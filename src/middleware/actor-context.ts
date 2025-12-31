// src/middleware/actor-context.ts
// Surface derivation and ActorContext resolution middleware

import type { FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";
import { parseVerifiedSession, SessionPayload } from "../utils/session.js";

// ---------- Enums and Types ----------

/**
 * Surface types derived from hostname.
 * - PLATFORM: app.* or app-* (staff dashboard)
 * - PORTAL: portal.* or portal-* (client portal)
 * - MARKETPLACE: marketplace.* or marketplace-* (public marketplace)
 */
export type Surface = "PLATFORM" | "PORTAL" | "MARKETPLACE";

/**
 * ActorContext determines what level of access the user has.
 * - STAFF: Has TenantMembership (breeder/admin staff)
 * - CLIENT: Has PortalAccess grant (customer viewing their animals)
 * - PUBLIC: Valid session on marketplace surface (browsing public listings)
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
 * Derive surface type from hostname.
 * Patterns:
 *   app.breederhq.com, app-*.vercel.app, localhost (dev) → PLATFORM
 *   portal.breederhq.com, portal-*.vercel.app → PORTAL
 *   marketplace.breederhq.com, marketplace-*.vercel.app → MARKETPLACE
 *
 * In development, X-Surface header can override for testing.
 */
export function deriveSurface(req: FastifyRequest): Surface {
  const hostname = (req.hostname || "").toLowerCase();

  // Dev override via header (only in development)
  const isDev =
    (process.env.BHQ_ENV || process.env.NODE_ENV) === "dev" ||
    String(process.env.NODE_ENV || "").toLowerCase() === "development";

  if (isDev) {
    const headerSurface = req.headers["x-surface"];
    if (headerSurface === "PORTAL") return "PORTAL";
    if (headerSurface === "MARKETPLACE") return "MARKETPLACE";
    if (headerSurface === "PLATFORM") return "PLATFORM";
  }

  // Production hostname patterns
  if (hostname.startsWith("portal.") || hostname.startsWith("portal-")) {
    return "PORTAL";
  }
  if (hostname.startsWith("marketplace.") || hostname.startsWith("marketplace-")) {
    return "MARKETPLACE";
  }

  // Default: PLATFORM (includes app.*, localhost, etc.)
  return "PLATFORM";
}

// ---------- Grant Checking ----------

/**
 * Check if user has STAFF access (TenantMembership) for any tenant.
 * Returns the first tenant ID they have membership for, or null.
 */
async function checkStaffGrant(userId: string): Promise<number | null> {
  try {
    const membership = await (prisma as any).tenantMembership.findFirst({
      where: { userId },
      select: { tenantId: true },
      orderBy: { tenantId: "asc" },
    });
    return membership?.tenantId ?? null;
  } catch {
    // Table might not exist in single-tenant mode
    return null;
  }
}

/**
 * Check if user has CLIENT access (PortalAccess with ACTIVE status).
 * Returns true if they have any active portal access.
 */
async function checkClientGrant(userId: string): Promise<boolean> {
  try {
    const access = await (prisma as any).portalAccess.findFirst({
      where: {
        userId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    return !!access;
  } catch {
    // Table might not exist
    return false;
  }
}

/**
 * Check if user is a super admin (bypasses tenant membership requirements).
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

// ---------- Context Resolution ----------

/**
 * Resolve ActorContext based on surface and user grants.
 *
 * Rules:
 * - PLATFORM surface → must have STAFF context (TenantMembership or SuperAdmin)
 * - PORTAL surface → must have CLIENT context (PortalAccess)
 * - MARKETPLACE surface → PUBLIC context (any valid session)
 *
 * Returns null if context cannot be resolved (fail-closed).
 */
export async function resolveActorContext(
  surface: Surface,
  userId: string
): Promise<{ context: ActorContext; tenantId: number | null } | null> {
  // Check super admin first (has STAFF access everywhere)
  const isSuperAdmin = await checkSuperAdmin(userId);

  switch (surface) {
    case "PLATFORM": {
      // PLATFORM requires STAFF context
      if (isSuperAdmin) {
        // Super admins default to first tenant or null
        const staffTenantId = await checkStaffGrant(userId);
        return { context: "STAFF", tenantId: staffTenantId };
      }
      const staffTenantId = await checkStaffGrant(userId);
      if (staffTenantId) {
        return { context: "STAFF", tenantId: staffTenantId };
      }
      // No staff access → fail
      return null;
    }

    case "PORTAL": {
      // PORTAL requires CLIENT context
      // Note: Staff can also access portal (they might be testing or have dual role)
      const hasClientAccess = await checkClientGrant(userId);
      if (hasClientAccess) {
        return { context: "CLIENT", tenantId: null };
      }
      // Super admins can access portal for support/debugging
      if (isSuperAdmin) {
        return { context: "CLIENT", tenantId: null };
      }
      // No client access → fail
      return null;
    }

    case "MARKETPLACE": {
      // MARKETPLACE allows PUBLIC context (any valid session)
      // They might also have STAFF or CLIENT grants, but on marketplace they're PUBLIC
      return { context: "PUBLIC", tenantId: null };
    }

    default:
      return null;
  }
}

// ---------- Middleware ----------

/**
 * Surface gate middleware factory.
 *
 * Creates a preHandler hook that:
 * 1. Derives surface from hostname
 * 2. Verifies session exists
 * 3. Resolves ActorContext based on surface + grants
 * 4. Attaches surface, actorContext, session to request
 * 5. Returns 403 if access is denied
 *
 * @param options.requireAuth - If false, allows unauthenticated requests (for public routes)
 */
export function createSurfaceGateMiddleware(options?: { requireAuth?: boolean }) {
  const requireAuth = options?.requireAuth ?? true;

  return async function surfaceGateMiddleware(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // 1. Derive surface
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

    // 3. Resolve ActorContext
    const resolved = await resolveActorContext(surface, session.userId);

    if (!resolved) {
      // Could not resolve context → fail closed
      const errorCode =
        surface === "PLATFORM"
          ? SURFACE_ACCESS_DENIED
          : surface === "PORTAL"
          ? SURFACE_ACCESS_DENIED
          : ACTOR_CONTEXT_UNRESOLVABLE;

      reply.code(403).send({
        error: errorCode,
        message: `Access denied for surface: ${surface}`,
        surface,
      });
      return;
    }

    // 4. Attach context to request
    (req as any).actorContext = resolved.context;

    // Set tenantId from resolution, but allow header override for STAFF
    if (resolved.context === "STAFF") {
      const headerTenantId = req.headers["x-tenant-id"];
      if (headerTenantId && Number(headerTenantId) > 0) {
        (req as any).tenantId = Number(headerTenantId);
      } else if (session.tenantId && Number.isInteger(session.tenantId)) {
        (req as any).tenantId = session.tenantId;
      } else {
        (req as any).tenantId = resolved.tenantId;
      }
    } else {
      (req as any).tenantId = resolved.tenantId;
    }
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
        message: `This route requires one of: ${allowed.join(", ")}`,
        current: context ?? "NONE",
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
