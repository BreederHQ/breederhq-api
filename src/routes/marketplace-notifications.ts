// src/routes/marketplace-notifications.ts
/**
 * Marketplace Notification Counts Routes
 *
 * Aggregated notification counts for the notification badge.
 *
 * Endpoints:
 *   GET /notifications/counts - Get aggregated notification counts
 *
 * All endpoints require authenticated MarketplaceUser.
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { requireMarketplaceAuth } from "../middleware/marketplace-auth.js";
import prisma from "../prisma.js";

export default async function marketplaceNotificationsRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /**
   * GET /notifications/counts - Get aggregated notification counts
   *
   * Returns counts for:
   *   - unreadMessages: Unread message threads
   *   - pendingReviews: Completed transactions without reviews
   *   - total: Sum of all notification types
   *
   * For providers, also includes:
   *   - pendingTransactions: Transactions awaiting provider action
   *   - newInquiries: Message threads provider hasn't responded to
   */
  app.get("/notifications/counts", {
    preHandler: requireMarketplaceAuth,
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = (req as any).marketplaceUserId;

    try {
      // Get user and check if they're a provider
      const user = await prisma.marketplaceUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          userType: true,
          provider: { select: { id: true } },
        },
      });

      if (!user) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const isProvider = user.userType === "provider" && user.provider;
      const providerId = user.provider?.id;

      // Count unread message threads (as client/buyer)
      // A thread is "unread" if:
      // - User is the client
      // - There are messages after the last time user viewed the thread
      const unreadMessagesPromise = prisma.marketplaceMessageThread.count({
        where: {
          clientId: userId,
          status: "active",
          messages: {
            some: {
              senderId: { not: userId },
              // We'd ideally check against lastReadAt, but for simplicity,
              // count threads with recent messages from the other party
            },
          },
        },
      });

      // Count pending reviews (completed transactions without a review)
      const pendingReviewsPromise = prisma.marketplaceTransaction.count({
        where: {
          clientId: userId,
          status: "completed",
          review: null,
        },
      });

      // For providers: count transactions needing action
      let pendingTransactionsPromise: Promise<number> = Promise.resolve(0);
      let newInquiriesPromise: Promise<number> = Promise.resolve(0);

      if (isProvider && providerId) {
        // Transactions awaiting provider action:
        // - "pending" (new booking)
        // - paid but not started/completed
        pendingTransactionsPromise = prisma.marketplaceTransaction.count({
          where: {
            providerId,
            status: { in: ["pending", "paid"] },
          },
        });

        // New inquiries: message threads from clients that provider hasn't responded to
        newInquiriesPromise = prisma.marketplaceMessageThread.count({
          where: {
            providerId,
            status: "active",
            messages: {
              every: {
                senderId: { not: providerId },
              },
            },
          },
        });
      }

      const [unreadMessages, pendingReviews, pendingTransactions, newInquiries] = await Promise.all([
        unreadMessagesPromise,
        pendingReviewsPromise,
        pendingTransactionsPromise,
        newInquiriesPromise,
      ]);

      const counts: any = {
        unreadMessages,
        pendingReviews,
      };

      if (isProvider) {
        counts.pendingTransactions = pendingTransactions;
        counts.newInquiries = newInquiries;
      }

      counts.total = unreadMessages + pendingReviews + pendingTransactions + newInquiries;

      return reply.send({
        ok: true,
        counts,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to fetch notification counts");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch notification counts." });
    }
  });
}
