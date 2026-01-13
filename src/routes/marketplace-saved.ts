// src/routes/marketplace-saved.ts
/**
 * Marketplace Saved Items Routes
 *
 * Endpoints for saving/unsaving service listings (favorites).
 *
 * Endpoints:
 *   GET    /saved              - List user's saved listings
 *   POST   /saved              - Save a listing { listingId }
 *   DELETE /saved/:listingId   - Unsave a listing
 *   GET    /saved/check/:listingId - Check if listing is saved
 *
 * All endpoints require authenticated MarketplaceUser.
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { requireMarketplaceAuth } from "../middleware/marketplace-auth.js";
import prisma from "../prisma.js";

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
   *   - page: Page number (default: 1)
   *   - limit: Items per page (default: 25, max: 100)
   *
   * Returns saved listings with full listing details and provider info.
   */
  app.get("/saved", {
    preHandler: requireMarketplaceAuth,
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = (req as any).marketplaceUserId;
    const { page, limit, skip } = parsePaging(req.query);

    try {
      const [items, total] = await Promise.all([
        prisma.marketplaceSavedListing.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { savedAt: "desc" },
          include: {
            listing: {
              select: {
                id: true,
                slug: true,
                title: true,
                description: true,
                category: true,
                subcategory: true,
                priceCents: true,
                priceType: true,
                priceText: true,
                coverImageUrl: true,
                city: true,
                state: true,
                status: true,
                deletedAt: true,
                provider: {
                  select: {
                    id: true,
                    businessName: true,
                    averageRating: true,
                    totalReviews: true,
                    verifiedProvider: true,
                  },
                },
              },
            },
          },
        }),
        prisma.marketplaceSavedListing.count({ where: { userId } }),
      ]);

      return reply.send({
        ok: true,
        items: items.map((item) => ({
          id: item.id,
          listingId: item.listingId,
          savedAt: item.savedAt.toISOString(),
          listing: item.listing ? {
            id: item.listing.id,
            slug: item.listing.slug,
            title: item.listing.title,
            description: item.listing.description?.slice(0, 200) || null,
            category: item.listing.category,
            subcategory: item.listing.subcategory,
            priceCents: item.listing.priceCents?.toString() || null,
            priceType: item.listing.priceType,
            priceText: item.listing.priceText,
            coverImageUrl: item.listing.coverImageUrl,
            city: item.listing.city,
            state: item.listing.state,
            status: item.listing.status,
            isAvailable: item.listing.status === "published" && !item.listing.deletedAt,
            provider: item.listing.provider ? {
              id: item.listing.provider.id,
              businessName: item.listing.provider.businessName,
              averageRating: item.listing.provider.averageRating.toString(),
              totalReviews: item.listing.provider.totalReviews,
              verifiedProvider: item.listing.provider.verifiedProvider,
            } : null,
          } : null,
        })),
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
   *   - listingId: number (required) - ID of listing to save
   *
   * Returns the created saved listing entry.
   */
  app.post("/saved", {
    preHandler: requireMarketplaceAuth,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = (req as any).marketplaceUserId;
    const { listingId } = req.body as { listingId?: number };

    if (!listingId || typeof listingId !== "number") {
      return reply.code(400).send({
        error: "invalid_listing_id",
        message: "listingId is required and must be a number.",
      });
    }

    try {
      // Verify listing exists and is published
      const listing = await prisma.marketplaceServiceListing.findUnique({
        where: { id: listingId },
        select: { id: true, status: true, deletedAt: true, title: true },
      });

      if (!listing || listing.deletedAt) {
        return reply.code(404).send({
          error: "listing_not_found",
          message: "Listing not found.",
        });
      }

      // Check if already saved
      const existing = await prisma.marketplaceSavedListing.findUnique({
        where: { userId_listingId: { userId, listingId } },
      });

      if (existing) {
        return reply.code(409).send({
          error: "already_saved",
          message: "Listing is already saved.",
        });
      }

      // Create saved listing
      const saved = await prisma.marketplaceSavedListing.create({
        data: { userId, listingId },
        select: { id: true, listingId: true, savedAt: true },
      });

      return reply.code(201).send({
        ok: true,
        saved: {
          id: saved.id,
          listingId: saved.listingId,
          savedAt: saved.savedAt.toISOString(),
        },
        message: "Listing saved successfully.",
      });
    } catch (err: any) {
      req.log?.error?.({ err, listingId }, "Failed to save listing");
      return reply.code(500).send({ error: "save_failed", message: "Failed to save listing." });
    }
  });

  /**
   * DELETE /saved/:listingId - Unsave a listing
   *
   * Params:
   *   - listingId: number - ID of listing to unsave
   */
  app.delete("/saved/:listingId", {
    preHandler: requireMarketplaceAuth,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = (req as any).marketplaceUserId;
    const listingId = parseInt((req.params as any).listingId, 10);

    if (isNaN(listingId)) {
      return reply.code(400).send({
        error: "invalid_listing_id",
        message: "Invalid listing ID.",
      });
    }

    try {
      // Check if saved
      const existing = await prisma.marketplaceSavedListing.findUnique({
        where: { userId_listingId: { userId, listingId } },
      });

      if (!existing) {
        return reply.code(404).send({
          error: "not_saved",
          message: "Listing is not in your saved items.",
        });
      }

      // Delete
      await prisma.marketplaceSavedListing.delete({
        where: { userId_listingId: { userId, listingId } },
      });

      return reply.send({
        ok: true,
        message: "Listing removed from saved items.",
      });
    } catch (err: any) {
      req.log?.error?.({ err, listingId }, "Failed to unsave listing");
      return reply.code(500).send({ error: "unsave_failed", message: "Failed to unsave listing." });
    }
  });

  /**
   * GET /saved/check/:listingId - Check if a listing is saved
   *
   * Params:
   *   - listingId: number - ID of listing to check
   *
   * Returns { saved: boolean }
   */
  app.get("/saved/check/:listingId", {
    preHandler: requireMarketplaceAuth,
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = (req as any).marketplaceUserId;
    const listingId = parseInt((req.params as any).listingId, 10);

    if (isNaN(listingId)) {
      return reply.code(400).send({
        error: "invalid_listing_id",
        message: "Invalid listing ID.",
      });
    }

    try {
      const existing = await prisma.marketplaceSavedListing.findUnique({
        where: { userId_listingId: { userId, listingId } },
        select: { id: true },
      });

      return reply.send({
        ok: true,
        saved: !!existing,
      });
    } catch (err: any) {
      req.log?.error?.({ err, listingId }, "Failed to check saved status");
      return reply.code(500).send({ error: "check_failed", message: "Failed to check saved status." });
    }
  });
}
