// src/routes/organizations.ts
import type { FastifyInstance } from "fastify";
import prisma from "../prisma.js";

export default async function organizationsRoutes(app: FastifyInstance) {
  // Auth guard like other v1 routes
  app.addHook("preHandler", async (req, reply) => {
    if (!req.url.startsWith("/api/v1/organizations")) return;
    // @ts-ignore
    const u = req.authUser;
    if (!u?.id) return reply.code(401).send({ error: "unauthorized" });
  });

  // GET /api/v1/organizations — list orgs for the picker/table (tenant-safe)
  app.get("/api/v1/organizations", async (req, reply) => {
    // @ts-ignore
    const orgId = req.authUser!.orgId!;
    const q = (req.query as any)?.q?.toString?.() || "";
    const page = Math.max(1, parseInt((req.query as any)?.page ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query as any)?.limit ?? "50", 10)));

    // If your schema only has id/name, keep selects minimal to avoid unknown field errors.
    const where: any = {
      AND: [
        { id: orgId }, // current tenant org for now; expand later if you support multi-org browse
        q ? { name: { contains: q, mode: "insensitive" } } : {},
      ],
    };

    const [total, rows] = await prisma.$transaction([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        orderBy: [{ updatedAt: "desc" as any }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          // the following may not exist in your schema; if they don’t, keep them commented out
          // website: true,
          // email: true,
          // phone: true,
          // city: true,
          // state: true,
          // country: true,
          // updatedAt: true,
          // createdAt: true,
        },
      }),
    ]);

    // Normalize to what App-Organizations expects
    const data = rows.map((r: any) => ({
      id: Number(r.id),
      name: r.name ?? `Org ${r.id}`,
      website: r.website ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      city: r.city ?? null,
      state: r.state ?? null,
      country: r.country ?? null,
      tags: [],
      status: "Active",
      created_at: (r.createdAt instanceof Date ? r.createdAt : null)?.toISOString?.() ?? new Date().toISOString(),
      updated_at: (r.updatedAt instanceof Date ? r.updatedAt : null)?.toISOString?.() ?? new Date().toISOString(),
      notes: null,
      audit: [],
    }));

    reply.send({ page, limit, total, data });
  });
}
