// @ts-nocheck - Marketplace admin features temporarily disabled pending migration
// src/routes/marketplace-listings.ts
/**
 * Marketplace Service Listings Routes
 *
 * Provider endpoints for creating and managing service listings.
 * Public endpoints for browsing and searching published listings.
 *
 * Endpoints:
 *   Provider (authenticated):
 *     POST   /                      - Create listing
 *     GET    /                      - List provider's listings
 *     GET    /:id                   - Get single listing
 *     PUT    /:id                   - Update listing
 *     POST   /:id/publish           - Publish listing
 *     POST   /:id/unpublish         - Unpublish listing
 *     DELETE /:id                   - Soft delete listing
 *
 *   Public (no auth):
 *     GET    /public/listings       - Browse/search listings
 *     GET    /public/listings/:slug - View single public listing
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { requireProvider } from "../middleware/marketplace-provider-auth.js";
import prisma from "../prisma.js";
import { geocodeZipCode, geocodeAddress } from "../services/geocoding-service.js";
import {
  requiresPayment,
  shouldMarkAsFounding,
  getListingPaymentSettings,
} from "../services/listing-payment-service.js";

// Valid listing categories
const VALID_CATEGORIES = [
  "grooming",
  "training",
  "veterinary",
  "photography",
  "boarding",
  "transport",
  "breeding",
  "other"
] as const;

// Valid price types
const VALID_PRICE_TYPES = ["fixed", "starting_at", "contact"] as const;

/**
 * Generate URL-friendly slug from title and ID
 */
function generateSlug(title: string, id: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${base}-${id}`;
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

/**
 * Parse sort parameter
 */
function parseSort(sortParam?: string) {
  const allowed = new Set(["createdAt", "updatedAt", "title", "publishedAt"]);
  if (!sortParam) return [{ createdAt: "desc" }];

  const parts = String(sortParam).split(",").map(s => s.trim()).filter(Boolean);
  const orderBy: any[] = [];

  for (const p of parts) {
    const desc = p.startsWith("-");
    const key = p.replace(/^-/, "");
    if (allowed.has(key)) {
      orderBy.push({ [key]: desc ? "desc" : "asc" });
    }
  }

  return orderBy.length ? orderBy : [{ createdAt: "desc" }];
}

/**
 * Transform listing to DTO with BigInt conversion
 */
function toListingDTO(listing: any): any {
  return {
    id: listing.id,
    slug: listing.slug,
    providerId: listing.providerId,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    subcategory: listing.subcategory,
    customServiceType: listing.customServiceType,
    priceCents: listing.priceCents ? listing.priceCents.toString() : null,
    priceType: listing.priceType,
    priceText: listing.priceText,
    images: listing.images,
    coverImageUrl: listing.coverImageUrl,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    country: listing.country,
    duration: listing.duration,
    availability: listing.availability,
    metaDescription: listing.metaDescription,
    keywords: listing.keywords,
    status: listing.status,
    viewCount: listing.viewCount,
    inquiryCount: listing.inquiryCount,
    bookingCount: listing.bookingCount,
    publishedAt: listing.publishedAt ? listing.publishedAt.toISOString() : null,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    tags: listing.assignments?.map((a: any) => ({
      id: a.tag.id,
      name: a.tag.name,
      slug: a.tag.slug,
    })) || [],
  };
}

export default async function marketplaceListingsRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /* ───────────────────────── Provider Endpoints ───────────────────────── */

  /**
   * Create new service listing
   */
  app.post("/listings", {
    config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const body = req.body as any;

    // Extract and validate fields
    const title = String(body.title || "").trim();
    const description = body.description !== undefined ? String(body.description).trim() : null;
    const category = String(body.category || "").trim();
    const subcategory = body.subcategory !== undefined ? String(body.subcategory).trim() : null;
    const customServiceType = body.customServiceType !== undefined ? String(body.customServiceType).trim() : null;
    const priceCents = body.priceCents !== undefined && body.priceCents !== null
      ? BigInt(body.priceCents)
      : null;
    const priceType = body.priceType || null;
    const priceText = body.priceText !== undefined ? String(body.priceText).trim() : null;
    const images = body.images || null;
    const coverImageUrl = body.coverImageUrl || null;
    const city = body.city !== undefined ? String(body.city).trim() : null;
    const state = body.state !== undefined ? String(body.state).trim() : null;
    const zip = body.zip !== undefined ? String(body.zip).trim() : null;
    const country = body.country !== undefined ? String(body.country).trim() : null;
    const duration = body.duration !== undefined ? String(body.duration).trim() : null;
    const availability = body.availability !== undefined ? String(body.availability).trim() : null;
    const metaDescription = body.metaDescription !== undefined ? String(body.metaDescription).trim() : null;
    const keywords = body.keywords !== undefined ? String(body.keywords).trim() : null;
    const tagIds = body.tagIds && Array.isArray(body.tagIds) ? body.tagIds : null;

    // Validation
    if (!title || title.length === 0) {
      return reply.code(400).send({
        error: "title_required",
        message: "Listing title is required.",
      });
    }

    if (title.length > 255) {
      return reply.code(400).send({
        error: "title_too_long",
        message: "Title must be 255 characters or less.",
      });
    }

    if (!category || !VALID_CATEGORIES.includes(category as any)) {
      return reply.code(400).send({
        error: "invalid_category",
        message: `Category must be one of: ${VALID_CATEGORIES.join(", ")}`,
      });
    }

    if (description && description.length > 5000) {
      return reply.code(400).send({
        error: "description_too_long",
        message: "Description must be 5000 characters or less.",
      });
    }

    if (priceCents !== null && priceCents < 0n) {
      return reply.code(400).send({
        error: "invalid_price",
        message: "Price must be a positive number.",
      });
    }

    if (priceType && !VALID_PRICE_TYPES.includes(priceType as any)) {
      return reply.code(400).send({
        error: "invalid_price_type",
        message: `Price type must be one of: ${VALID_PRICE_TYPES.join(", ")}`,
      });
    }

    if (images && (!Array.isArray(images) || images.length > 10)) {
      return reply.code(400).send({
        error: "invalid_images",
        message: "Images must be an array with a maximum of 10 items.",
      });
    }

    // Validate customServiceType (only for category "other")
    if (customServiceType) {
      if (category !== "other") {
        return reply.code(400).send({
          error: "invalid_custom_service_type",
          message: "customServiceType can only be used when category is 'other'.",
        });
      }
      if (customServiceType.length > 50) {
        return reply.code(400).send({
          error: "custom_service_type_too_long",
          message: "customServiceType must be 50 characters or less.",
        });
      }
    }

    // Validate tagIds
    if (tagIds) {
      if (!Array.isArray(tagIds) || tagIds.length > 5) {
        return reply.code(400).send({
          error: "invalid_tag_ids",
          message: "tagIds must be an array with a maximum of 5 tags.",
        });
      }
      // Ensure all are numbers
      if (!tagIds.every((id: any) => typeof id === "number" && !isNaN(id))) {
        return reply.code(400).send({
          error: "invalid_tag_ids",
          message: "All tag IDs must be valid numbers.",
        });
      }
    }

    try {
      // Use transaction to create listing and assign tags atomically
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create listing with draft status
        const listing = await tx.mktListingBreederService.create({
          data: {
            providerId: provider.id,
            slug: "",  // Will be generated after creation
            title,
            description,
            category,
            subcategory,
            customServiceType,
            priceCents,
            priceType,
            priceText,
            images,
            coverImageUrl,
            city,
            state,
            zip,
            country,
            duration,
            availability,
            metaDescription,
            keywords,
            status: "DRAFT",
            sourceType: "PROVIDER",  // Provider-created listing
          },
        });

        // 2. Generate slug from title + id
        const slug = generateSlug(title, listing.id);

        // 3. Update with generated slug
        const updated = await tx.mktListingBreederService.update({
          where: { id: listing.id },
          data: { slug },
        });

        // 4. Assign tags if provided
        if (tagIds && tagIds.length > 0) {
          // Verify all tags exist
          const existingTags = await tx.marketplaceServiceTag.findMany({
            where: { id: { in: tagIds } },
            select: { id: true },
          });

          if (existingTags.length !== tagIds.length) {
            throw new Error("One or more tag IDs are invalid.");
          }

          // Create tag assignments
          await tx.marketplaceServiceTagAssignment.createMany({
            data: tagIds.map((tagId: number) => ({
              listingId: listing.id,
              tagId,
            })),
            skipDuplicates: true,
          });

          // Increment usage counts
          await tx.marketplaceServiceTag.updateMany({
            where: { id: { in: tagIds } },
            data: { usageCount: { increment: 1 } },
          });
        }

        // 5. Fetch final listing with tags
        const finalListing = await tx.mktListingBreederService.findUnique({
          where: { id: listing.id },
          include: {
            assignments: {
              include: {
                tag: true,
              },
            },
          },
        });

        return finalListing;
      });

      return reply.code(201).send(toListingDTO(result));
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Failed to create listing");

      if (err.message === "One or more tag IDs are invalid.") {
        return reply.code(400).send({
          error: "invalid_tag_ids",
          message: err.message,
        });
      }

      return reply.code(500).send({
        error: "create_failed",
        message: "Failed to create listing. Please try again.",
      });
    }
  });

  /**
   * List provider's own listings
   */
  app.get("/listings", {
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const query = req.query as any;

    const { page, limit, skip } = parsePaging(query);
    const status = query.status || undefined;
    const orderBy = parseSort(query.sort);

    // Build where clause
    const where: any = {
      providerId: provider.id,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    try {
      const [listings, total] = await Promise.all([
        prisma.mktListingBreederService.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            assignments: {
              include: {
                tag: true,
              },
            },
          },
        }),
        prisma.mktListingBreederService.count({ where }),
      ]);

      return reply.send({
        items: listings.map(toListingDTO),
        total,
        page,
        limit,
        hasMore: skip + listings.length < total,
      });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Failed to list listings");
      return reply.code(500).send({
        error: "list_failed",
        message: "Failed to list listings. Please try again.",
      });
    }
  });

  /**
   * Get single listing (provider must own)
   */
  app.get("/listings/:id", {
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { id } = req.params as { id: string };
    const listingId = parseInt(id, 10);

    if (isNaN(listingId)) {
      return reply.code(400).send({
        error: "invalid_listing_id",
        message: "Listing ID must be a number.",
      });
    }

    try {
      const listing = await prisma.mktListingBreederService.findFirst({
        where: {
          id: listingId,
          providerId: provider.id,
          deletedAt: null,
        },
        include: {
          assignments: {
            include: {
              tag: true,
            },
          },
        },
      });

      if (!listing) {
        return reply.code(404).send({
          error: "listing_not_found",
          message: "Listing not found or access denied.",
        });
      }

      return reply.send(toListingDTO(listing));
    } catch (err: any) {
      req.log?.error?.({ err, listingId }, "Failed to get listing");
      return reply.code(500).send({
        error: "get_failed",
        message: "Failed to get listing. Please try again.",
      });
    }
  });

  /**
   * Update listing (partial update)
   */
  app.put("/listings/:id", {
    config: { rateLimit: { max: 30, timeWindow: "1 hour" } },
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { id } = req.params as { id: string };
    const listingId = parseInt(id, 10);
    const body = req.body as any;

    if (isNaN(listingId)) {
      return reply.code(400).send({
        error: "invalid_listing_id",
        message: "Listing ID must be a number.",
      });
    }

    // Check ownership
    const existing = await prisma.mktListingBreederService.findFirst({
      where: {
        id: listingId,
        providerId: provider.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      return reply.code(404).send({
        error: "listing_not_found",
        message: "Listing not found or access denied.",
      });
    }

    // Build update data
    const updateData: any = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title || title.length === 0) {
        return reply.code(400).send({
          error: "title_required",
          message: "Title cannot be empty.",
        });
      }
      if (title.length > 255) {
        return reply.code(400).send({
          error: "title_too_long",
          message: "Title must be 255 characters or less.",
        });
      }
      updateData.title = title;
    }

    if (body.description !== undefined) {
      const description = body.description ? String(body.description).trim() : null;
      if (description && description.length > 5000) {
        return reply.code(400).send({
          error: "description_too_long",
          message: "Description must be 5000 characters or less.",
        });
      }
      updateData.description = description;
    }

    if (body.category !== undefined) {
      const category = String(body.category).trim();
      if (!VALID_CATEGORIES.includes(category as any)) {
        return reply.code(400).send({
          error: "invalid_category",
          message: `Category must be one of: ${VALID_CATEGORIES.join(", ")}`,
        });
      }
      updateData.category = category;
    }

    if (body.subcategory !== undefined) {
      updateData.subcategory = body.subcategory ? String(body.subcategory).trim() : null;
    }

    if (body.priceCents !== undefined) {
      const priceCents = body.priceCents !== null ? BigInt(body.priceCents) : null;
      if (priceCents !== null && priceCents < 0n) {
        return reply.code(400).send({
          error: "invalid_price",
          message: "Price must be a positive number.",
        });
      }
      updateData.priceCents = priceCents;
    }

    if (body.priceType !== undefined) {
      const priceType = body.priceType;
      if (priceType && !VALID_PRICE_TYPES.includes(priceType as any)) {
        return reply.code(400).send({
          error: "invalid_price_type",
          message: `Price type must be one of: ${VALID_PRICE_TYPES.join(", ")}`,
        });
      }
      updateData.priceType = priceType;
    }

    if (body.priceText !== undefined) {
      updateData.priceText = body.priceText ? String(body.priceText).trim() : null;
    }

    if (body.images !== undefined) {
      if (body.images && (!Array.isArray(body.images) || body.images.length > 10)) {
        return reply.code(400).send({
          error: "invalid_images",
          message: "Images must be an array with a maximum of 10 items.",
        });
      }
      updateData.images = body.images;
    }

    if (body.coverImageUrl !== undefined) {
      updateData.coverImageUrl = body.coverImageUrl || null;
    }

    if (body.city !== undefined) {
      updateData.city = body.city ? String(body.city).trim() : null;
    }

    if (body.state !== undefined) {
      updateData.state = body.state ? String(body.state).trim() : null;
    }

    if (body.zip !== undefined) {
      updateData.zip = body.zip ? String(body.zip).trim() : null;
    }

    if (body.country !== undefined) {
      updateData.country = body.country ? String(body.country).trim() : null;
    }

    if (body.duration !== undefined) {
      updateData.duration = body.duration ? String(body.duration).trim() : null;
    }

    if (body.availability !== undefined) {
      updateData.availability = body.availability ? String(body.availability).trim() : null;
    }

    if (body.metaDescription !== undefined) {
      updateData.metaDescription = body.metaDescription ? String(body.metaDescription).trim() : null;
    }

    if (body.keywords !== undefined) {
      updateData.keywords = body.keywords ? String(body.keywords).trim() : null;
    }

    if (body.customServiceType !== undefined) {
      const customServiceType = body.customServiceType ? String(body.customServiceType).trim() : null;

      // If setting customServiceType, verify category is "other"
      const finalCategory = body.category !== undefined ? String(body.category).trim() : existing.category;
      if (customServiceType && finalCategory !== "other") {
        return reply.code(400).send({
          error: "invalid_custom_service_type",
          message: "customServiceType can only be used when category is 'other'.",
        });
      }

      if (customServiceType && customServiceType.length > 50) {
        return reply.code(400).send({
          error: "custom_service_type_too_long",
          message: "customServiceType must be 50 characters or less.",
        });
      }

      updateData.customServiceType = customServiceType;
    }

    // Validate tagIds if provided
    let tagIds: number[] | null = null;
    if (body.tagIds !== undefined) {
      if (body.tagIds === null) {
        tagIds = [];  // Clear all tags
      } else if (Array.isArray(body.tagIds)) {
        if (body.tagIds.length > 5) {
          return reply.code(400).send({
            error: "invalid_tag_ids",
            message: "Maximum of 5 tags allowed per listing.",
          });
        }
        if (!body.tagIds.every((id: any) => typeof id === "number" && !isNaN(id))) {
          return reply.code(400).send({
            error: "invalid_tag_ids",
            message: "All tag IDs must be valid numbers.",
          });
        }
        tagIds = body.tagIds;
      } else {
        return reply.code(400).send({
          error: "invalid_tag_ids",
          message: "tagIds must be an array or null.",
        });
      }
    }

    try {
      // Use transaction if tags are being updated
      if (tagIds !== null) {
        const result = await prisma.$transaction(async (tx) => {
          // 1. Update listing fields
          const updated = await tx.mktListingBreederService.update({
            where: { id: listingId },
            data: updateData,
          });

          // 2. Get current tag assignments
          const currentAssignments = await tx.marketplaceServiceTagAssignment.findMany({
            where: { listingId },
            select: { tagId: true },
          });
          const currentTagIds = currentAssignments.map(a => a.tagId);

          // 3. Calculate tags to add and remove
          const tagsToAdd = tagIds.filter(id => !currentTagIds.includes(id));
          const tagsToRemove = currentTagIds.filter(id => !tagIds.includes(id));

          // 4. Remove old tag assignments
          if (tagsToRemove.length > 0) {
            await tx.marketplaceServiceTagAssignment.deleteMany({
              where: {
                listingId,
                tagId: { in: tagsToRemove },
              },
            });

            // Decrement usage counts
            await tx.marketplaceServiceTag.updateMany({
              where: { id: { in: tagsToRemove } },
              data: { usageCount: { decrement: 1 } },
            });
          }

          // 5. Add new tag assignments
          if (tagsToAdd.length > 0) {
            // Verify all new tags exist
            const existingTags = await tx.marketplaceServiceTag.findMany({
              where: { id: { in: tagsToAdd } },
              select: { id: true },
            });

            if (existingTags.length !== tagsToAdd.length) {
              throw new Error("One or more tag IDs are invalid.");
            }

            await tx.marketplaceServiceTagAssignment.createMany({
              data: tagsToAdd.map(tagId => ({
                listingId,
                tagId,
              })),
              skipDuplicates: true,
            });

            // Increment usage counts
            await tx.marketplaceServiceTag.updateMany({
              where: { id: { in: tagsToAdd } },
              data: { usageCount: { increment: 1 } },
            });
          }

          // 6. Fetch final listing with tags
          const finalListing = await tx.mktListingBreederService.findUnique({
            where: { id: listingId },
            include: {
              assignments: {
                include: {
                  tag: true,
                },
              },
            },
          });

          return finalListing;
        });

        return reply.send(toListingDTO(result));
      } else {
        // No tag updates, just update listing fields
        const updated = await prisma.mktListingBreederService.update({
          where: { id: listingId },
          data: updateData,
          include: {
            assignments: {
              include: {
                tag: true,
              },
            },
          },
        });

        return reply.send(toListingDTO(updated));
      }
    } catch (err: any) {
      req.log?.error?.({ err, listingId }, "Failed to update listing");

      if (err.message === "One or more tag IDs are invalid.") {
        return reply.code(400).send({
          error: "invalid_tag_ids",
          message: err.message,
        });
      }

      return reply.code(500).send({
        error: "update_failed",
        message: "Failed to update listing. Please try again.",
      });
    }
  });

  /**
   * Publish listing (draft → published)
   */
  app.post("/listings/:id/publish", {
    config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { id } = req.params as { id: string };
    const listingId = parseInt(id, 10);

    if (isNaN(listingId)) {
      return reply.code(400).send({
        error: "invalid_listing_id",
        message: "Listing ID must be a number.",
      });
    }

    // Check ownership
    const listing = await prisma.mktListingBreederService.findFirst({
      where: {
        id: listingId,
        providerId: provider.id,
        deletedAt: null,
      },
    });

    if (!listing) {
      return reply.code(404).send({
        error: "listing_not_found",
        message: "Listing not found or access denied.",
      });
    }

    // Validate required fields for publishing
    if (!listing.title || listing.title.trim().length === 0) {
      return reply.code(400).send({
        error: "title_required_to_publish",
        message: "Listing must have a title to be published.",
      });
    }

    if (!listing.category) {
      return reply.code(400).send({
        error: "category_required_to_publish",
        message: "Listing must have a category to be published.",
      });
    }

    // Check if already published
    if (listing.status === "LIVE") {
      return reply.code(409).send({
        error: "already_published",
        message: "Listing is already published.",
      });
    }

    try {
      // Check if payment is required
      const paymentCheck = await requiresPayment(listingId, provider.id, listing.tenantId);

      if (paymentCheck.required) {
        const settings = await getListingPaymentSettings();
        return reply.code(402).send({
          error: "payment_required",
          message: "A subscription is required to publish this listing.",
          checkoutUrl: `/api/v1/service-listings/${listingId}/checkout`,
          listingFeeCents: settings.listingFeeCents,
        });
      }

      // Payment not required — publish and mark founding status
      const isFounding = await shouldMarkAsFounding();

      const updated = await prisma.mktListingBreederService.update({
        where: { id: listingId },
        data: {
          status: "LIVE",
          publishedAt: new Date(),
          ...(isFounding ? { isFounding: true } : {}),
        },
      });

      return reply.send({
        ok: true,
        listing: {
          id: updated.id,
          status: updated.status,
          publishedAt: updated.publishedAt?.toISOString() || new Date().toISOString(),
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err, listingId }, "Failed to publish listing");
      return reply.code(500).send({
        error: "publish_failed",
        message: "Failed to publish listing. Please try again.",
      });
    }
  });

  /**
   * Unpublish listing (published → draft)
   */
  app.post("/listings/:id/unpublish", {
    config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { id } = req.params as { id: string };
    const listingId = parseInt(id, 10);

    if (isNaN(listingId)) {
      return reply.code(400).send({
        error: "invalid_listing_id",
        message: "Listing ID must be a number.",
      });
    }

    // Check ownership
    const listing = await prisma.mktListingBreederService.findFirst({
      where: {
        id: listingId,
        providerId: provider.id,
        deletedAt: null,
      },
    });

    if (!listing) {
      return reply.code(404).send({
        error: "listing_not_found",
        message: "Listing not found or access denied.",
      });
    }

    try {
      const updated = await prisma.mktListingBreederService.update({
        where: { id: listingId },
        data: {
          status: "DRAFT",
        },
      });

      return reply.send({
        ok: true,
        listing: {
          id: updated.id,
          status: updated.status,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err, listingId }, "Failed to unpublish listing");
      return reply.code(500).send({
        error: "unpublish_failed",
        message: "Failed to unpublish listing. Please try again.",
      });
    }
  });

  /**
   * Soft delete listing
   */
  app.delete("/listings/:id", {
    config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { id } = req.params as { id: string };
    const listingId = parseInt(id, 10);

    if (isNaN(listingId)) {
      return reply.code(400).send({
        error: "invalid_listing_id",
        message: "Listing ID must be a number.",
      });
    }

    // Check ownership
    const listing = await prisma.mktListingBreederService.findFirst({
      where: {
        id: listingId,
        providerId: provider.id,
        deletedAt: null,
      },
    });

    if (!listing) {
      return reply.code(404).send({
        error: "listing_not_found",
        message: "Listing not found or access denied.",
      });
    }

    try {
      await prisma.mktListingBreederService.update({
        where: { id: listingId },
        data: {
          deletedAt: new Date(),
        },
      });

      return reply.send({
        ok: true,
        deleted: true,
      });
    } catch (err: any) {
      req.log?.error?.({ err, listingId }, "Failed to delete listing");
      return reply.code(500).send({
        error: "delete_failed",
        message: "Failed to delete listing. Please try again.",
      });
    }
  });

  /* ───────────────────────── Public Endpoints ───────────────────────── */

  /**
   * Browse/search published listings (public)
   *
   * UNIFIED VIEW: Queries the unified mktListingBreederService table containing
   * both provider and breeder listings.
   */
  app.get("/public/listings", {
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const query = req.query as any;

    const { page, limit: rawLimit, skip } = parsePaging(query);
    const limit = Math.min(50, rawLimit); // Max 50 for public

    // Parse filters
    const search = query.search ? String(query.search).trim() : undefined;
    const category = query.category ? String(query.category).trim().toUpperCase() : undefined;
    const subcategory = query.subcategory ? String(query.subcategory).trim() : undefined;
    const city = query.city ? String(query.city).trim() : undefined;
    const state = query.state ? String(query.state).trim() : undefined;
    const zip = query.zip ? String(query.zip).trim() : undefined;
    const priceMin = query.priceMin ? parseInt(query.priceMin, 10) : undefined;
    const priceMax = query.priceMax ? parseInt(query.priceMax, 10) : undefined;
    // Tenant/breeder filter - can be tenant slug or numeric ID
    const tenantIdParam = query.tenantId ? String(query.tenantId).trim() : undefined;

    // Parse sort
    const sortParam = query.sort || "-publishedAt";

    try {
      // Build where clause for unified table
      const where: any = {
        status: "LIVE",
        deletedAt: null,
      };

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { provider: { businessName: { contains: search, mode: "insensitive" } } },
          { tenant: { name: { contains: search, mode: "insensitive" } } },
        ];
      }
      if (category) where.category = category.toLowerCase();
      if (subcategory) where.subcategory = subcategory;
      // Filter by tenant (breeder) - supports both numeric ID and slug
      if (tenantIdParam) {
        const isNumericTenant = /^\d+$/.test(tenantIdParam);
        if (isNumericTenant) {
          where.tenantId = parseInt(tenantIdParam, 10);
        } else {
          // Filter by tenant slug
          where.tenant = { slug: tenantIdParam };
        }
      }
      if (city) where.city = { contains: city, mode: "insensitive" };
      if (state) where.state = { contains: state, mode: "insensitive" };
      if (zip) where.zip = { startsWith: zip };
      if (priceMin !== undefined && !isNaN(priceMin)) {
        where.priceCents = { ...where.priceCents, gte: BigInt(priceMin) };
      }
      if (priceMax !== undefined && !isNaN(priceMax)) {
        where.priceCents = { ...where.priceCents, lte: BigInt(priceMax) };
      }

      // Build orderBy for database sorting
      let orderBy: any[] = [];
      if (sortParam === "-publishedAt" || sortParam === "recent") {
        orderBy = [{ publishedAt: "desc" }];
      } else if (sortParam === "title") {
        orderBy = [{ title: "asc" }];
      } else if (sortParam === "price_low" || sortParam === "priceCents") {
        orderBy = [{ priceCents: "asc" }];
      } else if (sortParam === "price_high" || sortParam === "-priceCents") {
        orderBy = [{ priceCents: "desc" }];
      } else {
        orderBy = [{ publishedAt: "desc" }]; // Default
      }

      // Query unified table with pagination
      const [listings, total] = await Promise.all([
        prisma.mktListingBreederService.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            provider: {
              select: {
                id: true,
                businessName: true,
                logoUrl: true,
                coverImageUrl: true,
                averageRating: true,
                totalReviews: true,
                city: true,
                state: true,
              },
            },
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        }),
        prisma.mktListingBreederService.count({ where }),
      ]);

      // Transform to public DTO
      const items = listings.map((listing) => {
        const isProvider = listing.sourceType === "PROVIDER";
        const providerInfo = isProvider && listing.provider
          ? {
              id: listing.provider.id,
              name: listing.provider.businessName,
              businessName: listing.provider.businessName,
              logoUrl: listing.provider.logoUrl,
              coverImageUrl: listing.provider.coverImageUrl,
              averageRating: listing.provider.averageRating ? String(listing.provider.averageRating) : "0",
              totalReviews: listing.provider.totalReviews || 0,
              city: listing.provider.city,
              state: listing.provider.state,
              type: "provider" as const,
              slug: undefined,
            }
          : {
              id: `breeder-${listing.tenantId}`,
              name: listing.tenant?.name || "Unknown Breeder",
              businessName: listing.tenant?.name || "Unknown Breeder",
              logoUrl: null,
              coverImageUrl: null,
              averageRating: "0",
              totalReviews: 0,
              city: listing.city,
              state: listing.state,
              type: "breeder" as const,
              slug: listing.tenant?.slug,
            };

        return {
          id: listing.id,
          slug: listing.slug,
          title: listing.title,
          description: listing.description,
          summary: listing.description ? listing.description.substring(0, 150) : null,
          category: listing.category,
          subcategory: listing.subcategory,
          customServiceType: listing.customServiceType,
          listingType: listing.category, // For backward compatibility
          priceCents: listing.priceCents ? Number(listing.priceCents) : null,
          priceType: listing.priceType,
          priceDisplay: listing.priceCents
            ? `${listing.priceType === "starting_at" ? "Starting at " : ""}$${(Number(listing.priceCents) / 100).toFixed(2)}`
            : "Contact for pricing",
          images: listing.images || [],
          coverImageUrl: listing.coverImageUrl,
          city: listing.city,
          state: listing.state,
          country: listing.country || "US",
          publishedAt: listing.publishedAt,
          viewCount: listing.viewCount || 0,
          inquiryCount: listing.inquiryCount || 0,
          provider: providerInfo,
          tags: [], // Tags not yet migrated to unified table
        };
      });

      return reply.send({
        items,
        total,
        page,
        limit,
        hasMore: skip + items.length < total,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to browse listings");
      return reply.code(500).send({
        error: "browse_failed",
        message: "Failed to browse listings. Please try again.",
      });
    }
  });

  /**
   * View single public listing by slug or ID
   * Accepts either a numeric ID or a slug string
   * UNIFIED: Queries the unified mktListingBreederService table
   */
  app.get("/public/listings/:slugOrId", {
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { slugOrId } = req.params as { slugOrId: string };

    try {
      // Determine if parameter is a numeric ID or a slug
      const isNumeric = /^\d+$/.test(slugOrId);
      const listingId = isNumeric ? parseInt(slugOrId, 10) : undefined;

      // Build where clause
      const where: any = {
        status: "LIVE",
        deletedAt: null,
      };
      if (isNumeric && listingId) {
        where.id = listingId;
      } else {
        where.slug = slugOrId;
      }

      // Query unified table
      const listing = await prisma.mktListingBreederService.findFirst({
        where,
        include: {
          provider: {
            select: {
              id: true,
              businessName: true,
              businessDescription: true,
              logoUrl: true,
              coverImageUrl: true,
              publicEmail: true,
              publicPhone: true,
              website: true,
              city: true,
              state: true,
              country: true,
              averageRating: true,
              totalReviews: true,
              verifiedProvider: true,
              premiumProvider: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!listing) {
        return reply.code(404).send({
          error: "listing_not_found",
          message: "Listing not found or not available.",
        });
      }

      // Increment view count (fire-and-forget)
      prisma.mktListingBreederService.update({
        where: { id: listing.id },
        data: { viewCount: { increment: 1 } },
      }).catch((err) => {
        req.log?.error?.({ err, listingId: listing.id }, "Failed to increment view count");
      });

      // Transform to public DTO based on sourceType
      const isProvider = listing.sourceType === "PROVIDER";
      const providerInfo = isProvider && listing.provider
        ? {
            id: listing.provider.id,
            name: listing.provider.businessName,
            businessName: listing.provider.businessName,
            businessDescription: listing.provider.businessDescription,
            logoUrl: listing.provider.logoUrl,
            coverImageUrl: listing.provider.coverImageUrl,
            publicEmail: listing.provider.publicEmail,
            phone: listing.provider.publicPhone,
            website: listing.provider.website,
            city: listing.provider.city,
            state: listing.provider.state,
            country: listing.provider.country,
            averageRating: listing.provider.averageRating ? String(listing.provider.averageRating) : "0",
            totalReviews: listing.provider.totalReviews || 0,
            verifiedProvider: listing.provider.verifiedProvider || false,
            premiumProvider: listing.provider.premiumProvider || false,
            type: "provider" as const,
            slug: undefined,
          }
        : {
            id: `breeder-${listing.tenantId}`,
            name: listing.tenant?.name || "Unknown Breeder",
            businessName: listing.tenant?.name || "Unknown Breeder",
            businessDescription: null,
            logoUrl: null,
            coverImageUrl: null,
            publicEmail: null,
            phone: null,
            website: null,
            city: listing.city,
            state: listing.state,
            country: listing.country,
            averageRating: "0",
            totalReviews: 0,
            verifiedProvider: false,
            premiumProvider: false,
            type: "breeder" as const,
            slug: listing.tenant?.slug,
          };

      const publicListing = {
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        description: listing.description,
        summary: listing.description ? listing.description.substring(0, 150) : null,
        category: listing.category,
        subcategory: listing.subcategory,
        customServiceType: listing.customServiceType,
        listingType: listing.category,
        priceCents: listing.priceCents ? Number(listing.priceCents) : null,
        priceType: listing.priceType,
        priceDisplay: listing.priceCents
          ? `${listing.priceType === "starting_at" ? "Starting at " : ""}$${(Number(listing.priceCents) / 100).toFixed(2)}`
          : "Contact for pricing",
        images: listing.images || [],
        coverImageUrl: listing.coverImageUrl,
        city: listing.city,
        state: listing.state,
        country: listing.country || "US",
        publishedAt: listing.publishedAt,
        viewCount: listing.viewCount || 0,
        inquiryCount: listing.inquiryCount || 0,
        provider: providerInfo,
        tags: [], // Tags not yet migrated to unified table
      };

      return reply.send(publicListing);
    } catch (err: any) {
      req.log?.error?.({ err, slugOrId }, "Failed to get public listing");
      return reply.code(500).send({
        error: "get_failed",
        message: "Failed to get listing. Please try again.",
      });
    }
  });

  /**
   * Geocode a zip code or address to lat/lng (public utility endpoint)
   * Useful for frontend to get coordinates before searching
   */
  app.get("/public/geocode", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const query = req.query as any;
    const zip = query.zip ? String(query.zip).trim() : undefined;
    const address = query.address ? String(query.address).trim() : undefined;

    if (!zip && !address) {
      return reply.code(400).send({
        error: "missing_location",
        message: "Either zip or address parameter is required.",
      });
    }

    try {
      let result;
      if (zip) {
        result = await geocodeZipCode(zip, query.country || "US");
      } else if (address) {
        result = await geocodeAddress(address);
      }

      if (!result) {
        return reply.code(404).send({
          error: "location_not_found",
          message: "Could not find coordinates for the given location.",
        });
      }

      return reply.send({
        ok: true,
        latitude: result.latitude,
        longitude: result.longitude,
        displayName: result.displayName,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to geocode location");
      return reply.code(500).send({
        error: "geocode_failed",
        message: "Failed to geocode location. Please try again.",
      });
    }
  });
}
