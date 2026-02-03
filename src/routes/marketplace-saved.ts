// src/routes/marketplace-saved.ts
/**
 * Marketplace Saved Items Routes
 *
 * Endpoints for saving/unsaving listings (favorites).
 * Supports multiple listing types: offspring_group, animal, service.
 *
 * Endpoints:
 *   GET    /saved                          - List user's saved listings
 *   POST   /saved                          - Save a listing { listingType, listingId }
 *   DELETE /saved/:listingType/:listingId  - Unsave a listing
 *   GET    /saved/check/:listingType/:listingId - Check if listing is saved
 *
 * All endpoints require authenticated BHQ user (via marketplace session).
 * Uses bhqUserId (string CUID) from the main User table.
 */

import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import { parseVerifiedSession } from "../utils/session.js";
import prisma from "../prisma.js";

// Valid listing types
// - individual_animal: Individual animal listings (MktListingIndividualAnimal table)
const VALID_LISTING_TYPES = ["offspring_group", "individual_animal", "service", "animal_program", "breeder_storefront"] as const;
type ListingType = typeof VALID_LISTING_TYPES[number];

// Types that use string identifiers (slugs) instead of numeric IDs
const STRING_ID_LISTING_TYPES = ["breeder_storefront"] as const;
type StringIdListingType = typeof STRING_ID_LISTING_TYPES[number];

function isValidListingType(type: unknown): type is ListingType {
  return typeof type === "string" && VALID_LISTING_TYPES.includes(type as ListingType);
}

function usesStringId(type: ListingType): type is StringIdListingType {
  return STRING_ID_LISTING_TYPES.includes(type as StringIdListingType);
}

/**
 * Middleware to require marketplace session (BHQ User auth).
 * Sets req.bhqUserId (string CUID) on success.
 */
async function requireBhqAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const session = parseVerifiedSession(req, "MARKETPLACE");
  if (!session) {
    reply.code(401).send({
      error: "unauthorized",
      message: "Authentication required. Please log in.",
    });
    return;
  }
  (req as any).bhqUserId = session.userId; // CUID string
}

/**
 * Middleware to require verified email address.
 * Must be used after requireBhqAuth (requires bhqUserId on request).
 */
async function requireEmailVerified(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const bhqUserId = (req as any).bhqUserId;

  if (!bhqUserId) {
    reply.code(401).send({
      error: "unauthorized",
      message: "Authentication required.",
    });
    return;
  }

  // Fetch user to check email verification status
  const user = await prisma.user.findUnique({
    where: { id: bhqUserId },
    select: { emailVerifiedAt: true },
  });

  if (!user) {
    reply.code(401).send({
      error: "unauthorized",
      message: "User not found.",
    });
    return;
  }

  // Check if email is verified
  if (!user.emailVerifiedAt) {
    reply.code(403).send({
      error: "email_verification_required",
      message: "Please verify your email address to use this feature.",
    });
    return;
  }
}

/**
 * Parse pagination parameters
 */
function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "25", 10) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export default async function marketplaceSavedRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /**
   * GET /saved - List user's saved listings
   *
   * Query params:
   *   - type: Filter by listing type (offspring_group, animal, service)
   *   - page: Page number (default: 1)
   *   - limit: Items per page (default: 25, max: 100)
   *
   * Returns saved listings with full listing details.
   */
  app.get("/saved", {
    preHandler: requireBhqAuth,
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const bhqUserId = (req as any).bhqUserId;
    const { page, limit, skip } = parsePaging(req.query);
    const typeFilter = (req.query as any).type;

    try {
      const where: any = { bhqUserId };
      if (typeFilter && isValidListingType(typeFilter)) {
        where.listingType = typeFilter;
      }

      const [items, total] = await Promise.all([
        prisma.marketplaceSavedListing.findMany({
          where,
          skip,
          take: limit,
          orderBy: { savedAt: "desc" },
        }),
        prisma.marketplaceSavedListing.count({ where }),
      ]);

      // Fetch expanded listing details for each saved item
      const expandedItems = await Promise.all(
        items.map(async (item) => {
          let listing: any = null;

          if (item.listingType === "service" && item.listingId) {
            const serviceListing = await prisma.mktListingProviderService.findUnique({
              where: { id: item.listingId },
              include: {
                provider: true,
              },
            });
            if (serviceListing) {
              listing = {
                title: serviceListing.title,
                slug: serviceListing.slug,
                coverImageUrl: serviceListing.coverImageUrl,
                status: serviceListing.status,
                isAvailable: serviceListing.status === "LIVE" && !serviceListing.deletedAt,
                priceCents: serviceListing.priceCents ? Number(serviceListing.priceCents) : null,
                breederName: serviceListing.provider?.businessName,
              };
            }
          } else if (item.listingType === "offspring_group" && item.listingId) {
            const offspringGroup = await prisma.offspringGroup.findUnique({
              where: { id: item.listingId },
              include: {
                tenant: true,
              },
            });
            if (offspringGroup) {
              listing = {
                title: offspringGroup.listingTitle || offspringGroup.name || "Unnamed Litter",
                slug: offspringGroup.listingSlug,
                coverImageUrl: offspringGroup.coverImageUrl,
                status: offspringGroup.status === "LIVE" ? "live" : "draft",
                isAvailable: offspringGroup.status === "LIVE",
                priceCents: offspringGroup.marketplaceDefaultPriceCents ? Number(offspringGroup.marketplaceDefaultPriceCents) : null,
                breederName: offspringGroup.tenant?.name,
                breederSlug: offspringGroup.tenant?.slug,
              };
            }
          } else if (item.listingType === "individual_animal" && item.listingId) {
            // Individual animal listings - MktListingIndividualAnimal table
            const individualListing = await prisma.mktListingIndividualAnimal.findUnique({
              where: { id: item.listingId },
              include: {
                animal: true,
                tenant: true,
              },
            });
            if (individualListing) {
              listing = {
                title: individualListing.title || individualListing.animal?.name || "Animal Listing",
                slug: individualListing.slug,
                coverImageUrl: individualListing.animal?.photoUrl,
                status: individualListing.status || "DRAFT",
                isAvailable: individualListing.status === "LIVE",
                priceCents: individualListing.priceCents ? Number(individualListing.priceCents) : null,
                priceMinCents: individualListing.priceMinCents ? Number(individualListing.priceMinCents) : null,
                priceMaxCents: individualListing.priceMaxCents ? Number(individualListing.priceMaxCents) : null,
                priceModel: individualListing.priceModel,
                species: individualListing.animal?.species,
                breed: individualListing.animal?.breed,
                breederName: individualListing.tenant?.name,
                breederSlug: individualListing.tenant?.slug,
                templateType: individualListing.templateType,
              };
            }
          } else if (item.listingType === "animal_program" && item.listingId) {
            const program = await prisma.mktListingAnimalProgram.findUnique({
              where: { id: item.listingId },
              include: {
                tenant: true,
                _count: { select: { participants: true } },
              },
            });
            if (program) {
              listing = {
                title: program.name,
                slug: program.slug,
                coverImageUrl: program.coverImageUrl,
                status: program.status,
                isAvailable: program.status === "LIVE",
                templateType: program.templateType,
                headline: program.headline,
                priceCents: program.defaultPriceCents ? Number(program.defaultPriceCents) : null,
                priceMinCents: program.defaultPriceMinCents ? Number(program.defaultPriceMinCents) : null,
                priceMaxCents: program.defaultPriceMaxCents ? Number(program.defaultPriceMaxCents) : null,
                participantCount: program._count.participants,
                breederName: program.tenant?.name,
                breederSlug: program.tenant?.slug,
              };
            }
          } else if (item.listingType === "breeder_storefront" && item.listingId) {
            const tenant = await prisma.tenant.findUnique({
              where: { id: item.listingId },
              include: {
                _count: { select: { animals: true } },
              },
            });
            if (tenant) {
              // Build location string
              const locationParts = [tenant.city, tenant.region].filter(Boolean);
              const location = locationParts.length > 0 ? locationParts.join(", ") : null;

              listing = {
                title: tenant.name,
                slug: tenant.slug,
                coverImageUrl: null, // Tenant doesn't have a cover image in the schema
                status: "active",
                isAvailable: true,
                location,
                animalCount: tenant._count.animals,
                breederName: tenant.name,
                breederSlug: tenant.slug,
              };
            }
          }

          return {
            id: item.id,
            listingType: item.listingType,
            listingId: item.listingId,
            savedAt: item.savedAt.toISOString(),
            listing,
          };
        })
      );

      return reply.send({
        items: expandedItems,
        total,
        page,
        limit,
      });
    } catch (err: any) {
      req.log?.error?.({ err, message: err?.message, stack: err?.stack }, "Failed to fetch saved listings");
      // Return more detailed error info for debugging
      const errorMessage = err?.message || "Unknown error";
      const isPrismaError = err?.code?.startsWith?.("P");
      return reply.code(500).send({
        error: "fetch_failed",
        message: "Failed to fetch saved listings.",
        detail: isPrismaError ? `Database error: ${err.code}` : errorMessage,
      });
    }
  });

  /**
   * POST /saved - Save a listing
   *
   * Body:
   *   - listingType: string (required) - Type: offspring_group, animal, service
   *   - listingId: number (required) - ID of listing to save
   *
   * Returns the created saved listing entry.
   */
  app.post("/saved", {
    preHandler: [requireBhqAuth, requireEmailVerified],
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const bhqUserId = (req as any).bhqUserId;
    const { listingType, listingId: rawListingId } = req.body as { listingType?: string; listingId?: number | string };

    if (!isValidListingType(listingType)) {
      return reply.code(400).send({
        error: "invalid_listing_type",
        message: `listingType must be one of: ${VALID_LISTING_TYPES.join(", ")}`,
      });
    }

    // Validate listingId based on type
    // breeder_storefront accepts string slugs (resolved to tenant ID), others use numeric IDs
    let listingId: number;
    if (usesStringId(listingType)) {
      // For breeder_storefront, accept slug and resolve to tenant ID
      if (!rawListingId || (typeof rawListingId !== "string" && typeof rawListingId !== "number")) {
        return reply.code(400).send({
          error: "invalid_listing_id",
          message: "listingId is required (slug or ID) for breeder_storefront.",
        });
      }
      // Will be resolved to tenant ID below
      listingId = 0; // Placeholder, will be set after lookup
    } else {
      if (!rawListingId || typeof rawListingId !== "number") {
        return reply.code(400).send({
          error: "invalid_listing_id",
          message: "listingId is required and must be a number.",
        });
      }
      listingId = rawListingId;
    }

    try {
      // Verify listing exists based on type
      let listingExists = false;

      if (listingType === "service") {
        const listing = await prisma.mktListingProviderService.findUnique({
          where: { id: listingId },
          select: { id: true, deletedAt: true },
        });
        listingExists = !!listing && !listing.deletedAt;
      } else if (listingType === "offspring_group") {
        const listing = await prisma.offspringGroup.findUnique({
          where: { id: listingId },
          select: { id: true },
        });
        listingExists = !!listing;
      } else if (listingType === "individual_animal") {
        // Individual animal listings - lookup in MktListingIndividualAnimal table
        const listing = await prisma.mktListingIndividualAnimal.findUnique({
          where: { id: listingId },
          select: { id: true },
        });
        listingExists = !!listing;
      } else if (listingType === "animal_program") {
        const listing = await prisma.mktListingAnimalProgram.findUnique({
          where: { id: listingId },
          select: { id: true },
        });
        listingExists = !!listing;
      } else if (listingType === "breeder_storefront") {
        // breeder_storefront: look up by slug or ID, store tenant ID
        let tenant: { id: number } | null = null;
        if (typeof rawListingId === "string") {
          tenant = await prisma.tenant.findUnique({
            where: { slug: rawListingId },
            select: { id: true },
          });
        } else if (typeof rawListingId === "number") {
          tenant = await prisma.tenant.findUnique({
            where: { id: rawListingId },
            select: { id: true },
          });
        }
        if (tenant) {
          listingId = tenant.id; // Store tenant ID
          listingExists = true;
        }
      }

      if (!listingExists) {
        return reply.code(404).send({
          error: "listing_not_found",
          message: "Listing not found.",
        });
      }

      // Check if already saved
      const existing = await prisma.marketplaceSavedListing.findFirst({
        where: { bhqUserId, listingType, listingId },
      });

      if (existing) {
        return reply.code(409).send({
          error: "already_saved",
          message: "Listing is already saved.",
        });
      }

      // Create saved listing
      const saved = await prisma.marketplaceSavedListing.create({
        data: { bhqUserId, listingType, listingId },
        select: { id: true, listingType: true, listingId: true, savedAt: true },
      });

      return reply.code(201).send({
        ok: true,
        success: true,
        id: saved.id,
        saved: {
          id: saved.id,
          listingType: saved.listingType,
          listingId: saved.listingId,
          savedAt: saved.savedAt.toISOString(),
        },
        message: "Listing saved successfully.",
      });
    } catch (err: any) {
      req.log?.error?.({ err, listingType, listingId }, "Failed to save listing");
      return reply.code(500).send({ error: "save_failed", message: "Failed to save listing." });
    }
  });

  /**
   * DELETE /saved/:listingType/:listingId - Unsave a listing
   *
   * Params:
   *   - listingType: string - Type of listing
   *   - listingId: number or string (slug for breeder_storefront)
   */
  app.delete("/saved/:listingType/:listingId", {
    preHandler: requireBhqAuth,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const bhqUserId = (req as any).bhqUserId;
    const listingType = (req.params as any).listingType;
    const rawListingId = (req.params as any).listingId;

    if (!isValidListingType(listingType)) {
      return reply.code(400).send({
        error: "invalid_listing_type",
        message: `listingType must be one of: ${VALID_LISTING_TYPES.join(", ")}`,
      });
    }

    // Resolve listingId - for breeder_storefront, accept slug and resolve to tenant ID
    let listingId: number;
    if (usesStringId(listingType)) {
      // Try to parse as number first (in case they pass the ID directly)
      const parsedId = parseInt(rawListingId, 10);
      if (!isNaN(parsedId)) {
        listingId = parsedId;
      } else {
        // It's a slug, look up the tenant ID
        const tenant = await prisma.tenant.findUnique({
          where: { slug: rawListingId },
          select: { id: true },
        });
        if (!tenant) {
          return reply.code(404).send({
            error: "not_saved",
            message: "Listing is not in your saved items.",
          });
        }
        listingId = tenant.id;
      }
    } else {
      listingId = parseInt(rawListingId, 10);
      if (isNaN(listingId)) {
        return reply.code(400).send({
          error: "invalid_listing_id",
          message: "Invalid listing ID.",
        });
      }
    }

    try {
      // Check if saved
      const existing = await prisma.marketplaceSavedListing.findFirst({
        where: { bhqUserId, listingType, listingId },
      });

      if (!existing) {
        return reply.code(404).send({
          error: "not_saved",
          message: "Listing is not in your saved items.",
        });
      }

      // Delete
      await prisma.marketplaceSavedListing.delete({
        where: { id: existing.id },
      });

      return reply.send({
        ok: true,
        success: true,
        message: "Listing removed from saved items.",
      });
    } catch (err: any) {
      req.log?.error?.({ err, listingType, listingId }, "Failed to unsave listing");
      return reply.code(500).send({ error: "unsave_failed", message: "Failed to unsave listing." });
    }
  });

  /**
   * GET /saved/check/:listingType/:listingId - Check if a listing is saved
   *
   * Params:
   *   - listingType: string - Type of listing
   *   - listingId: number or string (slug for breeder_storefront)
   *
   * Returns { saved: boolean }
   */
  app.get("/saved/check/:listingType/:listingId", {
    preHandler: requireBhqAuth,
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const bhqUserId = (req as any).bhqUserId;
    const listingType = (req.params as any).listingType;
    const rawListingId = (req.params as any).listingId;

    if (!isValidListingType(listingType)) {
      return reply.code(400).send({
        error: "invalid_listing_type",
        message: `listingType must be one of: ${VALID_LISTING_TYPES.join(", ")}`,
      });
    }

    // Resolve listingId - for breeder_storefront, accept slug and resolve to tenant ID
    let listingId: number;
    if (usesStringId(listingType)) {
      const parsedId = parseInt(rawListingId, 10);
      if (!isNaN(parsedId)) {
        listingId = parsedId;
      } else {
        // It's a slug, look up the tenant ID
        const tenant = await prisma.tenant.findUnique({
          where: { slug: rawListingId },
          select: { id: true },
        });
        if (!tenant) {
          // Tenant not found, so it can't be saved
          return reply.send({ ok: true, saved: false });
        }
        listingId = tenant.id;
      }
    } else {
      listingId = parseInt(rawListingId, 10);
      if (isNaN(listingId)) {
        return reply.code(400).send({
          error: "invalid_listing_id",
          message: "Invalid listing ID.",
        });
      }
    }

    try {
      const existing = await prisma.marketplaceSavedListing.findFirst({
        where: { bhqUserId, listingType, listingId },
        select: { id: true },
      });

      return reply.send({
        ok: true,
        saved: !!existing,
      });
    } catch (err: any) {
      req.log?.error?.({ err, listingType, listingId }, "Failed to check saved status");
      return reply.code(500).send({ error: "check_failed", message: "Failed to check saved status." });
    }
  });
}
