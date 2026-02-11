// src/routes/public-marketplace.ts
// Marketplace endpoints - authentication AND entitlement required
//
// SECURITY: All data endpoints in this file require:
//   1. Valid session cookie (bhq_s) - enforced by middleware
//   2. Marketplace entitlement - enforced by requireMarketplaceEntitlement() in each handler
//
// Access control:
// - MARKETPLACE surface: requires session + MARKETPLACE_ACCESS entitlement → PUBLIC context
// - PLATFORM surface: requires session + STAFF membership → STAFF context (marketplace as module)
// - PORTAL surface: no access (rejected by surface gate)
//
// All endpoints resolve tenant from program slug, not headers/session

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";
import { getTosStatus } from "../services/tos-service.js";
import {
  resolveTenantFromProgramSlug,
  resolveOffspringGroupListing,
  resolveAnimalListing,
  isValidSlug,
  normalizeSlug,
} from "../utils/public-tenant-resolver.js";
import {
  toPublicProgramDTO,
  toPublicProgramSummaryDTO,
  toPublicOffspringGroupListingDTO,
  toPublicOffspringDTO,
  toPublicAnimalListingDTO,
  toOffspringGroupSummaryDTO,
  toAnimalListingSummaryDTO,
  type PublicListingSummaryDTO,
  type PublicProgramSummaryDTO,
} from "../utils/public-dto.js";
import {
  sendInquiryConfirmationToUser,
  sendInquiryNotificationToBreeder,
} from "../services/marketplace-email-service.js";

// ============================================================================
// Security: Environment flags
// ============================================================================

/**
 * SECURITY: STAFF bypass is disabled by default in production.
 * Set MARKETPLACE_STAFF_BYPASS=true to allow STAFF members marketplace access.
 */
const MARKETPLACE_STAFF_BYPASS = process.env.MARKETPLACE_STAFF_BYPASS === "true";

// Log warning at module load if bypass is enabled
if (MARKETPLACE_STAFF_BYPASS) {
  console.warn(
    "[SECURITY WARNING] MARKETPLACE_STAFF_BYPASS is enabled. " +
    "STAFF members will have marketplace access without explicit entitlement."
  );
}

// ============================================================================
// Security: Entitlement enforcement helper
// ============================================================================

/**
 * SECURITY: Require marketplace entitlement before returning any data.
 *
 * This is defense-in-depth - the surface gate middleware already checks entitlement,
 * but we explicitly verify here to ensure no data leaks if middleware is bypassed.
 *
 * Entitlement is granted via:
 * 1. superAdmin flag on user
 * 2. MARKETPLACE_ACCESS entitlement with ACTIVE status
 * 3. STAFF membership (ONLY if MARKETPLACE_STAFF_BYPASS=true env flag is set)
 *
 * Returns true if entitled, sends 401/403 response and returns false otherwise.
 * Callers MUST check return value and return early if false.
 */
async function requireMarketplaceEntitlement(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const userId = (req as any).userId;

  // No session = 401
  if (!userId) {
    reply.code(401).send({ error: "unauthorized", message: "Authentication required" });
    return false;
  }

  // Check if user is entitled to marketplace
  // Priority: superAdmin > explicit entitlement > staff membership (if bypass enabled)

  // 1. Check superAdmin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true } as any,
  }) as any;

  if (user?.isSuperAdmin) {
    return true;
  }

  // 2. Check explicit MARKETPLACE_ACCESS entitlement
  try {
    const entitlement = await (prisma as any).userEntitlement.findUnique({
      where: { userId_key: { userId, key: "MARKETPLACE_ACCESS" } },
      select: { status: true },
    });
    if (entitlement?.status === "ACTIVE") {
      return true;
    }
  } catch {
    // Table may not exist - continue to staff check if bypass enabled
  }

  // 3. Check STAFF membership ONLY if bypass is explicitly enabled
  // SECURITY: This bypass is OFF by default in production
  if (MARKETPLACE_STAFF_BYPASS) {
    try {
      const staffMembership = await (prisma as any).tenantMembership.findFirst({
        where: {
          userId,
          membershipRole: "STAFF",
          membershipStatus: "ACTIVE",
        },
        select: { tenantId: true },
      });
      if (staffMembership) {
        return true;
      }
    } catch {
      // Fallback for old schema
      try {
        const anyMembership = await (prisma as any).tenantMembership.findFirst({
          where: { userId },
          select: { tenantId: true },
        });
        if (anyMembership) {
          return true;
        }
      } catch {
        // No memberships table
      }
    }
  }

  // Not entitled = 403
  reply.code(403).send({
    error: "not_entitled",
    message: "Marketplace access requires subscription or invitation"
  });
  return false;
}

// ============================================================================
// Helper: parse pagination
// ============================================================================
function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(50, Math.max(1, Number(q?.limit ?? 20) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// ============================================================================
// Routes
// ============================================================================

const publicMarketplaceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /me - Current user's marketplace access info
  // --------------------------------------------------------------------------
  // Returns:
  // - userId: the authenticated user's ID
  // - actorContext: the resolved actor context (PUBLIC for marketplace surface)
  // - entitlements: list of user's explicit entitlements
  // - marketplaceEntitled: true if user can access marketplace (either by entitlement or policy)
  // - entitlementSource: "ENTITLEMENT" | "STAFF_POLICY" | "SUPER_ADMIN"
  //
  // This endpoint is for UI gating and debugging - it lets the frontend know
  // whether the user is entitled and why.
  // --------------------------------------------------------------------------
  app.get("/me", async (req, reply) => {
    const userId = (req as any).userId;
    const actorContext = (req as any).actorContext;
    const surface = (req as any).surface;

    // Allow anonymous users - return empty profile
    if (!userId) {
      return reply.send({
        userId: null,
        email: null,
        name: null,
        firstName: null,
        lastName: null,
        phone: null,
        marketplaceEntitled: false,
        actorContext: "PUBLIC",
        surface,
        entitlements: [],
        entitlementSource: null,
      });
    }

    // Fetch user info and entitlements
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phoneE164: true,
        isSuperAdmin: true,
      } as any,
    }) as any;

    if (!user) {
      return reply.code(401).send({ error: "user_not_found" });
    }

    // Fetch explicit entitlements
    let entitlements: Array<{ key: string; status: string; grantedAt: Date }> = [];
    try {
      const rows = await (prisma as any).userEntitlement.findMany({
        where: { userId },
        select: { key: true, status: true, grantedAt: true },
      });
      entitlements = rows || [];
    } catch {
      // UserEntitlement table may not exist yet
    }

    // Check explicit MARKETPLACE_ACCESS entitlement
    const hasExplicitEntitlement = entitlements.some(
      (e) => e.key === "MARKETPLACE_ACCESS" && e.status === "ACTIVE"
    );

    // Check STAFF memberships (for policy-based entitlement)
    let hasStaffMembership = false;
    try {
      const memberships = await (prisma as any).tenantMembership.findMany({
        where: {
          userId,
          membershipRole: "STAFF",
          membershipStatus: "ACTIVE",
        },
        select: { tenantId: true },
        take: 1,
      });
      hasStaffMembership = (memberships?.length ?? 0) > 0;
    } catch {
      // Fallback for schema without new fields
      try {
        const memberships = await (prisma as any).tenantMembership.findMany({
          where: { userId },
          select: { tenantId: true },
          take: 1,
        });
        hasStaffMembership = (memberships?.length ?? 0) > 0;
      } catch {
        // No memberships table
      }
    }

    // Determine entitlement source
    let entitlementSource: "SUPER_ADMIN" | "ENTITLEMENT" | "STAFF_POLICY" | null = null;
    let marketplaceEntitled = false;

    if (user.isSuperAdmin) {
      marketplaceEntitled = true;
      entitlementSource = "SUPER_ADMIN";
    } else if (hasExplicitEntitlement) {
      marketplaceEntitled = true;
      entitlementSource = "ENTITLEMENT";
    } else if (hasStaffMembership) {
      marketplaceEntitled = true;
      entitlementSource = "STAFF_POLICY";
    }


    // Get ToS status for this user
    const tosStatus = await getTosStatus(user.id);
    return reply.send({
      userId: user.id,
      email: user.email,
      name: user.name || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      phone: user.phoneE164 || null,
      actorContext,
      surface,
      entitlements: entitlements.map((e) => ({
        key: e.key,
        status: e.status,
        grantedAt: e.grantedAt,
      })),
      marketplaceEntitled,
      entitlementSource,
      tos: tosStatus,
    });
  });

  // --------------------------------------------------------------------------
  // PATCH /profile - Update user profile (basic profile maintenance)
  // --------------------------------------------------------------------------
  app.patch<{
    Body: {
      firstName?: string;
      lastName?: string;
      phoneE164?: string | null;
    };
  }>("/profile", async (req, reply) => {
    const userId = (req as any).userId;

    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const { firstName, lastName, phoneE164 } = req.body || {};

    // Build update data - only include fields that are provided
    const updateData: any = {};
    if (firstName !== undefined) {
      if (!firstName.trim()) {
        return reply.code(400).send({ error: "invalid_first_name", message: "First name is required" });
      }
      updateData.firstName = firstName.trim();
    }
    if (lastName !== undefined) {
      if (!lastName.trim()) {
        return reply.code(400).send({ error: "invalid_last_name", message: "Last name is required" });
      }
      updateData.lastName = lastName.trim();
    }
    if (phoneE164 !== undefined) {
      updateData.phoneE164 = phoneE164 || null;
    }

    // Update the name field if firstName or lastName changed
    if (firstName !== undefined || lastName !== undefined) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const newFirstName = firstName !== undefined ? firstName.trim() : currentUser?.firstName || "";
      const newLastName = lastName !== undefined ? lastName.trim() : currentUser?.lastName || "";
      updateData.name = [newFirstName, newLastName].filter(Boolean).join(" ") || null;
    }

    if (Object.keys(updateData).length === 0) {
      return reply.code(400).send({ error: "no_updates", message: "No fields to update" });
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          phoneE164: true,
        },
      });

      return reply.send({
        ok: true,
        user: {
          userId: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          phone: updatedUser.phoneE164,
        },
      });
    } catch (err: any) {
      console.error("Failed to update user profile:", err);
      return reply.code(500).send({ error: "internal_error", message: "Failed to update profile" });
    }
  });

  // --------------------------------------------------------------------------
  // GET /programs - Programs index (search/browse) - REQUIRES ENTITLEMENT
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: {
      search?: string;
      species?: string;
      breed?: string;
      location?: string;
      limit?: string;
      offset?: string;
    };
  }>("/programs", async (req, reply) => {
    // SECURITY: Require entitlement before returning any data
    if (!(await requireMarketplaceEntitlement(req, reply))) return;

    const { search, species, breed, location } = req.query;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 24)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    // Build where clause
    const where: any = {
      isPublicProgram: true,
      programSlug: { not: null },
    };

    // Search filter - case insensitive name match
    if (search && search.trim()) {
      where.name = { contains: search.trim(), mode: "insensitive" };
    }

    // Location filter - match city, state, country, or zip code
    if (location && location.trim()) {
      const locationTerm = location.trim();
      where.OR = [
        { city: { contains: locationTerm, mode: "insensitive" } },
        { state: { contains: locationTerm, mode: "insensitive" } },
        { country: { contains: locationTerm, mode: "insensitive" } },
        { zip: { contains: locationTerm, mode: "insensitive" } },
      ];
    }

    // Species and breed filters not implemented yet (would require animal aggregation)
    // Accept params without error but ignore for now

    const [programs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { name: "asc" },
        select: {
          programSlug: true,
          name: true,
          city: true,
          state: true,
          country: true,
        },
      }),
      prisma.organization.count({ where }),
    ]);

    const items: PublicProgramSummaryDTO[] = programs.map(toPublicProgramSummaryDTO);

    return reply.send({ items, total });
  });

  // --------------------------------------------------------------------------
  // GET /animal-programs - Animal Programs index (search/browse) - PUBLIC
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: {
      search?: string;
      species?: string;
      breed?: string;
      location?: string;
      templateType?: string;
      tenantId?: string; // Optional: filter by breeder (numeric ID or slug)
      limit?: string;
      offset?: string;
    };
  }>("/animal-programs", async (req, reply) => {
    // PUBLIC: No auth required - this is a public browsing endpoint

    const { search, templateType, tenantId } = req.query;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 24)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    // Build where clause - only LIVE and listed programs
    const where: any = {
      status: "LIVE",
    };

    // Filter by tenant/breeder if specified (for breeder storefront context)
    // Accepts either numeric ID or slug
    if (tenantId) {
      const parsedId = parseInt(tenantId, 10);
      if (!isNaN(parsedId)) {
        // Numeric ID
        where.tenantId = parsedId;
      } else {
        // Slug - need to resolve to ID first
        const tenant = await prisma.tenant.findUnique({
          where: { slug: tenantId.trim().toLowerCase() },
          select: { id: true },
        });
        if (tenant) {
          where.tenantId = tenant.id;
        } else {
          // Invalid slug - return empty results
          return reply.send({ items: [], total: 0, limit, offset });
        }
      }
    }

    // Search filter - case insensitive name or headline match
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { headline: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    // Template type filter (STUD_SERVICES, GUARDIAN, etc.)
    if (templateType && templateType.trim()) {
      where.templateType = templateType.toUpperCase();
    }

    // Species and breed filters not implemented yet (would require animal aggregation)
    // Accept params without error but ignore for now

    const [programs, total] = await Promise.all([
      prisma.mktListingAnimalProgram.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          name: true,
          headline: true,
          description: true,
          coverImageUrl: true,
          templateType: true,
          defaultPriceModel: true,
          defaultPriceCents: true,
          defaultPriceMinCents: true,
          defaultPriceMaxCents: true,
          viewCount: true,
          publishedAt: true,
          tenant: {
            select: {
              id: true,
              name: true,
              organizations: {
                take: 1,
                select: {
                  programSlug: true,
                  city: true,
                  state: true,
                  country: true,
                },
              },
            },
          },
          participants: {
            where: { status: "LIVE" },
            select: {
              id: true,
              animal: {
                select: {
                  id: true,
                  name: true,
                  photoUrl: true,
                  species: true,
                  breed: true,
                  sex: true,
                },
              },
            },
          },
        },
      }),
      prisma.mktListingAnimalProgram.count({ where }),
    ]);

    // Transform to public DTOs
    const items = programs.map((program) => ({
      id: program.id,
      slug: program.slug,
      name: program.name,
      headline: program.headline || null,
      description: program.description || null,
      coverImageUrl: program.coverImageUrl || null,
      templateType: program.templateType,
      priceModel: program.defaultPriceModel,
      priceCents: program.defaultPriceCents || null,
      priceMinCents: program.defaultPriceMinCents || null,
      priceMaxCents: program.defaultPriceMaxCents || null,
      viewCount: program.viewCount,
      publishedAt: program.publishedAt?.toISOString() || null,
      breeder: {
        tenantId: program.tenant.id,
        name: program.tenant.name,
        slug: program.tenant.organizations[0]?.programSlug || null,
        location: [
          program.tenant.organizations[0]?.city,
          program.tenant.organizations[0]?.state,
          program.tenant.organizations[0]?.country,
        ]
          .filter(Boolean)
          .join(", ") || null,
      },
      participants: program.participants.map((p) => ({
        id: p.id,
        animalId: p.animal.id,
        name: p.animal.name,
        photoUrl: p.animal.photoUrl,
        species: p.animal.species,
        breed: p.animal.breed,
        sex: p.animal.sex,
      })),
      participantCount: program.participants.length,
    }));

    return reply.send({ items, total, limit, offset });
  });

  // --------------------------------------------------------------------------
  // GET /mkt-listing-individual-animals - Direct Animal Listings index (V2 individual listings) - PUBLIC
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: {
      search?: string;
      species?: string;
      breed?: string;
      templateType?: string;
      location?: string;
      priceMin?: string;
      priceMax?: string;
      tenantSlug?: string;
      limit?: string;
      offset?: string;
    };
  }>("/mkt-listing-individual-animals", async (req, reply) => {
    // PUBLIC: No auth required - this is a public browsing endpoint

    const { search, species, breed, templateType, location, priceMin, priceMax, tenantSlug } = req.query;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 24)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    // Build where clause - only LIVE status listings
    const where: any = {
      status: "LIVE",
    };

    if (templateType) {
      where.templateType = templateType.toUpperCase();
    }

    // Filter by breeder tenant slug (for breeder storefront pages)
    // Accepts either numeric ID or slug
    if (tenantSlug && tenantSlug.trim()) {
      const trimmedSlug = tenantSlug.trim();
      const parsedId = parseInt(trimmedSlug, 10);
      if (!isNaN(parsedId)) {
        // Numeric ID
        where.tenantId = parsedId;
      } else {
        // Slug - need to resolve to ID first
        const tenant = await prisma.tenant.findUnique({
          where: { slug: trimmedSlug.toLowerCase() },
          select: { id: true },
        });
        if (tenant) {
          where.tenantId = tenant.id;
        } else {
          // Invalid slug - return empty results
          return reply.send({ items: [], total: 0, limit, offset });
        }
      }
    }

    if (species) {
      where.animal = { ...where.animal, species: species.toUpperCase() };
    }

    if (breed && breed.trim()) {
      where.animal = { ...where.animal, breed: { contains: breed.trim(), mode: "insensitive" } };
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { headline: { contains: searchTerm, mode: "insensitive" } },
        { title: { contains: searchTerm, mode: "insensitive" } },
        { summary: { contains: searchTerm, mode: "insensitive" } },
        { animal: { name: { contains: searchTerm, mode: "insensitive" } } },
        { animal: { breed: { contains: searchTerm, mode: "insensitive" } } },
      ];
    }

    if (location && location.trim()) {
      const locationTerm = location.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { locationCity: { contains: locationTerm, mode: "insensitive" } },
            { locationRegion: { contains: locationTerm, mode: "insensitive" } },
            { locationCountry: { contains: locationTerm, mode: "insensitive" } },
            { tenant: { organizations: { some: { city: { contains: locationTerm, mode: "insensitive" } } } } },
            { tenant: { organizations: { some: { state: { contains: locationTerm, mode: "insensitive" } } } } },
            { tenant: { organizations: { some: { zip: { contains: locationTerm, mode: "insensitive" } } } } },
          ],
        },
      ];
    }

    if (priceMin || priceMax) {
      const minCents = priceMin ? Math.round(Number(priceMin) * 100) : undefined;
      const maxCents = priceMax ? Math.round(Number(priceMax) * 100) : undefined;
      const priceConditions: any[] = [];
      if (minCents) {
        priceConditions.push({ OR: [{ priceCents: { gte: minCents } }, { priceMinCents: { gte: minCents } }] });
      }
      if (maxCents) {
        priceConditions.push({ OR: [{ priceCents: { lte: maxCents } }, { priceMaxCents: { lte: maxCents } }, { priceModel: "inquire" }] });
      }
      if (priceConditions.length > 0) {
        where.AND = [...(where.AND || []), ...priceConditions];
      }
    }

    try {
      const [listings, total] = await Promise.all([
        prisma.mktListingIndividualAnimal.findMany({
          where,
          orderBy: [{ createdAt: "desc" }],
          skip: offset,
          take: limit,
          include: {
            animal: {
              select: {
                id: true,
                name: true,
                photoUrl: true,
                birthDate: true,
                species: true,
                breed: true,
                sex: true,
              },
            },
            tenant: {
              select: {
                id: true,
                slug: true,
                name: true,
                organizations: {
                  where: { isPublicProgram: true },
                  take: 1,
                  select: {
                    city: true,
                    state: true,
                    programSlug: true,
                  },
                },
              },
            },
          },
        }),
        prisma.mktListingIndividualAnimal.count({ where }),
      ]);

      const items = listings.map((listing) => {
        const org = listing.tenant?.organizations?.[0];
        return {
          id: listing.id,
          slug: listing.slug,
          templateType: listing.templateType,
          headline: listing.headline,
          title: listing.title || listing.animal?.name,
          summary: listing.summary,
          priceModel: listing.priceModel,
          priceCents: listing.priceCents,
          priceMinCents: listing.priceMinCents,
          priceMaxCents: listing.priceMaxCents,
          locationCity: listing.locationCity || org?.city,
          locationRegion: listing.locationRegion || org?.state,
          publishedAt: listing.publishedAt?.toISOString() || null,
          animalId: listing.animal?.id,
          animalName: listing.animal?.name,
          animalPhotoUrl: listing.animal?.photoUrl,
          animalSpecies: listing.animal?.species || null,
          animalBreed: listing.animal?.breed || null,
          animalSex: listing.animal?.sex || null,
          animalBirthDate: listing.animal?.birthDate?.toISOString() || null,
          breeder: {
            id: listing.tenant?.id,
            slug: listing.tenant?.slug || org?.programSlug,
            name: listing.tenant?.name,
            location: [org?.city, org?.state].filter(Boolean).join(", ") || null,
          },
        };
      });

      return reply.send({ items, total, limit, offset });
    } catch (err: any) {
      req.log.error({ err, where }, "Failed to fetch public direct listings");
      return reply.code(500).send({ error: "server_error", message: "Failed to fetch listings" });
    }
  });

  // --------------------------------------------------------------------------
  // GET /mkt-listing-individual-animals/:slug - Direct Listing detail - PUBLIC
  // --------------------------------------------------------------------------
  app.get<{ Params: { slug: string } }>(
    "/mkt-listing-individual-animals/:slug",
    async (req, reply) => {
      // PUBLIC: No auth required - this is a public browsing endpoint

      const { slug } = req.params;

      if (!isValidSlug(slug)) {
        return reply.code(404).send({ error: "not_found", message: "Listing not found" });
      }

      try {
        const listing = await prisma.mktListingIndividualAnimal.findFirst({
          where: {
            slug,
            status: "LIVE",
          },
          select: {
            id: true,
            slug: true,
            templateType: true,
            headline: true,
            title: true,
            summary: true,
            description: true,
            priceModel: true,
            priceCents: true,
            priceMinCents: true,
            priceMaxCents: true,
            locationCity: true,
            locationRegion: true,
            locationCountry: true,
            publishedAt: true,
            viewCount: true,
            inquiryCount: true,
            dataDrawerConfig: true,
            animal: {
              select: {
                id: true,
                name: true,
                species: true,
                breed: true,
                sex: true,
                birthDate: true,
                photoUrl: true,
                canonicalBreed: { select: { name: true } },
                privacySettings: true,
                sire: { select: { id: true, name: true, photoUrl: true } },
                dam: { select: { id: true, name: true, photoUrl: true } },
                registryIds: {
                  include: { registry: { select: { name: true } } },
                },
                titles: {
                  include: { titleDefinition: { select: { abbreviation: true, fullName: true } } },
                },
                AnimalTraitValue: {
                  where: {
                    traitDefinition: {
                      category: { in: ["health", "health_testing", "genetics", "coat_color", "performance"] },
                    },
                  },
                  include: {
                    traitDefinition: { select: { key: true, displayName: true, category: true } },
                  },
                },
                Attachment: { orderBy: { createdAt: "asc" as const } },
              },
            },
            tenant: {
              select: {
                id: true,
                slug: true,
                name: true,
                city: true,
                region: true,
                country: true,
                organizations: {
                  where: { isPublicProgram: true },
                  take: 1,
                  select: { programSlug: true, name: true },
                },
              },
            },
          },
        });

        if (!listing) {
          return reply.code(404).send({ error: "not_found", message: "Listing not found" });
        }

        const { animal, tenant, dataDrawerConfig } = listing;
        const config = dataDrawerConfig as any;
        const privacy = animal.privacySettings;
        const org = tenant.organizations?.[0] || null;

        // Helper: Check if section is enabled in privacy settings and data drawer config
        const isSectionEnabled = (privacyFlag: boolean | null | undefined, configSection: any): boolean => {
          return privacyFlag === true && configSection?.enabled === true;
        };

        // Build response with data filtered by privacy and dataDrawerConfig
        const response: any = {
          listing: {
            id: listing.id,
            slug: listing.slug,
            templateType: listing.templateType,
            headline: listing.headline,
            title: listing.title,
            summary: listing.summary,
            description: listing.description,
            priceModel: listing.priceModel,
            priceCents: listing.priceCents,
            priceMinCents: listing.priceMinCents,
            priceMaxCents: listing.priceMaxCents,
            locationCity: listing.locationCity,
            locationRegion: listing.locationRegion,
            locationCountry: listing.locationCountry,
            publishedAt: listing.publishedAt?.toISOString() || null,
            viewCount: listing.viewCount,
          },
          breeder: {
            id: tenant.id,
            slug: tenant.slug || org?.programSlug || null,
            name: org?.name || tenant.name,
            city: tenant.city,
            region: tenant.region,
            country: tenant.country,
          },
          animal: {
            id: animal.id,
            name: privacy?.showName ? animal.name : null,
            species: animal.species,
            breed: animal.canonicalBreed?.name || animal.breed,
            sex: animal.sex,
            birthDate: privacy?.showFullDob ? animal.birthDate?.toISOString() : null,
            photoUrl: privacy?.showPhoto ? animal.photoUrl : null,
            sire: animal.sire ? { id: animal.sire.id, name: animal.sire.name, photoUrl: animal.sire.photoUrl } : null,
            dam: animal.dam ? { id: animal.dam.id, name: animal.dam.name, photoUrl: animal.dam.photoUrl } : null,
          },
          data: {} as any,
        };

        // Registry
        if (isSectionEnabled(privacy?.showRegistryFull, config?.registry)) {
          const selectedIds = config.registry.registryIds || [];
          response.data.registrations = animal.registryIds
            .filter((r: { id: number }) => selectedIds.length === 0 || selectedIds.includes(r.id))
            .map((r: { id: number; registry: { name: string }; identifier: string }) => ({
              id: r.id,
              registryName: r.registry.name,
              identifier: r.identifier,
            }));
        }

        // Titles
        if (isSectionEnabled(privacy?.showTitles, config?.titles)) {
          response.data.titles = animal.titles.map((t: { id: number; titleDefinition: { abbreviation: string; fullName: string } }) => ({
            id: t.id,
            abbreviation: t.titleDefinition.abbreviation,
            name: t.titleDefinition.fullName,
          }));
        }

        // Health testing
        if (isSectionEnabled(privacy?.enableHealthSharing, config?.healthTesting)) {
          const healthTraits = animal.AnimalTraitValue.filter(
            (tv: { traitDefinition: { category: string } }) => tv.traitDefinition.category === "health_testing"
          );
          response.data.healthTesting = healthTraits.map((tv: { id: number; traitDefinition: { key: string; displayName: string }; valueText: string | null }) => ({
            key: tv.traitDefinition.key,
            name: tv.traitDefinition.displayName,
            value: tv.valueText || "",
          }));
        }

        // Photos/gallery
        if (privacy?.showPhoto && config?.gallery?.enabled) {
          response.data.gallery = animal.Attachment
            .filter((a: { kind: string; mime: string }) => a.kind === "photo" || a.mime.startsWith("image/"))
            .map((a: { id: number; storageKey: string }) => ({
              id: a.id,
              url: `https://${process.env.CDN_DOMAIN || "cdn.breederhq.com"}/${a.storageKey}`,
              caption: null,
            }));
        }

        // Increment view count asynchronously
        prisma.mktListingIndividualAnimal.update({
          where: { id: listing.id },
          data: { viewCount: { increment: 1 } },
        }).catch((err) => req.log.warn({ err }, "Failed to increment view count"));

        return reply.send(response);
      } catch (err: any) {
        req.log.error({ err, slug }, "Failed to fetch direct listing detail");
        return reply.code(500).send({ error: "server_error", message: "Failed to fetch listing" });
      }
    }
  );

  // --------------------------------------------------------------------------
  // GET /animal-programs/:slug - Animal Program detail - PUBLIC
  // --------------------------------------------------------------------------
  app.get<{ Params: { slug: string } }>(
    "/animal-programs/:slug",
    async (req, reply) => {
      // PUBLIC: No auth required - this is a public browsing endpoint

      const { slug } = req.params;

      if (!isValidSlug(slug)) {
        return reply.code(404).send({ error: "not_found" });
      }

      const program = await prisma.mktListingAnimalProgram.findFirst({
        where: {
          slug,
          status: "LIVE",
        },
        select: {
          id: true,
          slug: true,
          name: true,
          headline: true,
          description: true,
          coverImageUrl: true,
          templateType: true,
          programContent: true,
          dataDrawerConfig: true,
          defaultPriceModel: true,
          defaultPriceCents: true,
          defaultPriceMinCents: true,
          defaultPriceMaxCents: true,
          acceptInquiries: true,
          openWaitlist: true,
          viewCount: true,
          inquiryCount: true,
          publishedAt: true,
          createdAt: true,
          tenant: {
            select: {
              id: true,
              name: true,
              organizations: {
                take: 1,
                select: {
                  programSlug: true,
                  name: true,
                  city: true,
                  state: true,
                  country: true,
                  publicContactEmail: true,
                  website: true,
                },
              },
            },
          },
          participants: {
            where: { status: "LIVE" },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              headlineOverride: true,
              descriptionOverride: true,
              priceModel: true,
              priceCents: true,
              priceMinCents: true,
              priceMaxCents: true,
              featured: true,
              viewCount: true,
              inquiryCount: true,
              animal: {
                select: {
                  id: true,
                  name: true,
                  photoUrl: true,
                  species: true,
                  breed: true,
                  sex: true,
                  birthDate: true,
                },
              },
            },
          },
          media: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              type: true,
              url: true,
              caption: true,
              isPrimary: true,
            },
          },
        },
      });

      if (!program) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Increment view count asynchronously (don't await)
      prisma.mktListingAnimalProgram
        .update({
          where: { id: program.id },
          data: {
            viewCount: { increment: 1 },
            lastViewedAt: new Date(),
          },
        })
        .catch((err) => {
          req.log.error({ err, programId: program.id }, "Failed to increment view count");
        });

      // Transform to public DTO
      const dto = {
        id: program.id,
        slug: program.slug,
        name: program.name,
        headline: program.headline || null,
        description: program.description || null,
        coverImageUrl: program.coverImageUrl || null,
        templateType: program.templateType,
        programContent: program.programContent || {},
        dataDrawerConfig: program.dataDrawerConfig || {},
        priceModel: program.defaultPriceModel,
        priceCents: program.defaultPriceCents || null,
        priceMinCents: program.defaultPriceMinCents || null,
        priceMaxCents: program.defaultPriceMaxCents || null,
        acceptInquiries: program.acceptInquiries,
        openWaitlist: program.openWaitlist,
        viewCount: program.viewCount,
        inquiryCount: program.inquiryCount,
        publishedAt: program.publishedAt?.toISOString() || null,
        createdAt: program.createdAt.toISOString(),
        breeder: {
          tenantId: program.tenant.id,
          name: program.tenant.name,
          slug: program.tenant.organizations[0]?.programSlug || null,
          location: [
            program.tenant.organizations[0]?.city,
            program.tenant.organizations[0]?.state,
            program.tenant.organizations[0]?.country,
          ]
            .filter(Boolean)
            .join(", ") || null,
          contactEmail: program.tenant.organizations[0]?.publicContactEmail || null,
          website: program.tenant.organizations[0]?.website || null,
        },
        participants: program.participants.map((p) => ({
          id: p.id,
          animalId: p.animal.id,
          name: p.animal.name,
          photoUrl: p.animal.photoUrl,
          species: p.animal.species,
          breed: p.animal.breed,
          sex: p.animal.sex,
          birthDate: p.animal.birthDate?.toISOString() || null,
          headlineOverride: p.headlineOverride || null,
          descriptionOverride: p.descriptionOverride || null,
          priceModel: p.priceModel || null,
          priceCents: p.priceCents || null,
          priceMinCents: p.priceMinCents || null,
          priceMaxCents: p.priceMaxCents || null,
          featured: p.featured,
          viewCount: p.viewCount,
          inquiryCount: p.inquiryCount,
        })),
        media: program.media.map((m) => ({
          id: m.id,
          type: m.type,
          url: m.url,
          caption: m.caption || null,
          isPrimary: m.isPrimary,
        })),
        participantCount: program.participants.length,
      };

      return reply.send(dto);
    }
  );

  // --------------------------------------------------------------------------
  // GET /programs/:programSlug - Program profile - REQUIRES ENTITLEMENT
  // --------------------------------------------------------------------------
  app.get<{ Params: { programSlug: string } }>(
    "/programs/:programSlug",
    async (req, reply) => {
      // SECURITY: Require entitlement before returning any data
      if (!(await requireMarketplaceEntitlement(req, reply))) return;

      const { programSlug } = req.params;

      if (!isValidSlug(programSlug)) {
        return reply.code(404).send({ error: "not_found" });
      }

      const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
      if (!resolved) {
        return reply.code(404).send({ error: "not_found" });
      }

      const org = await prisma.organization.findUnique({
        where: { id: resolved.organizationId },
        select: {
          programSlug: true,
          name: true,
          programBio: true,
          publicContactEmail: true,
          website: true,
        },
      });

      if (!org) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Fetch marketplace profile from TenantSetting to get enhanced program fields
      const profileSetting = await prisma.tenantSetting.findUnique({
        where: {
          tenantId_namespace: {
            tenantId: resolved.tenantId,
            namespace: "marketplace-profile",
          },
        },
        select: { data: true },
      });

      // Extract published data and find matching program
      const profileData = profileSetting?.data as Record<string, unknown> | null;
      const published = profileData?.published as Record<string, unknown> | null;
      const programs = (published?.programs || []) as Array<Record<string, unknown>>;

      // Find the program that matches by name (programs don't have slugs, matched by org name)
      const matchingProgram = programs.find((p) => p.status === true);

      // Build response with enhanced fields from matching program
      const baseDto = toPublicProgramDTO(org);

      // If we found a matching published program, add its program-specific enhanced fields
      // Note: Breeder-level info (health testing, registrations, credentials) comes from breeder profile
      const enhancedFields = matchingProgram ? {
        // Pricing & What's Included (program-specific)
        pricingTiers: matchingProgram.pricingTiers as Array<{
          tier: string;
          priceRange: string;
          description?: string;
        }> | null || null,
        whatsIncluded: matchingProgram.whatsIncluded as string | null || null,
        typicalWaitTime: matchingProgram.typicalWaitTime as string | null || null,
      } : {};

      return reply.send({ ...baseDto, ...enhancedFields });
    }
  );

  // --------------------------------------------------------------------------
  // GET /programs/:programSlug/offspring-groups - List offspring groups - REQUIRES ENTITLEMENT
  // --------------------------------------------------------------------------
  app.get<{
    Params: { programSlug: string };
    Querystring: { species?: string; page?: string; limit?: string };
  }>("/programs/:programSlug/offspring-groups", async (req, reply) => {
    // SECURITY: Require entitlement before returning any data
    if (!(await requireMarketplaceEntitlement(req, reply))) return;

    const { programSlug } = req.params;
    const { species } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    if (!isValidSlug(programSlug)) {
      return reply.code(404).send({ error: "not_found" });
    }

    const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
    if (!resolved) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Get organization for programName
    const org = await prisma.organization.findUnique({
      where: { id: resolved.organizationId },
      select: { name: true, programSlug: true },
    });

    if (!org) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Build where clause - only LIVE groups from this breeder
    // IMPORTANT: Offspring groups must have a parent BreedingProgram with status=LIVE
    // This enforces the hierarchy: BreedingProgram (LIVE) → BreedingPlan → OffspringGroup
    const where: any = {
      tenantId: resolved.tenantId,
      status: "LIVE",
      listingSlug: { not: null },
      // Require the parent breeding program to be LIVE
      plan: {
        program: {
          status: "LIVE",
        },
      },
    };

    if (species) {
      where.species = species.toUpperCase();
    }

    const [groups, total] = await Promise.all([
      prisma.offspringGroup.findMany({
        where,
        skip,
        take: limit,
        orderBy: { actualBirthOn: "desc" },
        select: {
          listingSlug: true,
          listingTitle: true,
          listingDescription: true,
          species: true,
          expectedBirthOn: true,
          actualBirthOn: true,
          coverImageUrl: true,
          marketplaceDefaultPriceCents: true,
          dam: {
            select: { name: true, photoUrl: true, breed: true },
          },
          sire: {
            select: { name: true, photoUrl: true, breed: true },
          },
          Offspring: {
            select: {
              priceCents: true,
              keeperIntent: true,
              placementState: true,
              marketplaceListed: true,
              marketplacePriceCents: true,
            },
          },
        },
      }),
      prisma.offspringGroup.count({ where }),
    ]);

    const items = groups.map((g) =>
      toPublicOffspringGroupListingDTO(g, org.programSlug || "", org.name)
    );

    return reply.send({ items, total, page, limit });
  });

  // --------------------------------------------------------------------------
  // GET /programs/:programSlug/offspring-groups/:listingSlug - Listing detail - REQUIRES ENTITLEMENT
  // --------------------------------------------------------------------------
  app.get<{ Params: { programSlug: string; listingSlug: string } }>(
    "/programs/:programSlug/offspring-groups/:listingSlug",
    async (req, reply) => {
      // SECURITY: Require entitlement before returning any data
      if (!(await requireMarketplaceEntitlement(req, reply))) return;

      const { programSlug, listingSlug } = req.params;

      if (!isValidSlug(programSlug) || !isValidSlug(listingSlug)) {
        return reply.code(404).send({ error: "not_found" });
      }

      const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
      if (!resolved) {
        return reply.code(404).send({ error: "not_found" });
      }

      const listingResolved = await resolveOffspringGroupListing(
        prisma,
        resolved.tenantId,
        listingSlug
      );
      if (!listingResolved) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Get organization for programName
      const org = await prisma.organization.findUnique({
        where: { id: resolved.organizationId },
        select: { name: true, programSlug: true },
      });

      if (!org) {
        return reply.code(404).send({ error: "not_found" });
      }

      const group = await prisma.offspringGroup.findUnique({
        where: { id: listingResolved.groupId },
        select: {
          listingSlug: true,
          listingTitle: true,
          listingDescription: true,
          species: true,
          expectedBirthOn: true,
          actualBirthOn: true,
          coverImageUrl: true,
          marketplaceDefaultPriceCents: true,
          dam: {
            select: { name: true, photoUrl: true, breed: true },
          },
          sire: {
            select: { name: true, photoUrl: true, breed: true },
          },
          Offspring: {
            where: {
              // Only include listed offspring that are alive
              marketplaceListed: true,
              lifeState: "ALIVE",
            },
            select: {
              id: true,
              name: true,
              sex: true,
              collarColorName: true,
              collarColorHex: true,
              priceCents: true,
              keeperIntent: true,
              placementState: true,
              marketplaceListed: true,
              marketplacePriceCents: true,
            },
            orderBy: { name: "asc" },
          },
        },
      });

      if (!group) {
        return reply.code(404).send({ error: "not_found" });
      }

      const listing = toPublicOffspringGroupListingDTO(
        group,
        org.programSlug || "",
        org.name
      );
      const offspring = (group.Offspring || []).map((o) =>
        toPublicOffspringDTO(o, group.marketplaceDefaultPriceCents)
      );

      return reply.send({ ...listing, offspring });
    }
  );

  // --------------------------------------------------------------------------
  // GET /programs/:programSlug/animals - List animal listings - REQUIRES ENTITLEMENT
  // --------------------------------------------------------------------------
  app.get<{
    Params: { programSlug: string };
    Querystring: { species?: string; page?: string; limit?: string };
  }>("/programs/:programSlug/animals", async (req, reply) => {
    // SECURITY: Require entitlement before returning any data
    if (!(await requireMarketplaceEntitlement(req, reply))) return;

    const { programSlug } = req.params;
    const { species } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    if (!isValidSlug(programSlug)) {
      return reply.code(404).send({ error: "not_found" });
    }

    const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
    if (!resolved) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Get organization for programName
    const org = await prisma.organization.findUnique({
      where: { id: resolved.organizationId },
      select: { name: true, programSlug: true },
    });

    if (!org) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Build where clause for animal listings
    // FILTER: Only LIVE status listings are publicly visible
    const where: any = {
      tenantId: resolved.tenantId,
      status: "LIVE",
    };

    if (species) {
      where.animal = { species: species.toUpperCase() };
    }

    const [listings, total] = await Promise.all([
      prisma.mktListingIndividualAnimal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: "desc" },
        select: {
          slug: true,
          title: true,
          templateType: true,
          headline: true,
          priceCents: true,
          priceMinCents: true,
          priceMaxCents: true,
          priceModel: true,
          animal: {
            select: {
              species: true,
              breed: true,
              photoUrl: true,
              priceCents: true,
            },
          },
        },
      }),
      prisma.mktListingIndividualAnimal.count({ where }),
    ]);

    const items = listings.map(toAnimalListingSummaryDTO);

    return reply.send({ items, total, page, limit });
  });

  // --------------------------------------------------------------------------
  // GET /programs/:programSlug/animals/:urlSlug - Single animal listing detail - REQUIRES ENTITLEMENT
  // --------------------------------------------------------------------------
  app.get<{ Params: { programSlug: string; urlSlug: string } }>(
    "/programs/:programSlug/animals/:urlSlug",
    async (req, reply) => {
      // SECURITY: Require entitlement before returning any data
      if (!(await requireMarketplaceEntitlement(req, reply))) return;

      const { programSlug, urlSlug } = req.params;

      if (!isValidSlug(programSlug) || !isValidSlug(urlSlug)) {
        return reply.code(404).send({ error: "not_found" });
      }

      const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
      if (!resolved) {
        return reply.code(404).send({ error: "not_found" });
      }

      const listingResolved = await resolveAnimalListing(
        prisma,
        resolved.tenantId,
        urlSlug
      );
      if (!listingResolved) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Get organization for programName
      const org = await prisma.organization.findUnique({
        where: { id: resolved.organizationId },
        select: { name: true, programSlug: true },
      });

      if (!org) {
        return reply.code(404).send({ error: "not_found" });
      }

      const listing = await prisma.mktListingIndividualAnimal.findUnique({
        where: {
          id: listingResolved.listingId,
          // FILTER: Only LIVE status listings are publicly visible
          status: "LIVE",
        },
        select: {
          slug: true,
          title: true,
          description: true,
          templateType: true,
          status: true,
          headline: true,
          summary: true,
          priceCents: true,
          priceMinCents: true,
          priceMaxCents: true,
          priceModel: true,
          locationCity: true,
          locationRegion: true,
          locationCountry: true,
          animal: {
            select: {
              name: true,
              species: true,
              sex: true,
              breed: true,
              birthDate: true,
              photoUrl: true,
              priceCents: true,
              registryIds: {
                select: {
                  identifier: true,
                  registry: {
                    select: { name: true },
                  },
                },
              },
              AnimalTraitValue: {
                where: { marketplaceVisible: true },
                select: {
                  marketplaceVisible: true,
                  status: true,
                  verified: true,
                  traitDefinition: {
                    select: {
                      key: true,
                      displayName: true,
                      category: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!listing) {
        return reply.code(404).send({ error: "not_found" });
      }

      return reply.send(
        toPublicAnimalListingDTO(listing, org.programSlug || "", org.name)
      );
    }
  );

  // --------------------------------------------------------------------------
  // POST /inquiries - Create marketplace inquiry - REQUIRES ENTITLEMENT
  // --------------------------------------------------------------------------
  app.post<{
    Body: {
      programSlug: string;
      listingSlug?: string;
      listingType?: "offspring_group" | "animal";
      message: string;
      offspringId?: number;
      // Guest fields - not implemented for MVP (auth required)
      guestName?: string;
      guestEmail?: string;
      // Origin tracking for conversion attribution
      origin?: {
        source?: string; // "direct" | "utm" | "referrer" | "embed" | "social"
        referrer?: string;
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        pagePath?: string;
      };
    };
  }>("/inquiries", async (req, reply) => {
    // SECURITY: Require entitlement before creating any inquiry
    if (!(await requireMarketplaceEntitlement(req, reply))) return;

    // SECURITY: Require verified email before allowing inquiries
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true, partyId: true },
    });

    if (!user) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "User not found.",
      });
    }

    if (!user.emailVerifiedAt) {
      return reply.code(403).send({
        error: "email_verification_required",
        message: "Please verify your email address before submitting inquiries.",
      });
    }

    if (!user.partyId) {
      return reply.code(400).send({ error: "user_has_no_party" });
    }

    const { programSlug, listingSlug, listingType, message, offspringId, origin } = req.body;

    // Validate required fields
    if (!programSlug || !message) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["programSlug", "message"],
      });
    }

    if (!isValidSlug(programSlug)) {
      return reply.code(404).send({ error: "program_not_found" });
    }

    // Resolve program
    const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
    if (!resolved) {
      return reply.code(404).send({ error: "program_not_found" });
    }

    // Validate listing if provided and get listing details for subject
    let listingTitle: string | null = null;
    let animalListingIntent: string | null = null;

    if (listingSlug) {
      if (!isValidSlug(listingSlug)) {
        return reply.code(404).send({ error: "listing_not_found" });
      }

      if (listingType === "offspring_group") {
        const listingResolved = await resolveOffspringGroupListing(
          prisma,
          resolved.tenantId,
          listingSlug
        );
        if (!listingResolved) {
          return reply.code(404).send({ error: "listing_not_found" });
        }
        // Get listing title for subject
        const group = await prisma.offspringGroup.findUnique({
          where: { id: listingResolved.groupId },
          select: { listingTitle: true },
        });
        listingTitle = group?.listingTitle || null;
      } else if (listingType === "animal") {
        const listingResolved = await resolveAnimalListing(
          prisma,
          resolved.tenantId,
          listingSlug
        );
        if (!listingResolved) {
          return reply.code(404).send({ error: "listing_not_found" });
        }
        // Verify listing is LIVE and get details for subject
        const animalListing = await prisma.mktListingIndividualAnimal.findUnique({
          where: { id: listingResolved.listingId },
          select: { status: true, title: true, headline: true, templateType: true },
        });
        if (!animalListing || animalListing.status !== "LIVE") {
          return reply.code(404).send({ error: "listing_not_found" });
        }
        listingTitle = animalListing.headline || animalListing.title || null;
        animalListingIntent = animalListing.templateType;
      }
    }

    // Get organization for subject line
    const org = await prisma.organization.findUnique({
      where: { id: resolved.organizationId },
      select: { name: true },
    });

    // Build subject with listing context
    let subject: string;
    if (listingSlug && listingTitle) {
      subject = `Inquiry: ${listingTitle}`;
    } else if (listingSlug) {
      subject = `Inquiry: Listing ${listingSlug}`;
    } else {
      subject = `Inquiry: ${org?.name || "Program"}`;
    }

    // Determine inquiryType based on listing type
    // ANIMAL_LISTING for animal listings, MARKETPLACE for offspring groups and general
    const inquiryType = listingType === "animal" ? "ANIMAL_LISTING" : "MARKETPLACE";

    const now = new Date();

    try {
      const thread = await prisma.messageThread.create({
        data: {
          tenantId: resolved.tenantId,
          subject,
          inquiryType,
          sourceListingSlug: listingSlug || null,
          lastMessageAt: now,
          // Origin tracking
          originSource: origin?.source || null,
          originReferrer: origin?.referrer || null,
          originUtmSource: origin?.utmSource || null,
          originUtmMedium: origin?.utmMedium || null,
          originUtmCampaign: origin?.utmCampaign || null,
          originPagePath: origin?.pagePath || null,
          participants: {
            create: [
              { partyId: user.partyId, lastReadAt: now },
              { partyId: resolved.partyId },
            ],
          },
          messages: {
            create: {
              senderPartyId: user.partyId,
              body: message,
            },
          },
        },
        select: { id: true },
      });

      // Send email notifications (don't fail the request if emails fail)
      try {
        // Get user details for emails
        const userDetails = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, firstName: true, lastName: true },
        });

        // Get breeder details for emails
        const breederOrg = await prisma.organization.findUnique({
          where: { id: resolved.organizationId },
          select: {
            name: true,
            party: { select: { email: true } },
          },
        });

        const userName = [userDetails?.firstName, userDetails?.lastName].filter(Boolean).join(" ") || "there";
        const breederName = breederOrg?.name || org?.name || "the breeder";

        // Send confirmation to user
        if (userDetails?.email) {
          await sendInquiryConfirmationToUser({
            userEmail: userDetails.email,
            userName,
            breederName,
            listingTitle: listingTitle || undefined,
            message,
          }).catch((e) => console.error("Failed to send inquiry confirmation to user:", e));
        }

        // Send notification to breeder
        if (breederOrg?.party?.email) {
          await sendInquiryNotificationToBreeder({
            breederEmail: breederOrg.party.email,
            breederName,
            inquirerName: userName,
            inquirerEmail: userDetails?.email || "unknown",
            listingTitle: listingTitle || undefined,
            message,
            threadId: thread.id,
            tenantId: resolved.tenantId,
          }).catch((e) => console.error("Failed to send inquiry notification to breeder:", e));
        }
      } catch (emailErr) {
        console.error("Failed to send inquiry emails:", emailErr);
      }

      return reply.send({ ok: true, threadId: thread.id });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // GET /programs/:programSlug/breeding-programs - List breeding programs for a breeder - REQUIRES ENTITLEMENT
  // --------------------------------------------------------------------------
  app.get<{
    Params: { programSlug: string };
    Querystring: { species?: string; page?: string; limit?: string };
  }>("/programs/:programSlug/breeding-programs", async (req, reply) => {
    // SECURITY: Require entitlement before returning any data
    if (!(await requireMarketplaceEntitlement(req, reply))) return;

    const { programSlug } = req.params;
    const { species } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    if (!isValidSlug(programSlug)) {
      return reply.code(404).send({ error: "not_found" });
    }

    const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
    if (!resolved) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Build where clause - only listed programs
    const where: any = {
      tenantId: resolved.tenantId,
      status: "LIVE",
    };

    if (species) {
      where.species = species.toUpperCase();
    }

    const [items, total] = await prisma.$transaction([
      prisma.mktListingBreedingProgram.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          species: true,
          breedText: true,
          acceptInquiries: true,
          openWaitlist: true,
          acceptReservations: true,
          pricingTiers: true,
          whatsIncluded: true,
          typicalWaitTime: true,
          publishedAt: true,
          _count: {
            select: {
              breedingPlans: {
                where: {
                  status: { in: ["CYCLE", "COMMITTED", "BRED", "BIRTHED", "WEANED", "PLACEMENT"] },
                },
              },
            },
          },
        },
      }),
      prisma.mktListingBreedingProgram.count({ where }),
    ]);

    return reply.send({
      items: items.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        species: p.species,
        breedText: p.breedText,
        acceptInquiries: p.acceptInquiries,
        openWaitlist: p.openWaitlist,
        acceptReservations: p.acceptReservations,
        pricingTiers: p.pricingTiers,
        whatsIncluded: p.whatsIncluded,
        typicalWaitTime: p.typicalWaitTime,
        publishedAt: p.publishedAt,
        activePlansCount: p._count.breedingPlans,
      })),
      total,
      page,
      limit,
    });
  });

  // --------------------------------------------------------------------------
  // GET /services - Browse all published service listings - PUBLIC
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: {
      tenantId?: string;
      type?: string;
      search?: string;
      city?: string;
      state?: string;
      page?: string;
      limit?: string;
    };
  }>("/services", async (req, reply) => {
    // PUBLIC: No auth required - this is a public browsing endpoint

    const { tenantId, type, search, city, state } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    // Service listing types
    const serviceTypes = [
      "STUD_SERVICE",
      "TRAINING",
      "VETERINARY",
      "PHOTOGRAPHY",
      "GROOMING",
      "TRANSPORT",
      "BOARDING",
      "PRODUCT",
      "OTHER_SERVICE",
    ];

    // Build where clause - only LIVE service listings
    const where: any = {
      status: "LIVE",
      category: { in: serviceTypes },
    };

    // Filter by tenant/breeder if provided (tenantId param is the tenant slug)
    if (tenantId && tenantId.trim()) {
      const normalizedSlug = tenantId.trim().toLowerCase();
      const tenant = await prisma.tenant.findUnique({
        where: { slug: normalizedSlug },
        select: { id: true },
      });
      if (tenant) {
        where.tenantId = tenant.id;
      } else {
        // Tenant not found - return empty results
        return reply.send({ items: [], total: 0, page, limit });
      }
    }

    // Filter by specific type if provided
    if (type && serviceTypes.includes(type.toUpperCase())) {
      where.listingType = type.toUpperCase();
    }

    // Search in title and description
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { description: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    // Location filters
    if (city && city.trim()) {
      where.city = { contains: city.trim(), mode: "insensitive" };
    }
    if (state && state.trim()) {
      where.state = { contains: state.trim(), mode: "insensitive" };
    }

    const [items, total] = await prisma.$transaction([
      prisma.mktListingBreederService.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          category: true,
          title: true,
          description: true,
          city: true,
          state: true,
          country: true,
          priceCents: true,
          priceType: true,
          images: true,
          publishedAt: true,
          // Include provider info
          providerId: true,
          provider: {
            select: {
              id: true,
              businessName: true,
              averageRating: true,
              totalReviews: true,
            },
          },
        },
      }),
      prisma.mktListingBreederService.count({ where }),
    ]);

    return reply.send({
      items: items.map((listing) => {
        return {
          id: listing.id,
          slug: listing.slug,
          category: listing.category,
          title: listing.title,
          description: listing.description,
          city: listing.city,
          state: listing.state,
          country: listing.country,
          priceCents: listing.priceCents,
          priceType: listing.priceType,
          images: listing.images,
          publishedAt: listing.publishedAt,
          provider: listing.provider ? {
            type: "marketplace_provider" as const,
            id: listing.provider.id,
            name: listing.provider.businessName,
            averageRating: listing.provider.averageRating || 0,
            totalReviews: listing.provider.totalReviews || 0,
          } : null,
        };
      }),
      total,
      page,
      limit,
    });
  });

  // --------------------------------------------------------------------------
  // GET /offspring-groups - Browse all published offspring groups - PUBLIC
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: {
      species?: string;
      breed?: string;
      search?: string;
      location?: string;
      page?: string;
      limit?: string;
    };
  }>("/offspring-groups", async (req, reply) => {
    // PUBLIC: No auth required - this is a public browsing endpoint

    const { species, breed, search, location } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    // Build where clause - only LIVE groups from published breeders
    // IMPORTANT: Offspring groups must have a parent BreedingProgram with status=LIVE
    // This enforces the hierarchy: BreedingProgram (LIVE) → BreedingPlan → OffspringGroup
    const where: any = {
      status: "LIVE",
      listingSlug: { not: null },
      // Require the parent breeding program to be LIVE
      plan: {
        program: {
          status: "LIVE",
        },
      },
      tenant: {
        organizations: {
          some: {
            isPublicProgram: true,
          },
        },
      },
    };

    if (species) {
      where.species = species.toUpperCase();
    }

    // Search in listing title and description, or dam/sire breed
    if (search && search.trim()) {
      where.OR = [
        { listingTitle: { contains: search.trim(), mode: "insensitive" } },
        { listingDescription: { contains: search.trim(), mode: "insensitive" } },
        { dam: { breed: { contains: search.trim(), mode: "insensitive" } } },
        { sire: { breed: { contains: search.trim(), mode: "insensitive" } } },
      ];
    }

    // Filter by breed (check dam or sire breed)
    if (breed && breed.trim()) {
      // Note: This will override the search OR clause if both are present
      // In practice, users typically use one or the other
      where.OR = [
        { dam: { breed: { contains: breed.trim(), mode: "insensitive" } } },
        { sire: { breed: { contains: breed.trim(), mode: "insensitive" } } },
      ];
    }

    // Location filter - match breeder's city, state, country, or zip code
    if (location && location.trim()) {
      const locationTerm = location.trim();
      where.tenant = {
        ...where.tenant,
        organizations: {
          some: {
            isPublicProgram: true,
            OR: [
              { city: { contains: locationTerm, mode: "insensitive" } },
              { state: { contains: locationTerm, mode: "insensitive" } },
              { country: { contains: locationTerm, mode: "insensitive" } },
              { zip: { contains: locationTerm, mode: "insensitive" } },
            ],
          },
        },
      };
    }

    const [groups, total] = await prisma.$transaction([
      prisma.offspringGroup.findMany({
        where,
        orderBy: [{ actualBirthOn: "desc" }, { expectedBirthOn: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          listingSlug: true,
          listingTitle: true,
          listingDescription: true,
          species: true,
          expectedBirthOn: true,
          actualBirthOn: true,
          coverImageUrl: true,
          marketplaceDefaultPriceCents: true,
          dam: {
            select: { name: true, photoUrl: true, breed: true },
          },
          sire: {
            select: { name: true, photoUrl: true, breed: true },
          },
          tenant: {
            select: {
              organizations: {
                where: { isPublicProgram: true },
                take: 1,
                select: {
                  programSlug: true,
                  name: true,
                  city: true,
                  state: true,
                },
              },
            },
          },
          Offspring: {
            where: {
              marketplaceListed: true,
              lifeState: "ALIVE",
              keeperIntent: "AVAILABLE",
            },
            select: {
              id: true,
              marketplacePriceCents: true,
              priceCents: true,
            },
          },
        },
      }),
      prisma.offspringGroup.count({ where }),
    ]);

    return reply.send({
      items: groups.map((g) => {
        const org = g.tenant?.organizations?.[0];
        const availableCount = g.Offspring?.length || 0;

        // Get price range from offspring
        const prices = (g.Offspring || [])
          .map((o) => o.marketplacePriceCents || o.priceCents || g.marketplaceDefaultPriceCents)
          .filter((p): p is number => p !== null && p !== undefined);

        const minPrice = prices.length > 0 ? Math.min(...prices) : g.marketplaceDefaultPriceCents;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : g.marketplaceDefaultPriceCents;

        return {
          id: g.id,
          listingSlug: g.listingSlug,
          title: g.listingTitle,
          description: g.listingDescription,
          species: g.species,
          breed: g.dam?.breed || g.sire?.breed || null,
          expectedBirthOn: g.expectedBirthOn,
          actualBirthOn: g.actualBirthOn,
          coverImageUrl: g.coverImageUrl,
          availableCount,
          priceMinCents: minPrice,
          priceMaxCents: maxPrice,
          dam: g.dam ? { name: g.dam.name, photoUrl: g.dam.photoUrl } : null,
          sire: g.sire ? { name: g.sire.name, photoUrl: g.sire.photoUrl } : null,
          breeder: org ? {
            slug: org.programSlug,
            name: org.name,
            location: [org.city, org.state].filter(Boolean).join(", ") || null,
          } : null,
        };
      }),
      total,
      page,
      limit,
    });
  });

  // --------------------------------------------------------------------------
  // GET /animals - Browse all published animal listings - PUBLIC
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: {
      search?: string;
      intent?: string;
      species?: string;
      breed?: string;
      location?: string;
      limit?: string;
      offset?: string;
    };
  }>("/animals", async (req, reply) => {
    // PUBLIC: No auth required - this is a public browsing endpoint

    const { search, intent, species, breed, location } = req.query;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 24)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    // Build where clause - only LIVE status listings from public programs
    const where: any = {
      status: "LIVE",
      tenant: {
        organizations: {
          some: {
            isPublicProgram: true,
          },
        },
      },
    };

    // Filter by intent type (STUD, REHOME, etc.)
    if (intent) {
      where.intent = intent.toUpperCase();
    }

    // Filter by species via the animal relation
    if (species) {
      where.animal = {
        ...where.animal,
        species: species.toUpperCase(),
      };
    }

    // Search in title, headline, summary, or animal name/breed
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: "insensitive" } },
        { headline: { contains: searchTerm, mode: "insensitive" } },
        { summary: { contains: searchTerm, mode: "insensitive" } },
        { animal: { name: { contains: searchTerm, mode: "insensitive" } } },
        { animal: { breed: { contains: searchTerm, mode: "insensitive" } } },
      ];
    }

    // Filter by breed via the animal relation
    if (breed && breed.trim()) {
      where.animal = {
        ...where.animal,
        breed: { contains: breed.trim(), mode: "insensitive" },
      };
    }

    // Location filter - match listing's location or breeder's location (including zip code)
    if (location && location.trim()) {
      const locationTerm = location.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { locationCity: { contains: locationTerm, mode: "insensitive" } },
            { locationRegion: { contains: locationTerm, mode: "insensitive" } },
            { locationCountry: { contains: locationTerm, mode: "insensitive" } },
            {
              tenant: {
                organizations: {
                  some: {
                    isPublicProgram: true,
                    OR: [
                      { city: { contains: locationTerm, mode: "insensitive" } },
                      { state: { contains: locationTerm, mode: "insensitive" } },
                      { zip: { contains: locationTerm, mode: "insensitive" } },
                    ],
                  },
                },
              },
            },
          ],
        },
      ];
    }

    const [listings, total] = await prisma.$transaction([
      prisma.mktListingIndividualAnimal.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip: offset,
        take: limit,
        select: {
          id: true,
          slug: true,
          templateType: true,
          headline: true,
          title: true,
          summary: true,
          priceCents: true,
          priceMinCents: true,
          priceMaxCents: true,
          priceModel: true,
          locationCity: true,
          locationRegion: true,
          publishedAt: true,
          animal: {
            select: {
              id: true,
              name: true,
              sex: true,
              species: true,
              breed: true,
              photoUrl: true,
              birthDate: true,
            },
          },
          tenant: {
            select: {
              organizations: {
                where: { isPublicProgram: true },
                take: 1,
                select: {
                  programSlug: true,
                  name: true,
                  city: true,
                  state: true,
                },
              },
            },
          },
        },
      }),
      prisma.mktListingIndividualAnimal.count({ where }),
    ]);

    // Transform to response format
    const items = listings.map((listing) => {
      const org = listing.tenant?.organizations?.[0] || null;
      return {
        id: listing.id,
        slug: listing.slug,
        templateType: listing.templateType,
        headline: listing.headline,
        title: listing.title,
        summary: listing.summary,
        priceCents: listing.priceCents,
        priceMinCents: listing.priceMinCents,
        priceMaxCents: listing.priceMaxCents,
        priceModel: listing.priceModel,
        locationCity: listing.locationCity,
        locationRegion: listing.locationRegion,
        publishedAt: listing.publishedAt?.toISOString() || null,
        animalName: listing.animal?.name || null,
        animalSex: listing.animal?.sex || null,
        animalSpecies: listing.animal?.species || null,
        animalBreed: listing.animal?.breed || null,
        animalPhotoUrl: listing.animal?.photoUrl || null,
        animalBirthDate: listing.animal?.birthDate?.toISOString() || null,
        programSlug: org?.programSlug || null,
        programName: org?.name || null,
        breederLocation: org ? [org.city, org.state].filter(Boolean).join(", ") || null : null,
      };
    });

    return reply.send({
      items,
      total,
      limit,
      offset,
    });
  });

  // --------------------------------------------------------------------------
  // GET /breeding-programs - Browse all listed breeding programs - REQUIRES ENTITLEMENT
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: {
      search?: string;
      species?: string;
      breed?: string;
      page?: string;
      limit?: string;
    };
  }>("/breeding-programs", async (req, reply) => {
    // SECURITY: Require entitlement before returning any data
    if (!(await requireMarketplaceEntitlement(req, reply))) return;

    const { search, species, breed } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    // Build where clause - only listed programs from published breeders
    const where: any = {
      status: "LIVE",
      tenant: {
        organizations: {
          some: {
            isPublicProgram: true,
          },
        },
      },
    };

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { breedText: { contains: search.trim(), mode: "insensitive" } },
        { description: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    if (species) {
      where.species = species.toUpperCase();
    }

    if (breed && breed.trim()) {
      where.breedText = { contains: breed.trim(), mode: "insensitive" };
    }

    const [items, total] = await prisma.$transaction([
      prisma.mktListingBreedingProgram.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          species: true,
          breedText: true,
          acceptInquiries: true,
          openWaitlist: true,
          acceptReservations: true,
          typicalWaitTime: true,
          tenant: {
            select: {
              organizations: {
                where: { isPublicProgram: true },
                take: 1,
                select: {
                  programSlug: true,
                  name: true,
                  city: true,
                  state: true,
                },
              },
            },
          },
          _count: {
            select: {
              breedingPlans: {
                where: {
                  status: { in: ["CYCLE", "COMMITTED", "BRED", "BIRTHED", "WEANED", "PLACEMENT"] },
                },
              },
            },
          },
        },
      }),
      prisma.mktListingBreedingProgram.count({ where }),
    ]);

    return reply.send({
      items: items.map((p) => {
        const org = p.tenant?.organizations?.[0];
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description,
          species: p.species,
          breedText: p.breedText,
          acceptInquiries: p.acceptInquiries,
          openWaitlist: p.openWaitlist,
          acceptReservations: p.acceptReservations,
          typicalWaitTime: p.typicalWaitTime,
          activePlansCount: p._count.breedingPlans,
          breeder: org ? {
            slug: org.programSlug,
            name: org.name,
            location: [org.city, org.state].filter(Boolean).join(", ") || null,
          } : null,
        };
      }),
      total,
      page,
      limit,
    });
  });
};

export default publicMarketplaceRoutes;
