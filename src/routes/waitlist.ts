// src/routes/waitlist.ts
import type { FastifyPluginCallback } from "fastify";
import prisma from "../prisma.js";

/* ───────── helpers ───────── */

function getTenantId(req: any) {
  const raw = req.headers["x-tenant-id"] ?? req.query.tenantId;
  const id = Number(raw);
  if (!Number.isFinite(id)) return null;
  return id;
}

function requireAdmin(req: any, reply: any) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
}

function parseISO(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ───────── serializers ───────── */

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

    contactId: w.contactId,
    organizationId: w.organizationId,
    litterId: w.litterId,
    planId: w.planId,

    speciesPref: w.speciesPref,
    breedPrefs: w.breedPrefs ?? null,
    sirePrefId: w.sirePrefId,
    damPrefId: w.damPrefId,

    contact: w.contact
      ? { id: w.contact.id, display_name: w.contact.display_name, email: w.contact.email, phoneE164: w.contact.phoneE164 }
      : null,
    organization: w.organization
      ? { id: w.organization.id, name: w.organization.name, email: w.organization.email, phone: w.organization.phone ?? null }
      : null,
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
  app.addHook("preHandler", async (req, reply) => {
    const tid = getTenantId(req);
    if (!tid) return reply.code(400).send({ error: "missing x-tenant-id" });
    (req as any).tenantId = tid;
  });

  /**
   * GET /api/v1/waitlist
   * Filters: q, status, species, limit, cursor
   * Returns: { items, total }
   */
  app.get("/waitlist", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const q = String(req.query["q"] ?? "").trim();
    const status = String(req.query["status"] ?? "").trim();
    const species = String(req.query["species"] ?? "").trim();
    const limit = Math.min(250, Math.max(1, Number(req.query["limit"] ?? 25)));
    const cursorId = req.query["cursor"] ? Number(req.query["cursor"]) : undefined;

    const where: any = {
      tenantId,
      ...(status ? { status } : null),
      ...(species ? { speciesPref: species } : null),
      ...(cursorId ? { id: { lt: cursorId } } : null),
      ...(q
        ? {
            OR: [
              { contact: { display_name: { contains: q, mode: "insensitive" } } },
              { contact: { email: { contains: q, mode: "insensitive" } } },
              { organization: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : null),
    };

    const rows = await prisma.waitlistEntry.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit,
      include: {
        contact: { select: { id: true, display_name: true, email: true, phoneE164: true } },
        organization: { select: { id: true, name: true, email: true, phone: true } },
        sirePref: { select: { id: true, name: true } },
        damPref: { select: { id: true, name: true } },
        TagAssignment: { include: { tag: true } },
      },
    });

    const total = await prisma.waitlistEntry.count({ where: { tenantId, ...(status ? { status } : null) } });

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
        contact: { select: { id: true, display_name: true, email: true, phoneE164: true } },
        organization: { select: { id: true, name: true, email: true, phone: true } },
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
   * Create a global (parking lot) waitlist entry
   */
  app.post("/waitlist", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    if (!requireAdmin(req, reply)) return;

    const b = (req.body as any) ?? {};
    if (!b.partyType || !["Organization", "Contact"].includes(b.partyType)) {
      return reply.code(400).send({ error: "partyType must be Contact or Organization" });
    }
    if (b.partyType === "Contact" && !b.contactId) return reply.code(400).send({ error: "contactId required for Contact partyType" });
    if (b.partyType === "Organization" && !b.organizationId) return reply.code(400).send({ error: "organizationId required for Organization partyType" });

    const created = await prisma.waitlistEntry.create({
      data: {
        tenantId,
        planId: b.planId ?? null,
        litterId: b.litterId ?? null,

        partyType: b.partyType,
        contactId: b.partyType === "Contact" ? Number(b.contactId) : null,
        organizationId: b.partyType === "Organization" ? Number(b.organizationId) : null,

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
        contact: true,
        organization: true,
        sirePref: true,
        damPref: true,
        TagAssignment: { include: { tag: true } },
      },
    });

    reply.code(201).send(serializeEntry(created));
  });

  /**
   * PATCH /api/v1/waitlist/:id
   */
  app.patch("/waitlist/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    if (!requireAdmin(req, reply)) return;
    const id = Number((req.params as any).id);
    const b = (req.body as any) ?? {};

    const existing = await prisma.waitlistEntry.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    const data: any = {};
    if ("partyType" in b) data.partyType = b.partyType;
    if ("contactId" in b) data.contactId = b.contactId ? Number(b.contactId) : null;
    if ("organizationId" in b) data.organizationId = b.organizationId ? Number(b.organizationId) : null;

    if ("planId" in b) data.planId = b.planId ?? null;
    if ("litterId" in b) data.litterId = b.litterId ?? null;

    if ("speciesPref" in b) data.speciesPref = b.speciesPref ?? null;
    if ("breedPrefs" in b) data.breedPrefs = b.breedPrefs ?? null;
    if ("sirePrefId" in b) data.sirePrefId = b.sirePrefId ? Number(b.sirePrefId) : null;
    if ("damPrefId" in b) data.damPrefId = b.damPrefId ? Number(b.damPrefId) : null;

    if ("status" in b) data.status = b.status;
    if ("priority" in b) data.priority = b.priority ?? null;

    if ("depositInvoiceId" in b) data.depositInvoiceId = b.depositInvoiceId ?? null;
    if ("balanceInvoiceId" in b) data.balanceInvoiceId = b.balanceInvoiceId ?? null;
    if ("depositPaidAt" in b) data.depositPaidAt = parseISO(b.depositPaidAt);
    if ("depositRequiredCents" in b) data.depositRequiredCents = b.depositRequiredCents ?? null;
    if ("depositPaidCents" in b) data.depositPaidCents = b.depositPaidCents ?? null;
    if ("balanceDueCents" in b) data.balanceDueCents = b.balanceDueCents ?? null;

    if ("animalId" in b) data.animalId = b.animalId ? Number(b.animalId) : null;

    if ("skipCount" in b) data.skipCount = b.skipCount ?? null;
    if ("lastSkipAt" in b) data.lastSkipAt = parseISO(b.lastSkipAt);

    if ("notes" in b) data.notes = b.notes ?? null;

    const updated = await prisma.waitlistEntry.update({
      where: { id },
      data,
      include: {
        contact: true,
        organization: true,
        sirePref: true,
        damPref: true,
        TagAssignment: { include: { tag: true } },
      },
    });

    reply.send(serializeEntry(updated));
  });

  /**
   * DELETE /api/v1/waitlist/:id
   */
  app.delete("/waitlist/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    if (!requireAdmin(req, reply)) return;
    const id = Number((req.params as any).id);

    const existing = await prisma.waitlistEntry.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    await prisma.waitlistEntry.delete({ where: { id } });
    reply.send({ ok: true });
  });

  /**
   * POST /api/v1/waitlist/:id/skip
   * Increments skipCount and sets lastSkipAt to now
   */
  app.post("/waitlist/:id/skip", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    if (!requireAdmin(req, reply)) return;
    const id = Number((req.params as any).id);

    const existing = await prisma.waitlistEntry.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    const updated = await prisma.waitlistEntry.update({
      where: { id },
      data: {
        skipCount: (existing.skipCount ?? 0) + 1,
        lastSkipAt: new Date(),
      },
    });

    reply.send({ skipCount: updated.skipCount ?? 0 });
  });

  done();
};

export default waitlistRoutes;
