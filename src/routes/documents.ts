// src/routes/documents.ts
// General document listing endpoint for tenant

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /documents - List documents for tenant
  app.get("/documents", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { scope, limit, offset } = req.query as any;

    const where: any = { tenantId };

    // Filter by scope if provided (e.g., "animal", "offspring", "contract", "invoice")
    if (scope) {
      where.scope = scope;
    }

    const take = limit ? Number(limit) : 100;
    const skip = offset ? Number(offset) : 0;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          title: true,
          mimeType: true,
          bytes: true,
          sizeBytes: true,
          scope: true,
          kind: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.document.count({ where }),
    ]);

    // Normalize response format
    const items = documents.map((doc) => ({
      id: doc.id,
      name: doc.title,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes ?? doc.bytes,
      scope: doc.scope,
      kind: doc.kind,
      createdAt: doc.createdAt?.toISOString(),
      updatedAt: doc.updatedAt?.toISOString(),
    }));

    return reply.send({
      items,
      total,
    });
  });
};

export default routes;
