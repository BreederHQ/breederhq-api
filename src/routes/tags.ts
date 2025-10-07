// src/routes/tags.ts
import type { FastifyInstance } from "fastify";
import prisma from "../prisma";

export default async function tagsRoutes(app: FastifyInstance) {
  // Lists tags; FE calls: GET /api/v1/tags?type=contact
  app.get("/api/v1/tags", async (req, reply) => {
    const q = (req.query as any)?.q?.toString?.() || "";
    const type = (req.query as any)?.type?.toString?.() || undefined;

    const where: any = {};
    if (type) where.type = type;
    if (q) where.name = { contains: q, mode: "insensitive" };

    const rows = await prisma.tag.findMany({
      where,
      orderBy: { name: "asc" },
      select: { name: true },
    });

    // FE expects an array of strings
    return reply.send({ items: rows.map(r => r.name) });
  });
}
