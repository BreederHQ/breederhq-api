// src/routes/portal-scheduling.ts
// Portal scheduling endpoints for client booking flow
// All endpoints enforce requireClientPartyScope for party-based data isolation
//
// Endpoints:
// GET  /api/v1/portal/scheduling/events/:eventId         - Get event context, rules, and status
// GET  /api/v1/portal/scheduling/events/:eventId/slots   - List available slots
// POST /api/v1/portal/scheduling/events/:eventId/book    - Book a slot (atomic)
// POST /api/v1/portal/scheduling/events/:eventId/cancel  - Cancel existing booking
// POST /api/v1/portal/scheduling/events/:eventId/reschedule - Reschedule to new slot

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";

// ---------- Types matching frontend contract ----------

interface SchedulingEventContext {
  eventId: string;
  eventType: string;
  breederName: string;
  breederId: number;
  subjectName: string | null;
  subjectType: "offspring" | "placement" | "agreement" | "transaction" | null;
  subjectId: number | null;
}

interface BookingRules {
  canCancel: boolean;
  canReschedule: boolean;
  cancellationDeadlineHours: number | null;
  rescheduleDeadlineHours: number | null;
}

interface SchedulingEventStatus {
  isOpen: boolean;
  isEligible: boolean;
  eligibilityReason: string | null;
  hasExistingBooking: boolean;
  existingBooking: ConfirmedBooking | null;
}

interface SchedulingSlot {
  slotId: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  mode: "in_person" | "virtual" | null;
}

interface ConfirmedBooking {
  bookingId: string;
  eventId: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  mode: "in_person" | "virtual" | null;
  confirmedAt: string;
  nextSteps: string | null;
}

interface SchedulingEventResponse {
  context: SchedulingEventContext;
  rules: BookingRules;
  eventStatus: SchedulingEventStatus;
}

// ---------- Helpers ----------

/**
 * Map database slot mode to frontend format
 */
function mapSlotMode(mode: string | null): "in_person" | "virtual" | null {
  if (!mode) return null;
  if (mode === "IN_PERSON") return "in_person";
  if (mode === "VIRTUAL") return "virtual";
  return null;
}

/**
 * Parse eventId to determine if it's a template or block reference
 * Format: "template:<id>" or "block:<id>"
 */
function parseEventId(eventId: string): { type: "template" | "block"; id: number } | null {
  const match = eventId.match(/^(template|block):(\d+)$/);
  if (!match) return null;
  return { type: match[1] as "template" | "block", id: parseInt(match[2], 10) };
}

/**
 * Check if a booking can be cancelled based on rules and deadlines
 */
function canCancelBooking(booking: any, rules: BookingRules): { allowed: boolean; reason?: string } {
  if (!rules.canCancel) {
    return { allowed: false, reason: "Cancellation is not allowed for this event" };
  }

  if (rules.cancellationDeadlineHours !== null) {
    const slot = booking.slot;
    const hoursUntilStart = (new Date(slot.startsAt).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilStart < rules.cancellationDeadlineHours) {
      return { allowed: false, reason: `Cancellation must be made at least ${rules.cancellationDeadlineHours} hours before the appointment` };
    }
  }

  return { allowed: true };
}

/**
 * Check if a booking can be rescheduled based on rules and deadlines
 */
function canRescheduleBooking(booking: any, rules: BookingRules): { allowed: boolean; reason?: string } {
  if (!rules.canReschedule) {
    return { allowed: false, reason: "Rescheduling is not allowed for this event" };
  }

  if (rules.rescheduleDeadlineHours !== null) {
    const slot = booking.slot;
    const hoursUntilStart = (new Date(slot.startsAt).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilStart < rules.rescheduleDeadlineHours) {
      return { allowed: false, reason: `Rescheduling must be made at least ${rules.rescheduleDeadlineHours} hours before the appointment` };
    }
  }

  return { allowed: true };
}

/**
 * Format a booking record to ConfirmedBooking response
 */
function formatConfirmedBooking(booking: any): ConfirmedBooking {
  return {
    bookingId: String(booking.id),
    eventId: booking.eventId,
    slotId: String(booking.slotId),
    startsAt: booking.slot.startsAt.toISOString(),
    endsAt: booking.slot.endsAt.toISOString(),
    location: booking.slot.location,
    mode: mapSlotMode(booking.slot.mode),
    confirmedAt: booking.bookedAt.toISOString(),
    nextSteps: booking.nextSteps,
  };
}

// ---------- Routes ----------

const portalSchedulingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/portal/scheduling/events/:eventId
   * Returns event context, rules, and current booking status for the client
   */
  app.get<{ Params: { eventId: string } }>("/portal/scheduling/events/:eventId", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const { eventId } = req.params;

      const parsed = parseEventId(eventId);
      if (!parsed) {
        return reply.code(400).send({ error: "invalid_event_id" });
      }

      let template: any = null;
      let block: any = null;

      if (parsed.type === "template") {
        template = await prisma.schedulingEventTemplate.findFirst({
          where: { id: parsed.id, tenantId },
          include: {
            tenant: { select: { id: true, name: true } },
            offspring: { select: { id: true, name: true } },
          },
        });
        if (!template) {
          return reply.code(404).send({ error: "event_not_found" });
        }
      } else {
        block = await prisma.schedulingAvailabilityBlock.findFirst({
          where: { id: parsed.id, tenantId },
          include: {
            tenant: { select: { id: true, name: true } },
            template: {
              include: {
                offspring: { select: { id: true, name: true } },
              },
            },
          },
        });
        if (!block) {
          return reply.code(404).send({ error: "event_not_found" });
        }
        template = block.template;
      }

      // Get the effective rules (block overrides template)
      const effectiveRules: BookingRules = {
        canCancel: block?.canCancel ?? template?.canCancel ?? true,
        canReschedule: block?.canReschedule ?? template?.canReschedule ?? true,
        cancellationDeadlineHours: block?.cancellationDeadlineHours ?? template?.cancellationDeadlineHours ?? null,
        rescheduleDeadlineHours: block?.rescheduleDeadlineHours ?? template?.rescheduleDeadlineHours ?? null,
      };

      // Check for existing booking
      const existingBooking = await prisma.schedulingBooking.findFirst({
        where: {
          tenantId,
          partyId,
          eventId,
          status: "CONFIRMED",
        },
        include: {
          slot: true,
        },
      });

      // Determine subject context
      let subjectName: string | null = null;
      let subjectType: "offspring" | "placement" | "agreement" | "transaction" | null = null;
      let subjectId: number | null = null;

      if (template?.offspring) {
        subjectName = template.offspring.name;
        subjectType = "offspring";
        subjectId = template.offspring.id;
      } else if (template?.subjectType) {
        subjectType = template.subjectType as any;
      }

      // Determine if event is open
      const eventStatus = block?.status ?? template?.status ?? "OPEN";
      const isOpen = eventStatus === "OPEN";

      // Build response
      const response: SchedulingEventResponse = {
        context: {
          eventId,
          eventType: template?.eventType ?? "appointment",
          breederName: block?.tenant?.name ?? template?.tenant?.name ?? "Breeder",
          breederId: tenantId,
          subjectName,
          subjectType,
          subjectId,
        },
        rules: effectiveRules,
        eventStatus: {
          isOpen,
          isEligible: true, // For MVP, all portal clients are eligible
          eligibilityReason: null,
          hasExistingBooking: !!existingBooking,
          existingBooking: existingBooking ? formatConfirmedBooking(existingBooking) : null,
        },
      };

      return reply.send(response);
    } catch (err: any) {
      if (err.statusCode) {
        return reply.code(err.statusCode).send({ error: err.error });
      }
      req.log?.error?.({ err }, "Failed to get scheduling event");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /api/v1/portal/scheduling/events/:eventId/slots
   * Returns available slots for booking
   */
  app.get<{ Params: { eventId: string } }>("/portal/scheduling/events/:eventId/slots", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const { eventId } = req.params;

      const parsed = parseEventId(eventId);
      if (!parsed) {
        return reply.code(400).send({ error: "invalid_event_id" });
      }

      // Build slot query based on event type
      let blockIds: number[] = [];

      if (parsed.type === "template") {
        // Get all open blocks for this template
        const blocks = await prisma.schedulingAvailabilityBlock.findMany({
          where: {
            tenantId,
            templateId: parsed.id,
            status: "OPEN",
          },
          select: { id: true },
        });
        blockIds = blocks.map((b) => b.id);
      } else {
        // Single block
        const block = await prisma.schedulingAvailabilityBlock.findFirst({
          where: { id: parsed.id, tenantId, status: "OPEN" },
          select: { id: true },
        });
        if (block) {
          blockIds = [block.id];
        }
      }

      if (blockIds.length === 0) {
        return reply.send({ slots: [] });
      }

      // Get available slots (future, not full)
      const now = new Date();
      const slots = await prisma.schedulingSlot.findMany({
        where: {
          tenantId,
          blockId: { in: blockIds },
          status: "AVAILABLE",
          startsAt: { gt: now },
        },
        orderBy: { startsAt: "asc" },
      });

      // Check if party already has a booking for any of these slots
      const existingBookings = await prisma.schedulingBooking.findMany({
        where: {
          tenantId,
          partyId,
          slotId: { in: slots.map((s) => s.id) },
          status: "CONFIRMED",
        },
        select: { slotId: true },
      });
      const bookedSlotIds = new Set(existingBookings.map((b) => b.slotId));

      // Filter out slots the party has already booked
      const availableSlots = slots.filter((s) => !bookedSlotIds.has(s.id));

      const formattedSlots: SchedulingSlot[] = availableSlots.map((slot) => ({
        slotId: String(slot.id),
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        location: slot.location,
        mode: mapSlotMode(slot.mode),
      }));

      return reply.send({ slots: formattedSlots });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.code(err.statusCode).send({ error: err.error });
      }
      req.log?.error?.({ err }, "Failed to list scheduling slots");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * POST /api/v1/portal/scheduling/events/:eventId/book
   * Book a slot atomically with capacity check
   * Body: { slotId: string }
   */
  app.post<{ Params: { eventId: string }; Body: { slotId?: string } }>(
    "/portal/scheduling/events/:eventId/book",
    async (req, reply) => {
      try {
        const { tenantId, partyId } = await requireClientPartyScope(req);
        const { eventId } = req.params;
        const { slotId: slotIdStr } = req.body || {};

        if (!slotIdStr) {
          return reply.code(400).send({ error: "slot_id_required" });
        }

        const slotId = parseInt(slotIdStr, 10);
        if (isNaN(slotId)) {
          return reply.code(400).send({ error: "invalid_slot_id" });
        }

        const parsed = parseEventId(eventId);
        if (!parsed) {
          return reply.code(400).send({ error: "invalid_event_id" });
        }

        // Atomic booking transaction
        const result = await prisma.$transaction(async (tx) => {
          // 1. Lock the slot row (SELECT FOR UPDATE via raw query)
          const lockedSlots = await tx.$queryRaw<any[]>`
            SELECT id, "tenantId", "blockId", "startsAt", "endsAt", capacity, "bookedCount", status, mode, location
            FROM "SchedulingSlot"
            WHERE id = ${slotId} AND "tenantId" = ${tenantId}
            FOR UPDATE
          `;

          if (lockedSlots.length === 0) {
            throw { code: "SLOT_NOT_FOUND" };
          }

          const slot = lockedSlots[0];

          // 2. Verify slot is still available
          if (slot.status !== "AVAILABLE") {
            throw { code: "SLOT_NOT_AVAILABLE" };
          }

          // 3. Check capacity
          const confirmedCount = await tx.schedulingBooking.count({
            where: { slotId, status: "CONFIRMED" },
          });

          if (confirmedCount >= slot.capacity) {
            throw { code: "SLOT_FULL" };
          }

          // 4. Check if party already has a booking for this event
          const existingEventBooking = await tx.schedulingBooking.findFirst({
            where: {
              tenantId,
              partyId,
              eventId,
              status: "CONFIRMED",
            },
          });

          if (existingEventBooking) {
            throw { code: "ALREADY_BOOKED" };
          }

          // 5. Get next steps text from block/template
          const block = await tx.schedulingAvailabilityBlock.findUnique({
            where: { id: slot.blockId },
            include: { template: true },
          });

          const nextSteps = block?.nextStepsText ?? block?.template?.nextStepsText ?? null;

          // 6. Create booking
          const booking = await tx.schedulingBooking.create({
            data: {
              tenantId,
              slotId,
              partyId,
              eventId,
              status: "CONFIRMED",
              bookedAt: new Date(),
              nextSteps,
            },
            include: { slot: true },
          });

          // 7. Update slot bookedCount
          const newBookedCount = confirmedCount + 1;
          const newStatus = newBookedCount >= slot.capacity ? "FULL" : "AVAILABLE";

          await tx.schedulingSlot.update({
            where: { id: slotId },
            data: {
              bookedCount: newBookedCount,
              status: newStatus,
            },
          });

          return booking;
        });

        return reply.send({ booking: formatConfirmedBooking(result) });
      } catch (err: any) {
        if (err.code === "SLOT_NOT_FOUND") {
          return reply.code(404).send({ error: "slot_not_found", message: "Slot not found" });
        }
        if (err.code === "SLOT_NOT_AVAILABLE") {
          return reply.code(409).send({ error: "slot_taken", message: "This time slot is no longer available." });
        }
        if (err.code === "SLOT_FULL") {
          return reply.code(409).send({ error: "slot_taken", message: "This time slot is no longer available." });
        }
        if (err.code === "ALREADY_BOOKED") {
          return reply.code(409).send({ error: "already_booked", message: "You already have a booking for this event." });
        }
        if (err.statusCode) {
          return reply.code(err.statusCode).send({ error: err.error });
        }
        req.log?.error?.({ err }, "Failed to book slot");
        return reply.code(500).send({ error: "booking_failed" });
      }
    }
  );

  /**
   * POST /api/v1/portal/scheduling/events/:eventId/cancel
   * Cancel existing booking
   */
  app.post<{ Params: { eventId: string } }>("/portal/scheduling/events/:eventId/cancel", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const { eventId } = req.params;

      const parsed = parseEventId(eventId);
      if (!parsed) {
        return reply.code(400).send({ error: "invalid_event_id" });
      }

      // Find existing booking
      const booking = await prisma.schedulingBooking.findFirst({
        where: {
          tenantId,
          partyId,
          eventId,
          status: "CONFIRMED",
        },
        include: {
          slot: {
            include: {
              block: {
                include: { template: true },
              },
            },
          },
        },
      });

      if (!booking) {
        return reply.code(404).send({ error: "booking_not_found" });
      }

      // Get rules
      const block = booking.slot.block;
      const template = block.template;
      const rules: BookingRules = {
        canCancel: block.canCancel ?? template?.canCancel ?? true,
        canReschedule: block.canReschedule ?? template?.canReschedule ?? true,
        cancellationDeadlineHours: block.cancellationDeadlineHours ?? template?.cancellationDeadlineHours ?? null,
        rescheduleDeadlineHours: block.rescheduleDeadlineHours ?? template?.rescheduleDeadlineHours ?? null,
      };

      // Check if cancellation is allowed
      const cancelCheck = canCancelBooking(booking, rules);
      if (!cancelCheck.allowed) {
        return reply.code(403).send({ error: "not_allowed", message: cancelCheck.reason });
      }

      // Cancel the booking atomically
      await prisma.$transaction(async (tx) => {
        // Update booking status
        await tx.schedulingBooking.update({
          where: { id: booking.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
          },
        });

        // Decrement slot bookedCount and restore availability if needed
        const slot = await tx.schedulingSlot.findUnique({
          where: { id: booking.slotId },
        });

        if (slot) {
          const newBookedCount = Math.max(0, slot.bookedCount - 1);
          await tx.schedulingSlot.update({
            where: { id: booking.slotId },
            data: {
              bookedCount: newBookedCount,
              status: newBookedCount < slot.capacity ? "AVAILABLE" : "FULL",
            },
          });
        }
      });

      return reply.send({ cancelled: true });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.code(err.statusCode).send({ error: err.error });
      }
      req.log?.error?.({ err }, "Failed to cancel booking");
      return reply.code(500).send({ error: "cancel_failed" });
    }
  });

  /**
   * POST /api/v1/portal/scheduling/events/:eventId/reschedule
   * Reschedule to a new slot (atomic cancel + book)
   * Body: { slotId: string }
   */
  app.post<{ Params: { eventId: string }; Body: { slotId?: string } }>(
    "/portal/scheduling/events/:eventId/reschedule",
    async (req, reply) => {
      try {
        const { tenantId, partyId } = await requireClientPartyScope(req);
        const { eventId } = req.params;
        const { slotId: newSlotIdStr } = req.body || {};

        if (!newSlotIdStr) {
          return reply.code(400).send({ error: "slot_id_required" });
        }

        const newSlotId = parseInt(newSlotIdStr, 10);
        if (isNaN(newSlotId)) {
          return reply.code(400).send({ error: "invalid_slot_id" });
        }

        const parsed = parseEventId(eventId);
        if (!parsed) {
          return reply.code(400).send({ error: "invalid_event_id" });
        }

        // Find existing booking
        const existingBooking = await prisma.schedulingBooking.findFirst({
          where: {
            tenantId,
            partyId,
            eventId,
            status: "CONFIRMED",
          },
          include: {
            slot: {
              include: {
                block: {
                  include: { template: true },
                },
              },
            },
          },
        });

        if (!existingBooking) {
          return reply.code(404).send({ error: "booking_not_found" });
        }

        // Get rules
        const block = existingBooking.slot.block;
        const template = block.template;
        const rules: BookingRules = {
          canCancel: block.canCancel ?? template?.canCancel ?? true,
          canReschedule: block.canReschedule ?? template?.canReschedule ?? true,
          cancellationDeadlineHours: block.cancellationDeadlineHours ?? template?.cancellationDeadlineHours ?? null,
          rescheduleDeadlineHours: block.rescheduleDeadlineHours ?? template?.rescheduleDeadlineHours ?? null,
        };

        // Check if rescheduling is allowed
        const rescheduleCheck = canRescheduleBooking(existingBooking, rules);
        if (!rescheduleCheck.allowed) {
          return reply.code(403).send({ error: "not_allowed", message: rescheduleCheck.reason });
        }

        // Atomic reschedule transaction
        const result = await prisma.$transaction(async (tx) => {
          // 1. Lock the new slot (SELECT FOR UPDATE)
          const lockedSlots = await tx.$queryRaw<any[]>`
            SELECT id, "tenantId", "blockId", "startsAt", "endsAt", capacity, "bookedCount", status, mode, location
            FROM "SchedulingSlot"
            WHERE id = ${newSlotId} AND "tenantId" = ${tenantId}
            FOR UPDATE
          `;

          if (lockedSlots.length === 0) {
            throw { code: "SLOT_NOT_FOUND" };
          }

          const newSlot = lockedSlots[0];

          // 2. Verify new slot is available
          if (newSlot.status !== "AVAILABLE") {
            throw { code: "SLOT_NOT_AVAILABLE" };
          }

          // 3. Check new slot capacity
          const newSlotConfirmedCount = await tx.schedulingBooking.count({
            where: { slotId: newSlotId, status: "CONFIRMED" },
          });

          if (newSlotConfirmedCount >= newSlot.capacity) {
            throw { code: "SLOT_FULL" };
          }

          // 4. Mark old booking as RESCHEDULED
          await tx.schedulingBooking.update({
            where: { id: existingBooking.id },
            data: {
              status: "RESCHEDULED",
              rescheduledAt: new Date(),
            },
          });

          // 5. Restore old slot capacity
          const oldSlot = await tx.schedulingSlot.findUnique({
            where: { id: existingBooking.slotId },
          });
          if (oldSlot) {
            const oldNewBookedCount = Math.max(0, oldSlot.bookedCount - 1);
            await tx.schedulingSlot.update({
              where: { id: existingBooking.slotId },
              data: {
                bookedCount: oldNewBookedCount,
                status: oldNewBookedCount < oldSlot.capacity ? "AVAILABLE" : "FULL",
              },
            });
          }

          // 6. Get next steps text
          const newBlock = await tx.schedulingAvailabilityBlock.findUnique({
            where: { id: newSlot.blockId },
            include: { template: true },
          });
          const nextSteps = newBlock?.nextStepsText ?? newBlock?.template?.nextStepsText ?? existingBooking.nextSteps;

          // 7. Create new booking with rescheduledFrom link
          const newBooking = await tx.schedulingBooking.create({
            data: {
              tenantId,
              slotId: newSlotId,
              partyId,
              eventId,
              status: "CONFIRMED",
              bookedAt: new Date(),
              nextSteps,
              rescheduledFromId: existingBooking.id,
            },
            include: { slot: true },
          });

          // 8. Update new slot bookedCount
          const finalBookedCount = newSlotConfirmedCount + 1;
          await tx.schedulingSlot.update({
            where: { id: newSlotId },
            data: {
              bookedCount: finalBookedCount,
              status: finalBookedCount >= newSlot.capacity ? "FULL" : "AVAILABLE",
            },
          });

          return newBooking;
        });

        return reply.send({ booking: formatConfirmedBooking(result) });
      } catch (err: any) {
        if (err.code === "SLOT_NOT_FOUND") {
          return reply.code(404).send({ error: "slot_not_found", message: "Slot not found" });
        }
        if (err.code === "SLOT_NOT_AVAILABLE") {
          return reply.code(409).send({ error: "slot_taken", message: "This time slot is no longer available." });
        }
        if (err.code === "SLOT_FULL") {
          return reply.code(409).send({ error: "slot_taken", message: "This time slot is no longer available." });
        }
        if (err.statusCode) {
          return reply.code(err.statusCode).send({ error: err.error });
        }
        req.log?.error?.({ err }, "Failed to reschedule booking");
        return reply.code(500).send({ error: "reschedule_failed" });
      }
    }
  );
};

export default portalSchedulingRoutes;
