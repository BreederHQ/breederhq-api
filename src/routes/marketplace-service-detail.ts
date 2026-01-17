// src/routes/marketplace-service-detail.ts
// Service Detail API for Service Provider Portal
// Public endpoint supporting both slug and ID routing

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";

/**
 * GET /api/v1/marketplace/services/:slugOrId
 * Get service listing by slug or ID with full provider details
 */
async function getServiceDetail(
  request: FastifyRequest<{
    Params: {
      slugOrId: string;
    };
  }>,
  reply: FastifyReply
) {
  const { slugOrId } = request.params;

  try {
    // Try to parse as numeric ID first
    const numericId = parseInt(slugOrId, 10);
    const isNumeric = !isNaN(numericId);

    // Build where clause - search by ID or slug
    const where: any = {
      status: "published",
      deletedAt: null,
    };

    if (isNumeric) {
      where.id = numericId;
    } else {
      where.slug = slugOrId;
    }

    // Fetch listing with full provider details and tags
    const listing = await prisma.marketplaceServiceListing.findFirst({
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
            zip: true,
            country: true,
            averageRating: true,
            totalReviews: true,
            verifiedProvider: true,
            premiumProvider: true,
            createdAt: true,
          },
        },
        assignments: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!listing) {
      return reply.status(404).send({
        error: "service_not_found",
        message: "Service listing not found or not available.",
      });
    }

    // Increment view count asynchronously (fire-and-forget)
    prisma.marketplaceServiceListing
      .update({
        where: { id: listing.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err) => {
        request.log.error(
          { err, listingId: listing.id },
          "Failed to increment view count"
        );
      });

    // Transform to public DTO
    const serviceDetail = {
      id: listing.id,
      slug: listing.slug,
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
      duration: listing.duration,
      availability: listing.availability,
      metaDescription: listing.metaDescription,
      keywords: listing.keywords,
      viewCount: listing.viewCount,
      publishedAt: listing.publishedAt
        ? listing.publishedAt.toISOString()
        : null,
      tags: listing.assignments.map((a) => ({
        id: a.tag.id,
        name: a.tag.name,
        slug: a.tag.slug,
      })),
      provider: {
        id: listing.provider.id,
        businessName: listing.provider.businessName,
        businessDescription: listing.provider.businessDescription,
        logoUrl: listing.provider.logoUrl,
        coverImageUrl: listing.provider.coverImageUrl,
        publicEmail: listing.provider.publicEmail,
        publicPhone: listing.provider.publicPhone,
        website: listing.provider.website,
        city: listing.provider.city,
        state: listing.provider.state,
        zip: listing.provider.zip,
        country: listing.provider.country,
        averageRating: listing.provider.averageRating.toString(),
        totalReviews: listing.provider.totalReviews,
        verifiedProvider: listing.provider.verifiedProvider,
        premiumProvider: listing.provider.premiumProvider,
        memberSince: listing.provider.createdAt.toISOString(),
      },
    };

    return reply.send(serviceDetail);
  } catch (error) {
    request.log.error(error, "Failed to fetch service detail");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to fetch service detail",
    });
  }
}

/**
 * Register routes
 */
export default async function marketplaceServiceDetailRoutes(
  fastify: FastifyInstance
) {
  // GET /api/v1/marketplace/services/:slugOrId - Get service detail
  fastify.get("/:slugOrId", {
    config: {
      rateLimit: {
        max: 100,
        timeWindow: "1 minute",
      },
    },
    handler: getServiceDetail,
  });
}
