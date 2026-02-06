// src/routes/breeding-bookings.ts
// Breeding Discovery: Booking workflow

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { generateBookingNumber } from "../utils/breeding-discovery-numbers.js";
import {
  breedingBookingCreateSchema,
  breedingBookingUpdateSchema,
  breedingBookingStatusSchema,
  breedingBookingRequirementsSchema,
} from "../validation/breeding-discovery.js";

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePaging(q: Record<string, unknown>) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 25) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

const bookingInclude = {
  offeringAnimal: {
    select: { id: true, name: true, species: true, sex: true, breed: true, photoUrl: true },
  },
  seekingAnimal: {
    select: { id: true, name: true, species: true, sex: true, breed: true, photoUrl: true },
  },
  seekingParty: {
    select: { id: true, name: true, email: true, phoneE164: true },
  },
  sourceListing: {
    select: { id: true, listingNumber: true, headline: true },
  },
  breedingPlan: {
    select: { id: true, code: true, status: true },
  },
  semenUsage: {
    select: { id: true, dosesUsed: true, usageDate: true, trackingNumber: true },
  },
};

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  INQUIRY: ["PENDING_REQUIREMENTS", "APPROVED", "CANCELLED"],
  PENDING_REQUIREMENTS: ["APPROVED", "CANCELLED"],
  APPROVED: ["DEPOSIT_PAID", "CANCELLED"],
  DEPOSIT_PAID: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const breedingBookingsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /breeding-bookings - List all bookings
  app.get("/breeding-bookings", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const q = (req.query || {}) as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(q);

      const where: any = {
        OR: [
          { offeringTenantId: tenantId },
          { seekingTenantId: tenantId },
        ],
      };

      if (q.status) {
        const statuses = String(q.status).toUpperCase().split(",").map((s) => s.trim()).filter(Boolean);
        where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
      }
      if (q.species) where.species = String(q.species).toUpperCase();

      const search = String(q.q || "").trim();
      if (search) {
        where.OR = [
          { bookingNumber: { contains: search, mode: "insensitive" } },
          { offeringAnimal: { name: { contains: search, mode: "insensitive" } } },
          { seekingAnimal: { name: { contains: search, mode: "insensitive" } } },
          { externalAnimalName: { contains: search, mode: "insensitive" } },
        ];
      }

      const [items, total] = await prisma.$transaction([
        prisma.breedingBooking.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: bookingInclude,
        }),
        prisma.breedingBooking.count({ where }),
      ]);

      reply.send({ items, total, page, limit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // GET /breeding-bookings/incoming - Bookings for my animals (I'm offering)
  app.get("/breeding-bookings/incoming", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const q = (req.query || {}) as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(q);

      const where: any = { offeringTenantId: tenantId };
      if (q.status) {
        const statuses = String(q.status).toUpperCase().split(",").map((s) => s.trim()).filter(Boolean);
        where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
      }

      const [items, total] = await prisma.$transaction([
        prisma.breedingBooking.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: bookingInclude,
        }),
        prisma.breedingBooking.count({ where }),
      ]);

      reply.send({ items, total, page, limit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // GET /breeding-bookings/outgoing - Bookings I'm requesting (I'm seeking)
  app.get("/breeding-bookings/outgoing", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const q = (req.query || {}) as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(q);

      const where: any = { seekingTenantId: tenantId };
      if (q.status) {
        const statuses = String(q.status).toUpperCase().split(",").map((s) => s.trim()).filter(Boolean);
        where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
      }

      const [items, total] = await prisma.$transaction([
        prisma.breedingBooking.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: bookingInclude,
        }),
        prisma.breedingBooking.count({ where }),
      ]);

      reply.send({ items, total, page, limit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /breeding-bookings - Create booking
  app.post("/breeding-bookings", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const parsed = breedingBookingCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }

      const data = parsed.data;

      // Verify offering animal exists and belongs to tenant
      const offeringAnimal = await prisma.animal.findFirst({
        where: { id: data.offeringAnimalId, tenantId },
        select: { id: true, species: true },
      });
      if (!offeringAnimal) return reply.code(404).send({ error: "offering_animal_not_found" });

      // Verify seeking party exists
      const seekingParty = await prisma.party.findFirst({
        where: { id: data.seekingPartyId },
        select: { id: true, tenantId: true },
      });
      if (!seekingParty) return reply.code(404).send({ error: "seeking_party_not_found" });

      // Verify seeking animal if provided
      if (data.seekingAnimalId) {
        const seekingAnimal = await prisma.animal.findFirst({
          where: { id: data.seekingAnimalId },
          select: { id: true, tenantId: true },
        });
        if (!seekingAnimal) return reply.code(404).send({ error: "seeking_animal_not_found" });
      }

      // Verify source listing if provided
      if (data.sourceListingId) {
        const listing = await prisma.breedingListing.findFirst({
          where: { id: data.sourceListingId, tenantId },
          select: { id: true },
        });
        if (!listing) return reply.code(404).send({ error: "source_listing_not_found" });
      }

      const bookingNumber = await generateBookingNumber();

      const booking = await prisma.breedingBooking.create({
        data: {
          bookingNumber,
          sourceListingId: data.sourceListingId ?? null,
          sourceInquiryId: data.sourceInquiryId ?? null,
          offeringTenantId: tenantId,
          offeringAnimalId: data.offeringAnimalId,
          seekingPartyId: data.seekingPartyId,
          seekingTenantId: data.seekingTenantId ?? null,
          seekingAnimalId: data.seekingAnimalId ?? null,
          externalAnimalName: data.externalAnimalName ?? null,
          externalAnimalReg: data.externalAnimalReg ?? null,
          externalAnimalBreed: data.externalAnimalBreed ?? null,
          externalAnimalSex: data.externalAnimalSex ?? null,
          species: data.species as any,
          bookingType: data.bookingType as any,
          preferredMethod: data.preferredMethod ?? null,
          preferredDateStart: data.preferredDateStart ? new Date(data.preferredDateStart) : null,
          preferredDateEnd: data.preferredDateEnd ? new Date(data.preferredDateEnd) : null,
          shippingRequired: data.shippingRequired ?? false,
          shippingAddress: data.shippingAddress ?? null,
          agreedFeeCents: data.agreedFeeCents,
          depositCents: data.depositCents ?? 0,
          feeDirection: data.feeDirection as any,
          guaranteeType: data.guaranteeType ?? null,
          notes: data.notes ?? null,
        },
        include: bookingInclude,
      });

      reply.code(201).send(booking);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // GET /breeding-bookings/:id - Get booking detail
  app.get("/breeding-bookings/:id", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const booking = await prisma.breedingBooking.findFirst({
        where: {
          id,
          OR: [
            { offeringTenantId: tenantId },
            { seekingTenantId: tenantId },
          ],
        },
        include: bookingInclude,
      });

      if (!booking) return reply.code(404).send({ error: "not_found" });
      reply.send(booking);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // PUT /breeding-bookings/:id - Update booking
  app.put("/breeding-bookings/:id", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingBooking.findFirst({
        where: {
          id,
          OR: [
            { offeringTenantId: tenantId },
            { seekingTenantId: tenantId },
          ],
        },
        select: { id: true, status: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const parsed = breedingBookingUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }

      const data = parsed.data;
      const updateData: any = {};

      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          if (["preferredDateStart", "preferredDateEnd", "scheduledDate"].includes(key)) {
            updateData[key] = value ? new Date(value as string) : null;
          } else {
            updateData[key] = value;
          }
        }
      }

      const updated = await prisma.breedingBooking.update({
        where: { id },
        data: updateData,
        include: bookingInclude,
      });

      reply.send(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /breeding-bookings/:id/status - Update status
  app.post("/breeding-bookings/:id/status", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingBooking.findFirst({
        where: {
          id,
          OR: [
            { offeringTenantId: tenantId },
            { seekingTenantId: tenantId },
          ],
        },
        select: { id: true, status: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const parsed = breedingBookingStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }

      const { status: newStatus, notes, scheduledDate, breedingPlanId, cancellationReason } = parsed.data;

      // Validate transition
      const validTransitions = VALID_STATUS_TRANSITIONS[existing.status];
      if (!validTransitions.includes(newStatus)) {
        return reply.code(400).send({
          error: "invalid_transition",
          message: `Cannot transition from ${existing.status} to ${newStatus}`,
          validTransitions,
        });
      }

      const updateData: any = {
        status: newStatus,
        statusChangedAt: new Date(),
      };

      if (newStatus === "SCHEDULED" && scheduledDate) {
        updateData.scheduledDate = new Date(scheduledDate);
      }

      if (newStatus === "IN_PROGRESS" && breedingPlanId) {
        updateData.breedingPlanId = breedingPlanId;
      }

      if (newStatus === "CANCELLED") {
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = cancellationReason ?? null;
      }

      const updated = await prisma.breedingBooking.update({
        where: { id },
        data: updateData,
        include: bookingInclude,
      });

      reply.send(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /breeding-bookings/:id/requirements - Update requirements
  app.post("/breeding-bookings/:id/requirements", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingBooking.findFirst({
        where: {
          id,
          offeringTenantId: tenantId, // Only offering party can update requirements
        },
        select: { id: true, requirements: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const parsed = breedingBookingRequirementsSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }

      const updated = await prisma.breedingBooking.update({
        where: { id },
        data: {
          requirements: parsed.data.requirements as any,
        },
        include: bookingInclude,
      });

      reply.send(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // GET /breeding-bookings/summary - Dashboard summary
  app.get("/breeding-bookings/summary", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      // Count by status (bookings where this tenant is offering)
      const statusCounts = await prisma.breedingBooking.groupBy({
        by: ["status"],
        where: { offeringTenantId: tenantId },
        _count: { id: true },
      });

      const byStatus: Record<string, number> = {
        INQUIRY: 0,
        PENDING_REQUIREMENTS: 0,
        APPROVED: 0,
        DEPOSIT_PAID: 0,
        CONFIRMED: 0,
        SCHEDULED: 0,
        IN_PROGRESS: 0,
        COMPLETED: 0,
        CANCELLED: 0,
      };
      for (const row of statusCounts) {
        byStatus[row.status] = row._count.id;
      }

      // Revenue totals (excluding cancelled)
      const revenueAgg = await prisma.breedingBooking.aggregate({
        where: { offeringTenantId: tenantId, status: { not: "CANCELLED" } },
        _sum: { agreedFeeCents: true, totalPaidCents: true },
      });

      const totalBookedCents = revenueAgg._sum.agreedFeeCents ?? 0;
      const totalPaidCents = revenueAgg._sum.totalPaidCents ?? 0;

      // Upcoming scheduled (next 7 days)
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(now.getDate() + 7);

      const upcoming = await prisma.breedingBooking.findMany({
        where: {
          offeringTenantId: tenantId,
          status: "SCHEDULED",
          scheduledDate: { gte: now, lte: sevenDaysFromNow },
        },
        orderBy: { scheduledDate: "asc" },
        take: 10,
        include: {
          offeringAnimal: { select: { name: true } },
          seekingAnimal: { select: { name: true } },
        },
      });

      // Stale bookings (no update for 5+ days)
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(now.getDate() - 5);

      const staleBookings = await prisma.breedingBooking.findMany({
        where: {
          offeringTenantId: tenantId,
          status: { in: ["INQUIRY", "PENDING_REQUIREMENTS", "APPROVED"] },
          updatedAt: { lt: fiveDaysAgo },
        },
        orderBy: { updatedAt: "asc" },
        take: 10,
        select: { id: true, bookingNumber: true, status: true, updatedAt: true },
      });

      reply.send({
        byStatus,
        revenue: {
          totalBookedCents,
          totalPaidCents,
          outstandingCents: totalBookedCents - totalPaidCents,
        },
        upcoming: upcoming.map((b) => ({
          bookingId: b.id,
          bookingNumber: b.bookingNumber,
          offeringAnimalName: b.offeringAnimal?.name ?? "Unknown",
          seekingAnimalName: b.seekingAnimal?.name ?? b.externalAnimalName ?? "Unknown",
          scheduledDate: b.scheduledDate?.toISOString() ?? null,
        })),
        requiresAttention: staleBookings.map((b) => ({
          bookingId: b.id,
          bookingNumber: b.bookingNumber,
          reason:
            b.status === "INQUIRY"
              ? "Inquiry stale"
              : b.status === "PENDING_REQUIREMENTS"
              ? "Requirements pending"
              : "Awaiting deposit",
          daysSinceUpdate: Math.floor(
            (now.getTime() - b.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
          ),
        })),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // GET /breeding-bookings/calendar - Calendar view
  app.get("/breeding-bookings/calendar", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const q = (req.query || {}) as Record<string, unknown>;
      const startDate = String(q.startDate || "");
      const endDate = String(q.endDate || "");
      if (!startDate || !endDate) {
        return reply.code(400).send({ error: "missing_date_range" });
      }

      const where: any = {
        offeringTenantId: tenantId,
        scheduledDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      };

      const animalId = q.offeringAnimalId ? parseIntStrict(q.offeringAnimalId) : null;
      if (animalId) where.offeringAnimalId = animalId;

      const bookings = await prisma.breedingBooking.findMany({
        where,
        orderBy: { scheduledDate: "asc" },
        include: {
          offeringAnimal: { select: { name: true } },
          seekingAnimal: { select: { name: true } },
          seekingParty: { select: { name: true } },
        },
      });

      // Group by date
      const byDate: Record<string, any[]> = {};
      for (const b of bookings) {
        const date = b.scheduledDate?.toISOString().split("T")[0] ?? "";
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push({
          bookingId: b.id,
          bookingNumber: b.bookingNumber,
          offeringAnimalName: b.offeringAnimal?.name ?? "Unknown",
          seekingAnimalName: b.seekingAnimal?.name ?? b.externalAnimalName ?? "Unknown",
          seekingPartyName: b.seekingParty?.name ?? "Unknown",
          status: b.status,
          method: b.preferredMethod,
        });
      }

      reply.send(
        Object.entries(byDate).map(([date, bookings]) => ({ date, bookings }))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /breeding-bookings/:id/payment - Record a payment
  app.post("/breeding-bookings/:id/payment", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const body = (req.body || {}) as any;
      const amountCents = Number(body.amountCents);
      if (!amountCents || amountCents <= 0) {
        return reply.code(400).send({ error: "invalid_amount" });
      }

      const existing = await prisma.breedingBooking.findFirst({
        where: { id, offeringTenantId: tenantId },
        select: { id: true, status: true, agreedFeeCents: true, depositCents: true, totalPaidCents: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const newTotalPaid = existing.totalPaidCents + amountCents;
      const updateData: any = { totalPaidCents: newTotalPaid };

      // Auto-transitions based on payment thresholds
      if (
        existing.status === "APPROVED" &&
        newTotalPaid >= existing.depositCents &&
        existing.depositCents > 0
      ) {
        updateData.status = "DEPOSIT_PAID";
        updateData.statusChangedAt = new Date();
      }

      if (
        (existing.status === "DEPOSIT_PAID" || updateData.status === "DEPOSIT_PAID") &&
        newTotalPaid >= existing.agreedFeeCents
      ) {
        updateData.status = "CONFIRMED";
        updateData.statusChangedAt = new Date();
      }

      const updated = await prisma.breedingBooking.update({
        where: { id },
        data: updateData,
        include: bookingInclude,
      });

      reply.send({
        success: true,
        booking: updated,
        totalPaidCents: newTotalPaid,
        balanceDueCents: Math.max(0, existing.agreedFeeCents - newTotalPaid),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /breeding-bookings/:id/start-breeding - Create BreedingPlan and transition
  app.post("/breeding-bookings/:id/start-breeding", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingBooking.findFirst({
        where: { id, offeringTenantId: tenantId },
        include: {
          offeringAnimal: { select: { id: true, name: true, species: true } },
          seekingAnimal: { select: { id: true, name: true } },
        },
      });

      if (!existing) return reply.code(404).send({ error: "not_found" });
      if (existing.status !== "SCHEDULED") {
        return reply.code(400).send({
          error: "invalid_status",
          message: "Can only start breeding from SCHEDULED status",
        });
      }

      const body = (req.body || {}) as any;
      const breedingDate = body.breedingDate
        ? new Date(body.breedingDate)
        : existing.scheduledDate ?? new Date();

      const [plan, updated] = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.findFirst({
          where: { tenantId },
          select: { id: true },
        });
        if (!org) throw new Error("No organization found for tenant");

        const offeringName = existing.offeringAnimal?.name ?? "Unknown";
        const seekingName = existing.seekingAnimal?.name ?? existing.externalAnimalName ?? "Unknown";

        const plan = await tx.breedingPlan.create({
          data: {
            tenantId,
            organizationId: org.id,
            code: `BP-${existing.bookingNumber}`,
            name: `${seekingName} x ${offeringName}`,
            species: existing.offeringAnimal?.species ?? existing.species,
            status: "BRED",
            damId: existing.seekingAnimalId ?? null,
            sireId: existing.offeringAnimalId,
            notes: body.notes ?? `From booking ${existing.bookingNumber}`,
          },
        });

        const u = await tx.breedingBooking.update({
          where: { id },
          data: {
            status: "IN_PROGRESS",
            statusChangedAt: new Date(),
            breedingPlanId: plan.id,
          },
          include: bookingInclude,
        });

        return [plan, u];
      });

      // Auto-create BreedingEvent records for both animals when breeding starts via marketplace
      try {
        const userId = (req as any).user?.id ?? "system";
        const breedingDate = body.breedingDate
          ? new Date(body.breedingDate)
          : existing.scheduledDate ?? new Date();

        const eventsToCreate: Array<{
          tenantId: number;
          animalId: number;
          eventType: string;
          occurredAt: Date;
          outcome: string;
          breedingPlanId: number;
          partnerAnimalId?: number;
          title: string;
          description: string;
          createdBy: string;
        }> = [];

        // Create event for offering animal (sire)
        if (existing.offeringAnimalId) {
          eventsToCreate.push({
            tenantId,
            animalId: existing.offeringAnimalId,
            eventType: "BREEDING_ATTEMPT",
            occurredAt: breedingDate,
            outcome: "PENDING",
            breedingPlanId: plan.id,
            partnerAnimalId: existing.seekingAnimalId ?? undefined,
            title: `Marketplace breeding - ${existing.bookingNumber}`,
            description: `Auto-recorded from marketplace booking start`,
            createdBy: userId,
          });
        }

        // Create event for seeking animal (dam) if it's a platform animal
        if (existing.seekingAnimalId) {
          eventsToCreate.push({
            tenantId: existing.seekingTenantId ?? tenantId,
            animalId: existing.seekingAnimalId,
            eventType: "BREEDING_ATTEMPT",
            occurredAt: breedingDate,
            outcome: "PENDING",
            breedingPlanId: plan.id,
            partnerAnimalId: existing.offeringAnimalId ?? undefined,
            title: `Marketplace breeding - ${existing.bookingNumber}`,
            description: `Auto-recorded from marketplace booking start`,
            createdBy: userId,
          });
        }

        if (eventsToCreate.length > 0) {
          await prisma.breedingEvent.createMany({ data: eventsToCreate });
          console.log(`[breeding-bookings] Auto-created ${eventsToCreate.length} BreedingEvent records for booking ${existing.bookingNumber}`);
        }
      } catch (eventErr) {
        // Log but don't fail - event creation is secondary
        console.warn("[breeding-bookings] Failed to auto-create BreedingEvent records:", eventErr);
      }

      reply.send({
        success: true,
        booking: updated,
        breedingPlan: { id: plan.id, status: plan.status },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /breeding-bookings/:id/ship-semen - Ship semen for booking
  app.post("/breeding-bookings/:id/ship-semen", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const body = (req.body || {}) as any;
      const inventoryId = parseIntStrict(body.inventoryId);
      if (!inventoryId) return reply.code(400).send({ error: "missing_inventory_id" });
      const dosesUsed = Number(body.dosesUsed) || 1;

      const existing = await prisma.breedingBooking.findFirst({
        where: { id, offeringTenantId: tenantId },
        select: {
          id: true,
          bookingNumber: true,
          shippingRequired: true,
          shippingAddress: true,
          externalAnimalName: true,
          seekingPartyId: true,
        },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });
      if (!existing.shippingRequired) {
        return reply.code(400).send({ error: "shipping_not_required" });
      }

      const inventory = await prisma.semenInventory.findFirst({
        where: { id: inventoryId, tenantId },
      });
      if (!inventory) return reply.code(404).send({ error: "inventory_not_found" });
      if (inventory.availableDoses < dosesUsed) {
        return reply.code(400).send({
          error: "insufficient_doses",
          available: inventory.availableDoses,
          requested: dosesUsed,
        });
      }

      const [usage, updated] = await prisma.$transaction(async (tx) => {
        await tx.semenInventory.update({
          where: { id: inventoryId },
          data: {
            availableDoses: { decrement: dosesUsed },
            status: inventory.availableDoses - dosesUsed === 0 ? "DEPLETED" : inventory.status,
          },
        });

        const usage = await tx.semenUsage.create({
          data: {
            tenantId,
            inventoryId,
            usageType: "BREEDING_SHIPPED",
            usageDate: new Date(),
            dosesUsed,
            shippedToAddress: existing.shippingAddress,
            shippingCarrier: body.shippingCarrier ?? null,
            trackingNumber: body.trackingNumber ?? null,
            notes: `Shipped for booking ${existing.bookingNumber}`,
          },
        });

        const u = await tx.breedingBooking.update({
          where: { id },
          data: { semenUsageId: usage.id },
          include: bookingInclude,
        });

        return [usage, u];
      });

      reply.send({
        success: true,
        booking: updated,
        semenUsage: {
          id: usage.id,
          dosesUsed: usage.dosesUsed,
          trackingNumber: usage.trackingNumber,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // DELETE /breeding-bookings/:id - Delete booking (only INQUIRY or CANCELLED)
  app.delete("/breeding-bookings/:id", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingBooking.findFirst({
        where: {
          id,
          OR: [
            { offeringTenantId: tenantId },
            { seekingTenantId: tenantId },
          ],
        },
        select: { id: true, status: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      if (!["INQUIRY", "CANCELLED"].includes(existing.status)) {
        return reply.code(400).send({
          error: "cannot_delete",
          message: "Can only delete bookings in INQUIRY or CANCELLED status",
        });
      }

      await prisma.breedingBooking.delete({ where: { id } });
      reply.code(204).send();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /breeding-bookings/:id/cancel - Cancel booking
  app.post("/breeding-bookings/:id/cancel", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingBooking.findFirst({
        where: {
          id,
          OR: [
            { offeringTenantId: tenantId },
            { seekingTenantId: tenantId },
          ],
        },
        select: { id: true, status: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      if (existing.status === "CANCELLED") {
        return reply.code(400).send({ error: "already_cancelled" });
      }

      if (existing.status === "COMPLETED") {
        return reply.code(400).send({ error: "cannot_cancel_completed" });
      }

      const body = (req.body || {}) as any;
      const updated = await prisma.breedingBooking.update({
        where: { id },
        data: {
          status: "CANCELLED",
          statusChangedAt: new Date(),
          cancelledAt: new Date(),
          cancellationReason: body.reason ?? null,
        },
        include: bookingInclude,
      });

      reply.send(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-bookings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });
};

export default breedingBookingsRoutes;
