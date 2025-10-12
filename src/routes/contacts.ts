// src/routes/contacts.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/**
 * Contact schema alignment
 * - id: Int (PK)
 * - tenantId: Int (required, scope EVERY query)
 * - organizationId: Int? (composite relation with tenantId)
 * - display_name: String (required)
 * - first_name: String?  ← added
 * - last_name: String?   ← added
 * - nickname: String?    ← added
 * - email: String? @db.Citext (unique per-tenant)
 * - phoneE164, whatsappE164: String? @db.VarChar(32)
 * - address fields: street, street2, city, state, zip, country @db.Char(2) for country
 * - archived: Boolean @default(false)
 * - createdAt / updatedAt
 */

type SortKey = "display_name" | "email" | "createdAt" | "updatedAt"; // keep existing sort surface

/* ───────────────────────── helpers ───────────────────────── */

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "25", 10) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function parseSort(q: any) {
  // "display_name:asc,email:desc"
  const s = String(q?.sort || "").trim();
  if (!s) return [{ createdAt: "desc" }] as any;
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  const orderBy: any[] = [];
  const allowed: SortKey[] = ["display_name", "email", "createdAt", "updatedAt"];
  for (const p of parts) {
    const [rawField, rawDir] = p.split(":");
    const field = rawField as SortKey;
    const dir = (rawDir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    if (allowed.includes(field)) orderBy.push({ [field]: dir });
  }
  return orderBy.length ? orderBy : [{ createdAt: "desc" }];
}

function idNum(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function errorReply(err: any) {
  if (err?.code === "P2002") {
    // unique constraint (likely [tenantId, email])
    return { status: 409, payload: { error: "conflict", detail: "email_must_be_unique_within_tenant" } };
  }
  if (err?.status) {
    return { status: err.status, payload: { error: err.message || "error" } };
  }
  return { status: 500, payload: { error: "internal_error" } };
}

/* if you attach auth to req.user, enforce here (kept no-op for compatibility) */
const ensureAuth = (_req: any) => {
  // if (!(_req as any).user) throw { status: 401, message: "unauthorized" };
};

/* ───────────────────────── routes ───────────────────────── */

const contactsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /contacts
  app.get("/contacts", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const q = (req.query as any) ?? {};
      const { page, limit, skip } = parsePaging(q);
      const includeArchived = String(q.includeArchived ?? "false").toLowerCase() === "true";
      const search = String(q.q ?? "").trim();
      const orderBy = parseSort(q);

      const where: any = { tenantId };
      if (!includeArchived) where.archived = false;
      if (search) {
        where.OR = [
          { display_name: { contains: search, mode: "insensitive" } },
          { first_name:   { contains: search, mode: "insensitive" } }, // ← added
          { last_name:    { contains: search, mode: "insensitive" } }, // ← added
          { nickname:     { contains: search, mode: "insensitive" } }, // ← added
          { email:        { contains: search, mode: "insensitive" } },
          { phoneE164:    { contains: search, mode: "insensitive" } },
          { whatsappE164: { contains: search, mode: "insensitive" } },
        ];
      }

      const [total, rows] = await Promise.all([
        prisma.contact.count({ where }),
        prisma.contact.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            tenantId: true,
            organizationId: true,
            display_name: true,
            first_name: true,   // ← added
            last_name: true,    // ← added
            nickname: true,     // ← added
            email: true,
            phoneE164: true,
            whatsappE164: true,
            street: true,
            street2: true,
            city: true,
            state: true,
            zip: true,
            country: true,
            archived: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ]);

      return reply.send({ items: rows, total, page, limit });
    } catch (err) {
      req.log?.error?.(err as any);
      return reply.code(500).send({ error: "contacts_unavailable" });
    }
  });

  // GET /contacts/:id
  app.get("/contacts/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const row = await prisma.contact.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          tenantId: true,
          organizationId: true,
          display_name: true,
          first_name: true,   // ← added
          last_name: true,    // ← added
          nickname: true,     // ← added
          email: true,
          phoneE164: true,
          whatsappE164: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          zip: true,
          country: true,
          archived: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!row) return reply.code(404).send({ error: "not_found" });
      return reply.send(row);
    } catch (err) {
      req.log?.error?.(err as any);
      return reply.code(500).send({ error: "get_failed" });
    }
  });

  // POST /contacts
  app.post("/contacts", async (req, reply) => {
    try {
      ensureAuth(req);

      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = (req.body as any) ?? {};
      const display_name = String(body.display_name || "").trim();
      if (!display_name) return reply.code(400).send({ error: "display_name_required" });

      // Optional org linkage, must be same-tenant if provided
      let organizationId: number | null = null;
      if (body.organizationId != null) {
        const orgId = idNum(body.organizationId);
        if (!orgId) return reply.code(400).send({ error: "organizationId_invalid" });
        const org = await prisma.organization.findFirst({ where: { id: orgId, tenantId }, select: { id: true } });
        if (!org) return reply.code(404).send({ error: "organization_not_found" });
        organizationId = org.id;
      }

      const created = await prisma.contact.create({
        data: {
          tenantId,
          organizationId,
          display_name,
          first_name: body.first_name ?? null,  // ← added
          last_name:  body.last_name ?? null,   // ← added
          nickname:   body.nickname ?? null,    // ← added
          email: body.email ?? null,
          phoneE164: body.phoneE164 ?? null,
          whatsappE164: body.whatsappE164 ?? null,
          street: body.street ?? null,
          street2: body.street2 ?? null,
          city: body.city ?? null,
          state: body.state ?? null,
          zip: body.zip ?? null,
          country: body.country ?? null,
          archived: !!body.archived && body.archived === true, // rarely set on create
        },
        select: {
          id: true,
          tenantId: true,
          organizationId: true,
          display_name: true,
          first_name: true,   // ← added
          last_name: true,    // ← added
          nickname: true,     // ← added
          email: true,
          phoneE164: true,
          whatsappE164: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          zip: true,
          country: true,
          archived: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // PATCH /contacts/:id
  app.patch("/contacts/:id", async (req, reply) => {
    try {
      ensureAuth(req);

      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.contact.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const body = (req.body as any) ?? {};
      const data: any = {};

      if ("display_name" in body) {
        const dn = String(body.display_name || "").trim();
        if (!dn) return reply.code(400).send({ error: "display_name_required" });
        data.display_name = dn;
      }

      // Allow partial updates of new fields
      if ("first_name" in body) data.first_name = body.first_name ?? null;  // ← added
      if ("last_name" in body)  data.last_name  = body.last_name ?? null;   // ← added
      if ("nickname" in body)   data.nickname   = body.nickname ?? null;    // ← added

      if ("email" in body) data.email = body.email ?? null;
      if ("phoneE164" in body) data.phoneE164 = body.phoneE164 ?? null;
      if ("whatsappE164" in body) data.whatsappE164 = body.whatsappE164 ?? null;
      if ("street" in body) data.street = body.street ?? null;
      if ("street2" in body) data.street2 = body.street2 ?? null;
      if ("city" in body) data.city = body.city ?? null;
      if ("state" in body) data.state = body.state ?? null;
      if ("zip" in body) data.zip = body.zip ?? null;
      if ("country" in body) data.country = body.country ?? null;
      if ("archived" in body) data.archived = !!body.archived;

      // Prevent cross-tenant moves / PK edits
      delete (body as any).id;
      delete (body as any).tenantId;

      // Organization reassignment (same-tenant)
      if ("organizationId" in body) {
        if (body.organizationId == null) {
          data.organizationId = null;
        } else {
          const orgId = idNum(body.organizationId);
          if (!orgId) return reply.code(400).send({ error: "organizationId_invalid" });
          const org = await prisma.organization.findFirst({ where: { id: orgId, tenantId }, select: { id: true } });
          if (!org) return reply.code(404).send({ error: "organization_not_found" });
          data.organizationId = org.id;
        }
      }

      const updated = await prisma.contact.update({
        where: { id: existing.id },
        data,
        select: {
          id: true,
          tenantId: true,
          organizationId: true,
          display_name: true,
          first_name: true,   // ← added
          last_name: true,    // ← added
          nickname: true,     // ← added
          email: true,
          phoneE164: true,
          whatsappE164: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          zip: true,
          country: true,
          archived: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // POST /contacts/:id/archive
  app.post("/contacts/:id/archive", async (req, reply) => {
    try {
      ensureAuth(req);

      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const updated = await prisma.contact.update({
        where: { id },
        data: { archived: true },
        select: { id: true, archived: true, updatedAt: true },
      });

      return reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // POST /contacts/:id/restore
  app.post("/contacts/:id/restore", async (req, reply) => {
    try {
      ensureAuth(req);

      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const updated = await prisma.contact.update({
        where: { id },
        data: { archived: false },
        select: { id: true, archived: true, updatedAt: true },
      });

      return reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /contacts/:id/audit  (stub until wired to real audit log)
  app.get("/contacts/:id/audit", async (_req, reply) => {
    return reply.send([] as any[]);
  });

  // GET /contacts/:id/affiliations  (returns org if present)
  app.get("/contacts/:id/affiliations", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const id = idNum((req.params as any).id);
    if (!id) return reply.code(400).send({ error: "bad_id" });

    const c = await prisma.contact.findFirst({
      where: { id, tenantId },
      select: { organizationId: true },
    });
    if (!c) return reply.code(404).send({ error: "not_found" });

    if (!c.organizationId) return reply.send([]);

    const org = await prisma.organization.findFirst({
      where: { id: c.organizationId, tenantId },
      select: { id: true, name: true, email: true, phone: true },
    });

    return reply.send(org ? [org] : []);
  });
};

export default contactsRoutes;
