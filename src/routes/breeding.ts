// src/routes/breeding.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// Small helper to clamp page size
function toLimit(v: unknown, d = 25, min = 1, max = 200) {
  const n = Math.floor(Number(v ?? d));
  return Math.min(Math.max(isFinite(n) ? n : d, min), max);
}

const breedingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/breeding/plans?limit=&cursor=
  // Returns Breeding rows ordered by id asc, paginated with cursor (last id)
  app.get("/api/v1/breeding/plans", async (req) => {
    const q = (req.query ?? {}) as Partial<{ limit: string; cursor: string }>;
    const limit = toLimit(q.limit, 50);
    const where = q.cursor ? { id: { gt: String(q.cursor) } } : undefined;

    const data = await prisma.breeding.findMany({
      where,
      orderBy: { id: "asc" },
      take: limit,
      // NOTE: no `select` block on purpose—this returns all columns
      // and avoids mismatches with your current Prisma schema.
    });

    const nextCursor = data.length === limit ? data[data.length - 1].id : null;
    return { data, nextCursor };
  });

  // GET /api/v1/breeding?limit=&cursor=
  // Generic list (kept for parity with previous handler)
  app.get("/api/v1/breeding", async (req) => {
    const q = (req.query ?? {}) as Partial<{ limit: string; cursor: string }>;
    const limit = toLimit(q.limit, 25);
    const where = q.cursor ? { id: { gt: String(q.cursor) } } : undefined;

    const data = await prisma.breeding.findMany({
      where,
      orderBy: { id: "asc" },
      take: limit,
    });

    const nextCursor = data.length === limit ? data[data.length - 1].id : null;
    return { data, nextCursor };
  });

  // (Intentionally omitting POST/PUT for now until we agree on exact field names
  // in your Breeding model; adding the wrong fields causes runtime errors.)
};

export default breedingRoutes;
