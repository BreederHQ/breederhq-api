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

      if (q.status) where.status = String(q.status).toUpperCase();
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
      if (q.status) where.status = String(q.status).toUpperCase();

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
      if (q.status) where.status = String(q.status).toUpperCase();

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
