// src/routes/account.ts
import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";

/**
 * Session cookie:
 * - COOKIE_NAME (env, default "bhq_s")
 * - signed(base64url(JSON.stringify({ userId, tenantId?, iat, exp })))
 */

/** Normalize possibly-undefined strings to nulls */
function nullable<T extends string | null | undefined>(v: T): string | null {
  return v == null ? null : String(v);
}

export default async function accountRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // ───────────────────────────────────────────────────────────────────────────
  // GET /account → current user profile + memberships + default tenant
  // ───────────────────────────────────────────────────────────────────────────
  app.get("/account", async (req, reply) => {
    reply.header("Cache-Control", "no-store");

    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantMemberships: {
          include: { tenant: true },
          orderBy: [{ tenantId: "asc" }],
        },
        memberships: {
          include: { organization: true },
          orderBy: [{ organizationId: "asc" }],
        },
        defaultTenant: true,
      },
    });
    if (!user) return reply.code(404).send({ error: "not_found" });

    const tenants = (user.tenantMemberships || []).map((m) => ({
      tenantId: m.tenantId,
      tenantName: m.tenant?.name ?? "",
      role: m.role,
    }));

    const organizations = (user.memberships || []).map((m) => ({
      organizationId: m.organizationId,
      organizationName: m.organization?.name ?? "",
      role: m.role,
      tenantId: (m.organization as any)?.tenantId ?? null,
    }));

    return reply.send({
      id: user.id,
      email: user.email,
      name: nullable(user.name),
      image: nullable(user.image),
      isSuperAdmin: !!user.isSuperAdmin,
      defaultTenantId: user.defaultTenantId ?? null,
      defaultTenantName: user.defaultTenant?.name ?? null,

      // expose basic profile fields too (current user view)
      phoneE164: nullable(user.phoneE164),
      whatsappE164: nullable(user.whatsappE164),
      street: nullable(user.street),
      street2: nullable(user.street2),
      city: nullable(user.city),
      state: nullable(user.state),
      postalCode: nullable(user.postalCode),
      country: nullable(user.country),

      tenants,
      organizations,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /account
  // body:
  //   { name?, image?, defaultTenantId?,
  //     phoneE164?, whatsappE164?,
  //     street?, street2?, city?, state?, postalCode?, country? }
  //
  // - If defaultTenantId provided, verify the user is a member of that tenant.
  // ───────────────────────────────────────────────────────────────────────────
  app.patch("/account", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const b = (req.body || {}) as Partial<{
      name: string | null;
      image: string | null;
      defaultTenantId: number | null;

      phoneE164: string | null;
      whatsappE164: string | null;
      street: string | null;
      street2: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      country: string | null;
    }>;

    // Validate defaultTenantId membership if present
    if (b.defaultTenantId !== undefined) {
      const tId = b.defaultTenantId == null ? null : Number(b.defaultTenantId);
      if (tId != null) {
        if (!Number.isFinite(tId) || tId <= 0) {
          return reply.code(400).send({ error: "tenantId_invalid" });
        }
        const hasMembership = await prisma.tenantMembership.findUnique({
          where: { userId_tenantId: { userId, tenantId: tId } },
          select: { tenantId: true },
        });
        if (!hasMembership) {
          return reply.code(403).send({ error: "not_a_member_of_tenant" });
        }
      }
    }

    const data: any = {};
    if (b.name !== undefined) data.name = b.name ?? null;
    if (b.image !== undefined) data.image = b.image ?? null;

    if (b.phoneE164 !== undefined) data.phoneE164 = b.phoneE164 ?? null;
    if (b.whatsappE164 !== undefined) data.whatsappE164 = b.whatsappE164 ?? null;
    if (b.street !== undefined) data.street = b.street ?? null;
    if (b.street2 !== undefined) data.street2 = b.street2 ?? null;
    if (b.city !== undefined) data.city = b.city ?? null;
    if (b.state !== undefined) data.state = b.state ?? null;
    if (b.postalCode !== undefined) data.postalCode = b.postalCode ?? null;
    if (b.country !== undefined) {
      const s = String(b.country ?? "").trim().toUpperCase();
      data.country = s && /^[A-Z]{2}$/.test(s) ? s : null;
    }

    if (b.defaultTenantId !== undefined) {
      data.defaultTenantId = b.defaultTenantId == null ? null : Number(b.defaultTenantId);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      include: { defaultTenant: true },
    });

    return reply.send({
      id: updated.id,
      email: updated.email,
      name: nullable(updated.name),
      image: nullable(updated.image),
      defaultTenantId: updated.defaultTenantId ?? null,
      defaultTenantName: updated.defaultTenant?.name ?? null,

      phoneE164: nullable(updated.phoneE164),
      whatsappE164: nullable(updated.whatsappE164),
      street: nullable(updated.street),
      street2: nullable(updated.street2),
      city: nullable(updated.city),
      state: nullable(updated.state),
      postalCode: nullable(updated.postalCode),
      country: nullable(updated.country),

      updatedAt: updated.updatedAt.toISOString(),
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /account/tenants → list tenant memberships for current user
  // ───────────────────────────────────────────────────────────────────────────
  app.get("/account/tenants", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const rows = await prisma.tenantMembership.findMany({
      where: { userId },
      include: { tenant: true },
      orderBy: [{ tenantId: "asc" }],
    });

    return reply.send({
      items: rows.map((r) => ({
        tenantId: r.tenantId,
        tenantName: r.tenant?.name ?? "",
        role: r.role,
      })),
      total: rows.length,
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PUT /account/default-tenant  body: { tenantId }
  // ───────────────────────────────────────────────────────────────────────────
  app.put("/account/default-tenant", async (req, reply) => {
    const userId = getActorId(req);
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const { tenantId } = (req.body || {}) as { tenantId?: number };
    const tId = Number(tenantId);
    if (!Number.isFinite(tId) || tId <= 0) {
      return reply.code(400).send({ error: "tenantId_invalid" });
    }

    const hasMembership = await prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId: tId } },
      select: { tenantId: true },
    });
    if (!hasMembership) {
      return reply.code(403).send({ error: "not_a_member_of_tenant" });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { defaultTenantId: tId },
      include: { defaultTenant: true },
    });

    return reply.send({
      ok: true,
      defaultTenantId: updated.defaultTenantId ?? null,
      defaultTenantName: updated.defaultTenant?.name ?? null,
    });
  });
}
