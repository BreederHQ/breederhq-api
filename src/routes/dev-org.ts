// src/routes/dev-org.ts
import type { FastifyInstance } from "fastify";
import prisma from "../prisma.js";

export default async function devOrgRoutes(app: FastifyInstance) {
  // List orgs (id + name)
  app.get("/api/s2s/dev/orgs", async (_req, reply) => {
    const rows = await prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
      take: 100,
    });
    reply.send(rows);
  });

  // Ensure an org exists (by id or name). Creates if missing.
  app.post("/api/s2s/dev/orgs/ensure", async (req, reply) => {
    const b: any = (req.body ?? {});
    const wantId = Number(b.id);
    const name = String(b.name || "").trim() || `Dev Org ${Date.now()}`;

    if (Number.isFinite(wantId)) {
      const found = await prisma.organization.findUnique({ where: { id: wantId } });
      if (found) return reply.send(found);
      const created = await prisma.organization.create({ data: { id: wantId, name } });
      return reply.code(201).send(created);
    }

    const foundByName = await prisma.organization.findFirst({ where: { name } });
    if (foundByName) return reply.send(foundByName);
    const created = await prisma.organization.create({ data: { name } });
    return reply.code(201).send(created);
  });
}
