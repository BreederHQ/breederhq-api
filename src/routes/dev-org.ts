// src/routes/dev-org.ts
import type { FastifyInstance } from "fastify";
import prisma from "../prisma.js";

export default async function devOrgRoutes(app: FastifyInstance) {
  // List orgs (id + name)
  app.get("/api/s2s/dev/orgs", async (_req, reply) => {
    const rows = await prisma.organization.findMany({
      select: { id: true, name: true, tenantId: true },
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
    const tenantId = Number(b.tenantId) || 1; // Default to tenant 1 for dev

    // Ensure default tenant exists
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      const created = await prisma.tenant.create({
        data: {
          id: tenantId,
          name: `Dev Tenant ${tenantId}`,
        },
      });
      console.log(`Created tenant ${created.id}: ${created.name}`);
    }

    if (Number.isFinite(wantId)) {
      const found = await prisma.organization.findUnique({ where: { id: wantId } });
      if (found) return reply.send(found);
      // Cannot set id directly with autoincrement - let DB assign it
      const created = await prisma.organization.create({
        data: { name, tenantId }
      });
      return reply.code(201).send(created);
    }

    const foundByName = await prisma.organization.findFirst({
      where: { name, tenantId }
    });
    if (foundByName) return reply.send(foundByName);
    const created = await prisma.organization.create({
      data: { name, tenantId }
    });
    return reply.code(201).send(created);
  });
}
