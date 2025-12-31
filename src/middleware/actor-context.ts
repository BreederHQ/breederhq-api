// src/middleware/actor-context.ts
// Surface derivation and ActorContext resolution middleware
//
// Surface is derived ONLY from req.hostname (trusted via Fastify trustProxy).
// ActorContext is resolved ONLY from TenantMembership and User.isSuperAdmin.

import type { FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";
import { parseVerifiedSession, SessionPayload } from "../utils/session.js";

// ---------- Enums and Types ----------

/**
 * Surface types derived from hostname only.
 * - PLATFORM: app.* or app-* (staff dashboard)
 * - PORTAL: portal.* or portal-* (client portal)
 * - MARKETPLACE: marketplace.* or marketplace-* (public marketplace)
 */
export type Surface = "PLATFORM" | "PORTAL" | "MARKETPLACE";

/**
 * ActorContext determines what level of access the user has.
 * - STAFF: Has TenantMembership with staff-like role (OWNER, ADMIN, MEMBER, BILLING, VIEWER)
 * - CLIENT: Has TenantMembership and is accessing portal surface for that tenant
 * - PUBLIC: Valid session on marketplace surface
 */
export type ActorContext = "STAFF" | "CLIENT" | "PUBLIC";

/**
 * Extended request with surface and actor context.
 */
export interface ActorContextRequest extends FastifyRequest {
  surface: Surface;
  actorContext: ActorContext;
  session: SessionPayload;
  tenantId: number | null;
}

// ---------- Error Codes ----------
export const SURFACE_ACCESS_DENIED = "SURFACE_ACCESS_DENIED";
export const ACTOR_CONTEXT_UNRESOLVABLE = "ACTOR_CONTEXT_UNRESOLVABLE";

// ---------- Surface Derivation ----------

/**
 * Derive surface type from hostname ONLY.
 * No header overrides - hostname is trusted via Fastify trustProxy.
 *
 * Patterns:
 *   app.breederhq.com, app-*.vercel.app, localhost → PLATFORM
 *   portal.breederhq.com, portal-*.vercel.app → PORTAL
 *   marketplace.breederhq.com, marketplace-*.vercel.app → MARKETPLACE
 */
export function deriveSurface(req: FastifyRequest): Surface {
  const hostname = (req.hostname || "").toLowerCase();

  // Hostname-only derivation (no header overrides)
  if (hostname.startsWith("portal.") || hostname.startsWith("portal-")) {
    return "PORTAL";
  }
  if (hostname.startsWith("marketplace.") || hostname.startsWith("marketplace-")) {
    return "MARKETPLACE";
  }

  // Default: PLATFORM (includes app.*, localhost, 127.0.0.1, etc.)
  return "PLATFORM";
}

// ---------- Membership Queries ----------

/**
 * Get all tenant memberships for a user.
 * Returns array of { tenantId, role } or empty array if table doesn't exist.
 */
async function getUserMemberships(userId: string): Promise<Array<{ tenantId: number; role: string }>> {
  try {
    const memberships = await (prisma as any).tenantMembership.findMany({
      where: { userId },
      select: { tenantId: true, role: true },
      orderBy: { tenantId: "asc" },
    });
    return memberships || [];
  } catch {
    // Table might not exist in single-tenant mode
    return [];
  }
}

/**
 * Check if user has membership to a specific tenant.
 */
async function hasMembershipToTenant(userId: string, tenantId: number): Promise<boolean> {
  try {
    const membership = await (prisma as any).tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { tenantId: true },
    });
    return !!membership;
  } catch {
    return false;
  }
}

/**
 * Check if user is a super admin.
 */
async function checkSuperAdmin(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true } as any,
    }) as any;
    return !!user?.isSuperAdmin;
  } catch {
    return false;
  }
}

/**
 * Get tenant by slug.
 */
async function getTenantBySlug(slug: string): Promise<{ id: number } | null> {
  try {
    const tenant = await (prisma as any).tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    return tenant || null;
  } catch {
    return null;
  }
}

// ---------- Context Resolution ----------

/**
 * Resolve ActorContext based on surface and user grants.
 *
 * Rules:
 * - PLATFORM: require authenticated session AND (TenantMembership OR superAdmin) → STAFF
 * - PORTAL: require authenticated session AND membership to accessed tenant → CLIENT
 *   - Tenant must be derivable from tenantSlug in path or X-Tenant-Id header
 *   - If tenant context cannot be derived, return ACTOR_CONTEXT_UNRESOLVABLE
 * - MARKETPLACE: require authenticated session → PUBLIC (no tenant context)
 *
 * @param surface - The derived surface
 * @param userId - The authenticated user ID
 * @param tenantContext - Optional tenant context (from header or path)
 */
export async function resolveActorContext(
  surface: Surface,
  userId: string,
  tenantContext?: { tenantId?: number; tenantSlug?: string }
): Promise<{ context: ActorContext; tenantId: number | null } | null> {
  const isSuperAdmin = await checkSuperAdmin(userId);

  switch (surface) {
    case "PLATFORM": {
      // PLATFORM requires STAFF context (any TenantMembership or superAdmin)
      if (isSuperAdmin) {
        const memberships = await getUserMemberships(userId);
        const defaultTenantId = memberships[0]?.tenantId ?? null;
        return { context: "STAFF", tenantId: defaultTenantId };
      }

      const memberships = await getUserMemberships(userId);
      if (memberships.length > 0) {
        // Has at least one membership → STAFF
        return { context: "STAFF", tenantId: memberships[0].tenantId };
      }

      // No membership, not superAdmin → deny
      return null;
    }

    case "PORTAL": {
      // PORTAL requires CLIENT context with valid tenant context
      // SuperAdmins can access any tenant's portal for support

      // First, resolve tenant ID from context
      let resolvedTenantId: number | null = null;

      if (tenantContext?.tenantId && Number.isInteger(tenantContext.tenantId) && tenantContext.tenantId > 0) {
        resolvedTenantId = tenantContext.tenantId;
      } else if (tenantContext?.tenantSlug) {
        const tenant = await getTenantBySlug(tenantContext.tenantSlug);
        resolvedTenantId = tenant?.id ?? null;
      }

      // If no tenant context, cannot resolve CLIENT
      if (!resolvedTenantId) {
        return null; // Will result in ACTOR_CONTEXT_UNRESOLVABLE
      }

      // SuperAdmin can access any tenant's portal
      if (isSuperAdmin) {
        return { context: "CLIENT", tenantId: resolvedTenantId };
      }

      // Check if user has membership to this tenant
      const hasMembership = await hasMembershipToTenant(userId, resolvedTenantId);
      if (hasMembership) {
        return { context: "CLIENT", tenantId: resolvedTenantId };
      }

      // No membership to this tenant → deny
      return null;
    }

    case "MARKETPLACE": {
      // MARKETPLACE allows PUBLIC context (any valid session)
      // No tenant context required
      return { context: "PUBLIC", tenantId: null };
    }

    default:
      return null;
  }
}

// ---------- Tenant Context Extraction ----------

/**
 * Extract tenant context from request (header or path).
 */
export function extractTenantContext(req: FastifyRequest): { tenantId?: number; tenantSlug?: string } {
  const result: { tenantId?: number; tenantSlug?: string } = {};

  // Check X-Tenant-Id header
  const headerTenantId = req.headers["x-tenant-id"];
  if (headerTenantId) {
    const parsed = Number(headerTenantId);
    if (Number.isInteger(parsed) && parsed > 0) {
      result.tenantId = parsed;
    }
  }

  // Check for tenant slug in path (e.g., /t/:tenantSlug/...)
  const url = req.url || "";
  const slugMatch = url.match(/^\/t\/([a-z0-9-]+)/i);
  if (slugMatch) {
    result.tenantSlug = slugMatch[1].toLowerCase();
  }

  return result;
}

// ---------- Middleware ----------

/**
 * Surface gate middleware factory.
 *
 * Creates a preHandler hook that:
 * 1. Derives surface from hostname (no header override)
 * 2. Verifies session exists
 * 3. Extracts tenant context from header/path
 * 4. Resolves ActorContext based on surface + membership
 * 5. Attaches surface, actorContext, tenantId to request
 * 6. Returns 403 if access is denied
 *
 * @param options.requireAuth - If false, allows unauthenticated requests
 */
export function createSurfaceGateMiddleware(options?: { requireAuth?: boolean }) {
  const requireAuth = options?.requireAuth ?? true;

  return async function surfaceGateMiddleware(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // 1. Derive surface from hostname only
    const surface = deriveSurface(req);
    (req as any).surface = surface;

    // 2. Verify session
    const session = parseVerifiedSession(req);

    if (!session) {
      if (requireAuth) {
        reply.code(401).send({ error: "unauthorized" });
        return;
      }
      // Allow unauthenticated access for public routes
      (req as any).actorContext = "PUBLIC";
      (req as any).session = null;
      (req as any).tenantId = null;
      return;
    }

    (req as any).session = session;
    (req as any).userId = session.userId;

    // 3. Extract tenant context
    const tenantContext = extractTenantContext(req);

    // Also check session for tenant context
    if (!tenantContext.tenantId && session.tenantId && Number.isInteger(session.tenantId) && session.tenantId > 0) {
      tenantContext.tenantId = session.tenantId;
    }

    // 4. Resolve ActorContext
    const resolved = await resolveActorContext(surface, session.userId, tenantContext);

    if (!resolved) {
      // Could not resolve context → fail closed
      // PORTAL without tenant context → ACTOR_CONTEXT_UNRESOLVABLE
      // PLATFORM without membership → SURFACE_ACCESS_DENIED
      const errorCode = surface === "PORTAL" ? ACTOR_CONTEXT_UNRESOLVABLE : SURFACE_ACCESS_DENIED;

      reply.code(403).send({
        error: errorCode,
        surface,
      });
      return;
    }

    // 5. Attach context to request
    (req as any).actorContext = resolved.context;
    (req as any).tenantId = resolved.tenantId;
  };
}

/**
 * Route-level guard to require specific ActorContext.
 * Use after the surface gate middleware has run.
 */
export function requireActorContext(...allowed: ActorContext[]) {
  return async function actorContextGuard(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const context = (req as any).actorContext as ActorContext | undefined;

    if (!context || !allowed.includes(context)) {
      reply.code(403).send({
        error: SURFACE_ACCESS_DENIED,
        surface: (req as any).surface,
      });
    }
  };
}

// ---------- TypeScript Declaration Merge ----------
declare module "fastify" {
  interface FastifyRequest {
    surface?: Surface;
    actorContext?: ActorContext;
    session?: SessionPayload | null;
  }
}
