// src/routes/breeds.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import prisma from "../prisma.js";

/** ───────────────────────────────────────────────────────────────────────────
 * Helpers
 * ─────────────────────────────────────────────────────────────────────────── */
async function assertOrgInTenant(orgId: number, tenantId: number) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, tenantId: true },
  });
  if (!org) throw Object.assign(new Error("not_found"), { statusCode: 404 });
  if (org.tenantId !== tenantId) {
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }
  return org;
}

const SPECIES_SET = new Set(["DOG", "CAT", "HORSE"]);
function assertSpecies(s?: string) {
  const val = String(s || "").toUpperCase();
  if (!SPECIES_SET.has(val)) {
    const err = new Error("invalid_species");
    (err as any).statusCode = 400;
    throw err;
  }
  return val as "DOG" | "CAT" | "HORSE";
}

/** Minimal canonical lists for now. You can expand or replace with a DB table later. */
const CANONICAL_BREEDS: Record<"DOG" | "CAT" | "HORSE", string[]> = {
  DOG: [
    "Labrador Retriever", "Golden Retriever", "German Shepherd", "French Bulldog", "Poodle",
    "Bulldog", "Beagle", "Rottweiler", "Dachshund", "Australian Shepherd",
    "Yorkshire Terrier", "Boxer", "Cavalier King Charles Spaniel", "Doberman Pinscher",
    "Great Dane", "Miniature Schnauzer", "Pembroke Welsh Corgi", "Siberian Husky",
    "Shih Tzu", "Boston Terrier"
  ],
  CAT: [
    "Domestic Shorthair", "Domestic Longhair", "Maine Coon", "Ragdoll", "Siamese",
    "British Shorthair", "Bengal", "Persian", "Sphynx", "Scottish Fold"
  ],
  HORSE: [
    "Quarter Horse", "Thoroughbred", "Arabian", "Paint Horse", "Appaloosa",
    "Morgan", "Tennessee Walking Horse", "Warmblood", "Friesian", "Mustang"
  ]
};

function searchCanonical(species: "DOG" | "CAT" | "HORSE", q: string, limit: number) {
  const list = CANONICAL_BREEDS[species] || [];
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? list.filter(n => n.toLowerCase().includes(needle))
    : list.slice();
  return filtered
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit)
    .map(name => ({ name, species, source: "canonical" as const }));
}

function dedupeByName(items: Array<{ name: string }>) {
  const seen = new Set<string>();
  const out: typeof items = [];
  for (const it of items) {
    const k = it.name.trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}

/** Response row shape the UI can consume easily */
type BreedRow = {
  id?: number;                     // present for custom breeds
  name: string;
  species: "DOG" | "CAT" | "HORSE";
  source: "canonical" | "custom";
};

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

  // Canonical + Custom search
  // GET /breeds/search?species=DOG&q=&limit=200&organizationId=123&registries=AKC,FCI
  app.get("/breeds/search", async (req, reply) => {
    const { q = "", species = "", limit = "100", organizationId, registries } = (req.query || {}) as {
      q?: string;
      species?: string;
      limit?: string | number;
      organizationId?: string | number;
      registries?: string; // comma list, not used yet
    };

    const sp = assertSpecies(species);
    const take = Math.min(200, Math.max(1, Number(limit) || 100));

    // Always provide canonical suggestions
    const canon = searchCanonical(sp, String(q), take);

    // Optionally merge org custom breeds when org is provided
    let custom: BreedRow[] = [];
    const tenantId = Number((req as any).tenantId);
    if (organizationId != null) {
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
      const orgId = Number(organizationId);
      if (!orgId) return reply.code(400).send({ error: "organizationId_required" });
      await assertOrgInTenant(orgId, tenantId);

      const where: any = { organizationId: orgId, species: sp };
      if (q) where.name = { contains: String(q), mode: "insensitive" as const };

      const rows = await prisma.customBreed.findMany({
        where,
        orderBy: [{ name: "asc" }],
        take: take,
        select: { id: true, name: true, species: true },
      });

      custom = rows.map(r => ({
        id: r.id,
        name: r.name,
        species: r.species as "DOG" | "CAT" | "HORSE",
        source: "custom",
      }));
    }

    // Merge and dedupe by name, prefer custom entries on conflict
    const merged = dedupeByName([...custom, ...canon]).slice(0, take);
    return reply.send({ items: merged, total: merged.length });
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
