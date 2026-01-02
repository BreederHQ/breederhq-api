// src/routes/scheduling.ts
// Staff-facing scheduling endpoints for calendar integration
// Provides read-only access to availability blocks and bookings for breeding calendar view
//
// Endpoints:
// GET /api/v1/scheduling/blocks   - List availability blocks in date range
// GET /api/v1/scheduling/bookings - List bookings in date range

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
