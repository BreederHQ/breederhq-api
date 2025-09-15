// src/routes/breeding.ts
import type { FastifyPluginAsync } from "fastify";
import prisma from "../prisma.ts";
import prisma from "../prisma.js";

/**
 * Breeding routes.
 * - GET /api/v1/breeding/plans : canonical endpoint the frontend calls
 * - (optional) GET /api/v1/breeding : fallback simple list
 *
 * NOTE: We avoid brittle `select` until schema fields are confirmed. Later you
 * can tighten with a select/map that matches your UI types.
 */
const breedingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/breeding/plans", async (req) => {
    const q = req.query as Partial<{ limit: string }>;
    const limit = Math.min(Math.max(Number(q?.limit ?? 50), 1), 200);

    const rows = await prisma.breeding.findMany({
      take: limit,
      orderBy: { id: "asc" },
    });

    return rows;
  });

  // Optional: keep a simple list at /api/v1/breeding as well
  app.get("/api/v1/breeding", async (req) => {
    const q = req.query as Partial<{ limit: string }>;
    const limit = Math.min(Math.max(Number(q?.limit ?? 25), 1), 200);

    const rows = await prisma.breeding.findMany({
      take: limit,
      orderBy: { id: "asc" },
    });

    return rows;
  });
};

export default breedingRoutes;

