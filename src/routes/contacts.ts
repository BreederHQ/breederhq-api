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
          { first_name: { contains: search, mode: "insensitive" } }, // ← added
          { last_name: { contains: search, mode: "insensitive" } }, // ← added
          { nickname: { contains: search, mode: "insensitive" } }, // ← added
          { email: { contains: search, mode: "insensitive" } },
          { phoneE164: { contains: search, mode: "insensitive" } },
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
          last_name: body.last_name ?? null,   // ← added
          nickname: body.nickname ?? null,    // ← added
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
  // helpers at top of file (or near this route)
  function contactDTO(row: any) {
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenantId,
      displayName: row.display_name,
      firstName: row.first_name ?? null,
      lastName: row.last_name ?? null,
      nickname: row.nickname ?? null,
      email: row.email ?? null,
      phone: row.phoneE164 ?? null,
      whatsapp: row.whatsappE164 ?? null,
      street: row.street ?? null,
      street2: row.street2 ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      postalCode: row.zip ?? null,
      country: row.country ?? null,
      notes: row.notes ?? null,           // if you don’t have notes, drop this line
      archived: row.archived,
      organizationId: row.organizationId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  function setIfProvidedCamel(
    src: Record<string, any>,
    dst: Record<string, any>,
    camelKey: string,
    dbKey: string,
    transform?: (v: any) => any
  ) {
    if (Object.prototype.hasOwnProperty.call(src, camelKey)) {
      const v = src[camelKey];
      dst[dbKey] = transform ? transform(v) : v;
    }
  }

  // ---------- PATCH /contacts/:id ----------
  app.patch<{
    Params: { id: string };
    Body: Partial<{
      firstName: string | null;
      lastName: string | null;
      displayName: string | null;
      nickname: string | null;
      email: string | null;
      phone: string | null;         // maps to phoneE164
      whatsapp: string | null;      // maps to whatsappE164
      street: string | null;
      street2: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;    // maps to zip
      country: string | null;
      notes: string | null;         // drop if your schema doesn’t have a notes column
      archived: boolean;
      organizationId: number | null;
    }>;
  }>("/contacts/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const contactId = Number(req.params.id);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return reply.code(400).send({ error: "invalid_contact_id" });
    }

    // Ensure contact exists in this tenant
    const existing = await app.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, organizationId: true },
    });
    if (!existing) return reply.code(404).send({ error: "contact_not_found" });

    const body = (req.body || {}) as Record<string, any>;

    // Build Prisma data (snake_case) from camelCase body
    const dataCore: Record<string, any> = {};
    const trimOrNull = (v: any) => (v == null ? null : String(v).trim());

    setIfProvidedCamel(body, dataCore, "displayName", "display_name", trimOrNull);
    setIfProvidedCamel(body, dataCore, "firstName", "first_name", trimOrNull);
    setIfProvidedCamel(body, dataCore, "lastName", "last_name", trimOrNull);
    setIfProvidedCamel(body, dataCore, "nickname", "nickname", trimOrNull);
    setIfProvidedCamel(body, dataCore, "email", "email", trimOrNull);

    // special mappings
    setIfProvidedCamel(body, dataCore, "phone", "phoneE164", trimOrNull);
    setIfProvidedCamel(body, dataCore, "whatsapp", "whatsappE164", trimOrNull);
    setIfProvidedCamel(body, dataCore, "postalCode", "zip", trimOrNull);

    // address
    setIfProvidedCamel(body, dataCore, "street", "street", trimOrNull);
    setIfProvidedCamel(body, dataCore, "street2", "street2", trimOrNull);
    setIfProvidedCamel(body, dataCore, "city", "city", trimOrNull);
    setIfProvidedCamel(body, dataCore, "state", "state", trimOrNull);
    setIfProvidedCamel(body, dataCore, "country", "country", trimOrNull);

    // optional notes (remove if not in DB)
    setIfProvidedCamel(body, dataCore, "notes", "notes", (v) => (v == null ? null : String(v)));

    if (Object.prototype.hasOwnProperty.call(body, "archived")) {
      dataCore.archived = Boolean(body.archived);
    }

    // Handle organizationId separately (validate tenant, allow null to clear)
    if (Object.prototype.hasOwnProperty.call(body, "organizationId")) {
      const orgVal = body.organizationId;
      if (orgVal === null) {
        dataCore.organizationId = null; // clear link
      } else {
        const orgId = Number(orgVal);
        if (!Number.isInteger(orgId) || orgId <= 0) {
          return reply.code(400).send({ error: "organizationId_invalid" });
        }
        const org = await app.prisma.organization.findFirst({
          where: { id: orgId, tenantId },
          select: { id: true },
        });
        if (!org) {
          return reply.code(404).send({ error: "organization_not_found_or_wrong_tenant" });
        }
        dataCore.organizationId = org.id;
      }
    }

    if (Object.keys(dataCore).length === 0) {
      return reply.code(400).send({ error: "no_update_fields" });
    }

    try {
      const updatedDb = await app.prisma.contact.update({
        where: { id: existing.id },
        data: dataCore,
        // select snake_case, then map to camelCase DTO
        select: {
          id: true,
          tenantId: true,
          display_name: true,
          first_name: true,
          last_name: true,
          nickname: true,
          email: true,
          phoneE164: true,
          whatsappE164: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          zip: true,
          country: true,
          // notes: true, // uncomment if you have this field in your schema
          archived: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.send(contactDTO(updatedDb));
    } catch (err: any) {
      req.log.error({ err }, "contacts.patch failed");
      if (err?.code === "P2002") {
        return reply.code(409).send({ error: "conflict", detail: "unique_constraint_violation" });
      }
      if (err?.code === "P2003") {
        return reply.code(400).send({ error: "foreign_key_violation" });
      }
      return reply.code(500).send({ error: "internal_error", detail: err?.message || "unexpected" });
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
