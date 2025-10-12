// src/routes/tags.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

type Module = "CONTACT" | "ORGANIZATION" | "ANIMAL";

/* ───────────────────────── helpers ───────────────────────── */

function parseIntOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(200, Math.max(1, Number(q?.limit ?? 50) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function errorReply(err: unknown) {
  const any = err as any;
  const code = any?.code;
  if (code === "P2002") {
    return { status: 409, payload: { error: "conflict", detail: "Unique constraint violation" } };
  }
  if (code === "P2025") {
    return { status: 404, payload: { error: "not_found" } };
  }
  return { status: 500, payload: { error: "internal_error", detail: any?.message || "Unexpected error" } };
}

function tagDTO(t: any) {
  return {
    id: t.id,
    name: t.name,
    module: t.module as Module,
    color: t.color ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/* ───────────────────────── routes ───────────────────────── */

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /tags?module=CONTACT&q=&page=&limit=
  app.get("/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { module = "", q = "" } = (req.query || {}) as {
        module?: Module | "";
        q?: string;
        page?: string;
        limit?: string;
      };
      const { page, limit, skip } = parsePaging(req.query);

      const where: any = { tenantId };
      if (module) where.module = module;
      if (q) where.name = { contains: q, mode: "insensitive" };

      const [itemsRaw, total] = await prisma.$transaction([
        prisma.tag.findMany({
          where,
          orderBy: [{ name: "asc" }],
          skip,
          take: limit,
          select: { id: true, name: true, module: true, color: true, createdAt: true, updatedAt: true },
        }),
        prisma.tag.count({ where }),
      ]);

      const items = itemsRaw.map(tagDTO);
      reply.send({ items, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /tags  body: { name, module, color? }
  app.post("/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = (req.body || {}) as { name?: string; module?: Module; color?: string | null };
      const name = String(body.name || "").trim();
      const module = body.module;

      if (!name) return reply.code(400).send({ error: "name_required" });
      if (!module || !["CONTACT", "ORGANIZATION", "ANIMAL"].includes(module)) {
        return reply.code(400).send({ error: "module_invalid" });
      }

      const created = await prisma.tag.create({
        data: { tenantId, name, module, color: body.color ?? null },
        select: { id: true, name: true, module: true, color: true, createdAt: true, updatedAt: true },
      });
      return reply.code(201).send(tagDTO(created));
    } catch (e: any) {
      if (e?.code === "P2002") {
        return reply
          .code(409)
          .send({ error: "duplicate_tag", detail: "name_must_be_unique_within_tenant_and_module" });
      }
      const { status, payload } = errorReply(e);
      reply.status(status).send(payload);
    }
  });

  // GET /tags/:id
  app.get("/tags/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const tag = await prisma.tag.findFirst({
        where: { id: Number(id), tenantId },
        select: { id: true, name: true, module: true, color: true, createdAt: true, updatedAt: true },
      });
      if (!tag) return reply.code(404).send({ error: "not_found" });
      reply.send(tagDTO(tag));
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // PATCH /tags/:id   body: { name?, color? }
  // Module is immutable after creation to keep assignment semantics consistent.
  app.patch("/tags/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const existing = await prisma.tag.findFirst({
        where: { id: Number(id), tenantId },
        select: { id: true, module: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const body = (req.body || {}) as { name?: string; color?: string | null };
      const data: any = {};
      if (body.name !== undefined) {
        const n = String(body.name || "").trim();
        if (!n) return reply.code(400).send({ error: "name_required" });
        data.name = n;
      }
      if (body.color !== undefined) data.color = body.color;

      const updated = await prisma.tag.update({
        where: { id: existing.id },
        data,
        select: { id: true, name: true, module: true, color: true, createdAt: true, updatedAt: true },
      });
      reply.send(tagDTO(updated));
    } catch (e: any) {
      if (e?.code === "P2002") {
        return reply
          .code(409)
          .send({ error: "duplicate_tag", detail: "name_must_be_unique_within_tenant_and_module" });
      }
      const { status, payload } = errorReply(e);
      reply.status(status).send(payload);
    }
  });

  // DELETE /tags/:id
  app.delete("/tags/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const tag = await prisma.tag.findFirst({ where: { id: Number(id), tenantId }, select: { id: true } });
      if (!tag) return reply.code(404).send({ error: "not_found" });

      await prisma.tag.delete({ where: { id: tag.id } });
      reply.code(204).send();
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /tags/:id/assign   body: { contactId? | organizationId? | animalId? }
  // Exactly one target; target must be in the same tenant; tag.module must match target type.
  app.post("/tags/:id/assign", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const tag = await prisma.tag.findFirst({
        where: { id: Number(id), tenantId },
        select: { id: true, module: true },
      });
      if (!tag) return reply.code(404).send({ error: "not_found" });

      const body = (req.body || {}) as { contactId?: number; organizationId?: number; animalId?: number };
      const targets = ["contactId", "organizationId", "animalId"].filter((k) => (body as any)[k] != null);
      if (targets.length !== 1) return reply.code(400).send({ error: "one_target_required" });

      try {
        if (body.organizationId != null) {
          if (tag.module !== "ORGANIZATION") return reply.code(400).send({ error: "module_mismatch" });
          const orgId = parseIntOrNull(body.organizationId);
          if (!orgId) return reply.code(400).send({ error: "organizationId_invalid" });
          const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true, tenantId: true },
          });
          if (!org) return reply.code(404).send({ error: "organization_not_found" });
          if (org.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });
          await prisma.tagAssignment.create({ data: { tagId: tag.id, organizationId: org.id } });
        } else if (body.contactId != null) {
          if (tag.module !== "CONTACT") return reply.code(400).send({ error: "module_mismatch" });
          const contactId = parseIntOrNull(body.contactId);
          if (!contactId) return reply.code(400).send({ error: "contactId_invalid" });
          const c = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { id: true, tenantId: true },
          });
          if (!c) return reply.code(404).send({ error: "contact_not_found" });
          if (c.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });
          await prisma.tagAssignment.create({ data: { tagId: tag.id, contactId: c.id } });
        } else {
          if (tag.module !== "ANIMAL") return reply.code(400).send({ error: "module_mismatch" });
          const animalId = parseIntOrNull(body.animalId);
          if (!animalId) return reply.code(400).send({ error: "animalId_invalid" });
          const a = await prisma.animal.findUnique({
            where: { id: animalId },
            select: { id: true, tenantId: true },
          });
          if (!a) return reply.code(404).send({ error: "animal_not_found" });
          if (a.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });
          await prisma.tagAssignment.create({ data: { tagId: tag.id, animalId: a.id } });
        }
      } catch (e: any) {
        if (e?.code === "P2002") {
          // @@unique([tagId, contactId]) and siblings
          return reply.code(409).send({ error: "already_assigned" });
        }
        throw e;
      }

      reply.code(201).send({ ok: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /tags/:id/unassign   body: { contactId? | organizationId? | animalId? }
  app.post("/tags/:id/unassign", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const tag = await prisma.tag.findFirst({ where: { id: Number(id), tenantId }, select: { id: true } });
      if (!tag) return reply.code(404).send({ error: "not_found" });

      const body = (req.body || {}) as { contactId?: number; organizationId?: number; animalId?: number };
      const targets = ["contactId", "organizationId", "animalId"].filter((k) => (body as any)[k] != null);
      if (targets.length !== 1) return reply.code(400).send({ error: "one_target_required" });

      if (body.organizationId != null) {
        const orgId = parseIntOrNull(body.organizationId);
        if (!orgId) return reply.code(400).send({ error: "organizationId_invalid" });
        await prisma.tagAssignment.deleteMany({ where: { tagId: tag.id, organizationId: orgId } });
      } else if (body.contactId != null) {
        const contactId = parseIntOrNull(body.contactId);
        if (!contactId) return reply.code(400).send({ error: "contactId_invalid" });
        await prisma.tagAssignment.deleteMany({ where: { tagId: tag.id, contactId } });
      } else {
        const animalId = parseIntOrNull(body.animalId);
        if (!animalId) return reply.code(400).send({ error: "animalId_invalid" });
        await prisma.tagAssignment.deleteMany({ where: { tagId: tag.id, animalId } });
      }

      reply.send({ ok: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });
};

export default routes;
