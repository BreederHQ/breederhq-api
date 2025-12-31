// src/middleware/actor-context.ts
// Surface derivation and ActorContext resolution middleware
//
// Surface is derived ONLY from req.hostname (trusted via Fastify trustProxy).
// ActorContext is resolved ONLY from TenantMembership and User.isSuperAdmin.
//
// PORTAL TENANT CONTEXT:
// Portal tenant is derived ONLY from URL path slug (/:tenantSlug/...).
// No headers, no session, no client-provided numeric IDs accepted.

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
  tenantSlug?: string;
}

// ---------- Error Codes ----------
export const SURFACE_ACCESS_DENIED = "SURFACE_ACCESS_DENIED";
export const ACTOR_CONTEXT_UNRESOLVABLE = "ACTOR_CONTEXT_UNRESOLVABLE";

// ---------- Portal Tenant-less Route Allowlist ----------
/**
 * Routes on portal.* that do NOT require tenant context.
 * These are auth bootstrap routes that work before tenant is known.
 * Pattern: starts with prefix (after stripping /api/v1 if present)
 */
const PORTAL_TENANTLESS_PREFIXES = [
  "/auth/",      // /api/v1/auth/*
  "/session",    // /api/v1/session, /api/v1/session/*
  "/account",    // /api/v1/account, /api/v1/account/*
  "/portal/",    // /api/v1/portal/* (activation - no auth required)
];

/**
 * Check if a portal route is allowed without tenant context.
 */
function isPortalTenantlessRoute(pathname: string): boolean {
  // Normalize: strip /api/v1 prefix if present
  let path = pathname;
  if (path.startsWith("/api/v1")) {
    path = path.slice(7); // Remove "/api/v1"
  }

  // Check against allowlist
  for (const prefix of PORTAL_TENANTLESS_PREFIXES) {
    if (path === prefix.replace(/\/$/, "") || path.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

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

// ---------- Portal Tenant Slug Resolver ----------

/**
 * Extract tenant slug from portal URL path ONLY.
 *
 * Expected patterns:
 *   /t/:tenantSlug/...           → tenantSlug
 *   /:tenantSlug/...             → tenantSlug (if first segment is valid slug)
 *   /api/v1/t/:tenantSlug/...    → tenantSlug
 *
 * Returns null if no slug found or route is tenantless.
 */
export function extractPortalTenantSlug(req: FastifyRequest): string | null {
  const url = req.url || "";
  const pathname = url.split("?")[0] || "";

  // Check if this is a tenantless route
  if (isPortalTenantlessRoute(pathname)) {
    return null; // Explicitly no tenant needed
  }

  // Pattern 1: /t/:tenantSlug/... or /api/v1/t/:tenantSlug/...
  const tPrefixMatch = pathname.match(/(?:^|\/api\/v1)\/t\/([a-z0-9][a-z0-9-]*)/i);
  if (tPrefixMatch) {
    return tPrefixMatch[1].toLowerCase();
  }

  // Pattern 2: /:tenantSlug/... (first path segment after optional /api/v1)
  // Only if it looks like a valid slug (lowercase alphanumeric with hyphens)
  let pathWithoutApi = pathname;
  if (pathWithoutApi.startsWith("/api/v1")) {
    pathWithoutApi = pathWithoutApi.slice(7);
  }

  const firstSegmentMatch = pathWithoutApi.match(/^\/([a-z0-9][a-z0-9-]*)/i);
  if (firstSegmentMatch) {
    const segment = firstSegmentMatch[1].toLowerCase();
    // Exclude known non-slug routes
    const reservedPrefixes = ["auth", "session", "account", "healthz", "health", "__diag"];
    if (!reservedPrefixes.includes(segment)) {
      return segment;
    }
  }

  return null;
}

/**
 * Resolve tenant from slug via database lookup.
 * Returns tenant { id, slug } or null if not found.
 */
export async function resolvePortalTenant(slug: string): Promise<{ id: number; slug: string } | null> {
  try {
    const tenant = await (prisma as any).tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
    return tenant || null;
  } catch {
    return null;
  }
}

// ---------- Membership Queries ----------

/**
 * Membership data returned from queries.
 */
interface MembershipRecord {
  tenantId: number;
  role: string;
  membershipRole?: string;
  membershipStatus?: string;
}

/**
 * Get all STAFF memberships for a user (ACTIVE status only).
 * Used for PLATFORM surface gating.
 */
async function getStaffMemberships(userId: string): Promise<MembershipRecord[]> {
  try {
    const memberships = await (prisma as any).tenantMembership.findMany({
      where: {
        userId,
        membershipRole: "STAFF",
        membershipStatus: "ACTIVE",
      },
      select: { tenantId: true, role: true, membershipRole: true, membershipStatus: true },
      orderBy: { tenantId: "asc" },
    });
    return memberships || [];
  } catch {
    // Fallback for schema without new fields - return all memberships
    try {
      const memberships = await (prisma as any).tenantMembership.findMany({
        where: { userId },
        select: { tenantId: true, role: true },
        orderBy: { tenantId: "asc" },
      });
      return memberships || [];
    } catch {
      return [];
    }
  }
}

/**
 * Check if user has ACTIVE CLIENT membership to a specific tenant.
 * Used for PORTAL surface gating.
 */
async function hasClientMembershipToTenant(userId: string, tenantId: number): Promise<boolean> {
  try {
    const membership = await (prisma as any).tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { membershipRole: true, membershipStatus: true },
    });
    // Accept CLIENT role with ACTIVE status
    return membership?.membershipRole === "CLIENT" && membership?.membershipStatus === "ACTIVE";
  } catch {
    // Fallback for schema without new fields - check any membership exists
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
}

/**
 * Legacy: Check if user has any membership to a specific tenant.
 * @deprecated Use hasClientMembershipToTenant or getStaffMemberships instead.
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

// ---------- Context Resolution ----------

/**
 * Tenant context for PLATFORM surface.
 * Accepts: X-Tenant-Id header, session tenantId.
 */
export function extractPlatformTenantContext(req: FastifyRequest, session: SessionPayload): { tenantId?: number } {
  const result: { tenantId?: number } = {};

  // Check X-Tenant-Id header (PLATFORM only)
  const headerTenantId = req.headers["x-tenant-id"];
  if (headerTenantId) {
    const parsed = Number(headerTenantId);
    if (Number.isInteger(parsed) && parsed > 0) {
      result.tenantId = parsed;
    }
  }

  // Fallback to session tenantId (PLATFORM only)
  if (!result.tenantId && session.tenantId && Number.isInteger(session.tenantId) && session.tenantId > 0) {
    result.tenantId = session.tenantId;
  }

  return result;
}

/**
 * Resolve ActorContext based on surface and user grants.
 *
 * Rules:
 * - PLATFORM: require (TenantMembership OR superAdmin) → STAFF
 *   - Tenant from X-Tenant-Id header or session
 * - PORTAL: require membership to accessed tenant → CLIENT
 *   - Tenant ONLY from URL slug (resolved via resolvePortalTenant)
 *   - No headers, no session accepted
 * - MARKETPLACE: any valid session → PUBLIC (no tenant context)
 *
 * @param surface - The derived surface
 * @param userId - The authenticated user ID
 * @param tenantId - Pre-resolved tenant ID (from slug for PORTAL, from header/session for PLATFORM)
 */
export async function resolveActorContext(
  surface: Surface,
  userId: string,
  tenantId: number | null
): Promise<{ context: ActorContext; tenantId: number | null } | null> {
  const isSuperAdmin = await checkSuperAdmin(userId);

  switch (surface) {
    case "PLATFORM": {
      // PLATFORM requires STAFF context (TenantMembership with membershipRole=STAFF, membershipStatus=ACTIVE)
      if (isSuperAdmin) {
        const memberships = await getStaffMemberships(userId);
        const defaultTenantId = tenantId ?? memberships[0]?.tenantId ?? null;
        return { context: "STAFF", tenantId: defaultTenantId };
      }

      const memberships = await getStaffMemberships(userId);
      if (memberships.length > 0) {
        // Has at least one STAFF membership → STAFF context
        // Use provided tenantId if valid, otherwise first membership
        const activeTenantId = tenantId ?? memberships[0].tenantId;
        return { context: "STAFF", tenantId: activeTenantId };
      }

      // No STAFF membership, not superAdmin → deny
      return null;
    }

    case "PORTAL": {
      // PORTAL requires CLIENT context (TenantMembership with membershipRole=CLIENT, membershipStatus=ACTIVE)
      // tenantId must already be resolved from URL slug before calling this

      if (!tenantId) {
        // No tenant context → cannot resolve CLIENT
        return null;
      }

      // SuperAdmin can access any tenant's portal
      if (isSuperAdmin) {
        return { context: "CLIENT", tenantId };
      }

      // Check if user has ACTIVE CLIENT membership to this tenant
      const hasClientAccess = await hasClientMembershipToTenant(userId, tenantId);
      if (hasClientAccess) {
        return { context: "CLIENT", tenantId };
      }

      // No CLIENT membership to this tenant → deny (will be SURFACE_ACCESS_DENIED)
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

// ---------- TypeScript Declaration Merge ----------
declare module "fastify" {
  interface FastifyRequest {
    surface?: Surface;
    actorContext?: ActorContext;
    session?: SessionPayload | null;
    tenantSlug?: string;
  }
}
