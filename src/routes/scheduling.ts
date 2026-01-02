// src/routes/scheduling.ts
// Staff-facing scheduling endpoints for calendar integration and block management
//
// Endpoints:
// GET  /api/v1/scheduling/blocks              - List availability blocks in date range
// POST /api/v1/scheduling/blocks              - Create block and generate slots
// GET  /api/v1/scheduling/blocks/:blockId     - Get block details
// GET  /api/v1/scheduling/blocks/:blockId/slots    - List slots for a block
// GET  /api/v1/scheduling/blocks/:blockId/bookings - List bookings for a block
// GET  /api/v1/scheduling/bookings            - List bookings in date range

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { parseVerifiedSession } from "../utils/session.js";

// ---------- Helpers ----------

function toNum(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function resolveTenantIdFromRequest(req: any): number | null {
  const h = req.headers || {};
  const headerTenant =
    toNum(h["x-tenant-id"]) ??
    toNum(h["X-Tenant-Id"]) ??
    toNum(h["x-tenantid"]) ??
    null;
  if (headerTenant) return headerTenant;

  const sess = parseVerifiedSession(req);
  if (sess?.tenantId) return sess.tenantId;

  const fromReq =
    toNum(req.tenantId) ??
    toNum(req.session?.tenantId) ??
    toNum(req.user?.tenantId) ??
    toNum(req.user?.defaultTenantId) ??
    null;
  if (fromReq) return fromReq;

  return null;
}

/**
 * Map database slot mode to API format
 */
function mapSlotMode(mode: string | null): "in_person" | "virtual" | null {
  if (!mode) return null;
  if (mode === "IN_PERSON") return "in_person";
  if (mode === "VIRTUAL") return "virtual";
  return null;
}

// ---------- Response Types ----------

interface AvailabilityBlockResponse {
  id: number;
  templateId: number | null;
  templateName: string | null;
  eventType: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  status: string;
  location: string | null;
  slotCount: number;
  bookedSlotCount: number;
}

interface BookingResponse {
  id: number;
  eventId: string;
  eventType: string | null;
  partyId: number;
  partyName: string;
  slotId: number;
  startsAt: string;
  endsAt: string;
  location: string | null;
  mode: "in_person" | "virtual" | null;
  status: string;
  bookedAt: string;
}

// Request body for creating a block
interface CreateBlockBody {
  templateId?: number;
  startAt: string;           // ISO datetime
  endAt: string;             // ISO datetime
  timezone: string;          // e.g., "America/New_York"
  slotIntervalMinutes: number;  // 30, 60, 90
  slotDurationMinutes: number;  // duration of each slot
  capacity: number;             // capacity per slot
  bufferBeforeMinutes?: number; // buffer before block starts
  bufferAfterMinutes?: number;  // buffer after block ends
  mode: "IN_PERSON" | "VIRTUAL";
  location?: string;
  nextStepsText?: string;
}

interface SlotResponse {
  id: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  status: string;
  mode: "in_person" | "virtual" | null;
  location: string | null;
}

interface BlockDetailResponse extends AvailabilityBlockResponse {
  slotIntervalMinutes: number | null;
  slotDurationMinutes: number | null;
  mode: "in_person" | "virtual" | null;
  bufferBeforeMinutes: number | null;
  bufferAfterMinutes: number | null;
  nextStepsText: string | null;
  canCancel: boolean | null;
  canReschedule: boolean | null;
}

// ---------- Slot Generation Logic ----------

/**
 * Generate slots for a block based on configuration
 * Rules:
 * - Effective window is block start + bufferBefore to block end - bufferAfter
 * - Slots walk forward by slotInterval
 * - Each slot lasts slotDuration minutes
 * - Do not generate slots that would exceed block end
 */
function generateSlots(config: {
  blockId: number;
  tenantId: number;
  startAt: Date;
  endAt: Date;
  slotIntervalMinutes: number;
  slotDurationMinutes: number;
  capacity: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  mode: "IN_PERSON" | "VIRTUAL";
  location: string | null;
}): Array<{
  tenantId: number;
  blockId: number;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  bookedCount: number;
  status: "AVAILABLE";
  mode: "IN_PERSON" | "VIRTUAL";
  location: string | null;
}> {
  const slots: Array<{
    tenantId: number;
    blockId: number;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    bookedCount: number;
    status: "AVAILABLE";
    mode: "IN_PERSON" | "VIRTUAL";
    location: string | null;
  }> = [];

  // Calculate effective window
  const effectiveStart = new Date(config.startAt.getTime() + config.bufferBeforeMinutes * 60 * 1000);
  const effectiveEnd = new Date(config.endAt.getTime() - config.bufferAfterMinutes * 60 * 1000);

  // Walk through the window generating slots
  let current = new Date(effectiveStart);

  while (current < effectiveEnd) {
    const slotEnd = new Date(current.getTime() + config.slotDurationMinutes * 60 * 1000);

    // Don't create slot if it would exceed effective end
    if (slotEnd > effectiveEnd) break;

    slots.push({
      tenantId: config.tenantId,
      blockId: config.blockId,
      startsAt: new Date(current),
      endsAt: slotEnd,
      capacity: config.capacity,
      bookedCount: 0,
      status: "AVAILABLE",
      mode: config.mode,
      location: config.location,
    });

    // Move to next slot start
    current = new Date(current.getTime() + config.slotIntervalMinutes * 60 * 1000);
  }

  return slots;
}

// ---------- Routes ----------

const schedulingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Enforce tenant context for all routes
  app.addHook("preHandler", async (req, reply) => {
    let tenantId: number | null = toNum((req as any).tenantId);
    if (!tenantId) {
      tenantId = resolveTenantIdFromRequest(req);
      if (tenantId) (req as any).tenantId = tenantId;
    }
    if (!tenantId) {
      return reply
        .code(400)
        .send({ message: "Missing or invalid tenant context (X-Tenant-Id or session tenant)" });
    }
  });

  /**
   * GET /api/v1/scheduling/blocks
   * List availability blocks in a date range for calendar rendering
   * Query params: from (ISO date), to (ISO date)
   */
  app.get<{ Querystring: { from?: string; to?: string } }>("/scheduling/blocks", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const { from, to } = req.query;

      // Default to current month if no range provided
      const now = new Date();
      const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
      const toDate = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return reply.code(400).send({ error: "invalid_date_range" });
      }

      // Fetch blocks that overlap with the date range
      const blocks = await prisma.schedulingAvailabilityBlock.findMany({
        where: {
          tenantId,
          OR: [
            // Block starts within range
            { startAt: { gte: fromDate, lte: toDate } },
            // Block ends within range
            { endAt: { gte: fromDate, lte: toDate } },
            // Block spans entire range
            { startAt: { lte: fromDate }, endAt: { gte: toDate } },
          ],
        },
        include: {
          template: {
            select: { id: true, name: true, eventType: true },
          },
          slots: {
            select: { id: true, status: true },
          },
        },
        orderBy: { startAt: "asc" },
      });

      const response: AvailabilityBlockResponse[] = blocks.map((block) => ({
        id: block.id,
        templateId: block.templateId,
        templateName: block.template?.name ?? null,
        eventType: block.template?.eventType ?? null,
        startAt: block.startAt.toISOString(),
        endAt: block.endAt.toISOString(),
        timezone: block.timezone,
        status: block.status,
        location: block.location,
        slotCount: block.slots.length,
        bookedSlotCount: block.slots.filter((s) => s.status === "FULL").length,
      }));

      return reply.send({ blocks: response });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list scheduling blocks");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * POST /api/v1/scheduling/blocks
   * Create a new availability block and generate slots
   */
  app.post<{ Body: CreateBlockBody }>("/scheduling/blocks", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const body = req.body;

      // Validate required fields
      if (!body.startAt || !body.endAt || !body.timezone) {
        return reply.code(400).send({ error: "missing_required_fields", message: "startAt, endAt, and timezone are required" });
      }

      if (!body.slotIntervalMinutes || !body.slotDurationMinutes || !body.capacity) {
        return reply.code(400).send({ error: "missing_required_fields", message: "slotIntervalMinutes, slotDurationMinutes, and capacity are required" });
      }

      if (!body.mode || !["IN_PERSON", "VIRTUAL"].includes(body.mode)) {
        return reply.code(400).send({ error: "invalid_mode", message: "mode must be IN_PERSON or VIRTUAL" });
      }

      const startAt = new Date(body.startAt);
      const endAt = new Date(body.endAt);

      if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
        return reply.code(400).send({ error: "invalid_dates", message: "Invalid startAt or endAt date format" });
      }

      if (endAt <= startAt) {
        return reply.code(400).send({ error: "invalid_date_range", message: "endAt must be after startAt" });
      }

      // Validate template if provided
      if (body.templateId) {
        const template = await prisma.schedulingEventTemplate.findFirst({
          where: { id: body.templateId, tenantId },
        });
        if (!template) {
          return reply.code(404).send({ error: "template_not_found" });
        }
      }

      const bufferBefore = body.bufferBeforeMinutes ?? 0;
      const bufferAfter = body.bufferAfterMinutes ?? 0;

      // Create block and slots in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create the block
        const block = await tx.schedulingAvailabilityBlock.create({
          data: {
            tenantId,
            templateId: body.templateId ?? null,
            startAt,
            endAt,
            timezone: body.timezone,
            status: "OPEN",
            location: body.location ?? null,
            nextStepsText: body.nextStepsText ?? null,
          },
        });

        // Generate slots
        const slotsData = generateSlots({
          blockId: block.id,
          tenantId,
          startAt,
          endAt,
          slotIntervalMinutes: body.slotIntervalMinutes,
          slotDurationMinutes: body.slotDurationMinutes,
          capacity: body.capacity,
          bufferBeforeMinutes: bufferBefore,
          bufferAfterMinutes: bufferAfter,
          mode: body.mode,
          location: body.location ?? null,
        });

        // Insert slots
        if (slotsData.length > 0) {
          await tx.schedulingSlot.createMany({ data: slotsData });
        }

        return { block, slotCount: slotsData.length };
      });

      return reply.code(201).send({
        block: {
          id: result.block.id,
          startAt: result.block.startAt.toISOString(),
          endAt: result.block.endAt.toISOString(),
          timezone: result.block.timezone,
          status: result.block.status,
          location: result.block.location,
        },
        slotCount: result.slotCount,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create scheduling block");
      return reply.code(500).send({ error: "failed_to_create" });
    }
  });

  /**
   * GET /api/v1/scheduling/blocks/:blockId
   * Get detailed information about a specific block
   */
  app.get<{ Params: { blockId: string } }>("/scheduling/blocks/:blockId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const blockId = parseInt(req.params.blockId, 10);

      if (isNaN(blockId)) {
        return reply.code(400).send({ error: "invalid_block_id" });
      }

      const block = await prisma.schedulingAvailabilityBlock.findFirst({
        where: { id: blockId, tenantId },
        include: {
          template: { select: { id: true, name: true, eventType: true } },
          slots: { select: { id: true, status: true, startsAt: true, endsAt: true, capacity: true, mode: true } },
        },
      });

      if (!block) {
        return reply.code(404).send({ error: "block_not_found" });
      }

      // Calculate slot interval and duration from first two slots if available
      let slotIntervalMinutes: number | null = null;
      let slotDurationMinutes: number | null = null;
      let mode: "in_person" | "virtual" | null = null;

      if (block.slots.length > 0) {
        const firstSlot = block.slots[0];
        slotDurationMinutes = Math.round((firstSlot.endsAt.getTime() - firstSlot.startsAt.getTime()) / (60 * 1000));
        mode = mapSlotMode(firstSlot.mode);

        if (block.slots.length > 1) {
          const secondSlot = block.slots[1];
          slotIntervalMinutes = Math.round((secondSlot.startsAt.getTime() - firstSlot.startsAt.getTime()) / (60 * 1000));
        }
      }

      const response: BlockDetailResponse = {
        id: block.id,
        templateId: block.templateId,
        templateName: block.template?.name ?? null,
        eventType: block.template?.eventType ?? null,
        startAt: block.startAt.toISOString(),
        endAt: block.endAt.toISOString(),
        timezone: block.timezone,
        status: block.status,
        location: block.location,
        slotCount: block.slots.length,
        bookedSlotCount: block.slots.filter((s) => s.status === "FULL").length,
        slotIntervalMinutes,
        slotDurationMinutes,
        mode,
        bufferBeforeMinutes: null, // Not stored, would need to calculate from first slot
        bufferAfterMinutes: null,
        nextStepsText: block.nextStepsText,
        canCancel: block.canCancel,
        canReschedule: block.canReschedule,
      };

      return reply.send(response);
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get scheduling block");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /api/v1/scheduling/blocks/:blockId/slots
   * List all slots for a specific block
   */
  app.get<{ Params: { blockId: string } }>("/scheduling/blocks/:blockId/slots", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const blockId = parseInt(req.params.blockId, 10);

      if (isNaN(blockId)) {
        return reply.code(400).send({ error: "invalid_block_id" });
      }

      // Verify block exists and belongs to tenant
      const block = await prisma.schedulingAvailabilityBlock.findFirst({
        where: { id: blockId, tenantId },
        select: { id: true },
      });

      if (!block) {
        return reply.code(404).send({ error: "block_not_found" });
      }

      const slots = await prisma.schedulingSlot.findMany({
        where: { blockId, tenantId },
        orderBy: { startsAt: "asc" },
      });

      const response: SlotResponse[] = slots.map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        capacity: slot.capacity,
        bookedCount: slot.bookedCount,
        status: slot.status,
        mode: mapSlotMode(slot.mode),
        location: slot.location,
      }));

      return reply.send({ slots: response });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list block slots");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /api/v1/scheduling/blocks/:blockId/bookings
   * List all bookings for slots in a specific block
   */
  app.get<{ Params: { blockId: string } }>("/scheduling/blocks/:blockId/bookings", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const blockId = parseInt(req.params.blockId, 10);

      if (isNaN(blockId)) {
        return reply.code(400).send({ error: "invalid_block_id" });
      }

      // Verify block exists and belongs to tenant
      const block = await prisma.schedulingAvailabilityBlock.findFirst({
        where: { id: blockId, tenantId },
        select: { id: true },
      });

      if (!block) {
        return reply.code(404).send({ error: "block_not_found" });
      }

      const bookings = await prisma.schedulingBooking.findMany({
        where: {
          tenantId,
          slot: { blockId },
        },
        include: {
          slot: true,
          party: { select: { id: true, name: true } },
        },
        orderBy: { slot: { startsAt: "asc" } },
      });

      const response: BookingResponse[] = bookings.map((booking) => ({
        id: booking.id,
        eventId: booking.eventId,
        eventType: null, // Would need to join through block->template
        partyId: booking.partyId,
        partyName: booking.party.name,
        slotId: booking.slotId,
        startsAt: booking.slot.startsAt.toISOString(),
        endsAt: booking.slot.endsAt.toISOString(),
        location: booking.slot.location,
        mode: mapSlotMode(booking.slot.mode),
        status: booking.status,
        bookedAt: booking.bookedAt.toISOString(),
      }));

      return reply.send({ bookings: response });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list block bookings");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  /**
   * GET /api/v1/scheduling/bookings
   * List confirmed bookings in a date range for calendar rendering
   * Query params: from (ISO date), to (ISO date)
   */
  app.get<{ Querystring: { from?: string; to?: string } }>("/scheduling/bookings", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const { from, to } = req.query;

      // Default to current month if no range provided
      const now = new Date();
      const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
      const toDate = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return reply.code(400).send({ error: "invalid_date_range" });
      }

      // Fetch bookings where the slot falls within the date range
      const bookings = await prisma.schedulingBooking.findMany({
        where: {
          tenantId,
          status: "CONFIRMED",
          slot: {
            startsAt: { gte: fromDate, lte: toDate },
          },
        },
        include: {
          slot: {
            include: {
              block: {
                include: {
                  template: { select: { eventType: true } },
                },
              },
            },
          },
          party: {
            select: { id: true, name: true },
          },
        },
        orderBy: { slot: { startsAt: "asc" } },
      });

      const response: BookingResponse[] = bookings.map((booking) => ({
        id: booking.id,
        eventId: booking.eventId,
        eventType: booking.slot.block.template?.eventType ?? null,
        partyId: booking.partyId,
        partyName: booking.party.name,
        slotId: booking.slotId,
        startsAt: booking.slot.startsAt.toISOString(),
        endsAt: booking.slot.endsAt.toISOString(),
        location: booking.slot.location,
        mode: mapSlotMode(booking.slot.mode),
        status: booking.status,
        bookedAt: booking.bookedAt.toISOString(),
      }));

      return reply.send({ bookings: response });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list scheduling bookings");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });
};

export default schedulingRoutes;
