// src/routes/marketplace-service-detail.ts
// Service Detail API for Service Provider Portal AND Breeder Services
// Public endpoint supporting both slug and ID routing

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";

/**
 * GET /api/v1/marketplace/services/:slugOrId
 * Get service listing by slug or ID with full provider details
 * Searches both Service Provider listings AND Breeder Service listings
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

    // ==========================================================================
    // 1. First, try to find in Breeder Services (mktListingBreederService)
    // ==========================================================================
    const breederWhere: any = {
      status: "LIVE",
    };

    if (isNumeric) {
      breederWhere.id = numericId;
    } else {
      breederWhere.slug = slugOrId;
    }

    const breederListing = await prisma.mktListingBreederService.findFirst({
      where: breederWhere,
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            organizations: {
              where: { isPublicProgram: true },
              take: 1,
              select: {
                programSlug: true,
                name: true,
                publicContactEmail: true,
              },
            },
          },
        },
      },
    });

    if (breederListing) {
      // Increment view count asynchronously (fire-and-forget)
      prisma.mktListingBreederService
        .update({
          where: { id: breederListing.id },
          data: { viewCount: { increment: 1 } },
        })
        .catch((err) => {
          request.log.error(
            { err, listingId: breederListing.id },
            "Failed to increment view count"
          );
        });

      const org = breederListing.tenant?.organizations?.[0];

      // Transform to public DTO (matching PublicServiceListing interface)
      return reply.send({
        id: breederListing.id,
        slug: breederListing.slug,
        listingType: breederListing.listingType,
        title: breederListing.title,
        summary: breederListing.description?.substring(0, 200) || null,
        description: breederListing.description,
        customServiceType: null,
        tags: [],
        city: breederListing.city,
        state: breederListing.state,
        country: breederListing.country,
        priceCents: breederListing.priceCents,
        priceType: breederListing.priceType,
        priceDisplay: breederListing.priceCents
          ? `$${(breederListing.priceCents / 100).toLocaleString()}`
          : null,
        coverImageUrl: Array.isArray(breederListing.images) && breederListing.images.length > 0
          ? breederListing.images[0]
          : null,
        images: breederListing.images || [],
        publishedAt: breederListing.publishedAt?.toISOString() || null,
        provider: {
          type: "breeder" as const,
          id: breederListing.tenant?.id,
          slug: breederListing.tenant?.slug || org?.programSlug || null,
          name: org?.name || breederListing.tenant?.name || "Unknown Breeder",
          email: breederListing.contactEmail || org?.publicContactEmail || null,
          phone: breederListing.contactPhone || null,
          website: null,
        },
      });
    }

    // ==========================================================================
    // 2. If not found in Breeder Services, try Service Provider listings
    // ==========================================================================
    const providerWhere: any = {
      status: "LIVE",
      deletedAt: null,
    };

    if (isNumeric) {
      providerWhere.id = numericId;
    } else {
      providerWhere.slug = slugOrId;
    }

    // Fetch listing with full provider details and tags
    const listing = await prisma.mktListingProviderService.findFirst({
      where: providerWhere,
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
    prisma.mktListingProviderService
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
