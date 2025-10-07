// src/routes/breeds.ts
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ───────────────────────────────────────────────────────────
   Header helpers
   ─────────────────────────────────────────────────────────── */
function requireOrgId(h: any): number {
  const raw = (h["x-org-id"] ?? h["X-Org-Id"] ?? "").toString().trim();
  if (!raw) throw new Error("X-Org-Id required");
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error("X-Org-Id must be numeric");
  return n;
}

/** Non-throwing org extractor (canonical search can work without org) */
function tryOrgId(h: any): number | null {
  const raw = (h["x-org-id"] ?? h["X-Org-Id"] ?? "").toString().trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const Species = z.enum(["DOG", "CAT", "HORSE"]);

/* ───────────────────────────────────────────────────────────
   Query DTOs
   ─────────────────────────────────────────────────────────── */
/** GET /api/v1/breeds/search
 *  Query: species=DOG|CAT|HORSE, q?, limit?, registries? (CSV of codes)
 *  Returns canonical breeds with limited registry link fields.
 *
 *  NOTE: We accept any positive limit and clamp server-side
 *  to avoid throwing (prevents 500s on limit=120, etc).
 */
const QuerySearch = z.object({
  species: Species,
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().optional(),
  registries: z.string().optional(), // CSV list, optional
});

/** GET /api/v1/breeds/custom (org-scoped list of CustomBreed for species) */
const QueryCustomList = z.object({
  species: Species.optional(),
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

/** POST/PATCH input for custom breeds */
const UpsertCustom = z.object({
  name: z.string().min(2),
  species: Species,
  canonicalBreedId: z.string().nullish(),
  aliases: z.array(z.string().min(1)).optional(),
});

/* ───────────────────────────────────────────────────────────
   Helper: read enabled registry codes from OrgSetting.preferences
   Shape: { registryCodesEnabled: string[] }
   ─────────────────────────────────────────────────────────── */
async function getEnabledRegistryCodes(
  orgId: number | null,
  prismaClient: PrismaClient
): Promise<string[]> {
  if (orgId == null) return [];
  const row = await prismaClient.$queryRaw<Array<{ preferences: any }>>`
    SELECT preferences FROM "OrgSetting" WHERE "organizationId" = ${orgId} LIMIT 1`;
  const prefs = row?.[0]?.preferences ?? {};
  return Array.isArray(prefs.registryCodesEnabled) ? prefs.registryCodesEnabled : [];
}

/* ───────────────────────────────────────────────────────────
   Routes
   ─────────────────────────────────────────────────────────── */
export default async function breedsRoutes(app: FastifyInstance) {
  // 1) Canonical breeds search (species-scoped; registry badges filtered)
  app.get("/api/v1/breeds/search", async (req, reply) => {
    try {
      // Org is OPTIONAL for canonical search; missing/invalid should not 500
      const orgId = tryOrgId(req.headers);

      const parsed = QuerySearch.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_query", details: parsed.error.flatten() });
      }
      const q = parsed.data;

      // Clamp limit: default 25, min 1, max 200
      const limit = Math.min(Math.max(q.limit ?? 25, 1), 200);

      // Registry codes: prefer explicit param, else org prefs, else none
      const codesFromOrg = await getEnabledRegistryCodes(orgId, prisma);
      const explicitCodes =
        q.registries?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
      const codesFilter = explicitCodes.length ? explicitCodes : codesFromOrg;

      // WHERE: species is required; name/slug filter only when q is present
      const where: any = { species: q.species };
      if (q.q && q.q.length > 0) {
        where.OR = [
          { name: { contains: q.q, mode: "insensitive" as const } },
          { slug: { contains: q.q, mode: "insensitive" as const } },
        ];
      }

      const items = await prisma.breed.findMany({
        where,
        take: limit,
        orderBy: [{ name: "asc" }],
        include: {
          registries: {
            where: codesFilter.length ? { registryCode: { in: codesFilter } } : undefined,
            select: { registryCode: true, url: true, primary: true, since: true, statusText: true },
          },
        },
      });

      return reply.send({
        items: items.map((b) => ({
          source: "canonical",
          id: b.id,
          name: b.name,
          species: b.species,
          registries: (b.registries ?? []).map((r) => ({
            code: r.registryCode,
            url: r.url,
            primary: r.primary,
            since: r.since,
            statusText: r.statusText, // VERBATIM
          })),
        })),
      });
    } catch (err) {
      // Log but do NOT break the UI; return empty items on unexpected errors
      req.log?.error({ err }, "breeds.search failed");
      return reply.send({ items: [] });
    }
  });

  // 2) Custom breeds (org-scoped, optional species filter)
  app.get("/api/v1/breeds/custom", async (req, reply) => {
    // Custom lists are org-owned → strict header requirement stays
    const orgId = requireOrgId(req.headers);
    const q = QueryCustomList.parse(req.query);

    const items = await prisma.customBreed.findMany({
      where: {
        organizationId: orgId as any,
        ...(q.species ? { species: q.species } : {}),
        ...(q.q ? { name: { contains: q.q, mode: "insensitive" as const } } : {}),
      },
      orderBy: [{ name: "asc" }],
      take: q.limit,
      include: { aliases: true, Canonical: { select: { id: true, name: true } } },
    });

    return reply.send({
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        species: i.species,
        canonicalBreedId: i.canonicalBreedId,
        canonicalBreedName: i.Canonical?.name ?? null,
        aliases: i.aliases.map((a) => a.name),
      })),
    });
  });

  // 3) Custom breed create (org-scoped)
  app.post("/api/v1/breeds/custom", async (req, reply) => {
    const orgId = requireOrgId(req.headers);
    const body = UpsertCustom.parse(req.body);

    const created = await prisma.customBreed.create({
      data: {
        organizationId: orgId as any,
        name: body.name,
        species: body.species,
        canonicalBreedId: body.canonicalBreedId ?? null,
        aliases: body.aliases?.length
          ? { create: body.aliases.map((n) => ({ name: n })) }
          : undefined,
      },
      select: { id: true },
    });

    return reply.send({ id: created.id });
  });

  // 4) Custom breed update (org-scoped)
  app.patch("/api/v1/breeds/custom/:id", async (req, reply) => {
    const orgId = requireOrgId(req.headers);
    const id = z.coerce.number().parse((req.params as any).id);
    const body = UpsertCustom.partial().parse(req.body);

    const exists = await prisma.customBreed.findFirst({
      where: { id, organizationId: orgId as any },
      select: { id: true },
    });
    if (!exists) return reply.code(404).send({ error: "Not found" });

    await prisma.customBreed.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        species: body.species ?? undefined,
        canonicalBreedId:
          body.canonicalBreedId === undefined ? undefined : body.canonicalBreedId ?? null,
      },
    });

    if (body.aliases) {
      await prisma.$transaction([
        prisma.customBreedAlias.deleteMany({ where: { customBreedId: id } }),
        ...(body.aliases.length
          ? [
              prisma.customBreedAlias.createMany({
                data: body.aliases.map((n) => ({ customBreedId: id, name: n })),
              }),
            ]
          : []),
      ]);
    }

    return reply.send({ id });
  });

  // 5) Custom breed delete (org-scoped; force unlinks AnimalCustomBreed)
  app.delete("/api/v1/breeds/custom/:id", async (req, reply) => {
    const orgId = requireOrgId(req.headers);
    const id = z.coerce.number().parse((req.params as any).id);
    const force = z.coerce.boolean().optional().parse((req.query as any)?.force);

    const target = await prisma.customBreed.findFirst({
      where: { id, organizationId: orgId as any },
      include: { animalLinks: true },
    });
    if (!target) return reply.code(404).send({ error: "Not found" });

    if (target.animalLinks.length > 0 && !force) {
      return reply.code(409).send({ error: "In use by animals", count: target.animalLinks.length });
    }

    await prisma.$transaction(async (tx) => {
      if (force) await tx.animalCustomBreed.deleteMany({ where: { customBreedId: id } });
      await tx.customBreedAlias.deleteMany({ where: { customBreedId: id } });
      await tx.customBreed.delete({ where: { id } });
    });

    return reply.send({ ok: true });
  });
}
