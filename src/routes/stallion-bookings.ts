// src/routes/stallion-bookings.ts
// Stallion Booking Pipeline API (P8)
// Dedicated workflow for managing mare owner inquiries and stallion bookings

import type { FastifyInstance } from "fastify";
import prisma from "../prisma.js";

// Type definitions (matches Prisma schema enums)
type BookingStatus =
  | "INQUIRY"
  | "PENDING_REQUIREMENTS"
  | "APPROVED"
  | "DEPOSIT_PAID"
  | "CONFIRMED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type BreedingMethod = "NATURAL" | "AI_TCI" | "AI_SI" | "AI_FROZEN";
type BreedingGuaranteeType =
  | "NO_GUARANTEE"
  | "LIVE_FOAL"
  | "STANDS_AND_NURSES"
  | "SIXTY_DAY_PREGNANCY"
  | "CERTIFIED_PREGNANT";
type PaymentMethod = "cash" | "check" | "card" | "wire" | "other";

// ============================================================================
// Types
// ============================================================================

interface CreateBookingInput {
  serviceListingId: number;
  mareId?: number;
  externalMareName?: string;
  externalMareReg?: string;
  externalMareBreed?: string;
  mareOwnerPartyId: number;
  preferredMethod?: BreedingMethod;
  preferredDateStart?: string;
  preferredDateEnd?: string;
  shippingRequired?: boolean;
  shippingAddress?: string;
  agreedFeeCents?: number;
  bookingFeeCents?: number;
  guaranteeType?: BreedingGuaranteeType;
  notes?: string;
}

interface UpdateBookingInput {
  mareId?: number;
  externalMareName?: string;
  externalMareReg?: string;
  externalMareBreed?: string;
  preferredMethod?: BreedingMethod;
  preferredDateStart?: string;
  preferredDateEnd?: string;
  shippingRequired?: boolean;
  shippingAddress?: string;
  agreedFeeCents?: number;
  bookingFeeCents?: number;
  guaranteeType?: BreedingGuaranteeType;
  notes?: string;
  internalNotes?: string;
}

interface TransitionInput {
  toStatus: BookingStatus;
  notes?: string;
  scheduledDate?: string;
  breedingPlanId?: number;
  cancellationReason?: string;
}

interface RequirementsInput {
  healthCertReceived?: boolean;
  healthCertDate?: string;
  cogginsReceived?: boolean;
  cogginsDate?: string;
  cultureReceived?: boolean;
  cultureDate?: string;
  uterineExamReceived?: boolean;
  uterineExamDate?: string;
  notes?: string;
}

interface PaymentInput {
  amountCents: number;
  paymentMethod: PaymentMethod;
  paymentDate?: string;
  reference?: string;
  notes?: string;
}

interface StartBreedingInput {
  breedingDate?: string;
  notes?: string;
}

interface ShipSemenInput {
  inventoryId: number;
  dosesUsed?: number;
  shippingCarrier?: string;
  trackingNumber?: string;
}

// ============================================================================
// Valid Status Transitions
// ============================================================================

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
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

// ============================================================================
// Helpers
// ============================================================================

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePaging(q: Record<string, unknown>) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 50) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Generate a unique booking number for the tenant
 * Format: SB-YYYY-NNN (e.g., SB-2026-001)
 */
async function generateBookingNumber(tenantId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SB-${year}-`;

  const count = await prisma.stallionBooking.count({
    where: {
      tenantId,
      bookingNumber: { startsWith: prefix },
    },
  });

  const sequence = String(count + 1).padStart(3, "0");
  return `${prefix}${sequence}`;
}

function toBookingResponse(booking: any) {
  return {
    id: booking.id,
    tenantId: booking.tenantId,
    bookingNumber: booking.bookingNumber,
    serviceListingId: booking.serviceListingId,
    serviceListingTitle: booking.serviceListing?.title ?? null,
    stallionId: booking.stallionId,
    stallionName: booking.stallion?.name ?? null,
    stallionPhotoUrl: booking.stallion?.photoUrl ?? null,
    mareId: booking.mareId,
    mareName: booking.mare?.name ?? booking.externalMareName ?? null,
    marePhotoUrl: booking.mare?.photoUrl ?? null,
    externalMareName: booking.externalMareName,
    externalMareReg: booking.externalMareReg,
    externalMareBreed: booking.externalMareBreed,
    mareOwnerPartyId: booking.mareOwnerPartyId,
    mareOwnerName: booking.mareOwnerParty?.name ?? null,
    mareOwnerEmail: booking.mareOwnerParty?.email ?? null,
    mareOwnerPhone: booking.mareOwnerParty?.phoneE164 ?? null,
    status: booking.status,
    statusChangedAt: booking.statusChangedAt?.toISOString() ?? null,
    preferredMethod: booking.preferredMethod,
    preferredDateStart: booking.preferredDateStart?.toISOString() ?? null,
    preferredDateEnd: booking.preferredDateEnd?.toISOString() ?? null,
    scheduledDate: booking.scheduledDate?.toISOString() ?? null,
    shippingRequired: booking.shippingRequired,
    shippingAddress: booking.shippingAddress,
    agreedFeeCents: booking.agreedFeeCents,
    bookingFeeCents: booking.bookingFeeCents,
    totalPaidCents: booking.totalPaidCents,
    guaranteeType: booking.guaranteeType,
    requirements: booking.requirementsJson ?? null,
    breedingPlanId: booking.breedingPlanId,
    semenUsageId: booking.semenUsage?.id ?? null,
    notes: booking.notes,
    internalNotes: booking.internalNotes,
    createdAt: booking.createdAt?.toISOString() ?? null,
    updatedAt: booking.updatedAt?.toISOString() ?? null,
    createdBy: booking.createdBy,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    cancellationReason: booking.cancellationReason,
  };
}

function toHistoryResponse(history: any) {
  return {
    id: history.id,
    bookingId: history.bookingId,
    fromStatus: history.fromStatus,
    toStatus: history.toStatus,
    changedAt: history.changedAt?.toISOString() ?? null,
    changedBy: history.changedBy,
    notes: history.notes,
  };
}

/**
 * Check if all required mare requirements are met
 */
function allRequirementsMet(requirements: RequirementsInput | null): boolean {
  if (!requirements) return false;
  // Health cert and coggins are required; culture and uterine exam are optional
  return !!(requirements.healthCertReceived && requirements.cogginsReceived);
}

// ============================================================================
// Routes
// ============================================================================

export default async function stallionBookingsRoutes(app: FastifyInstance) {
  const bookingInclude = {
    serviceListing: { select: { id: true, title: true } },
    stallion: { select: { id: true, name: true, photoUrl: true } },
    mare: { select: { id: true, name: true, photoUrl: true } },
    mareOwnerParty: { select: { id: true, name: true, email: true, phoneE164: true } },
    breedingPlan: { select: { id: true, status: true } },
    semenUsage: { select: { id: true } },
  };

  // --------------------------------------------------------------------------
  // GET /stallion-bookings - List all bookings
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: {
      stallionId?: string;
      status?: string;
      serviceListingId?: string;
      mareOwnerPartyId?: string;
      fromDate?: string;
      toDate?: string;
      search?: string;
      page?: string;
      limit?: string;
    };
  }>("/stallion-bookings", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const q = req.query;
    const { page, limit, skip } = parsePaging(q as Record<string, unknown>);

    const where: any = { tenantId };

    // Filters
    if (q.stallionId) {
      const stallionId = parseIntStrict(q.stallionId);
      if (stallionId) where.stallionId = stallionId;
    }

    if (q.status) {
      // Support multiple statuses: status=INQUIRY,APPROVED
      const statuses = q.status.split(",").map((s) => s.trim().toUpperCase());
      if (statuses.length === 1) {
        where.status = statuses[0] as BookingStatus;
      } else {
        where.status = { in: statuses as BookingStatus[] };
      }
    }

    if (q.serviceListingId) {
      const serviceListingId = parseIntStrict(q.serviceListingId);
      if (serviceListingId) where.serviceListingId = serviceListingId;
    }

    if (q.mareOwnerPartyId) {
      const mareOwnerPartyId = parseIntStrict(q.mareOwnerPartyId);
      if (mareOwnerPartyId) where.mareOwnerPartyId = mareOwnerPartyId;
    }

    if (q.fromDate) {
      where.createdAt = { ...(where.createdAt || {}), gte: new Date(q.fromDate) };
    }
    if (q.toDate) {
      where.createdAt = { ...(where.createdAt || {}), lte: new Date(q.toDate) };
    }

    if (q.search) {
      const search = q.search.trim();
      where.OR = [
        { bookingNumber: { contains: search, mode: "insensitive" } },
        { stallion: { name: { contains: search, mode: "insensitive" } } },
        { mare: { name: { contains: search, mode: "insensitive" } } },
        { externalMareName: { contains: search, mode: "insensitive" } },
        { mareOwnerParty: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.stallionBooking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: bookingInclude,
      }),
      prisma.stallionBooking.count({ where }),
    ]);

    return reply.send({
      data: items.map(toBookingResponse),
      total,
      page,
      limit,
    });
  });

  // --------------------------------------------------------------------------
  // GET /stallion-bookings/summary - Dashboard summary
  // --------------------------------------------------------------------------
  app.get("/stallion-bookings/summary", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    // Count by status
    const statusCounts = await prisma.stallionBooking.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { id: true },
    });

    const byStatus: Record<BookingStatus, number> = {
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
      byStatus[row.status as BookingStatus] = row._count.id;
    }

    // Revenue totals (excluding cancelled)
    const revenueAgg = await prisma.stallionBooking.aggregate({
      where: { tenantId, status: { not: "CANCELLED" } },
      _sum: { agreedFeeCents: true, totalPaidCents: true },
    });

    const totalBookedCents = revenueAgg._sum.agreedFeeCents ?? 0;
    const totalPaidCents = revenueAgg._sum.totalPaidCents ?? 0;
    const outstandingCents = totalBookedCents - totalPaidCents;

    // Upcoming scheduled (next 7 days)
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const upcoming = await prisma.stallionBooking.findMany({
      where: {
        tenantId,
        status: "SCHEDULED",
        scheduledDate: { gte: now, lte: sevenDaysFromNow },
      },
      orderBy: { scheduledDate: "asc" },
      take: 10,
      include: {
        stallion: { select: { name: true } },
        mare: { select: { name: true } },
      },
    });

    // Requires attention (stale inquiries - no update for 5+ days)
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(now.getDate() - 5);

    const staleBookings = await prisma.stallionBooking.findMany({
      where: {
        tenantId,
        status: { in: ["INQUIRY", "PENDING_REQUIREMENTS", "APPROVED"] },
        updatedAt: { lt: fiveDaysAgo },
      },
      orderBy: { updatedAt: "asc" },
      take: 10,
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        updatedAt: true,
      },
    });

    return reply.send({
      byStatus,
      revenue: {
        totalBookedCents,
        totalPaidCents,
        outstandingCents,
      },
      upcoming: upcoming.map((b) => ({
        bookingId: b.id,
        bookingNumber: b.bookingNumber,
        stallionName: b.stallion?.name ?? "Unknown",
        mareName: b.mare?.name ?? b.externalMareName ?? "Unknown",
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
  });

  // --------------------------------------------------------------------------
  // GET /stallion-bookings/calendar - Calendar view
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: {
      startDate: string;
      endDate: string;
      stallionId?: string;
    };
  }>("/stallion-bookings/calendar", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const { startDate, endDate, stallionId } = req.query;
    if (!startDate || !endDate) {
      return reply.code(400).send({ error: "missing_date_range" });
    }

    const where: any = {
      tenantId,
      scheduledDate: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
    };

    if (stallionId) {
      const id = parseIntStrict(stallionId);
      if (id) where.stallionId = id;
    }

    const bookings = await prisma.stallionBooking.findMany({
      where,
      orderBy: { scheduledDate: "asc" },
      include: {
        stallion: { select: { name: true } },
        mare: { select: { name: true } },
        mareOwnerParty: { select: { name: true } },
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
        stallionName: b.stallion?.name ?? "Unknown",
        mareName: b.mare?.name ?? b.externalMareName ?? "Unknown",
        mareOwnerName: b.mareOwnerParty?.name ?? "Unknown",
        status: b.status,
        method: b.preferredMethod,
      });
    }

    const result = Object.entries(byDate).map(([date, bookings]) => ({
      date,
      bookings,
    }));

    return reply.send(result);
  });

  // --------------------------------------------------------------------------
  // GET /stallion-bookings/:id - Get a single booking
  // --------------------------------------------------------------------------
  app.get<{
    Params: { id: string };
  }>("/stallion-bookings/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const booking = await prisma.stallionBooking.findFirst({
      where: { id, tenantId },
      include: bookingInclude,
    });

    if (!booking) {
      return reply.code(404).send({ error: "not_found" });
    }

    return reply.send(toBookingResponse(booking));
  });

  // --------------------------------------------------------------------------
  // GET /stallion-bookings/:id/history - Get status history
  // --------------------------------------------------------------------------
  app.get<{
    Params: { id: string };
  }>("/stallion-bookings/:id/history", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    // Verify booking exists and belongs to tenant
    const booking = await prisma.stallionBooking.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!booking) {
      return reply.code(404).send({ error: "not_found" });
    }

    const history = await prisma.bookingStatusHistory.findMany({
      where: { bookingId: id },
      orderBy: { changedAt: "desc" },
    });

    return reply.send(history.map(toHistoryResponse));
  });

  // --------------------------------------------------------------------------
  // POST /stallion-bookings - Create a new booking
  // --------------------------------------------------------------------------
  app.post<{
    Body: CreateBookingInput;
  }>("/stallion-bookings", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const body = req.body;

    // Validate required fields
    if (!body.serviceListingId) {
      return reply.code(400).send({ error: "missing_service_listing_id" });
    }
    if (!body.mareOwnerPartyId) {
      return reply.code(400).send({ error: "missing_mare_owner_party_id" });
    }
    if (!body.mareId && !body.externalMareName) {
      return reply.code(400).send({ error: "missing_mare_info" });
    }

    // Verify service listing exists and get stallion info
    const listing = await prisma.mktListingBreederService.findFirst({
      where: { id: body.serviceListingId, tenantId },
      select: {
        id: true,
        stallionId: true,
        priceCents: true,
        defaultGuarantee: true,
        maxBookings: true,
        bookingsClosed: true,
        horseServiceData: true,
      },
    });

    if (!listing) {
      return reply.code(404).send({ error: "service_listing_not_found" });
    }

    if (listing.bookingsClosed) {
      return reply.code(400).send({ error: "bookings_closed" });
    }

    if (!listing.stallionId) {
      return reply.code(400).send({ error: "listing_has_no_stallion" });
    }

    // Check slot availability
    if (listing.maxBookings !== null) {
      const activeBookings = await prisma.stallionBooking.count({
        where: {
          serviceListingId: body.serviceListingId,
          status: { not: "CANCELLED" },
        },
      });

      if (activeBookings >= listing.maxBookings) {
        return reply.code(400).send({ error: "booking_slots_full" });
      }
    }

    // Verify mare owner party exists
    const mareOwner = await prisma.party.findFirst({
      where: { id: body.mareOwnerPartyId, tenantId },
      select: { id: true },
    });

    if (!mareOwner) {
      return reply.code(404).send({ error: "mare_owner_not_found" });
    }

    // If mareId provided, verify it exists
    if (body.mareId) {
      const mare = await prisma.animal.findFirst({
        where: { id: body.mareId, tenantId },
        select: { id: true },
      });
      if (!mare) {
        return reply.code(404).send({ error: "mare_not_found" });
      }
    }

    // Get defaults from listing
    const horseData = listing.horseServiceData as any;
    const defaultAgreedFee = body.agreedFeeCents ?? listing.priceCents ?? 0;
    const defaultBookingFee = body.bookingFeeCents ?? horseData?.bookingFeeCents ?? 0;
    const defaultGuarantee = body.guaranteeType ?? listing.defaultGuarantee;

    // Generate booking number
    const bookingNumber = await generateBookingNumber(tenantId);

    // Create booking with history
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.stallionBooking.create({
        data: {
          tenantId,
          bookingNumber,
          serviceListingId: body.serviceListingId,
          stallionId: listing.stallionId!,
          mareId: body.mareId ?? null,
          externalMareName: body.externalMareName ?? null,
          externalMareReg: body.externalMareReg ?? null,
          externalMareBreed: body.externalMareBreed ?? null,
          mareOwnerPartyId: body.mareOwnerPartyId,
          status: "INQUIRY",
          statusChangedAt: new Date(),
          preferredMethod: body.preferredMethod ?? null,
          preferredDateStart: body.preferredDateStart ? new Date(body.preferredDateStart) : null,
          preferredDateEnd: body.preferredDateEnd ? new Date(body.preferredDateEnd) : null,
          shippingRequired: body.shippingRequired ?? false,
          shippingAddress: body.shippingAddress ?? null,
          agreedFeeCents: defaultAgreedFee,
          bookingFeeCents: defaultBookingFee,
          totalPaidCents: 0,
          guaranteeType: defaultGuarantee ?? null,
          notes: body.notes ?? null,
        },
        include: bookingInclude,
      });

      // Create initial history record
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: created.id,
          fromStatus: null,
          toStatus: "INQUIRY",
          changedAt: new Date(),
          notes: "Booking created",
        },
      });

      // Increment bookingsReceived on listing
      await tx.mktListingBreederService.update({
        where: { id: body.serviceListingId },
        data: { bookingsReceived: { increment: 1 } },
      });

      return created;
    });

    return reply.code(201).send(toBookingResponse(booking));
  });

  // --------------------------------------------------------------------------
  // PATCH /stallion-bookings/:id - Update booking
  // --------------------------------------------------------------------------
  app.patch<{
    Params: { id: string };
    Body: UpdateBookingInput;
  }>("/stallion-bookings/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.stallionBooking.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    const body = req.body;
    const updateData: any = {};

    // Mare info
    if (body.mareId !== undefined) updateData.mareId = body.mareId;
    if (body.externalMareName !== undefined) updateData.externalMareName = body.externalMareName;
    if (body.externalMareReg !== undefined) updateData.externalMareReg = body.externalMareReg;
    if (body.externalMareBreed !== undefined) updateData.externalMareBreed = body.externalMareBreed;

    // Preferences
    if (body.preferredMethod !== undefined) updateData.preferredMethod = body.preferredMethod;
    if (body.preferredDateStart !== undefined) {
      updateData.preferredDateStart = body.preferredDateStart ? new Date(body.preferredDateStart) : null;
    }
    if (body.preferredDateEnd !== undefined) {
      updateData.preferredDateEnd = body.preferredDateEnd ? new Date(body.preferredDateEnd) : null;
    }
    if (body.shippingRequired !== undefined) updateData.shippingRequired = body.shippingRequired;
    if (body.shippingAddress !== undefined) updateData.shippingAddress = body.shippingAddress;

    // Pricing
    if (body.agreedFeeCents !== undefined) updateData.agreedFeeCents = body.agreedFeeCents;
    if (body.bookingFeeCents !== undefined) updateData.bookingFeeCents = body.bookingFeeCents;
    if (body.guaranteeType !== undefined) updateData.guaranteeType = body.guaranteeType;

    // Notes
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.internalNotes !== undefined) updateData.internalNotes = body.internalNotes;

    const updated = await prisma.stallionBooking.update({
      where: { id },
      data: updateData,
      include: bookingInclude,
    });

    return reply.send(toBookingResponse(updated));
  });

  // --------------------------------------------------------------------------
  // DELETE /stallion-bookings/:id - Delete booking (only INQUIRY or CANCELLED)
  // --------------------------------------------------------------------------
  app.delete<{
    Params: { id: string };
  }>("/stallion-bookings/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.stallionBooking.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    if (!["INQUIRY", "CANCELLED"].includes(existing.status)) {
      return reply.code(400).send({
        error: "cannot_delete",
        message: "Can only delete bookings in INQUIRY or CANCELLED status",
      });
    }

    await prisma.$transaction(async (tx) => {
      // Delete history first
      await tx.bookingStatusHistory.deleteMany({ where: { bookingId: id } });
      // Delete booking
      await tx.stallionBooking.delete({ where: { id } });
      // Decrement bookingsReceived on listing
      await tx.mktListingBreederService.update({
        where: { id: existing.serviceListingId },
        data: { bookingsReceived: { decrement: 1 } },
      });
    });

    return reply.code(204).send();
  });

  // --------------------------------------------------------------------------
  // POST /stallion-bookings/:id/transition - Transition status
  // --------------------------------------------------------------------------
  app.post<{
    Params: { id: string };
    Body: TransitionInput;
  }>("/stallion-bookings/:id/transition", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const { toStatus, notes, scheduledDate, breedingPlanId, cancellationReason } = req.body;

    if (!toStatus) {
      return reply.code(400).send({ error: "missing_to_status" });
    }

    const existing = await prisma.stallionBooking.findFirst({
      where: { id, tenantId },
      include: bookingInclude,
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    const fromStatus = existing.status as BookingStatus;
    const validTargets = VALID_TRANSITIONS[fromStatus];

    if (!validTargets.includes(toStatus as BookingStatus)) {
      return reply.code(400).send({
        error: "invalid_transition",
        message: `Cannot transition from ${fromStatus} to ${toStatus}`,
        validTargets,
      });
    }

    // Validate required fields for specific transitions
    if (toStatus === "SCHEDULED" && !scheduledDate) {
      return reply.code(400).send({ error: "scheduled_date_required" });
    }

    if (toStatus === "CANCELLED" && !cancellationReason) {
      return reply.code(400).send({ error: "cancellation_reason_required" });
    }

    const updateData: any = {
      status: toStatus,
      statusChangedAt: new Date(),
    };

    if (toStatus === "SCHEDULED" && scheduledDate) {
      updateData.scheduledDate = new Date(scheduledDate);
    }

    if (toStatus === "CANCELLED") {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = cancellationReason;
    }

    if (toStatus === "IN_PROGRESS" && breedingPlanId) {
      updateData.breedingPlanId = breedingPlanId;
    }

    const [updated, history] = await prisma.$transaction(async (tx) => {
      const u = await tx.stallionBooking.update({
        where: { id },
        data: updateData,
        include: bookingInclude,
      });

      const h = await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: fromStatus,
          toStatus: toStatus as BookingStatus,
          changedAt: new Date(),
          notes: notes ?? null,
        },
      });

      return [u, h];
    });

    return reply.send({
      success: true,
      booking: toBookingResponse(updated),
      history: toHistoryResponse(history),
    });
  });

  // --------------------------------------------------------------------------
  // PATCH /stallion-bookings/:id/requirements - Update requirements checklist
  // --------------------------------------------------------------------------
  app.patch<{
    Params: { id: string };
    Body: RequirementsInput;
  }>("/stallion-bookings/:id/requirements", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.stallionBooking.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    const currentReqs = (existing.requirementsJson as RequirementsInput) ?? {};
    const newReqs = { ...currentReqs, ...req.body };

    let updated = await prisma.stallionBooking.update({
      where: { id },
      data: { requirementsJson: newReqs },
      include: bookingInclude,
    });

    // Auto-transition to APPROVED if all requirements met and status is PENDING_REQUIREMENTS
    if (existing.status === "PENDING_REQUIREMENTS" && allRequirementsMet(newReqs)) {
      const [u, h] = await prisma.$transaction(async (tx) => {
        const u = await tx.stallionBooking.update({
          where: { id },
          data: {
            status: "APPROVED",
            statusChangedAt: new Date(),
          },
          include: bookingInclude,
        });

        const h = await tx.bookingStatusHistory.create({
          data: {
            bookingId: id,
            fromStatus: "PENDING_REQUIREMENTS",
            toStatus: "APPROVED",
            changedAt: new Date(),
            notes: "Auto-approved: all requirements met",
          },
        });

        return [u, h];
      });
      updated = u;
    }

    return reply.send(toBookingResponse(updated));
  });

  // --------------------------------------------------------------------------
  // POST /stallion-bookings/:id/payment - Record a payment
  // --------------------------------------------------------------------------
  app.post<{
    Params: { id: string };
    Body: PaymentInput;
  }>("/stallion-bookings/:id/payment", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const { amountCents, paymentMethod, paymentDate, reference, notes } = req.body;

    if (!amountCents || amountCents <= 0) {
      return reply.code(400).send({ error: "invalid_amount" });
    }

    const existing = await prisma.stallionBooking.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    const newTotalPaid = existing.totalPaidCents + amountCents;

    let updated = await prisma.stallionBooking.update({
      where: { id },
      data: { totalPaidCents: newTotalPaid },
      include: bookingInclude,
    });

    // Auto-transitions based on payment thresholds
    let autoTransitioned = false;
    const currentStatus = existing.status as BookingStatus;

    if (
      currentStatus === "APPROVED" &&
      newTotalPaid >= existing.bookingFeeCents &&
      existing.bookingFeeCents > 0
    ) {
      // Transition to DEPOSIT_PAID
      const [u] = await prisma.$transaction(async (tx) => {
        const u = await tx.stallionBooking.update({
          where: { id },
          data: {
            status: "DEPOSIT_PAID",
            statusChangedAt: new Date(),
          },
          include: bookingInclude,
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: id,
            fromStatus: "APPROVED",
            toStatus: "DEPOSIT_PAID",
            changedAt: new Date(),
            notes: `Auto-transitioned: deposit payment received ($${(amountCents / 100).toFixed(2)})`,
          },
        });

        return [u];
      });
      updated = u;
      autoTransitioned = true;
    }

    if (
      (currentStatus === "DEPOSIT_PAID" || (currentStatus === "APPROVED" && autoTransitioned)) &&
      newTotalPaid >= existing.agreedFeeCents
    ) {
      // Transition to CONFIRMED
      const prevStatus = updated.status;
      const [u] = await prisma.$transaction(async (tx) => {
        const u = await tx.stallionBooking.update({
          where: { id },
          data: {
            status: "CONFIRMED",
            statusChangedAt: new Date(),
          },
          include: bookingInclude,
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: id,
            fromStatus: prevStatus as BookingStatus,
            toStatus: "CONFIRMED",
            changedAt: new Date(),
            notes: `Auto-transitioned: full payment received ($${(newTotalPaid / 100).toFixed(2)})`,
          },
        });

        return [u];
      });
      updated = u;
    }

    return reply.send({
      success: true,
      booking: toBookingResponse(updated),
      totalPaidCents: newTotalPaid,
      balanceDueCents: Math.max(0, existing.agreedFeeCents - newTotalPaid),
    });
  });

  // --------------------------------------------------------------------------
  // POST /stallion-bookings/:id/start-breeding - Create BreedingPlan and start
  // --------------------------------------------------------------------------
  app.post<{
    Params: { id: string };
    Body: StartBreedingInput;
  }>("/stallion-bookings/:id/start-breeding", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.stallionBooking.findFirst({
      where: { id, tenantId },
      include: {
        stallion: { select: { id: true, name: true } },
        mare: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    if (existing.status !== "SCHEDULED") {
      return reply.code(400).send({
        error: "invalid_status",
        message: "Can only start breeding from SCHEDULED status",
      });
    }

    const breedingDate = req.body.breedingDate
      ? new Date(req.body.breedingDate)
      : existing.scheduledDate ?? new Date();

    // Create BreedingPlan and transition
    const [plan, updated] = await prisma.$transaction(async (tx) => {
      // Get tenant's default organization
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });

      const org = await tx.organization.findFirst({
        where: { tenantId },
        select: { id: true },
      });

      if (!org) {
        throw new Error("No organization found for tenant");
      }

      const plan = await tx.breedingPlan.create({
        data: {
          tenantId,
          organizationId: org.id,
          code: `BP-${existing.bookingNumber}`,
          status: "BRED",
          damId: existing.mareId ?? null,
          sireId: existing.stallionId,
          notes: req.body.notes ?? `From booking ${existing.bookingNumber}`,
        },
      });

      const u = await tx.stallionBooking.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          statusChangedAt: new Date(),
          breedingPlanId: plan.id,
        },
        include: bookingInclude,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: "SCHEDULED",
          toStatus: "IN_PROGRESS",
          changedAt: new Date(),
          notes: `Breeding started, BreedingPlan ${plan.id} created`,
        },
      });

      return [plan, u];
    });

    return reply.send({
      success: true,
      booking: toBookingResponse(updated),
      breedingPlan: {
        id: plan.id,
        status: plan.status,
      },
    });
  });

  // --------------------------------------------------------------------------
  // POST /stallion-bookings/:id/ship-semen - Ship semen for booking
  // --------------------------------------------------------------------------
  app.post<{
    Params: { id: string };
    Body: ShipSemenInput;
  }>("/stallion-bookings/:id/ship-semen", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseIntStrict(req.params.id);
    if (!id) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const { inventoryId, dosesUsed = 1, shippingCarrier, trackingNumber } = req.body;

    if (!inventoryId) {
      return reply.code(400).send({ error: "missing_inventory_id" });
    }

    const existing = await prisma.stallionBooking.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    if (!existing.shippingRequired) {
      return reply.code(400).send({ error: "shipping_not_required" });
    }

    // Check inventory
    const inventory = await prisma.semenInventory.findFirst({
      where: { id: inventoryId, tenantId },
    });

    if (!inventory) {
      return reply.code(404).send({ error: "inventory_not_found" });
    }

    if (inventory.availableDoses < dosesUsed) {
      return reply.code(400).send({
        error: "insufficient_doses",
        available: inventory.availableDoses,
        requested: dosesUsed,
      });
    }

    // Create usage record and update inventory
    const [usage, updated] = await prisma.$transaction(async (tx) => {
      // Decrement available doses
      await tx.semenInventory.update({
        where: { id: inventoryId },
        data: {
          availableDoses: { decrement: dosesUsed },
          status: inventory.availableDoses - dosesUsed === 0 ? "DEPLETED" : inventory.status,
        },
      });

      // Create usage record
      const usage = await tx.semenUsage.create({
        data: {
          tenantId,
          inventoryId,
          usageType: "BREEDING_SHIPPED",
          usageDate: new Date(),
          dosesUsed,
          shippedToName: existing.mareOwnerPartyId ? undefined : existing.externalMareName,
          shippedToAddress: existing.shippingAddress,
          shippingCarrier,
          trackingNumber,
          bookingId: id,
          notes: `Shipped for booking ${existing.bookingNumber}`,
        },
      });

      // Update booking
      const u = await tx.stallionBooking.update({
        where: { id },
        data: {},
        include: bookingInclude,
      });

      return [usage, u];
    });

    return reply.send({
      success: true,
      booking: toBookingResponse(updated),
      semenUsage: {
        id: usage.id,
        dosesUsed: usage.dosesUsed,
        trackingNumber: usage.trackingNumber,
      },
    });
  });
}
