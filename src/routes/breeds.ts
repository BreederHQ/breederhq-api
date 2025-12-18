// src/routes/breeds.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Species } from "@prisma/client";
import prisma from "../prisma.js";

/** ───────────────────────────────────────────────────────────────────────────
 * Helpers
 * ─────────────────────────────────────────────────────────────────────────── */
const SPECIES_SET = new Set(["DOG", "CAT", "HORSE"]);
function assertSpecies(s?: string) {
  const val = String(s || "").toUpperCase();
  if (!SPECIES_SET.has(val)) {
    const err = new Error("invalid_species") as any;
    err.statusCode = 400;
    throw err;
  }
  return val as "DOG" | "CAT" | "HORSE";
}

/** Pull tenant id from header or request decoration (don’t throw here) */
function readTenantId(req: any): number | null {
  const hdr = Number(req?.headers?.["x-tenant-id"]);
  if (Number.isInteger(hdr) && hdr > 0) return hdr;
  const decorated = Number(req?.tenantId);
  if (Number.isInteger(decorated) && decorated > 0) return decorated;
  return null;
}

type BreedHit = {
  id?: number; // present for custom
  name: string;
  species: "DOG" | "CAT" | "HORSE";
  source: "canonical" | "custom";
  canonicalBreedId?: number | null; // present for canonical
};

function dedupeByName(items: Array<BreedHit>) {
  const seen = new Set<string>();
  const out: BreedHit[] = [];
  for (const it of items) {
    const k = it.name.trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}

/** Tokenized ILIKE AND search on name */
function nameContainsAllTokens(q: string) {
  const tokens = (q || "")
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!tokens.length) return undefined;
  return { AND: tokens.map((t) => ({ name: { contains: t, mode: "insensitive" as const } })) };
}

/** ───────────────────────────────────────────────────────────────────────────
 * Routes
 * ─────────────────────────────────────────────────────────────────────────── */
export default async function breedsRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // GET /species  → enum values
  app.get("/species", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=86400, immutable");
    const items = Array.from(SPECIES_SET).sort(); // ["CAT","DOG","HORSE"]
    return reply.send({ items, total: items.length });
  });

  /**
   * Canonical + Custom search (custom is tenant-scoped).
   * GET /breeds/search?species=DOG&q=golden&limit=20
   *
   * Behavior:
   * - Always returns canonical (from Breed) for the species.
   * - If tenant present (x-tenant-id), merges in tenant’s CustomBreed rows.
   * - Never 400s for missing tenant (so typeahead works before tenant resolve).
   */


  app.get("/breeds/search", async (req, reply) => {
    const { q = "", species = "", limit = "100" } = (req.query || {}) as {
      q?: string; species?: string; limit?: string | number;
    };

    const sp = assertSpecies(species);
    const take = Math.min(200, Math.max(1, Number(limit) || 100));

    const tenantId = readTenantId(req);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const canonWhere: any = { species: sp };
    if (q) Object.assign(canonWhere, nameContainsAllTokens(q));

    // --- Step 1: canonical breeds (MUST NOT crash) ---------------------------
    let canonRows: Array<{ id: number; name: string; species: Species }> = [];
    try {
      canonRows = await prisma.breed.findMany({
        where: canonWhere,
        orderBy: [{ name: "asc" }],
        take,
        select: { id: true, name: true, species: true },
      });
    } catch (err) {
      req.log.error({ err }, "breeds.search: canonical query failed");
      // If even canon fails, bail fast with a readable error in dev
      return reply.code(500).send({ error: "server_error_canonical" });
    }

    // --- Step 2: tenant custom breeds (if this fails, just skip) -------------
    let customRows: Array<{ id: number; name: string; species: Species }> = [];
    try {
      customRows = await prisma.customBreed.findMany({
        where: { tenantId, species: sp, ...(q ? nameContainsAllTokens(q) : {}) },
        orderBy: [{ name: "asc" }],
        take,
        select: { id: true, name: true, species: true },
      });
    } catch (err) {
      req.log.warn({ err }, "breeds.search: custom query failed — continuing without custom");
      customRows = [];
    }

    // --- Step 3: registries (safe join using the real relation name) -----------
    let regsByBreed = new Map<number, Array<{ code: string; status?: string | null; primary?: boolean | null }>>();
    try {
      const breedIds = canonRows.map(b => b.id);
      if (breedIds.length) {
        const links = await prisma.breedRegistryLink.findMany({
          where: { breedId: { in: breedIds } },
          select: {
            breedId: true,
            statusText: true,
            primary: true,
            // THIS is the correct relation name according to Prisma's error hint:
            registry: { select: { id: true, code: true, name: true } },
          },
        });

        regsByBreed = new Map();
        for (const l of links) {
          // l.registry can be null if the FK is optional — guard it
          if (!l.registry) continue;
          const arr = regsByBreed.get(l.breedId) || [];
          arr.push({
            code: l.registry.code ?? "",
            status: l.statusText ?? null,
            primary: l.primary ?? null,
          });
          regsByBreed.set(l.breedId, arr);
        }
      }
    } catch (err) {
      req.log.warn({ err }, "breeds.search: registries join failed — continuing without registries");
      regsByBreed = new Map();
    }

    // --- Build outputs --------------------------------------------------------
    type OutRow = {
      id?: number;
      name: string;
      species: Species;
      source: "canonical" | "custom";
      canonicalBreedId?: number | null;
      registries?: Array<{ code: string; status?: string | null; primary?: boolean | null }>;
    };

    const canon: OutRow[] = canonRows.map(r => ({
      name: r.name,
      species: r.species,
      source: "canonical",
      canonicalBreedId: r.id,
      registries: regsByBreed.get(r.id) || [],
    }));

    const custom: OutRow[] = customRows.map(r => ({
      id: r.id,
      name: r.name,
      species: r.species,
      source: "custom",
      registries: [],
    }));

    // Prefer custom on name collisions
    const merged: OutRow[] = [];
    const seen = new Set<string>();
    for (const it of [...custom, ...canon]) {
      const k = `${it.species}::${it.name}`.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(it);
      if (merged.length >= take) break;
    }

    return reply.send({ items: merged, total: merged.length });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tenant-scoped Custom breeds (CRUD)
  // Base: /breeds/custom
  // ───────────────────────────────────────────────────────────────────────────

  // LIST: GET /breeds/custom?species=&q=&page=&limit=
  app.get("/breeds/custom", async (req, reply) => {
    const { species = "", q = "", page = "1", limit = "25" } = (req.query || {}) as {
      species?: string;
      q?: string;
      page?: string;
      limit?: string;
    };

    const tenantId = readTenantId(req);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const take = Math.min(100, Math.max(1, Number(limit) || 25));
    const skip = Math.max(0, ((Number(page) || 1) - 1) * take);

    const where: any = { tenantId };
    if (species) where.species = assertSpecies(species);
    if (q) Object.assign(where, nameContainsAllTokens(q));

    const [data, total] = await prisma.$transaction([
      prisma.customBreed.findMany({
        where,
        orderBy: [{ species: "asc" }, { name: "asc" }],
        skip,
        take,
        select: { id: true, tenantId: true, species: true, name: true, createdAt: true, updatedAt: true },
      }),
      prisma.customBreed.count({ where }),
    ]);

    reply.send({ data, total, page: Number(page) || 1, limit: take });
  });

  // READ: GET /breeds/custom/:id
  app.get("/breeds/custom/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = readTenantId(req);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const rec = await prisma.customBreed.findFirst({
      where: { id: Number(id), tenantId },
      select: { id: true, tenantId: true, species: true, name: true, createdAt: true, updatedAt: true },
    });
    if (!rec) return reply.code(404).send({ error: "not_found" });
    reply.send(rec);
  });

  // CREATE: POST /breeds/custom  { species: "DOG"|"CAT"|"HORSE", name: string }
  app.post("/breeds/custom", async (req, reply) => {
    const body = (req.body || {}) as { species?: string; name?: string };
    const tenantId = readTenantId(req);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const species = assertSpecies(body.species);
    const name = String(body.name || "").trim();
    if (!name) return reply.code(400).send({ error: "name_required" });

    try {
      const created = await prisma.customBreed.create({
        data: { tenantId, species, name },
        select: { id: true, tenantId: true, species: true, name: true, createdAt: true, updatedAt: true },
      });
      return reply.code(201).send(created);
    } catch (e: any) {
      if (e?.code === "P2002") {
        return reply.code(409).send({ error: "duplicate_breed", details: { species, name } });
      }
      throw e;
    }
  });

  // UPDATE: PATCH /breeds/custom/:id  { name?, species? }
  app.patch("/breeds/custom/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { name?: string; species?: string };
    const tenantId = readTenantId(req);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const data: any = {};
    if (body.name !== undefined) {
      const n = String(body.name || "").trim();
      if (!n) return reply.code(400).send({ error: "name_required" });
      data.name = n;
    }
    if (body.species !== undefined) data.species = assertSpecies(body.species);

    try {
      const existing = await prisma.customBreed.findUnique({
        where: { id: Number(id) },
        select: { tenantId: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });
      if (existing.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });

      const updated = await prisma.customBreed.update({
        where: { id: Number(id) },
        data,
        select: { id: true, tenantId: true, species: true, name: true, createdAt: true, updatedAt: true },
      });
      reply.send(updated);
    } catch (e: any) {
      if (e?.code === "P2002") return reply.code(409).send({ error: "duplicate_breed" });
      if (e?.code === "P2025") return reply.code(404).send({ error: "not_found" });
      throw e;
    }
  });

  // DELETE: DELETE /breeds/custom/:id
  app.delete("/breeds/custom/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = readTenantId(req);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    try {
      const rec = await prisma.customBreed.findUnique({
        where: { id: Number(id) },
        select: { tenantId: true },
      });
      if (!rec) return reply.code(404).send({ error: "not_found" });
      if (rec.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });

      await prisma.customBreed.delete({ where: { id: Number(id) } });
      reply.send({ ok: true });
    } catch (e: any) {
      if (e?.code === "P2025") return reply.code(404).send({ error: "not_found" });
      throw e;
    }
  });
}
