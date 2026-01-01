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
 * - PLATFORM: app.breederhq.com (staff dashboard)
 * - PORTAL: portal.breederhq.com (client portal)
 * - MARKETPLACE: marketplace.breederhq.com (public marketplace)
 * - UNKNOWN: hostname not in production allowlist (rejected in production)
 */
export type Surface = "PLATFORM" | "PORTAL" | "MARKETPLACE" | "UNKNOWN";

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

// ---------- Environment ----------
const NODE_ENV = String(process.env.NODE_ENV || "").toLowerCase();
const IS_PROD = NODE_ENV === "production";

// ---------- Production Hostname Allowlist ----------
/**
 * In production, ONLY these exact hostnames are allowed.
 * Any other hostname returns UNKNOWN and is rejected.
 */
const PROD_HOSTNAME_MAP: Record<string, Surface> = {
  "app.breederhq.com": "PLATFORM",
  "portal.breederhq.com": "PORTAL",
  "marketplace.breederhq.com": "MARKETPLACE",
};


/**
 * Origin → Surface mapping for proxied requests.
 * When hostname is the Render API host, we use Origin header to determine surface.
 */
const ORIGIN_TO_SURFACE: Record<string, Surface> = {
  "https://app.breederhq.com": "PLATFORM",
  "https://portal.breederhq.com": "PORTAL",
  "https://marketplace.breederhq.com": "MARKETPLACE",
};

/**
 * Hostnames that indicate a proxied request (Vercel → Render).
 * For these, we derive surface from Origin header instead of hostname.
 */
const PROXY_API_HOSTNAMES = new Set([
  "breederhq-api.onrender.com",
]);

// ---------- Surface Derivation ----------

/**
 * Derive surface type from hostname ONLY.
 * No header overrides - hostname is trusted via Fastify trustProxy.
 *
 * PRODUCTION (NODE_ENV=production):
 *   Strict allowlist - only exact matches allowed:
 *   - app.breederhq.com → PLATFORM
 *   - portal.breederhq.com → PORTAL
 *   - marketplace.breederhq.com → MARKETPLACE
 *   - anything else → UNKNOWN (rejected with 403)
 *
 * DEVELOPMENT:
 *   Flexible prefix matching for local dev:
 *   - portal.breederhq.test, portal-* → PORTAL
 *   - marketplace.breederhq.test, marketplace-* → MARKETPLACE
 *   - app.breederhq.test, localhost, 127.0.0.1, etc. → PLATFORM
 */
export function deriveSurface(req: FastifyRequest): Surface {
  const hostname = (req.hostname || "").toLowerCase();

  // Production: strict allowlist only
  if (IS_PROD) {
    // First check direct hostname match
    const directMatch = PROD_HOSTNAME_MAP[hostname];
    if (directMatch) return directMatch;

    // If hostname is a known proxy API host, derive from Origin header
    if (PROXY_API_HOSTNAMES.has(hostname)) {
      const origin = (req.headers.origin || "").toLowerCase();
      const originMatch = ORIGIN_TO_SURFACE[origin];
      if (originMatch) return originMatch;

      // Allow Vercel preview deployments via Origin
      if (/^https:\/\/[a-z0-9-]+-breederhq\.vercel\.app$/i.test(origin)) {
        if (origin.includes("app-") || origin.includes("platform-")) return "PLATFORM";
        if (origin.includes("portal-")) return "PORTAL";
        if (origin.includes("marketplace-")) return "MARKETPLACE";
        return "PLATFORM";
      }

      // No Origin on proxy host - allow as PLATFORM for server-to-server/curl
      if (!origin) return "PLATFORM";
    }

    return "UNKNOWN";
  }

  // Development: flexible prefix matching
  if (hostname === "portal.breederhq.test" || hostname.startsWith("portal.") || hostname.startsWith("portal-")) {
    return "PORTAL";
  }
  if (hostname === "marketplace.breederhq.test" || hostname.startsWith("marketplace.") || hostname.startsWith("marketplace-")) {
    return "MARKETPLACE";
  }

  // Default: PLATFORM (includes app.breederhq.test, localhost, 127.0.0.1, etc.)
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

/**
 * Check if user has a specific entitlement with ACTIVE status.
 * Used for MARKETPLACE surface gating.
 */
async function hasActiveEntitlement(userId: string, key: string): Promise<boolean> {
  try {
    const entitlement = await (prisma as any).userEntitlement.findUnique({
      where: { userId_key: { userId, key } },
      select: { status: true },
    });
    return entitlement?.status === "ACTIVE";
  } catch {
    // UserEntitlement table may not exist yet - deny access
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
 * - MARKETPLACE: require valid session AND UserEntitlement(MARKETPLACE_ACCESS, ACTIVE) → PUBLIC
 *   - No tenant context required
 *   - SuperAdmin bypasses entitlement check
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
      // MARKETPLACE requires valid session AND one of:
      // 1. MARKETPLACE_ACCESS entitlement (standalone marketplace users)
      // 2. Any STAFF membership (platform subscribers get marketplace by policy)
      // No tenant context required

      // SuperAdmin bypasses entitlement check
      if (isSuperAdmin) {
        return { context: "PUBLIC", tenantId: null };
      }

      // Check for MARKETPLACE_ACCESS entitlement (explicit grant)
      const hasMarketplaceAccess = await hasActiveEntitlement(userId, "MARKETPLACE_ACCESS");
      if (hasMarketplaceAccess) {
        return { context: "PUBLIC", tenantId: null };
      }

      // Platform subscribers (users with any STAFF membership) get marketplace access by policy
      const staffMemberships = await getStaffMemberships(userId);
      if (staffMemberships.length > 0) {
        return { context: "PUBLIC", tenantId: null };
      }

      // No entitlement and no staff membership → deny access to marketplace surface
      return null;
    }

    default:
      return null;
  }
}

// ---------- Portal Party Scope Helper ----------

/**
 * Portal party scope context returned by requireClientPartyScope.
 * Guarantees that the request is from an authenticated CLIENT with a valid partyId.
 */
export interface ClientPartyScope {
  tenantId: number;
  userId: string;
  partyId: number;
}

/**
 * Require CLIENT party scope for portal endpoints.
 * Enforces that:
 * - User is authenticated
 * - ActorContext is CLIENT
 * - User has ACTIVE CLIENT membership to the tenant
 * - Membership has a valid partyId
 *
 * Throws 401/403 if requirements not met.
 * Returns { tenantId, userId, partyId } for use in data queries.
 *
 * Usage in routes:
 *   const { tenantId, partyId, userId } = await requireClientPartyScope(req);
 *   // Use partyId to filter queries
 */
export async function requireClientPartyScope(req: FastifyRequest): Promise<ClientPartyScope> {
  // Check userId from session
  const userId = (req as any).userId;
  if (!userId) {
    throw { statusCode: 401, error: "unauthorized", detail: "no_session" };
  }

  // Check tenantId from context
  const tenantId = Number((req as any).tenantId);
  if (!tenantId || isNaN(tenantId)) {
    throw { statusCode: 403, error: "forbidden", detail: "no_tenant_context" };
  }

  // Check actorContext is CLIENT
  const actorContext = (req as any).actorContext;
  if (actorContext !== "CLIENT") {
    throw { statusCode: 403, error: "forbidden", detail: "not_client_context" };
  }

  // Fetch CLIENT membership with partyId
  try {
    const membership = await (prisma as any).tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: {
        membershipRole: true,
        membershipStatus: true,
        partyId: true,
      },
    });

    // Verify CLIENT role and ACTIVE status
    if (!membership || membership.membershipRole !== "CLIENT" || membership.membershipStatus !== "ACTIVE") {
      throw { statusCode: 403, error: "forbidden", detail: "invalid_client_membership" };
    }

    // Verify partyId exists
    if (!membership.partyId) {
      throw { statusCode: 403, error: "forbidden", detail: "no_party_id" };
    }

    return {
      tenantId,
      userId,
      partyId: membership.partyId,
    };
  } catch (err: any) {
    // Re-throw our custom errors
    if (err.statusCode) {
      throw err;
    }
    // Database error
    throw { statusCode: 500, error: "internal_error", detail: "membership_lookup_failed" };
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
