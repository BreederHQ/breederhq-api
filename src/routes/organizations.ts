// src/routes/organizations.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

type SortKey = "name" | "createdAt" | "updatedAt";

function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 25) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function parseSort(q: any) {
  // Accepts "name:asc,createdAt:desc"
  const s = String(q?.sort || "").trim();
  const allowed: SortKey[] = ["name", "createdAt", "updatedAt"];
  if (!s) return [{ createdAt: "desc" }] as any[];
  const orderBy: any[] = [];
  for (const piece of s.split(",").map((p: string) => p.trim()).filter(Boolean)) {
    const [fieldRaw, dirRaw] = piece.split(":");
    const field = fieldRaw as SortKey;
    const dir = (dirRaw || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    if (allowed.includes(field)) orderBy.push({ [field]: dir });
  }
  return orderBy.length ? orderBy : [{ createdAt: "desc" }];
}

function idNum(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function getOrgInTenant(orgId: number, tenantId: number) {
  const org = await prisma.organization.findFirst({
    where: { id: orgId, tenantId },
    select: { id: true },
  });
  if (!org) {
    // Hide cross-tenant existence by default, but if you prefer explicit, keep this split:
    const exists = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!exists) throw Object.assign(new Error("not_found"), { statusCode: 404 });
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }
  return org;
}

function errorReply(err: any) {
  if (err?.code === "P2002") {
    // @@unique([tenantId, name])
    return { status: 409, payload: { error: "duplicate_org", detail: "name_must_be_unique_within_tenant" } };
  }
  if (err?.code === "P2003") {
    // FK constraint, likely contacts or animals referencing this org
    return { status: 409, payload: { error: "cannot_delete_org_with_dependents" } };
  }
  if (err?.statusCode) {
    return { status: err.statusCode, payload: { error: err.message } };
  }
  return { status: 500, payload: { error: "internal_error" } };
}

/* ───────────────────────── routes ───────────────────────── */

const organizationsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /organizations?q=&includeArchived=&page=&limit=&sort=
  app.get("/organizations", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const q = (req.query || {}) as {
        q?: string;
        includeArchived?: string | "1" | "true";
        page?: string;
        limit?: string;
        sort?: string;
      };

      const search = String(q.q || "").trim();
      const includeArchived =
        q.includeArchived === "1" || String(q.includeArchived || "").toLowerCase() === "true";
      const { page, limit, skip } = parsePaging(q);
      const orderBy = parseSort(q);

      const where: any = { tenantId };
      if (!includeArchived) where.archived = false;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
          { state: { contains: search, mode: "insensitive" } },
          { country: { contains: search, mode: "insensitive" } },
        ];
      }

      const [items, total] = await prisma.$transaction([
        prisma.organization.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            website: true,
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
        prisma.organization.count({ where }),
      ]);

      reply.send({ items, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /organizations/:id
  app.get("/organizations/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const org = await prisma.organization.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          website: true,
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
      if (!org) return reply.code(404).send({ error: "not_found" });
      reply.send(org);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /organizations
  app.post("/organizations", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const b = (req.body || {}) as Partial<{
        name: string;
        email: string | null;
        phone: string | null;
        website: string | null;
        street: string | null;
        street2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        country: string | null;
      }>;

      const name = String(b.name || "").trim();
      if (!name) return reply.code(400).send({ error: "name_required" });

      const created = await prisma.organization.create({
        data: {
          tenantId,
          name,
          email: b.email ?? null,
          phone: b.phone ?? null,
          website: b.website ?? null,
          street: b.street ?? null,
          street2: b.street2 ?? null,
          city: b.city ?? null,
          state: b.state ?? null,
          zip: b.zip ?? null,
          country: b.country ?? null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          website: true,
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
    } catch (e: any) {
      const { status, payload } = errorReply(e);
      return reply.code(status).send(payload);
    }
  });

  // PATCH /organizations/:id
  app.patch("/organizations/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      await getOrgInTenant(id, tenantId);

      const b = (req.body || {}) as Partial<{
        name: string;
        email: string | null;
        phone: string | null;
        website: string | null;
        street: string | null;
        street2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        country: string | null;
        archived: boolean;
      }>;

      const data: any = {};
      if (b.name !== undefined) {
        const n = String(b.name || "").trim();
        if (!n) return reply.code(400).send({ error: "name_required" });
        data.name = n;
      }
      if (b.email !== undefined) data.email = b.email;
      if (b.phone !== undefined) data.phone = b.phone;
      if (b.website !== undefined) data.website = b.website;
      if (b.street !== undefined) data.street = b.street;
      if (b.street2 !== undefined) data.street2 = b.street2;
      if (b.city !== undefined) data.city = b.city;
      if (b.state !== undefined) data.state = b.state;
      if (b.zip !== undefined) data.zip = b.zip;
      if (b.country !== undefined) data.country = b.country;
      if (b.archived !== undefined) data.archived = !!b.archived;

      const updated = await prisma.organization.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          website: true,
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

      reply.send(updated);
    } catch (e: any) {
      const { status, payload } = errorReply(e);
      reply.status(status).send(payload);
    }
  });

  // POST /organizations/:id/archive
  app.post("/organizations/:id/archive", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      await getOrgInTenant(id, tenantId);
      await prisma.organization.update({ where: { id }, data: { archived: true } });
      reply.send({ ok: true });
    } catch (e: any) {
      const { status, payload } = errorReply(e);
      reply.status(status).send(payload);
    }
  });

  // POST /organizations/:id/restore
  app.post("/organizations/:id/restore", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      await getOrgInTenant(id, tenantId);
      await prisma.organization.update({ where: { id }, data: { archived: false } });
      reply.send({ ok: true });
    } catch (e: any) {
      const { status, payload } = errorReply(e);
      reply.status(status).send(payload);
    }
  });

  // DELETE /organizations/:id  (hard delete; tenant enforced; FK-safe)
  app.delete("/organizations/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      await getOrgInTenant(id, tenantId);

      // Preflight check to produce a friendlier error than raw P2003
      const [contactRefCount, animalRefCount] = await Promise.all([
        prisma.contact.count({ where: { organizationId: id, tenantId } }),
        prisma.animal.count({ where: { organizationId: id, tenantId } }),
      ]);
      if (contactRefCount > 0 || animalRefCount > 0) {
        return reply
          .code(409)
          .send({ error: "cannot_delete_org_with_dependents", contacts: contactRefCount, animals: animalRefCount });
      }

      await prisma.organization.delete({ where: { id } });
      reply.send({ ok: true });
    } catch (e: any) {
      const { status, payload } = errorReply(e);
      reply.status(status).send(payload);
    }
  });
};

export default organizationsRoutes;
