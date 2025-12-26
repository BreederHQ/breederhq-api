// src/routes/waitlist.ts
import type { FastifyPluginCallback } from "fastify";
import prisma from "../prisma.js";
import { WaitlistStatus } from "@prisma/client";
import { Species } from "@prisma/client";

/* ───────── helpers ───────── */

function getTenantId(req: any) {
  const raw = req.headers["x-tenant-id"] ?? req.query.tenantId;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

function parseISO(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ───────── serializers ───────── */

/**
 * Serialize WaitlistEntry with Party-native fields.
 */
function serializeEntry(w: any) {
  return {
    id: w.id,
    tenantId: w.tenantId,

    status: w.status,
    priority: w.priority,

    depositRequiredCents: w.depositRequiredCents,
    depositPaidCents: w.depositPaidCents,
    balanceDueCents: w.balanceDueCents,
    depositPaidAt: w.depositPaidAt?.toISOString() ?? null,

    clientPartyId: w.clientPartyId,
    litterId: w.litterId,
    planId: w.planId,

    speciesPref: w.speciesPref,
    breedPrefs: w.breedPrefs ?? null,
    sirePrefId: w.sirePrefId,
    damPrefId: w.damPrefId,

    sirePref: w.sirePref ? { id: w.sirePref.id, name: w.sirePref.name } : null,
    damPref: w.damPref ? { id: w.damPref.id, name: w.damPref.name } : null,

    TagAssignment: (w.TagAssignment ?? []).map((t: any) => ({
      id: t.id,
      tagId: t.tagId,
      tag: t.tag ? { id: t.tag.id, name: t.tag.name, color: t.tag.color ?? null } : null,
    })),

    skipCount: w.skipCount ?? null,
    lastSkipAt: w.lastSkipAt?.toISOString() ?? null,
  };
}

/* ───────── router ───────── */

const waitlistRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // tenant scope; no admin requirements anywhere in this file
  app.addHook("preHandler", async (req, reply) => {
    const tid = getTenantId(req);
    if (!tid) return reply.code(400).send({ error: "missing x-tenant-id" });
    (req as any).tenantId = tid;
  });

  /**
   * GET /api/v1/waitlist
   * Filters: q, status, species, limit, cursor
   * Returns: { items, total }
   * (Global parking-lot by default; you can pass other filters, but FE uses parking lot.)
   */
  app.get("/waitlist", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const q = String((req.query as any)["q"] ?? "").trim();
    const status = String((req.query as any)["status"] ?? "").trim();
    const species = String((req.query as any)["species"] ?? "").trim();
    const validSpecies = species && Object.values(Species).includes(species as Species) ? (species as Species) : undefined;
    const validStatus = status && Object.values(WaitlistStatus).includes(status as WaitlistStatus) ? (status as WaitlistStatus) : undefined;
    const limit = Math.min(250, Math.max(1, Number((req.query as any)["limit"] ?? 25)));
    const cursorId = (req.query as any)["cursor"] ? Number((req.query as any)["cursor"]) : undefined;

    const where: any = {
      tenantId,
      litterId: null, // parking lot
      ...(validStatus ? { status } : null),
      ...(species ? { speciesPref: species } : null),
      ...(cursorId ? { id: { lt: cursorId } } : null),
      ...(q
        ? {
            OR: [
              { notes: { contains: q, mode: "insensitive" } },
            ],
          }
        : null),
    };

    const rows = await prisma.waitlistEntry.findMany({
      where,
      orderBy: [{ depositPaidAt: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      take: limit,
      include: {
        sirePref: { select: { id: true, name: true } },
        damPref: { select: { id: true, name: true } },
        TagAssignment: { include: { tag: true } },
      },
    });

    // Count without cursor to give a stable aggregate for UI; still scoped to parking-lot, status/species
    const total = await prisma.waitlistEntry.count({
      where: { tenantId, litterId: null, ...(validStatus ? { status: validStatus } : null), ...(validSpecies ? { speciesPref: validSpecies } : null) },
    });

    reply.send({ items: rows.map(serializeEntry), total });
  });

  /**
   * GET /api/v1/waitlist/:id
   */
  app.get("/waitlist/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const w = await prisma.waitlistEntry.findFirst({
      where: { id, tenantId },
      include: {
        sirePref: { select: { id: true, name: true } },
        damPref: { select: { id: true, name: true } },
        TagAssignment: { include: { tag: true } },
      },
    });

    if (!w) return reply.code(404).send({ error: "not found" });
    reply.send(serializeEntry(w));
  });

  /**
   * POST /api/v1/waitlist
   * Create a global (parking lot) waitlist entry (no admin required)
   */
  app.post("/waitlist", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const b = (req.body as any) ?? {};

    // Require clientPartyId
    if (!b.clientPartyId) {
      return reply.code(400).send({ error: "clientPartyId required" });
    }

    const created = await prisma.waitlistEntry.create({
      data: {
        tenantId,
        planId: b.planId ?? null,
        litterId: null, // parking-lot by design

        clientPartyId: Number(b.clientPartyId),

        speciesPref: b.speciesPref ?? null,
        breedPrefs: b.breedPrefs ?? null,
        sirePrefId: b.sirePrefId ? Number(b.sirePrefId) : null,
        damPrefId: b.damPrefId ? Number(b.damPrefId) : null,

        status: b.status ?? "INQUIRY",
        priority: b.priority ?? null,

        depositInvoiceId: b.depositInvoiceId ?? null,
        balanceInvoiceId: b.balanceInvoiceId ?? null,
        depositPaidAt: parseISO(b.depositPaidAt),
        depositRequiredCents: b.depositRequiredCents ?? null,
        depositPaidCents: b.depositPaidCents ?? null,
        balanceDueCents: b.balanceDueCents ?? null,

        animalId: b.animalId ? Number(b.animalId) : null,

        skipCount: b.skipCount ?? null,
        lastSkipAt: parseISO(b.lastSkipAt),

        notes: b.notes ?? null,
      },
      include: {
        sirePref: { select: { id: true, name: true } },
        damPref: { select: { id: true, name: true } },
        TagAssignment: { include: { tag: true } },
      },
    });

    reply.code(201).send(serializeEntry(created));
  });

  /**
   * PATCH /api/v1/waitlist/:id
   * Update an entry (no admin required)
   */
  app.patch("/waitlist/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const b = (req.body as any) ?? {};

    const existing = await prisma.waitlistEntry.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    const data: any = {};

    // Accept clientPartyId
    if ("clientPartyId" in b) {
      if (!b.clientPartyId) {
        return reply.code(400).send({ error: "clientPartyId required" });
      }
      data.clientPartyId = Number(b.clientPartyId);
    }

    // relations
    if ("planId" in b) data.planId = b.planId ?? null;
    if ("litterId" in b) data.litterId = b.litterId ?? null; // allows moving out of parking lot if ever needed
    if ("animalId" in b) data.animalId = b.animalId ? Number(b.animalId) : null;

    // prefs
    if ("speciesPref" in b) data.speciesPref = b.speciesPref ?? null;
    if ("breedPrefs" in b) data.breedPrefs = b.breedPrefs ?? null;
    if ("sirePrefId" in b) data.sirePrefId = b.sirePrefId ? Number(b.sirePrefId) : null;
    if ("damPrefId" in b) data.damPrefId = b.damPrefId ? Number(b.damPrefId) : null;

    // status/priority
    if ("status" in b) data.status = b.status;
    if ("priority" in b) data.priority = b.priority ?? null;

    // money
    if ("depositInvoiceId" in b) data.depositInvoiceId = b.depositInvoiceId ?? null;
    if ("balanceInvoiceId" in b) data.balanceInvoiceId = b.balanceInvoiceId ?? null;
    if ("depositPaidAt" in b) data.depositPaidAt = parseISO(b.depositPaidAt);
    if ("depositRequiredCents" in b) data.depositRequiredCents = b.depositRequiredCents ?? null;
    if ("depositPaidCents" in b) data.depositPaidCents = b.depositPaidCents ?? null;
    if ("balanceDueCents" in b) data.balanceDueCents = b.balanceDueCents ?? null;

    // skip meta
    if ("skipCount" in b) data.skipCount = b.skipCount ?? null;
    if ("lastSkipAt" in b) data.lastSkipAt = parseISO(b.lastSkipAt);

    // notes
    if ("notes" in b) data.notes = b.notes ?? null;

    const updated = await prisma.waitlistEntry.update({
      where: { id },
      data,
      include: {
        sirePref: { select: { id: true, name: true } },
        damPref: { select: { id: true, name: true } },
        TagAssignment: { include: { tag: true } },
      },
    });

    reply.send(serializeEntry(updated));
  });

  /**
   * DELETE /api/v1/waitlist/:id
   * No admin required
   */
  app.delete("/waitlist/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const existing = await prisma.waitlistEntry.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    await prisma.waitlistEntry.delete({ where: { id } });
    reply.send({ ok: true });
  });

  /**
   * POST /api/v1/waitlist/:id/skip
   * Increments skipCount and sets lastSkipAt to now (no admin required)
   */
  app.post("/waitlist/:id/skip", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const existing = await prisma.waitlistEntry.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    const updated = await prisma.waitlistEntry.update({
      where: { id },
      data: {
        skipCount: (existing.skipCount ?? 0) + 1,
        lastSkipAt: new Date(),
      },
      select: { skipCount: true },
    });

    reply.send({ skipCount: updated.skipCount ?? 0 });
  });

  done();
};

export default waitlistRoutes;
