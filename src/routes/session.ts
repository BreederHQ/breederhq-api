// src/routes/session.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import prisma from "../prisma.js";
import {
  parseVerifiedSession,
  setSessionCookies,
  maybeRotateSession,
  Surface,
} from "../utils/session.js";
import { deriveSurface } from "../middleware/actor-context.js";
import { auditFailure } from "../services/audit.js";
import { getTosStatus } from "../services/tos-service.js";

/**
 * Endpoints
 *   GET  /session           → read-only session context (may rotate expiry only)
 *   POST /session/tenant    → switch active tenant in the session cookie (CSRF protected)
 *
 * Notes
 * - We DO NOT mutate tenant on GET. Explicit POST is safer & auditable.
 * - If tenant tables are unavailable (schema out of phase), the routes still work in single-tenant mode.
 * - Cookie is signed via @fastify/cookie with COOKIE_SECRET.
 */

/** ──────────────────────────────── schema detection ────────────────────────────────
 * We support both:
 *  - Multi-tenant schema (Tenant, TenantMembership, User.{isSuperAdmin, defaultTenantId, tenantMemberships})
 *  - Single-tenant schema (no Tenant/TenantMembership tables).
 *
 * We probe once per process and cache the result.
 */
let _tenantSupport: null | { ready: boolean } = null;

async function detectTenantSupport(): Promise<boolean> {
  if (_tenantSupport?.ready) return true;
  try {
    // Fast sanity check: look for Tenant table
    // If this throws, we assume no tenant tables yet.
    await (prisma as any).tenant.findFirst?.({ select: { id: true }, take: 1 });
    await (prisma as any).tenantMembership.findFirst?.({ select: { tenantId: true }, take: 1 });
    _tenantSupport = { ready: true };
    return true;
  } catch {
    return false;
  }
}

/** ───────────────────────────────── user/tenant resolvers ───────────────────────────────── */
type ResolvedUser = {
  isSuperAdmin?: boolean | null;
  defaultTenantId?: number | null;
  tenantMemberships?: Array<{ tenantId: number; role?: string | null }>;
};

async function fetchUserBasic(userId: string) {
  // Minimum fields — avoid coupling to schema details
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      // These may or may not exist; Prisma will ignore unknown selects at build time,
      // so we use runtime-safe fallbacks below via any-casts.
      // We keep TS happy by reading them via `any` from the returned object.
      // @ts-ignore
      isSuperAdmin: true,
      // @ts-ignore
      defaultTenantId: true,
      // @ts-ignore
      tenantMemberships: { select: { tenantId: true, role: true, membershipRole: true, membershipStatus: true }, orderBy: { tenantId: "asc" } },
    } as any,
  }) as any as (ResolvedUser & { id: string }) | null;
}

async function resolveActiveTenant(userId: string, requested?: number) {
  const hasTenants = await detectTenantSupport();
  const user = await fetchUserBasic(userId);

  if (!user) {
    return { hasTenants, user: null as null, activeTenantId: undefined as number | undefined, isMember: false };
  }

  if (!hasTenants) {
    // Single-tenant mode: no tenant context to resolve
    return { hasTenants, user, activeTenantId: undefined, isMember: true };
  }

  const memberships = Array.isArray(user.tenantMemberships) ? user.tenantMemberships : [];
  const superAdmin = !!user.isSuperAdmin;

  // requested takes precedence if valid
  if (requested && Number.isInteger(requested) && requested > 0) {
    const isMember = superAdmin || memberships.some((m) => m.tenantId === requested);
    return { hasTenants, user, activeTenantId: isMember ? requested : undefined, isMember };
  }

  const activeTenantId =
    (typeof user.defaultTenantId === "number" ? user.defaultTenantId : undefined) ??
    memberships[0]?.tenantId ??
    undefined;

  const isMember =
    superAdmin ||
    (activeTenantId != null && memberships.some((m) => m.tenantId === activeTenantId));

  return { hasTenants, user, activeTenantId, isMember };
}

/** ───────────────────────────────────────── plugin ───────────────────────────────────────── */
export default async function sessionRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // GET /session  (read-only; rotate expiry only)
  app.get("/session", async (req, reply) => {
    reply.header("Cache-Control", "no-store");

    // Use signature-verified session parsing with surface-specific cookie
    const surface = deriveSurface(req) as Surface;
    const sess = parseVerifiedSession(req, surface);
    if (!sess) return reply.code(401).send({ user: null, tenant: null, memberships: [] });

    if (!maybeRotateSession(req, reply, sess, surface)) {
      return reply.code(401).send({ user: null, tenant: null, memberships: [] });
    }

    // FE may hint a tenant via header; we DO NOT mutate cookie here.
    const hdrTenant = req.headers["x-tenant-id"];
    const requestedTenantId = hdrTenant ? Number(hdrTenant) : undefined;

    const { hasTenants, user, activeTenantId, isMember } = await resolveActiveTenant(sess.userId, requestedTenantId);
    if (!user) return reply.code(401).send({ user: null, tenant: null, memberships: [] });
    
    // Fetch ToS status for all responses
    const tos = await getTosStatus(sess.userId);

    if (!hasTenants) {
      // Single-tenant response
      return reply.send({
        user: { id: sess.userId },
        tenant: null,
        memberships: [],
        tos,
      });
    }

    // Multi-tenant response
    if (!activeTenantId) {
      return reply.code(403).send({
        error: "no_tenant_context",
        user: { id: sess.userId, isSuperAdmin: !!(user as any).isSuperAdmin },
        memberships: (user.tenantMemberships ?? []).map((m) => ({ tenantId: m.tenantId, role: m.role ?? null })),
        tos,
      });
    }
    if (!isMember) {
      await auditFailure(req, "AUTH_TENANT_DENIED", {
        reason: "forbidden_tenant",
        tenantId: requestedTenantId ?? activeTenantId,
        userId: sess.userId,
      });
      return reply.code(403).send({
        error: "forbidden_tenant",
        tenantId: requestedTenantId ?? activeTenantId,
      });
    }

    let tenant: { id: number; name: string; slug: string | null; isDemoTenant?: boolean; demoResetType?: string | null } | null = null;
    try {
      const t = await (prisma as any).tenant.findUnique({
        where: { id: activeTenantId },
        select: { id: true, name: true, slug: true, isDemoTenant: true, demoResetType: true },
      });
      tenant = t ? {
        id: t.id,
        name: t.name,
        slug: t.slug ?? null,
        isDemoTenant: t.isDemoTenant ?? false,
        demoResetType: t.demoResetType ?? null,
      } : null;
    } catch {
      tenant = null;
    }

    // Fetch tenant names for all memberships (for tenant switcher UI)
    const membershipTenantIds = (user.tenantMemberships ?? []).map((m) => m.tenantId);
    let tenantInfoMap: Map<number, { name: string; slug: string | null }> = new Map();
    if (membershipTenantIds.length > 0) {
      try {
        const tenants = await (prisma as any).tenant.findMany({
          where: { id: { in: membershipTenantIds } },
          select: { id: true, name: true, slug: true },
        });
        for (const t of tenants) {
          tenantInfoMap.set(t.id, { name: t.name, slug: t.slug ?? null });
        }
      } catch {
        // ignore errors, memberships will just have null names
      }
    }

    return reply.send({
      user: { id: sess.userId, isSuperAdmin: !!(user as any).isSuperAdmin },
      tenant,
      memberships: (user.tenantMemberships ?? []).map((m) => {
        const tenantInfo = tenantInfoMap.get(m.tenantId);
        return {
          tenantId: m.tenantId,
          tenantName: tenantInfo?.name ?? null,
          tenantSlug: tenantInfo?.slug ?? null,
          role: m.role ?? null,
          membershipRole: (m as any).membershipRole ?? null,
          membershipStatus: (m as any).membershipStatus ?? null,
        };
      }),
      tos,
    });
  });

  // POST /session/tenant   body: { tenantId: number, saveDefault?: boolean }
  // Explicit tenant switch (CSRF-protected via your global preHandler)
  app.post<{ Body: { tenantId?: number; saveDefault?: boolean } }>("/session/tenant", async (req, reply) => {
    // Use signature-verified session parsing with surface-specific cookie
    const surface = deriveSurface(req) as Surface;
    const sess = parseVerifiedSession(req, surface);
    if (!sess) return reply.code(401).send({ error: "unauthorized" });

    const hasTenants = await detectTenantSupport();
    if (!hasTenants) {
      return reply.code(400).send({ error: "tenant_not_supported" });
    }

    const tenantId = Number(req.body?.tenantId ?? 0);
    const saveDefault = !!req.body?.saveDefault;
    if (!tenantId || !Number.isInteger(tenantId) || tenantId <= 0) {
      return reply.code(400).send({ error: "tenantId_invalid" });
    }

    // Validate membership (or super admin)
    const actor = await prisma.user.findUnique({
      where: { id: sess.userId },
      select: {
        // @ts-ignore
        isSuperAdmin: true,
      } as any,
    }) as any;

    const membership = await (prisma as any).tenantMembership.findUnique?.({
      where: { userId_tenantId: { userId: sess.userId, tenantId } },
      select: { tenantId: true },
    });

    if (!actor?.isSuperAdmin && !membership) {
      return reply.code(403).send({ error: "forbidden" });
    }

    // Re-issue signed cookie with new tenantId (surface-specific)
    setSessionCookies(reply, { userId: sess.userId, tenantId }, surface);

    // Optionally persist as defaultTenantId (if the column exists)
    if (saveDefault) {
      try {
        await prisma.user.update({
          where: { id: sess.userId },
          // @ts-ignore
          data: { defaultTenantId: tenantId },
          select: { id: true },
        } as any);
      } catch {
        // ignore if the column isn't present yet
      }
    }

    return reply.send({ ok: true, tenant: { id: tenantId }, savedAsDefault: saveDefault });
  });
}
