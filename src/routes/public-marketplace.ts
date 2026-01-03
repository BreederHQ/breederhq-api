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

    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    // Fetch user info and entitlements
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
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

    // Location filter - match city, state, or country
    if (location && location.trim()) {
      const locationTerm = location.trim();
      where.OR = [
        { city: { contains: locationTerm, mode: "insensitive" } },
        { state: { contains: locationTerm, mode: "insensitive" } },
        { country: { contains: locationTerm, mode: "insensitive" } },
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

      return reply.send(toPublicProgramDTO(org));
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

    // Build where clause
    const where: any = {
      tenantId: resolved.tenantId,
      published: true,
      listingSlug: { not: null },
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
    const where: any = {
      tenantId: resolved.tenantId,
      isListed: true,
      urlSlug: { not: null },
    };

    if (species) {
      where.animal = { species: species.toUpperCase() };
    }

    const [listings, total] = await Promise.all([
      prisma.animalPublicListing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          urlSlug: true,
          title: true,
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
      prisma.animalPublicListing.count({ where }),
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

      const listing = await prisma.animalPublicListing.findUnique({
        where: { id: listingResolved.listingId },
        select: {
          urlSlug: true,
          title: true,
          description: true,
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
    };
  }>("/inquiries", async (req, reply) => {
    // SECURITY: Require entitlement before creating any inquiry
    if (!(await requireMarketplaceEntitlement(req, reply))) return;

    const { programSlug, listingSlug, listingType, message, offspringId } = req.body;

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

    // userId is guaranteed to exist after requireMarketplaceEntitlement() check
    const userId = (req as any).userId;

    // Get sender's party
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { partyId: true },
    });

    if (!user?.partyId) {
      return reply.code(400).send({ error: "user_has_no_party" });
    }

    // Validate listing if provided
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
      } else if (listingType === "animal") {
        const listingResolved = await resolveAnimalListing(
          prisma,
          resolved.tenantId,
          listingSlug
        );
        if (!listingResolved) {
          return reply.code(404).send({ error: "listing_not_found" });
        }
      }
    }

    // Get organization for subject line
    const org = await prisma.organization.findUnique({
      where: { id: resolved.organizationId },
      select: { name: true },
    });

    // Build subject
    const subject = listingSlug
      ? `Inquiry: Listing ${listingSlug}`
      : `Inquiry: ${org?.name || "Program"}`;

    const now = new Date();

    try {
      const thread = await prisma.messageThread.create({
        data: {
          tenantId: resolved.tenantId,
          subject,
          inquiryType: "MARKETPLACE",
          sourceListingSlug: listingSlug || null,
          lastMessageAt: now,
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

      return reply.send({ ok: true, threadId: thread.id });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });
};

export default publicMarketplaceRoutes;
