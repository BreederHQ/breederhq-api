// src/routes/marketplace-breeds.ts
// Public breeds search endpoint for marketplace - returns canonical breeds only (no tenant required)

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Species } from "@prisma/client";
import prisma from "../prisma.js";

const SPECIES_SET = new Set(["DOG", "CAT", "HORSE", "GOAT", "SHEEP", "RABBIT"]);

function assertSpecies(s?: string) {
  const val = String(s || "").toUpperCase();
  if (!SPECIES_SET.has(val)) {
    const err = new Error("invalid_species") as any;
    err.statusCode = 400;
    throw err;
  }
  return val as Species;
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

export default async function marketplaceBreedsRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  /**
   * Public breed search for marketplace - canonical breeds only, no auth required.
   * GET /api/v1/marketplace/breeds/search?species=DOG&q=golden&limit=50&offset=0
   */
  app.get("/breeds/search", async (req, reply) => {
    const { q = "", species = "", limit = "50", offset = "0" } = (req.query || {}) as {
      q?: string;
      species?: string;
      limit?: string | number;
      offset?: string | number;
    };

    const sp = assertSpecies(species);
    const take = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = Math.max(0, Number(offset) || 0);

    const where: any = { species: sp };
    if (q) Object.assign(where, nameContainsAllTokens(q));

    try {
      const [breeds, total] = await Promise.all([
        prisma.breed.findMany({
          where,
          orderBy: [{ name: "asc" }],
          skip,
          take,
          select: { id: true, name: true, species: true },
        }),
        prisma.breed.count({ where }),
      ]);

      const items = breeds.map((b) => ({
        id: b.id,
        name: b.name,
        species: b.species,
        source: "canonical" as const,
      }));

      return reply.send({ items, total });
    } catch (err) {
      req.log.error({ err }, "marketplace breeds search failed");
      return reply.code(500).send({ error: "server_error" });
    }
  });

  /**
   * Get list of supported species
   * GET /api/v1/marketplace/breeds/species
   */
  app.get("/breeds/species", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=86400, immutable");
    const items = Array.from(SPECIES_SET).sort();
    return reply.send({ items, total: items.length });
  });
}
