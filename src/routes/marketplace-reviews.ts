// src/routes/marketplace-reviews.ts
// Marketplace reviews & ratings endpoints
//
// Endpoints:
//   POST /transactions/:id/review    - Submit review for completed transaction
//   POST /reviews/:id/respond        - Provider responds to a review
//   GET  /providers/:id/reviews      - Get reviews for a provider (public)
//   GET  /reviews/my-reviews         - Get reviews submitted by current user
//
// Security:
// - Review submission requires buyer who completed the transaction
// - Provider response requires the provider being reviewed
// - Public reviews listing shows only published reviews

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";
import { requireMarketplaceAuth } from "../middleware/marketplace-auth.js";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Convert review to JSON-safe format
 */
function toReviewDTO(review: any) {
  return {
    id: review.id,
    transactionId: String(review.transactionId),
    providerId: review.providerId,
    clientId: review.clientId,
    listingId: review.listingId,
    rating: review.rating,
    title: review.title,
    reviewText: review.reviewText,
    providerResponse: review.providerResponse,
    respondedAt: review.respondedAt?.toISOString() || null,
    status: review.status,
    createdAt: review.createdAt.toISOString(),
    // Include related data if present
    client: review.client
      ? {
          id: review.client.id,
          firstName: review.client.firstName,
          lastName: review.client.lastName,
        }
      : undefined,
    provider: review.provider
      ? {
          id: review.provider.id,
          businessName: review.provider.businessName,
        }
      : undefined,
    listing: review.listing
      ? {
          id: review.listing.id,
          title: review.listing.title,
        }
      : undefined,
  };
}

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // POST /transactions/:id/review - Submit review for completed transaction
  // --------------------------------------------------------------------------
  app.post(
    "/transactions/:id/review",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: { max: 10, timeWindow: "1 hour" },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const transactionIdStr = (req.params as any).id;
      const { rating, title, reviewText } = req.body as any;

      // Parse transaction ID
      let transactionId: bigint;
      try {
        transactionId = BigInt(transactionIdStr);
      } catch {
        return reply.code(400).send({ error: "invalid_transaction_id" });
      }

      // Validate rating
      if (typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return reply.code(400).send({
          error: "invalid_rating",
          message: "Rating must be an integer between 1 and 5",
        });
      }

      // Validate title length if provided
      if (title && (typeof title !== "string" || title.length > 100)) {
        return reply.code(400).send({
          error: "invalid_title",
          message: "Title must be 100 characters or less",
        });
      }

      // Validate review text length if provided
      if (reviewText && (typeof reviewText !== "string" || reviewText.length > 2000)) {
        return reply.code(400).send({
          error: "invalid_review_text",
          message: "Review text must be 2000 characters or less",
        });
      }

      try {
        // Get transaction and verify ownership
        const transaction = await prisma.marketplaceTransaction.findUnique({
          where: { id: transactionId },
          select: {
            id: true,
            clientId: true,
            providerId: true,
            listingId: true,
            status: true,
            review: { select: { id: true } },
          },
        });

        if (!transaction) {
          return reply.code(404).send({
            error: "transaction_not_found",
            message: "Transaction not found",
          });
        }

        // Must be the client (buyer) who completed the transaction
        if (transaction.clientId !== userId) {
          return reply.code(403).send({
            error: "not_authorized",
            message: "Only the buyer can review this transaction",
          });
        }

        // Transaction must be completed
        if (transaction.status !== "completed") {
          return reply.code(400).send({
            error: "transaction_not_completed",
            message: "Can only review completed transactions",
          });
        }

        // Check if already reviewed
        if (transaction.review) {
          return reply.code(400).send({
            error: "already_reviewed",
            message: "This transaction has already been reviewed",
          });
        }

        // Create review and update provider stats in transaction
        const review = await prisma.$transaction(async (tx) => {
          // Create the review
          const newReview = await tx.marketplaceReview.create({
            data: {
              transactionId,
              providerId: transaction.providerId,
              clientId: userId,
              listingId: transaction.listingId,
              rating,
              title: title || null,
              reviewText: reviewText || null,
              status: "published",
            },
            include: {
              client: {
                select: { id: true, firstName: true, lastName: true },
              },
              provider: {
                select: { id: true, businessName: true },
              },
              listing: {
                select: { id: true, title: true },
              },
            },
          });

          // Get current provider stats
          const provider = await tx.marketplaceProvider.findUnique({
            where: { id: transaction.providerId },
            select: { averageRating: true, totalReviews: true },
          });

          if (provider) {
            // Calculate new average rating
            const currentTotal = provider.averageRating.toNumber() * provider.totalReviews;
            const newTotal = currentTotal + rating;
            const newCount = provider.totalReviews + 1;
            const newAverage = newTotal / newCount;

            // Update provider stats
            await tx.marketplaceProvider.update({
              where: { id: transaction.providerId },
              data: {
                averageRating: new Decimal(newAverage.toFixed(2)),
                totalReviews: newCount,
              },
            });
          }

          return newReview;
        });

        return reply.code(201).send({
          ok: true,
          message: "Review submitted successfully",
          review: toReviewDTO(review),
        });
      } catch (err: any) {
        console.error("Error submitting review:", err);
        return reply.code(500).send({
          error: "internal_error",
          message: "Failed to submit review",
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // POST /reviews/:id/respond - Provider responds to a review
  // --------------------------------------------------------------------------
  app.post(
    "/reviews/:id/respond",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: { max: 20, timeWindow: "1 hour" },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const reviewId = parseInt((req.params as any).id, 10);
      const { response } = req.body as any;

      if (isNaN(reviewId)) {
        return reply.code(400).send({ error: "invalid_review_id" });
      }

      // Validate response
      if (!response || typeof response !== "string") {
        return reply.code(400).send({
          error: "missing_response",
          message: "Response text is required",
        });
      }

      if (response.length > 1000) {
        return reply.code(400).send({
          error: "response_too_long",
          message: "Response must be 1000 characters or less",
        });
      }

      try {
        // Get review and verify ownership
        const review = await prisma.marketplaceReview.findUnique({
          where: { id: reviewId },
          select: {
            id: true,
            providerId: true,
            providerResponse: true,
            provider: {
              select: { userId: true },
            },
          },
        });

        if (!review) {
          return reply.code(404).send({
            error: "review_not_found",
            message: "Review not found",
          });
        }

        // Must be the provider being reviewed
        if (review.provider.userId !== userId) {
          return reply.code(403).send({
            error: "not_authorized",
            message: "Only the reviewed provider can respond",
          });
        }

        // Check if already responded
        if (review.providerResponse) {
          return reply.code(400).send({
            error: "already_responded",
            message: "You have already responded to this review",
          });
        }

        // Update review with response
        const updatedReview = await prisma.marketplaceReview.update({
          where: { id: reviewId },
          data: {
            providerResponse: response,
            respondedAt: new Date(),
          },
          include: {
            client: {
              select: { id: true, firstName: true, lastName: true },
            },
            provider: {
              select: { id: true, businessName: true },
            },
            listing: {
              select: { id: true, title: true },
            },
          },
        });

        return reply.send({
          ok: true,
          message: "Response submitted successfully",
          review: toReviewDTO(updatedReview),
        });
      } catch (err: any) {
        console.error("Error responding to review:", err);
        return reply.code(500).send({
          error: "internal_error",
          message: "Failed to submit response",
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // GET /providers/:id/reviews - Get reviews for a provider (public)
  // --------------------------------------------------------------------------
  app.get(
    "/providers/:id/reviews",
    {
      config: {
        rateLimit: { max: 100, timeWindow: "1 minute" },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const providerId = parseInt((req.params as any).id, 10);
      const { page = "1", limit = "10", sort = "recent" } = req.query as any;

      if (isNaN(providerId)) {
        return reply.code(400).send({ error: "invalid_provider_id" });
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
      const skip = (pageNum - 1) * limitNum;

      // Determine sort order
      let orderBy: any = { createdAt: "desc" }; // recent (default)
      if (sort === "rating_high") {
        orderBy = { rating: "desc" };
      } else if (sort === "rating_low") {
        orderBy = { rating: "asc" };
      } else if (sort === "oldest") {
        orderBy = { createdAt: "asc" };
      }

      try {
        // Verify provider exists
        const provider = await prisma.marketplaceProvider.findUnique({
          where: { id: providerId },
          select: {
            id: true,
            businessName: true,
            averageRating: true,
            totalReviews: true,
          },
        });

        if (!provider) {
          return reply.code(404).send({
            error: "provider_not_found",
            message: "Provider not found",
          });
        }

        // Get reviews (only published)
        const [reviews, total] = await Promise.all([
          prisma.marketplaceReview.findMany({
            where: {
              providerId,
              status: "published",
            },
            orderBy,
            skip,
            take: limitNum,
            include: {
              client: {
                select: { id: true, firstName: true, lastName: true },
              },
              listing: {
                select: { id: true, title: true },
              },
            },
          }),
          prisma.marketplaceReview.count({
            where: {
              providerId,
              status: "published",
            },
          }),
        ]);

        // Calculate rating distribution
        const ratingDistribution = await prisma.marketplaceReview.groupBy({
          by: ["rating"],
          where: {
            providerId,
            status: "published",
          },
          _count: { rating: true },
        });

        const distribution = {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        };
        for (const r of ratingDistribution) {
          distribution[r.rating as 1 | 2 | 3 | 4 | 5] = r._count.rating;
        }

        return reply.send({
          ok: true,
          provider: {
            id: provider.id,
            businessName: provider.businessName,
            averageRating: provider.averageRating.toNumber(),
            totalReviews: provider.totalReviews,
          },
          ratingDistribution: distribution,
          reviews: reviews.map(toReviewDTO),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        });
      } catch (err: any) {
        console.error("Error fetching provider reviews:", err);
        return reply.code(500).send({
          error: "internal_error",
          message: "Failed to fetch reviews",
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // GET /reviews/my-reviews - Get reviews submitted by current user
  // --------------------------------------------------------------------------
  app.get(
    "/reviews/my-reviews",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: { max: 100, timeWindow: "1 minute" },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const { page = "1", limit = "10" } = req.query as any;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
      const skip = (pageNum - 1) * limitNum;

      try {
        const [reviews, total] = await Promise.all([
          prisma.marketplaceReview.findMany({
            where: { clientId: userId },
            orderBy: { createdAt: "desc" },
            skip,
            take: limitNum,
            include: {
              provider: {
                select: { id: true, businessName: true },
              },
              listing: {
                select: { id: true, title: true },
              },
            },
          }),
          prisma.marketplaceReview.count({
            where: { clientId: userId },
          }),
        ]);

        return reply.send({
          ok: true,
          reviews: reviews.map(toReviewDTO),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        });
      } catch (err: any) {
        console.error("Error fetching user reviews:", err);
        return reply.code(500).send({
          error: "internal_error",
          message: "Failed to fetch reviews",
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // GET /reviews/pending - Get transactions awaiting review (buyer only)
  // --------------------------------------------------------------------------
  app.get(
    "/reviews/pending",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: { max: 100, timeWindow: "1 minute" },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;

      try {
        // Get completed transactions without reviews
        const pendingReviews = await prisma.marketplaceTransaction.findMany({
          where: {
            clientId: userId,
            status: "completed",
            review: null,
          },
          orderBy: { completedAt: "desc" },
          take: 20,
          select: {
            id: true,
            serviceDescription: true,
            completedAt: true,
            provider: {
              select: {
                id: true,
                businessName: true,
              },
            },
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        });

        return reply.send({
          ok: true,
          pendingReviews: pendingReviews.map((t) => ({
            transactionId: String(t.id),
            serviceTitle: t.listing?.title || t.serviceDescription.split(":")[0],
            completedAt: t.completedAt?.toISOString(),
            provider: {
              id: t.provider.id,
              businessName: t.provider.businessName,
            },
          })),
        });
      } catch (err: any) {
        console.error("Error fetching pending reviews:", err);
        return reply.code(500).send({
          error: "internal_error",
          message: "Failed to fetch pending reviews",
        });
      }
    }
  );
};

export default routes;
