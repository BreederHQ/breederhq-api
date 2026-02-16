// src/routes/marketplace-profile.ts
// Marketplace profile endpoints for tenant settings (draft + published)
//
// Auth: Requires session + tenant membership (OWNER/ADMIN for writes)
// Endpoints:
//   GET    /api/v1/marketplace/profile       - Read draft + published data
//   PUT    /api/v1/marketplace/profile/draft - Save draft
//   POST   /api/v1/marketplace/profile/publish - Publish (validates + strips address)

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";
import {
  validateLegalAcceptancePayload,
  writeLegalAcceptance,
} from "../services/marketplace-legal-service.js";

// ============================================================================
// Constants
// ============================================================================

const NAMESPACE = "marketplace-profile";

// ============================================================================
// Slug Generation
// ============================================================================

/**
 * Generate a URL-safe slug from business name.
 * Converts to lowercase, replaces spaces/special chars with hyphens.
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

/**
 * Ensure tenant has a slug. If missing, generate from business name.
 * Returns the slug (existing or newly generated).
 */
async function ensureTenantSlug(tenantId: number, businessName: string): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });

  if (tenant?.slug) {
    return tenant.slug;
  }

  // Generate unique slug from business name
  let baseSlug = generateSlug(businessName);
  if (!baseSlug) {
    baseSlug = `breeder-${tenantId}`;
  }

  let slug = baseSlug;
  let counter = 0;

  // Try to find unique slug (append counter if needed)
  while (true) {
    const existing = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      // Slug is available
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { slug },
      });
      return slug;
    }

    // Slug taken, try with counter
    counter++;
    slug = `${baseSlug}-${counter}`;

    // Safety limit
    if (counter > 100) {
      slug = `${baseSlug}-${Date.now()}`;
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { slug },
      });
      return slug;
    }
  }
}

// ============================================================================
// Breeding Programs Sync
// ============================================================================

/**
 * Sync marketplace profile listedPrograms to MktListingBreedingProgram database records.
 * This ensures rules can be managed at the PROGRAM level.
 *
 * This function:
 * 1. Creates/updates records for programs in the profile
 * 2. Deletes orphaned records that are no longer in the profile
 */
async function syncBreedingPrograms(tenantId: number, profileData: any): Promise<void> {
  const listedPrograms = profileData?.listedPrograms;
  if (!Array.isArray(listedPrograms)) return;

  // Track which slugs are valid (in the profile)
  const validSlugs = new Set<string>();

  for (const program of listedPrograms) {
    // Require minimum name length (3 chars) to avoid creating records for partial typing
    // This is defensive - frontend should debounce saves, but this prevents DB pollution
    if (!program.name || program.name.trim().length < 3 || !program.species) continue;

    const slug = generateSlug(program.name);
    validSlugs.add(slug);

    // Check if record exists
    const existing = await prisma.mktListingBreedingProgram.findFirst({
      where: { tenantId, slug },
      select: { id: true },
    });

    if (existing) {
      // Update existing
      await prisma.mktListingBreedingProgram.update({
        where: { id: existing.id },
        data: {
          name: program.name,
          species: program.species,
          breedText: program.breedText || null,
          breedId: program.breedId || null,
          description: program.description || null,
          programStory: program.programStory || null,
          coverImageUrl: program.coverImageUrl || null,
          showCoverImage: program.showCoverImage !== false,
          status: 'LIVE',
          acceptInquiries: program.acceptInquiries !== false,
          openWaitlist: program.openWaitlist === true,
          acceptReservations: program.acceptReservations === true,
          comingSoon: program.comingSoon === true,
        },
      });
    } else {
      // Create new
      await prisma.mktListingBreedingProgram.create({
        data: {
          tenantId,
          slug,
          name: program.name,
          species: program.species,
          breedText: program.breedText || null,
          breedId: program.breedId || null,
          description: program.description || null,
          programStory: program.programStory || null,
          coverImageUrl: program.coverImageUrl || null,
          showCoverImage: program.showCoverImage !== false,
          status: 'LIVE',
          acceptInquiries: program.acceptInquiries !== false,
          openWaitlist: program.openWaitlist === true,
          acceptReservations: program.acceptReservations === true,
          comingSoon: program.comingSoon === true,
        },
      });
    }
  }

  // Delete orphaned records that are no longer in the profile
  // Only delete if we have at least one valid program (prevents accidental mass deletion)
  if (validSlugs.size > 0) {
    const allRecords = await prisma.mktListingBreedingProgram.findMany({
      where: { tenantId },
      select: { id: true, slug: true },
    });

    const orphanedIds = allRecords
      .filter(record => !validSlugs.has(record.slug))
      .map(record => record.id);

    if (orphanedIds.length > 0) {
      await prisma.mktListingBreedingProgram.deleteMany({
        where: {
          id: { in: orphanedIds },
          tenantId, // Safety: ensure we only delete for this tenant
        },
      });
    }
  }
}

// Fields that must be stripped from published data for privacy
const ADDRESS_FIELDS_TO_STRIP = [
  "streetAddress",
  "streetAddress2",
  "addressLine1",
  "addressLine2",
];

// ============================================================================
// Types
// ============================================================================

interface MarketplaceProfileData {
  draft?: Record<string, unknown>;
  draftUpdatedAt?: string;
  published?: Record<string, unknown>;
  publishedAt?: string;
}

// ============================================================================
// Helpers
// ============================================================================

async function requireTenantMemberOrAdmin(req: FastifyRequest, tenantId: number) {
  const actorId = getActorId(req);
  if (!actorId) return { ok: false as const, code: 401 as const };

  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { isSuperAdmin: true },
  });
  if (user?.isSuperAdmin) return { ok: true as const, role: "OWNER" as const };

  const mem = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: actorId, tenantId } },
    select: { role: true },
  });
  if (!mem) return { ok: false as const, code: 403 as const };
  return { ok: true as const, role: mem.role };
}

function isAdminLike(role?: string | null) {
  return role === "OWNER" || role === "ADMIN";
}

async function readProfileSetting(tenantId: number): Promise<MarketplaceProfileData> {
  const row = await prisma.tenantSetting.findUnique({
    where: { tenantId_namespace: { tenantId, namespace: NAMESPACE } },
    select: { data: true },
  });
  return (row?.data as MarketplaceProfileData) ?? {};
}

async function writeProfileSetting(
  tenantId: number,
  data: MarketplaceProfileData,
  userId: string | null
) {
  return prisma.tenantSetting.upsert({
    where: { tenantId_namespace: { tenantId, namespace: NAMESPACE } },
    update: { data: data as object, version: { increment: 1 }, updatedBy: userId ?? undefined },
    create: { tenantId, namespace: NAMESPACE, data: data as object, version: 1, updatedBy: userId ?? undefined },
    select: { data: true, version: true, updatedAt: true },
  });
}

/**
 * Strip street address fields from data for privacy on publish.
 */
function stripAddressFields(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  for (const field of ADDRESS_FIELDS_TO_STRIP) {
    delete result[field];
  }
  // Also handle nested address object
  if (result.address && typeof result.address === "object") {
    const addr = { ...(result.address as Record<string, unknown>) };
    for (const field of ADDRESS_FIELDS_TO_STRIP) {
      delete addr[field];
    }
    // Remove street-related fields
    delete addr.street;
    delete addr.street2;
    result.address = addr;
  }
  return result;
}

/**
 * Validate that minimum required fields are present for publishing.
 *
 * Optional branding fields:
 * - logoUrl: URL to breeder logo (recommended 400x400px square)
 * - bannerImageUrl: URL to banner image (recommended 1200x400px wide)
 * - showLogo: boolean visibility flag for logo
 * - showBanner: boolean visibility flag for banner
 */
function validatePublishPayload(
  data: Record<string, unknown>
): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  // businessName required
  if (!data.businessName || typeof data.businessName !== "string" || !data.businessName.trim()) {
    errors.push("businessName is required");
  }

  // breeds >= 1
  if (!Array.isArray(data.breeds) || data.breeds.length < 1) {
    errors.push("at least one breed is required");
  }

  // listedPrograms >= 1 (only required for initial publish, allow empty for updates)
  // Note: Frontend should warn if hiding all programs, but backend allows it
  if (!Array.isArray(data.listedPrograms)) {
    errors.push("listedPrograms must be an array");
  }

  // Optional branding fields - validate types if present
  if (data.logoUrl !== undefined && data.logoUrl !== null && typeof data.logoUrl !== "string") {
    errors.push("logoUrl must be a string if provided");
  }
  if (data.bannerImageUrl !== undefined && data.bannerImageUrl !== null && typeof data.bannerImageUrl !== "string") {
    errors.push("bannerImageUrl must be a string if provided");
  }
  if (data.showLogo !== undefined && data.showLogo !== null && typeof data.showLogo !== "boolean") {
    errors.push("showLogo must be a boolean if provided");
  }
  if (data.showBanner !== undefined && data.showBanner !== null && typeof data.showBanner !== "boolean") {
    errors.push("showBanner must be a boolean if provided");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}

// ============================================================================
// Routes
// ============================================================================

const marketplaceProfileRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /profile - Read marketplace profile (draft + published)
  // --------------------------------------------------------------------------
  app.get("/profile", async (req, reply) => {
    const tenantId = (req as unknown as { tenantId: number | null }).tenantId;

    // For marketplace surface (no tenant context), return 400
    if (!tenantId) {
      return reply.code(400).send({
        error: "tenant_required",
        message: "X-Tenant-Id header required for profile endpoints",
      });
    }

    const gate = await requireTenantMemberOrAdmin(req, tenantId);
    if (!gate.ok) {
      return reply.code(gate.code).send({
        error: gate.code === 401 ? "unauthorized" : "forbidden",
      });
    }

    const data = await readProfileSetting(tenantId);

    return reply.send({
      draft: data.draft ?? null,
      draftUpdatedAt: data.draftUpdatedAt ?? null,
      published: data.published ?? null,
      publishedAt: data.publishedAt ?? null,
    });
  });

  // --------------------------------------------------------------------------
  // PUT /profile/draft - Save draft marketplace profile
  // --------------------------------------------------------------------------
  app.put<{ Body: Record<string, unknown> }>("/profile/draft", async (req, reply) => {
    const tenantId = (req as unknown as { tenantId: number | null }).tenantId;

    if (!tenantId) {
      return reply.code(400).send({
        error: "tenant_required",
        message: "X-Tenant-Id header required for profile endpoints",
      });
    }

    const gate = await requireTenantMemberOrAdmin(req, tenantId);
    if (!gate.ok) {
      return reply.code(gate.code).send({
        error: gate.code === 401 ? "unauthorized" : "forbidden",
      });
    }

    if (!isAdminLike(gate.role)) {
      return reply.code(403).send({ error: "forbidden", message: "Admin role required" });
    }

    const draftPayload = req.body ?? {};
    if (typeof draftPayload !== "object") {
      return reply.code(400).send({ error: "invalid_payload" });
    }

    const existing = await readProfileSetting(tenantId);
    const now = new Date().toISOString();

    const updated: MarketplaceProfileData = {
      ...existing,
      draft: draftPayload,
      draftUpdatedAt: now,
    };

    await writeProfileSetting(tenantId, updated, getActorId(req));

    // Sync listedPrograms to BreedingProgram database records
    await syncBreedingPrograms(tenantId, draftPayload);

    return reply.send({
      ok: true,
      draftUpdatedAt: now,
    });
  });

  // --------------------------------------------------------------------------
  // POST /profile/publish - Publish marketplace profile
  // --------------------------------------------------------------------------
  app.post<{ Body: Record<string, unknown> }>("/profile/publish", async (req, reply) => {
    const tenantId = (req as unknown as { tenantId: number | null }).tenantId;

    if (!tenantId) {
      return reply.code(400).send({
        error: "tenant_required",
        message: "X-Tenant-Id header required for profile endpoints",
      });
    }

    const gate = await requireTenantMemberOrAdmin(req, tenantId);
    if (!gate.ok) {
      return reply.code(gate.code).send({
        error: gate.code === 401 ? "unauthorized" : "forbidden",
      });
    }

    if (!isAdminLike(gate.role)) {
      return reply.code(403).send({ error: "forbidden", message: "Admin role required" });
    }

    const rawBody = req.body ?? {};
    if (typeof rawBody !== "object") {
      return reply.code(400).send({ error: "invalid_payload" });
    }

    // Extract legalAcceptance from payload (sent by frontend on first publish)
    const { legalAcceptance, ...publishPayload } = rawBody as Record<string, unknown>;

    // Validate required fields
    const validation = validatePublishPayload(publishPayload);
    if (!validation.valid) {
      return reply.code(400).send({
        error: "validation_failed",
        errors: validation.errors,
      });
    }

    // Record legal acceptance if provided (first-time publish flow)
    if (legalAcceptance) {
      try {
        const payload = validateLegalAcceptancePayload(legalAcceptance);
        const actorId = getActorId(req);
        // Look up user email for audit trail
        let email: string | undefined;
        if (actorId) {
          const user = await prisma.user.findUnique({
            where: { id: actorId },
            select: { email: true },
          });
          email = user?.email ?? undefined;
        }
        await writeLegalAcceptance(payload, req, {
          email,
          entityType: "tenant",
          entityId: tenantId,
        });
      } catch (err) {
        req.log.error({ err, tenantId }, "Failed to record legal acceptance on publish");
        // Don't block publish if legal logging fails — record the error
      }
    }

    // Strip address fields from published data for privacy
    const sanitizedPublished = stripAddressFields(publishPayload);

    // Ensure tenant has a slug for directory visibility
    const businessName = publishPayload.businessName as string;
    const tenantSlug = await ensureTenantSlug(tenantId, businessName);

    const existing = await readProfileSetting(tenantId);
    const now = new Date().toISOString();

    const updated: MarketplaceProfileData = {
      ...existing,
      published: sanitizedPublished,
      publishedAt: now,
      // Clear draft after publishing to prevent stale draft data from overriding published
      // The frontend merges with { ...published, ...draft } so old draft values would win
      draft: undefined,
      draftUpdatedAt: undefined,
    };

    await writeProfileSetting(tenantId, updated, getActorId(req));

    return reply.send({
      ok: true,
      publishedAt: now,
      tenantSlug,
    });
  });

  // --------------------------------------------------------------------------
  // GET /profile/slug - Get current tenant marketplace URL slug
  // --------------------------------------------------------------------------
  app.get("/profile/slug", async (req, reply) => {
    const tenantId = (req as unknown as { tenantId: number | null }).tenantId;

    if (!tenantId) {
      return reply.code(400).send({
        error: "tenant_required",
        message: "X-Tenant-Id header required for profile endpoints",
      });
    }

    const gate = await requireTenantMemberOrAdmin(req, tenantId);
    if (!gate.ok) {
      return reply.code(gate.code).send({
        error: gate.code === 401 ? "unauthorized" : "forbidden",
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    return reply.send({
      slug: tenant?.slug ?? null,
    });
  });

  // --------------------------------------------------------------------------
  // PUT /profile/slug - Update tenant marketplace URL slug
  // --------------------------------------------------------------------------
  app.put<{ Body: { slug: string } }>("/profile/slug", async (req, reply) => {
    const tenantId = (req as unknown as { tenantId: number | null }).tenantId;

    if (!tenantId) {
      return reply.code(400).send({
        error: "tenant_required",
        message: "X-Tenant-Id header required for profile endpoints",
      });
    }

    const gate = await requireTenantMemberOrAdmin(req, tenantId);
    if (!gate.ok) {
      return reply.code(gate.code).send({
        error: gate.code === 401 ? "unauthorized" : "forbidden",
      });
    }

    if (!isAdminLike(gate.role)) {
      return reply.code(403).send({ error: "forbidden", message: "Admin role required" });
    }

    const { slug: rawSlug } = req.body ?? {};

    if (!rawSlug || typeof rawSlug !== "string") {
      return reply.code(400).send({
        error: "invalid_slug",
        message: "Slug is required",
      });
    }

    // Normalize slug: lowercase, trim, replace invalid chars
    const slug = rawSlug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);

    // Validate minimum length
    if (slug.length < 3) {
      return reply.code(400).send({
        error: "invalid_slug",
        message: "Slug must be at least 3 characters",
      });
    }

    // Validate format (alphanumeric and hyphens only)
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      return reply.code(400).send({
        error: "invalid_slug",
        message: "Slug can only contain lowercase letters, numbers, and hyphens",
      });
    }

    // Check uniqueness (exclude current tenant)
    const existing = await prisma.tenant.findFirst({
      where: {
        slug,
        id: { not: tenantId },
      },
      select: { id: true },
    });

    if (existing) {
      return reply.code(409).send({
        error: "slug_taken",
        message: "This URL is already taken by another breeder",
      });
    }

    // Update the tenant slug
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { slug },
    });

    return reply.send({
      ok: true,
      slug,
    });
  });

  // --------------------------------------------------------------------------
  // POST /profile/sync-programs - Sync breeding programs from profile to database
  // --------------------------------------------------------------------------
  app.post("/profile/sync-programs", async (req, reply) => {
    const tenantId = (req as unknown as { tenantId: number | null }).tenantId;

    if (!tenantId) {
      return reply.code(400).send({
        error: "tenant_required",
        message: "X-Tenant-Id header required for profile endpoints",
      });
    }

    const gate = await requireTenantMemberOrAdmin(req, tenantId);
    if (!gate.ok) {
      return reply.code(gate.code).send({
        error: gate.code === 401 ? "unauthorized" : "forbidden",
      });
    }

    try {
      const data = await readProfileSetting(tenantId);
      const profile = data.draft || data.published;

      if (profile) {
        await syncBreedingPrograms(tenantId, profile);
      }

      return reply.send({ ok: true });
    } catch (err) {
      console.error("Error syncing breeding programs:", err);
      return reply.code(500).send({
        error: "internal_error",
        message: err instanceof Error ? err.message : "Failed to sync programs",
      });
    }
  });

  // --------------------------------------------------------------------------
  // POST /profile/unpublish - Remove published marketplace profile
  // --------------------------------------------------------------------------
  app.post("/profile/unpublish", async (req, reply) => {
    const tenantId = (req as unknown as { tenantId: number | null }).tenantId;

    if (!tenantId) {
      return reply.code(400).send({
        error: "tenant_required",
        message: "X-Tenant-Id header required for profile endpoints",
      });
    }

    const gate = await requireTenantMemberOrAdmin(req, tenantId);
    if (!gate.ok) {
      return reply.code(gate.code).send({
        error: gate.code === 401 ? "unauthorized" : "forbidden",
      });
    }

    if (!isAdminLike(gate.role)) {
      return reply.code(403).send({ error: "forbidden", message: "Admin role required" });
    }

    try {
      const existing = await readProfileSetting(tenantId);

      // Remove published data but keep draft
      const updated: MarketplaceProfileData = {
        ...existing,
        published: undefined,
        publishedAt: undefined,
      };

      await writeProfileSetting(tenantId, updated, getActorId(req));

      return reply.send({
        ok: true,
      });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "Failed to unpublish marketplace profile");
      return reply.code(500).send({
        error: "unpublish_failed",
        message: err?.message || "Failed to remove marketplace listing",
      });
    }
  });
};

export default marketplaceProfileRoutes;
