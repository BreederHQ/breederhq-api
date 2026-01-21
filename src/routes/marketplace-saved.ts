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
const VALID_LISTING_TYPES = ["offspring_group", "animal", "service"] as const;
type ListingType = typeof VALID_LISTING_TYPES[number];

function isValidListingType(type: unknown): type is ListingType {
  return typeof type === "string" && VALID_LISTING_TYPES.includes(type as ListingType);
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
            const serviceListing = await prisma.marketplaceServiceListing.findUnique({
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
                isAvailable: serviceListing.status === "published" && !serviceListing.deletedAt,
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
                status: offspringGroup.published ? "live" : "draft",
                isAvailable: offspringGroup.published,
                priceCents: offspringGroup.marketplaceDefaultPriceCents ? Number(offspringGroup.marketplaceDefaultPriceCents) : null,
                breederName: offspringGroup.tenant?.name,
                breederSlug: offspringGroup.tenant?.slug,
              };
            }
          } else if (item.listingType === "animal" && item.listingId) {
            const animal = await prisma.animal.findUnique({
              where: { id: item.listingId },
              include: {
                tenant: true,
                publicListing: true,
              },
            });
            if (animal) {
              listing = {
                title: animal.name,
                slug: animal.publicListing?.urlSlug || null,
                coverImageUrl: animal.photoUrl,
                status: animal.publicListing?.status || "DRAFT",
                isAvailable: animal.publicListing?.status === "LIVE",
                priceCents: animal.publicListing?.priceCents ? Number(animal.publicListing.priceCents) : null,
                species: animal.species,
                breed: animal.breed,
                breederName: animal.tenant?.name,
                breederSlug: animal.tenant?.slug,
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
        ok: true,
        items: expandedItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to fetch saved listings");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch saved listings." });
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
    const { listingType, listingId } = req.body as { listingType?: string; listingId?: number };

    if (!isValidListingType(listingType)) {
      return reply.code(400).send({
        error: "invalid_listing_type",
        message: `listingType must be one of: ${VALID_LISTING_TYPES.join(", ")}`,
      });
    }

    if (!listingId || typeof listingId !== "number") {
      return reply.code(400).send({
        error: "invalid_listing_id",
        message: "listingId is required and must be a number.",
      });
    }

    try {
      // Verify listing exists based on type
      let listingExists = false;

      if (listingType === "service") {
        const listing = await prisma.marketplaceServiceListing.findUnique({
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
      } else if (listingType === "animal") {
        const listing = await prisma.animal.findUnique({
          where: { id: listingId },
          select: { id: true },
        });
        listingExists = !!listing;
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
   *   - listingId: number - ID of listing to unsave
   */
  app.delete("/saved/:listingType/:listingId", {
    preHandler: requireBhqAuth,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const bhqUserId = (req as any).bhqUserId;
    const listingType = (req.params as any).listingType;
    const listingId = parseInt((req.params as any).listingId, 10);

    if (!isValidListingType(listingType)) {
      return reply.code(400).send({
        error: "invalid_listing_type",
        message: `listingType must be one of: ${VALID_LISTING_TYPES.join(", ")}`,
      });
    }

    if (isNaN(listingId)) {
      return reply.code(400).send({
        error: "invalid_listing_id",
        message: "Invalid listing ID.",
      });
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
   *   - listingId: number - ID of listing to check
   *
   * Returns { saved: boolean }
   */
  app.get("/saved/check/:listingType/:listingId", {
    preHandler: requireBhqAuth,
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const bhqUserId = (req as any).bhqUserId;
    const listingType = (req.params as any).listingType;
    const listingId = parseInt((req.params as any).listingId, 10);

    if (!isValidListingType(listingType)) {
      return reply.code(400).send({
        error: "invalid_listing_type",
        message: `listingType must be one of: ${VALID_LISTING_TYPES.join(", ")}`,
      });
    }

    if (isNaN(listingId)) {
      return reply.code(400).send({
        error: "invalid_listing_id",
        message: "Invalid listing ID.",
      });
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
