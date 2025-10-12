// src/routes/breeds.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import prisma from "../prisma.js";

// Helper: ensure organization exists and belongs to the active tenant
async function assertOrgInTenant(orgId: number, tenantId: number) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, tenantId: true },
  });
  if (!org) throw Object.assign(new Error("not_found"), { statusCode: 404 });
  // Enforce tenancy even if tenantId is nullable in the current schema
  if (org.tenantId !== tenantId) {
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }
  return org;
}

// Validate Species enum (DOG | CAT | HORSE)
const Species = new Set(["DOG", "CAT", "HORSE"]);
function assertSpecies(s?: string) {
  const val = String(s || "").toUpperCase();
  if (!Species.has(val)) {
    const err = new Error("invalid_species");
    (err as any).statusCode = 400;
    throw err;
  }
  return val as "DOG" | "CAT" | "HORSE";
}

export default async function breedsRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // ───────────────────────────────────────────────────────────────────────────
  // Canonical breeds search (placeholder until a CanonicalBreed model exists)
  // GET /breeds/search?q=&species=
  // ───────────────────────────────────────────────────────────────────────────
  app.get("/breeds/search", async (req, reply) => {
    const { q = "", species = "" } = (req.query || {}) as { q?: string; species?: string };
    // Not implemented because schema has no CanonicalBreed table yet.
    return reply.code(501).send({
      ok: false,
      error: "not_implemented",
      message:
        "Canonical breed search requires a CanonicalBreed model or external provider. Add the model, then wire this route.",
      echo: { q, species },
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Custom breeds (CRUD) — tenant-scoped via organization → tenant
  // Base: /breeds/custom
  // ───────────────────────────────────────────────────────────────────────────

  // LIST: GET /breeds/custom?organizationId=&species=&q=&page=&limit=
  app.get("/breeds/custom", async (req, reply) => {
    const { organizationId, species = "", q = "", page = "1", limit = "25" } = (req.query || {}) as {
      organizationId?: string;
      species?: string;
      q?: string;
      page?: string;
      limit?: string;
    };

    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const orgId = Number(organizationId);
    if (!orgId) return reply.code(400).send({ error: "organizationId_required" });

    await assertOrgInTenant(orgId, tenantId);

    const take = Math.min(100, Math.max(1, Number(limit) || 25));
    const skip = Math.max(0, ((Number(page) || 1) - 1) * take);

    const where: any = { organizationId: orgId };
    if (species) where.species = assertSpecies(species);
    if (q) where.name = { contains: String(q), mode: "insensitive" as const };

    const [data, total] = await prisma.$transaction([
      prisma.customBreed.findMany({
        where,
        orderBy: [{ species: "asc" }, { name: "asc" }],
        skip,
        take,
        select: { id: true, organizationId: true, species: true, name: true, createdAt: true, updatedAt: true },
      }),
      prisma.customBreed.count({ where }),
    ]);

    reply.send({ data, total, page: Number(page) || 1, limit: take });
  });

  // READ: GET /breeds/custom/:id?organizationId=
  app.get("/breeds/custom/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { organizationId } = (req.query || {}) as { organizationId?: string };

    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const orgId = Number(organizationId);
    if (!orgId) return reply.code(400).send({ error: "organizationId_required" });
    await assertOrgInTenant(orgId, tenantId);

    const rec = await prisma.customBreed.findFirst({
      where: { id: Number(id), organizationId: orgId },
      select: { id: true, organizationId: true, species: true, name: true, createdAt: true, updatedAt: true },
    });
    if (!rec) return reply.code(404).send({ error: "not_found" });
    reply.send(rec);
  });

  // CREATE: POST /breeds/custom
  // body: { organizationId: number, species: "DOG"|"CAT"|"HORSE", name: string }
  app.post("/breeds/custom", async (req, reply) => {
    const body = (req.body || {}) as { organizationId?: number; species?: string; name?: string };

    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const orgId = Number(body.organizationId);
    if (!orgId) return reply.code(400).send({ error: "organizationId_required" });
    await assertOrgInTenant(orgId, tenantId);

    const species = assertSpecies(body.species);
    const name = String(body.name || "").trim();
    if (!name) return reply.code(400).send({ error: "name_required" });

    try {
      const created = await prisma.customBreed.create({
        data: { organizationId: orgId, species, name },
        select: { id: true, organizationId: true, species: true, name: true, createdAt: true, updatedAt: true },
      });
      return reply.code(201).send(created);
    } catch (e: any) {
      // Handle @@unique([organizationId, species, name])
      if (e?.code === "P2002") {
        return reply.code(409).send({ error: "duplicate_breed", details: { organizationId: orgId, species, name } });
      }
      throw e;
    }
  });

  // UPDATE: PATCH /breeds/custom/:id
  // body: { organizationId: number, name?: string, species?: enum }
  app.patch("/breeds/custom/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { organizationId?: number; name?: string; species?: string };

    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const orgId = Number(body.organizationId);
    if (!orgId) return reply.code(400).send({ error: "organizationId_required" });
    await assertOrgInTenant(orgId, tenantId);

    const data: any = {};
    if (body.name !== undefined) {
      const n = String(body.name || "").trim();
      if (!n) return reply.code(400).send({ error: "name_required" });
      data.name = n;
    }
    if (body.species !== undefined) {
      data.species = assertSpecies(body.species);
    }

    try {
      const updated = await prisma.customBreed.update({
        where: { id: Number(id) },
        data,
        select: { id: true, organizationId: true, species: true, name: true, createdAt: true, updatedAt: true },
      });
      // sanity: make sure it still belongs to the same org/tenant
      if (updated.organizationId !== orgId) {
        return reply.code(403).send({ error: "forbidden" });
      }
      reply.send(updated);
    } catch (e: any) {
      if (e?.code === "P2002") {
        return reply.code(409).send({ error: "duplicate_breed" });
      }
      if (e?.code === "P2025") {
        return reply.code(404).send({ error: "not_found" });
      }
      throw e;
    }
  });


// GET /species  → enum values for Species (DOG | CAT | HORSE)
app.get("/species", async (_req, reply) => {
  // cache for a day; change if you expect enum updates during a deploy
  reply.header("Cache-Control", "public, max-age=86400, immutable");
  const items = Array.from(SpeciesSet).sort(); // ["CAT","DOG","HORSE"]
  return reply.send({ items, total: items.length });
});

  // DELETE: DELETE /breeds/custom/:id?organizationId=
  app.delete("/breeds/custom/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { organizationId } = (req.query || {}) as { organizationId?: string };

    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const orgId = Number(organizationId);
    if (!orgId) return reply.code(400).send({ error: "organizationId_required" });
    await assertOrgInTenant(orgId, tenantId);

    try {
      // Delete only if the record belongs to this org
      const rec = await prisma.customBreed.findUnique({ where: { id: Number(id) }, select: { organizationId: true } });
      if (!rec) return reply.code(404).send({ error: "not_found" });
      if (rec.organizationId !== orgId) return reply.code(403).send({ error: "forbidden" });

      await prisma.customBreed.delete({ where: { id: Number(id) } });
      reply.send({ ok: true });
    } catch (e: any) {
      if (e?.code === "P2025") return reply.code(404).send({ error: "not_found" });
      throw e;
    }
  });
}
