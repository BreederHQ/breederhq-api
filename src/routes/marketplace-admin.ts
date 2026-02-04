// @ts-nocheck - Marketplace admin features temporarily disabled pending migration
// src/routes/marketplace-admin.ts
/**
 * Marketplace Admin Dashboard Routes
 *
 * Provides administrative oversight and moderation capabilities for the marketplace.
 * All endpoints require admin authentication (userType === "admin").
 *
 * Endpoints:
 *   Dashboard:
 *     GET    /admin/stats                    - Overall marketplace statistics
 *
 *   Provider Management:
 *     GET    /admin/providers                - List all providers (with filters)
 *     GET    /admin/providers/:id            - Get provider details
 *     POST   /admin/providers/:id/approve    - Approve pending provider
 *     POST   /admin/providers/:id/suspend    - Suspend provider
 *     POST   /admin/providers/:id/unsuspend  - Unsuspend provider
 *
 *   Listing Moderation:
 *     GET    /admin/listings                 - List all listings (with filters)
 *     GET    /admin/listings/:id             - Get listing details
 *     POST   /admin/listings/:id/unpublish   - Unpublish listing
 *     POST   /admin/listings/:id/remove      - Remove listing (soft delete)
 *
 *   Transaction Oversight:
 *     GET    /admin/transactions             - List all transactions
 *     GET    /admin/transactions/:id         - Get transaction details
 *     POST   /admin/transactions/:id/refund  - Admin-initiated refund
 *
 *   Review Moderation:
 *     GET    /admin/reviews                  - List all reviews (with filters)
 *     GET    /admin/reviews/:id              - Get review details
 *     POST   /admin/reviews/:id/flag         - Flag review
 *     POST   /admin/reviews/:id/remove       - Remove review
 *
 *   User Management:
 *     GET    /admin/users                    - List all users
 *     GET    /admin/users/:id                - Get user details
 *     POST   /admin/users/:id/suspend        - Suspend user
 *     POST   /admin/users/:id/unsuspend      - Unsuspend user
 *     POST   /admin/users/:id/make-admin     - Promote user to admin
 *
 *   Verification Queue:
 *     GET    /admin/verification-requests         - List verification requests
 *     GET    /admin/verification-requests/:id     - Get request details
 *     POST   /admin/verification-requests/:id/start-review - Start reviewing
 *     POST   /admin/verification-requests/:id/approve      - Approve request
 *     POST   /admin/verification-requests/:id/deny         - Deny request
 *     POST   /admin/verification-requests/:id/request-info - Request more info
 *     GET    /admin/verification-stats             - Queue statistics
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { requireAdmin } from "../middleware/marketplace-auth.js";
import prisma from "../prisma.js";
import { Decimal } from "@prisma/client/runtime/library";
import {
  getVerificationRequests,
  getVerificationRequestById,
  updateVerificationRequestStatus,
  requestMoreInfo,
} from "../services/marketplace-verification-service.js";
import type { VerificationRequestStatus } from "@prisma/client";

/**
 * Parse pagination parameters
 */
function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "25", 10) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export default async function marketplaceAdminRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /* ═══════════════════════════════════════════════════════════════════════════
   * DASHBOARD STATS
   * ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * GET /admin/stats - Overall marketplace statistics
   */
  app.get("/admin/stats", {
    preHandler: requireAdmin,
  }, async (req, reply) => {
    try {
      const [
        totalUsers,
        totalProviders,
        pendingProviders,
        activeProviders,
        suspendedProviders,
        totalListings,
        publishedListings,
        totalTransactions,
        completedTransactions,
        totalReviews,
        flaggedReviews,
        revenueResult,
      ] = await Promise.all([
        prisma.marketplaceUser.count(),
        prisma.marketplaceProvider.count(),
        prisma.marketplaceProvider.count({ where: { status: "pending" } }),
        prisma.marketplaceProvider.count({ where: { status: "active" } }),
        prisma.marketplaceProvider.count({ where: { status: "suspended" } }),
        prisma.mktListingProviderService.count({ where: { deletedAt: null } }),
        prisma.mktListingProviderService.count({ where: { status: "LIVE", deletedAt: null } }),
        prisma.marketplaceTransaction.count(),
        prisma.marketplaceTransaction.count({ where: { status: "completed" } }),
        prisma.marketplaceReview.count(),
        prisma.marketplaceReview.count({ where: { status: "flagged" } }),
        prisma.marketplaceTransaction.aggregate({
          where: { status: "completed" },
          _sum: { platformFeeCents: true, totalCents: true },
        }),
      ]);

      const totalRevenueCents = revenueResult._sum.totalCents || BigInt(0);
      const platformFeeCents = revenueResult._sum.platformFeeCents || BigInt(0);

      return reply.send({
        ok: true,
        stats: {
          users: { total: totalUsers },
          providers: {
            total: totalProviders,
            pending: pendingProviders,
            active: activeProviders,
            suspended: suspendedProviders,
          },
          listings: {
            total: totalListings,
            published: publishedListings,
          },
          transactions: {
            total: totalTransactions,
            completed: completedTransactions,
            totalRevenueCents: totalRevenueCents.toString(),
            platformFeeCents: platformFeeCents.toString(),
          },
          reviews: {
            total: totalReviews,
            flagged: flaggedReviews,
          },
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to fetch admin stats");
      return reply.code(500).send({ error: "stats_failed", message: "Failed to fetch statistics." });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * PROVIDER MANAGEMENT
   * ═══════════════════════════════════════════════════════════════════════════ */

  app.get("/admin/providers", { preHandler: requireAdmin }, async (req, reply) => {
    const query = req.query as any;
    const { page, limit, skip } = parsePaging(query);
    const status = query.status ? String(query.status).trim() : undefined;
    const search = query.search ? String(query.search).trim() : undefined;
    const providerType = query.providerType ? String(query.providerType).trim() : undefined;

    const where: any = {};
    if (status) where.status = status;
    if (providerType) where.providerType = providerType;
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    try {
      const [providers, total] = await Promise.all([
        prisma.marketplaceProvider.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        }),
        prisma.marketplaceProvider.count({ where }),
      ]);

      return reply.send({
        ok: true,
        providers: providers.map((p) => ({
          id: p.id,
          userId: p.userId,
          providerType: p.providerType,
          businessName: p.businessName,
          city: p.city,
          state: p.state,
          status: p.status,
          paymentMode: p.paymentMode,
          averageRating: p.averageRating.toString(),
          totalReviews: p.totalReviews,
          totalListings: p.totalListings,
          completedTransactions: p.completedTransactions,
          totalRevenueCents: p.totalRevenueCents.toString(),
          verifiedProvider: p.verifiedProvider,
          createdAt: p.createdAt.toISOString(),
          activatedAt: p.activatedAt?.toISOString() || null,
          suspendedAt: p.suspendedAt?.toISOString() || null,
          user: p.user,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to fetch providers");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch providers." });
    }
  });

  app.get("/admin/providers/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const providerId = parseInt((req.params as any).id, 10);
    if (isNaN(providerId)) return reply.code(400).send({ error: "invalid_provider_id" });

    try {
      const provider = await prisma.marketplaceProvider.findUnique({
        where: { id: providerId },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true } },
          listings: { where: { deletedAt: null }, take: 10, orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true, category: true, createdAt: true } },
        },
      });

      if (!provider) return reply.code(404).send({ error: "provider_not_found", message: "Provider not found." });

      return reply.send({
        ok: true,
        provider: {
          id: provider.id,
          userId: provider.userId,
          providerType: provider.providerType,
          businessName: provider.businessName,
          businessDescription: provider.businessDescription,
          logoUrl: provider.logoUrl,
          publicEmail: provider.publicEmail,
          publicPhone: provider.publicPhone,
          website: provider.website,
          city: provider.city,
          state: provider.state,
          zip: provider.zip,
          country: provider.country,
          paymentMode: provider.paymentMode,
          status: provider.status,
          averageRating: provider.averageRating.toString(),
          totalReviews: provider.totalReviews,
          totalListings: provider.totalListings,
          activeListings: provider.activeListings,
          totalTransactions: provider.totalTransactions,
          completedTransactions: provider.completedTransactions,
          totalRevenueCents: provider.totalRevenueCents.toString(),
          verifiedProvider: provider.verifiedProvider,
          premiumProvider: provider.premiumProvider,
          createdAt: provider.createdAt.toISOString(),
          activatedAt: provider.activatedAt?.toISOString() || null,
          suspendedAt: provider.suspendedAt?.toISOString() || null,
          suspendedReason: provider.suspendedReason,
          user: provider.user,
          recentListings: provider.listings,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err, providerId }, "Failed to fetch provider");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch provider." });
    }
  });

  app.post("/admin/providers/:id/approve", { preHandler: requireAdmin, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const providerId = parseInt((req.params as any).id, 10);
    if (isNaN(providerId)) return reply.code(400).send({ error: "invalid_provider_id" });

    try {
      const provider = await prisma.marketplaceProvider.findUnique({ where: { id: providerId }, select: { id: true, status: true } });
      if (!provider) return reply.code(404).send({ error: "provider_not_found", message: "Provider not found." });
      if (provider.status !== "pending") return reply.code(400).send({ error: "not_pending", message: "Provider is not in pending status." });

      await prisma.marketplaceProvider.update({ where: { id: providerId }, data: { status: "active", activatedAt: new Date() } });
      return reply.send({ ok: true, message: "Provider approved successfully." });
    } catch (err: any) {
      req.log?.error?.({ err, providerId }, "Failed to approve provider");
      return reply.code(500).send({ error: "approve_failed", message: "Failed to approve provider." });
    }
  });

  app.post("/admin/providers/:id/suspend", { preHandler: requireAdmin, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const providerId = parseInt((req.params as any).id, 10);
    const { reason } = req.body as { reason?: string };
    if (isNaN(providerId)) return reply.code(400).send({ error: "invalid_provider_id" });

    try {
      const provider = await prisma.marketplaceProvider.findUnique({ where: { id: providerId }, select: { id: true, status: true } });
      if (!provider) return reply.code(404).send({ error: "provider_not_found", message: "Provider not found." });
      if (provider.status === "suspended") return reply.code(400).send({ error: "already_suspended", message: "Provider is already suspended." });

      await prisma.marketplaceProvider.update({ where: { id: providerId }, data: { status: "suspended", suspendedAt: new Date(), suspendedReason: reason?.trim() || null } });
      return reply.send({ ok: true, message: "Provider suspended successfully." });
    } catch (err: any) {
      req.log?.error?.({ err, providerId }, "Failed to suspend provider");
      return reply.code(500).send({ error: "suspend_failed", message: "Failed to suspend provider." });
    }
  });

  app.post("/admin/providers/:id/unsuspend", { preHandler: requireAdmin, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const providerId = parseInt((req.params as any).id, 10);
    if (isNaN(providerId)) return reply.code(400).send({ error: "invalid_provider_id" });

    try {
      const provider = await prisma.marketplaceProvider.findUnique({ where: { id: providerId }, select: { id: true, status: true } });
      if (!provider) return reply.code(404).send({ error: "provider_not_found", message: "Provider not found." });
      if (provider.status !== "suspended") return reply.code(400).send({ error: "not_suspended", message: "Provider is not suspended." });

      await prisma.marketplaceProvider.update({ where: { id: providerId }, data: { status: "active", suspendedAt: null, suspendedReason: null } });
      return reply.send({ ok: true, message: "Provider unsuspended successfully." });
    } catch (err: any) {
      req.log?.error?.({ err, providerId }, "Failed to unsuspend provider");
      return reply.code(500).send({ error: "unsuspend_failed", message: "Failed to unsuspend provider." });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * LISTING MODERATION
   * ═══════════════════════════════════════════════════════════════════════════ */

  app.get("/admin/listings", { preHandler: requireAdmin }, async (req, reply) => {
    const query = req.query as any;
    const { page, limit, skip } = parsePaging(query);
    const status = query.status ? String(query.status).trim() : undefined;
    const category = query.category ? String(query.category).trim() : undefined;
    const search = query.search ? String(query.search).trim() : undefined;

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { provider: { businessName: { contains: search, mode: "insensitive" } } },
      ];
    }

    try {
      const [listings, total] = await Promise.all([
        prisma.mktListingProviderService.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { provider: { select: { id: true, businessName: true, status: true } } },
        }),
        prisma.mktListingProviderService.count({ where }),
      ]);

      return reply.send({
        ok: true,
        listings: listings.map((l) => ({
          id: l.id,
          slug: l.slug,
          title: l.title,
          description: l.description?.slice(0, 200) || null,
          category: l.category,
          priceCents: l.priceCents?.toString() || null,
          city: l.city,
          state: l.state,
          status: l.status,
          viewCount: l.viewCount,
          publishedAt: l.publishedAt?.toISOString() || null,
          createdAt: l.createdAt.toISOString(),
          provider: l.provider,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to fetch listings");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch listings." });
    }
  });

  app.get("/admin/listings/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const listingId = parseInt((req.params as any).id, 10);
    if (isNaN(listingId)) return reply.code(400).send({ error: "invalid_listing_id" });

    try {
      const listing = await prisma.mktListingProviderService.findUnique({
        where: { id: listingId },
        include: { provider: { select: { id: true, businessName: true, status: true, user: { select: { id: true, email: true } } } } },
      });

      if (!listing) return reply.code(404).send({ error: "listing_not_found", message: "Listing not found." });

      return reply.send({
        ok: true,
        listing: {
          id: listing.id,
          slug: listing.slug,
          providerId: listing.providerId,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          subcategory: listing.subcategory,
          priceCents: listing.priceCents?.toString() || null,
          priceType: listing.priceType,
          priceText: listing.priceText,
          images: listing.images,
          coverImageUrl: listing.coverImageUrl,
          city: listing.city,
          state: listing.state,
          zip: listing.zip,
          status: listing.status,
          viewCount: listing.viewCount,
          publishedAt: listing.publishedAt?.toISOString() || null,
          createdAt: listing.createdAt.toISOString(),
          updatedAt: listing.updatedAt.toISOString(),
          deletedAt: listing.deletedAt?.toISOString() || null,
          provider: listing.provider,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err, listingId }, "Failed to fetch listing");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch listing." });
    }
  });

  app.post("/admin/listings/:id/unpublish", { preHandler: requireAdmin, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const listingId = parseInt((req.params as any).id, 10);
    if (isNaN(listingId)) return reply.code(400).send({ error: "invalid_listing_id" });

    try {
      await prisma.mktListingProviderService.update({ where: { id: listingId }, data: { status: "DRAFT", publishedAt: null } });
      return reply.send({ ok: true, message: "Listing unpublished successfully." });
    } catch (err: any) {
      req.log?.error?.({ err, listingId }, "Failed to unpublish listing");
      return reply.code(500).send({ error: "unpublish_failed", message: "Failed to unpublish listing." });
    }
  });

  app.post("/admin/listings/:id/remove", { preHandler: requireAdmin, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const listingId = parseInt((req.params as any).id, 10);
    if (isNaN(listingId)) return reply.code(400).send({ error: "invalid_listing_id" });

    try {
      await prisma.mktListingProviderService.update({ where: { id: listingId }, data: { status: "DRAFT", deletedAt: new Date() } });
      return reply.send({ ok: true, message: "Listing removed successfully." });
    } catch (err: any) {
      req.log?.error?.({ err, listingId }, "Failed to remove listing");
      return reply.code(500).send({ error: "remove_failed", message: "Failed to remove listing." });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * TRANSACTION OVERSIGHT
   * ═══════════════════════════════════════════════════════════════════════════ */

  app.get("/admin/transactions", { preHandler: requireAdmin }, async (req, reply) => {
    const query = req.query as any;
    const { page, limit, skip } = parsePaging(query);
    const status = query.status ? String(query.status).trim() : undefined;
    const search = query.search ? String(query.search).trim() : undefined;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { serviceDescription: { contains: search, mode: "insensitive" } },
        { client: { email: { contains: search, mode: "insensitive" } } },
        { provider: { businessName: { contains: search, mode: "insensitive" } } },
      ];
    }

    try {
      const [transactions, total] = await Promise.all([
        prisma.marketplaceTransaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            client: { select: { id: true, email: true, firstName: true, lastName: true } },
            provider: { select: { id: true, businessName: true } },
            listing: { select: { id: true, title: true } },
          },
        }),
        prisma.marketplaceTransaction.count({ where }),
      ]);

      return reply.send({
        ok: true,
        transactions: transactions.map((t) => ({
          id: t.id.toString(),
          clientId: t.clientId,
          providerId: t.providerId,
          listingId: t.listingId,
          serviceDescription: t.serviceDescription.slice(0, 100),
          servicePriceCents: t.servicePriceCents.toString(),
          platformFeeCents: t.platformFeeCents.toString(),
          totalCents: t.totalCents.toString(),
          status: t.status,
          createdAt: t.createdAt.toISOString(),
          paidAt: t.paidAt?.toISOString() || null,
          completedAt: t.completedAt?.toISOString() || null,
          client: t.client,
          provider: t.provider,
          listing: t.listing,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to fetch transactions");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch transactions." });
    }
  });

  app.get("/admin/transactions/:id", { preHandler: requireAdmin }, async (req, reply) => {
    let transactionId: bigint;
    try {
      transactionId = BigInt((req.params as any).id);
    } catch {
      return reply.code(400).send({ error: "invalid_transaction_id" });
    }

    try {
      const transaction = await prisma.marketplaceTransaction.findUnique({
        where: { id: transactionId },
        include: {
          client: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
          provider: { select: { id: true, businessName: true, paymentMode: true, user: { select: { email: true } } } },
          listing: { select: { id: true, title: true, slug: true } },
          review: { select: { id: true, rating: true, title: true, status: true } },
        },
      });

      if (!transaction) return reply.code(404).send({ error: "transaction_not_found", message: "Transaction not found." });

      return reply.send({
        ok: true,
        transaction: {
          id: transaction.id.toString(),
          clientId: transaction.clientId,
          providerId: transaction.providerId,
          listingId: transaction.listingId,
          serviceDescription: transaction.serviceDescription,
          serviceNotes: transaction.serviceNotes,
          servicePriceCents: transaction.servicePriceCents.toString(),
          platformFeeCents: transaction.platformFeeCents.toString(),
          stripeFeesCents: transaction.stripeFeesCents.toString(),
          totalCents: transaction.totalCents.toString(),
          status: transaction.status,
          cancellationReason: transaction.cancellationReason,
          createdAt: transaction.createdAt.toISOString(),
          paidAt: transaction.paidAt?.toISOString() || null,
          startedAt: transaction.startedAt?.toISOString() || null,
          completedAt: transaction.completedAt?.toISOString() || null,
          cancelledAt: transaction.cancelledAt?.toISOString() || null,
          refundedAt: transaction.refundedAt?.toISOString() || null,
          client: transaction.client,
          provider: transaction.provider,
          listing: transaction.listing,
          review: transaction.review,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to fetch transaction");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch transaction." });
    }
  });

  app.post("/admin/transactions/:id/refund", { preHandler: requireAdmin, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    let transactionId: bigint;
    try {
      transactionId = BigInt((req.params as any).id);
    } catch {
      return reply.code(400).send({ error: "invalid_transaction_id" });
    }
    const { reason } = req.body as { reason?: string };

    try {
      const transaction = await prisma.marketplaceTransaction.findUnique({ where: { id: transactionId }, select: { id: true, status: true } });
      if (!transaction) return reply.code(404).send({ error: "transaction_not_found", message: "Transaction not found." });
      if (transaction.status === "refunded") return reply.code(400).send({ error: "already_refunded", message: "Transaction has already been refunded." });
      if (transaction.status !== "paid" && transaction.status !== "completed") return reply.code(400).send({ error: "cannot_refund", message: "Only paid or completed transactions can be refunded." });

      await prisma.marketplaceTransaction.update({
        where: { id: transactionId },
        data: { status: "refunded", refundedAt: new Date(), cancellationReason: reason?.trim() || "Admin-initiated refund" },
      });

      return reply.send({ ok: true, message: "Transaction refunded successfully." });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to refund transaction");
      return reply.code(500).send({ error: "refund_failed", message: "Failed to refund transaction." });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * REVIEW MODERATION
   * ═══════════════════════════════════════════════════════════════════════════ */

  app.get("/admin/reviews", { preHandler: requireAdmin }, async (req, reply) => {
    const query = req.query as any;
    const { page, limit, skip } = parsePaging(query);
    const status = query.status ? String(query.status).trim() : undefined;

    const where: any = {};
    if (status) where.status = status;

    try {
      const [reviews, total] = await Promise.all([
        prisma.marketplaceReview.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            client: { select: { id: true, email: true, firstName: true, lastName: true } },
            provider: { select: { id: true, businessName: true } },
            listing: { select: { id: true, title: true } },
          },
        }),
        prisma.marketplaceReview.count({ where }),
      ]);

      return reply.send({
        ok: true,
        reviews: reviews.map((r) => ({
          id: r.id,
          transactionId: r.transactionId.toString(),
          providerId: r.providerId,
          clientId: r.clientId,
          rating: r.rating,
          title: r.title,
          reviewText: r.reviewText?.slice(0, 200) || null,
          providerResponse: r.providerResponse?.slice(0, 200) || null,
          status: r.status,
          flaggedReason: r.flaggedReason,
          createdAt: r.createdAt.toISOString(),
          client: r.client,
          provider: r.provider,
          listing: r.listing,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to fetch reviews");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch reviews." });
    }
  });

  app.get("/admin/reviews/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const reviewId = parseInt((req.params as any).id, 10);
    if (isNaN(reviewId)) return reply.code(400).send({ error: "invalid_review_id" });

    try {
      const review = await prisma.marketplaceReview.findUnique({
        where: { id: reviewId },
        include: {
          client: { select: { id: true, email: true, firstName: true, lastName: true } },
          provider: { select: { id: true, businessName: true } },
          listing: { select: { id: true, title: true, slug: true } },
        },
      });

      if (!review) return reply.code(404).send({ error: "review_not_found", message: "Review not found." });

      return reply.send({
        ok: true,
        review: {
          id: review.id,
          transactionId: review.transactionId.toString(),
          providerId: review.providerId,
          clientId: review.clientId,
          rating: review.rating,
          title: review.title,
          reviewText: review.reviewText,
          providerResponse: review.providerResponse,
          status: review.status,
          flaggedReason: review.flaggedReason,
          createdAt: review.createdAt.toISOString(),
          respondedAt: review.respondedAt?.toISOString() || null,
          client: review.client,
          provider: review.provider,
          listing: review.listing,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err, reviewId }, "Failed to fetch review");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch review." });
    }
  });

  app.post("/admin/reviews/:id/flag", { preHandler: requireAdmin, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const reviewId = parseInt((req.params as any).id, 10);
    const { reason } = req.body as { reason?: string };
    if (isNaN(reviewId)) return reply.code(400).send({ error: "invalid_review_id" });

    try {
      await prisma.marketplaceReview.update({ where: { id: reviewId }, data: { status: "flagged", flaggedReason: reason?.trim() || "Flagged by admin" } });
      return reply.send({ ok: true, message: "Review flagged successfully." });
    } catch (err: any) {
      req.log?.error?.({ err, reviewId }, "Failed to flag review");
      return reply.code(500).send({ error: "flag_failed", message: "Failed to flag review." });
    }
  });

  app.post("/admin/reviews/:id/remove", { preHandler: requireAdmin, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const reviewId = parseInt((req.params as any).id, 10);
    const { reason } = req.body as { reason?: string };
    if (isNaN(reviewId)) return reply.code(400).send({ error: "invalid_review_id" });

    try {
      const review = await prisma.marketplaceReview.findUnique({ where: { id: reviewId }, select: { providerId: true, rating: true, status: true } });
      if (!review) return reply.code(404).send({ error: "review_not_found", message: "Review not found." });

      // Update provider stats if review was published
      if (review.status === "published") {
        const provider = await prisma.marketplaceProvider.findUnique({ where: { id: review.providerId }, select: { averageRating: true, totalReviews: true } });
        if (provider && provider.totalReviews > 0) {
          const currentTotal = provider.averageRating.toNumber() * provider.totalReviews;
          const newCount = provider.totalReviews - 1;
          const newAverage = newCount > 0 ? (currentTotal - review.rating) / newCount : 0;
          await prisma.marketplaceProvider.update({ where: { id: review.providerId }, data: { averageRating: new Decimal(newAverage.toFixed(2)), totalReviews: newCount } });
        }
      }

      await prisma.marketplaceReview.update({ where: { id: reviewId }, data: { status: "removed", flaggedReason: reason?.trim() || "Removed by admin" } });
      return reply.send({ ok: true, message: "Review removed successfully." });
    } catch (err: any) {
      req.log?.error?.({ err, reviewId }, "Failed to remove review");
      return reply.code(500).send({ error: "remove_failed", message: "Failed to remove review." });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * USER MANAGEMENT
   * ═══════════════════════════════════════════════════════════════════════════ */

  app.get("/admin/users", { preHandler: requireAdmin }, async (req, reply) => {
    const query = req.query as any;
    const { page, limit, skip } = parsePaging(query);
    const userType = query.userType ? String(query.userType).trim() : undefined;
    const search = query.search ? String(query.search).trim() : undefined;

    const where: any = {};
    if (userType) where.userType = userType;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }

    try {
      const [users, total] = await Promise.all([
        prisma.marketplaceUser.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            userType: true,
            emailVerified: true,
            status: true,
            createdAt: true,
            provider: { select: { id: true, businessName: true, status: true } },
          },
        }),
        prisma.marketplaceUser.count({ where }),
      ]);

      return reply.send({
        ok: true,
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
          userType: u.userType,
          emailVerified: u.emailVerified,
          status: u.status,
          createdAt: u.createdAt.toISOString(),
          provider: u.provider,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to fetch users");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch users." });
    }
  });

  app.get("/admin/users/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const userId = parseInt((req.params as any).id, 10);
    if (isNaN(userId)) return reply.code(400).send({ error: "invalid_user_id" });

    try {
      const user = await prisma.marketplaceUser.findUnique({
        where: { id: userId },
        include: { provider: { select: { id: true, businessName: true, status: true, totalReviews: true, averageRating: true } } },
      });

      if (!user) return reply.code(404).send({ error: "user_not_found", message: "User not found." });

      return reply.send({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          city: user.city,
          state: user.state,
          zip: user.zip,
          country: user.country,
          userType: user.userType,
          emailVerified: user.emailVerified,
          status: user.status,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          provider: user.provider ? { ...user.provider, averageRating: user.provider.averageRating.toString() } : null,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err, userId }, "Failed to fetch user");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch user." });
    }
  });

  app.post("/admin/users/:id/suspend", { preHandler: requireAdmin, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const userId = parseInt((req.params as any).id, 10);
    if (isNaN(userId)) return reply.code(400).send({ error: "invalid_user_id" });

    try {
      const user = await prisma.marketplaceUser.findUnique({ where: { id: userId }, select: { id: true, status: true, userType: true } });
      if (!user) return reply.code(404).send({ error: "user_not_found", message: "User not found." });
      if (user.userType === "admin") return reply.code(400).send({ error: "cannot_suspend_admin", message: "Cannot suspend admin users." });
      if (user.status === "suspended") return reply.code(400).send({ error: "already_suspended", message: "User is already suspended." });

      await prisma.marketplaceUser.update({ where: { id: userId }, data: { status: "suspended" } });
      return reply.send({ ok: true, message: "User suspended successfully." });
    } catch (err: any) {
      req.log?.error?.({ err, userId }, "Failed to suspend user");
      return reply.code(500).send({ error: "suspend_failed", message: "Failed to suspend user." });
    }
  });

  app.post("/admin/users/:id/unsuspend", { preHandler: requireAdmin, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const userId = parseInt((req.params as any).id, 10);
    if (isNaN(userId)) return reply.code(400).send({ error: "invalid_user_id" });

    try {
      const user = await prisma.marketplaceUser.findUnique({ where: { id: userId }, select: { id: true, status: true } });
      if (!user) return reply.code(404).send({ error: "user_not_found", message: "User not found." });
      if (user.status !== "suspended") return reply.code(400).send({ error: "not_suspended", message: "User is not suspended." });

      await prisma.marketplaceUser.update({ where: { id: userId }, data: { status: "active" } });
      return reply.send({ ok: true, message: "User unsuspended successfully." });
    } catch (err: any) {
      req.log?.error?.({ err, userId }, "Failed to unsuspend user");
      return reply.code(500).send({ error: "unsuspend_failed", message: "Failed to unsuspend user." });
    }
  });

  app.post("/admin/users/:id/make-admin", { preHandler: requireAdmin, config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
    const userId = parseInt((req.params as any).id, 10);
    if (isNaN(userId)) return reply.code(400).send({ error: "invalid_user_id" });

    try {
      const user = await prisma.marketplaceUser.findUnique({ where: { id: userId }, select: { id: true, userType: true } });
      if (!user) return reply.code(404).send({ error: "user_not_found", message: "User not found." });
      if (user.userType === "admin") return reply.code(400).send({ error: "already_admin", message: "User is already an admin." });

      await prisma.marketplaceUser.update({ where: { id: userId }, data: { userType: "admin" } });
      return reply.send({ ok: true, message: "User promoted to admin successfully." });
    } catch (err: any) {
      req.log?.error?.({ err, userId }, "Failed to promote user");
      return reply.code(500).send({ error: "promote_failed", message: "Failed to promote user." });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * VERIFICATION REQUEST QUEUE (Admin Review)
   * ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * GET /admin/verification-requests - List all verification requests
   * Query params:
   *   - status: PENDING | IN_REVIEW | NEEDS_INFO | APPROVED | DENIED
   *   - userType: BREEDER | SERVICE_PROVIDER
   *   - page, limit
   */
  app.get("/admin/verification-requests", { preHandler: requireAdmin }, async (req, reply) => {
    const query = req.query as any;
    const { page, limit, skip } = parsePaging(query);
    const status = query.status ? String(query.status).trim() as VerificationRequestStatus : undefined;
    const userType = query.userType ? String(query.userType).trim() as "BREEDER" | "SERVICE_PROVIDER" : undefined;

    try {
      const { requests, total } = await getVerificationRequests({
        status,
        userType,
        limit,
        offset: skip,
      });

      return reply.send({
        ok: true,
        requests: requests.map((r: any) => ({
          id: r.id,
          userType: r.userType,
          packageType: r.packageType,
          requestedTier: r.requestedTier,
          status: r.status,
          amountPaidCents: r.amountPaidCents,
          createdAt: r.createdAt.toISOString(),
          reviewedAt: r.reviewedAt?.toISOString() || null,
          infoRequestedAt: r.infoRequestedAt?.toISOString() || null,
          provider: r.provider ? {
            id: r.provider.id,
            businessName: r.provider.businessName,
            publicEmail: r.provider.publicEmail,
            user: r.provider.user,
          } : null,
          marketplaceUser: r.marketplaceUser ? {
            id: r.marketplaceUser.id,
            email: r.marketplaceUser.email,
            firstName: r.marketplaceUser.firstName,
            lastName: r.marketplaceUser.lastName,
          } : null,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to fetch verification requests");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch verification requests." });
    }
  });

  /**
   * GET /admin/verification-requests/:id - Get single verification request details
   */
  app.get("/admin/verification-requests/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const requestId = parseInt((req.params as any).id, 10);
    if (isNaN(requestId)) return reply.code(400).send({ error: "invalid_request_id" });

    try {
      const request = await getVerificationRequestById(requestId);

      if (!request) {
        return reply.code(404).send({ error: "request_not_found", message: "Verification request not found." });
      }

      return reply.send({
        ok: true,
        request: {
          id: request.id,
          userType: request.userType,
          packageType: request.packageType,
          requestedTier: request.requestedTier,
          status: request.status,
          submittedInfo: request.submittedInfo,
          amountPaidCents: request.amountPaidCents,
          paymentIntentId: request.paymentIntentId,
          createdAt: request.createdAt.toISOString(),
          reviewedAt: request.reviewedAt?.toISOString() || null,
          reviewedBy: request.reviewedBy,
          reviewNotes: request.reviewNotes,
          infoRequestedAt: request.infoRequestedAt?.toISOString() || null,
          infoRequestNote: request.infoRequestNote,
          infoProvidedAt: request.infoProvidedAt?.toISOString() || null,
          provider: (request as any).provider || null,
          marketplaceUser: (request as any).marketplaceUser || null,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err, requestId }, "Failed to fetch verification request");
      return reply.code(500).send({ error: "fetch_failed", message: "Failed to fetch verification request." });
    }
  });

  /**
   * POST /admin/verification-requests/:id/start-review - Mark request as being reviewed
   */
  app.post("/admin/verification-requests/:id/start-review", {
    preHandler: requireAdmin,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const requestId = parseInt((req.params as any).id, 10);
    const adminUserId = req.marketplaceUserId!;
    if (isNaN(requestId)) return reply.code(400).send({ error: "invalid_request_id" });

    try {
      const updated = await updateVerificationRequestStatus(requestId, "IN_REVIEW", adminUserId);

      if (!updated) {
        return reply.code(404).send({ error: "request_not_found", message: "Verification request not found." });
      }

      return reply.send({ ok: true, message: "Review started." });
    } catch (err: any) {
      req.log?.error?.({ err, requestId }, "Failed to start review");
      return reply.code(500).send({ error: "update_failed", message: "Failed to start review." });
    }
  });

  /**
   * POST /admin/verification-requests/:id/approve - Approve verification request
   */
  app.post("/admin/verification-requests/:id/approve", {
    preHandler: requireAdmin,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const requestId = parseInt((req.params as any).id, 10);
    const adminUserId = req.marketplaceUserId!;
    const { notes } = (req.body || {}) as { notes?: string };
    if (isNaN(requestId)) return reply.code(400).send({ error: "invalid_request_id" });

    try {
      const updated = await updateVerificationRequestStatus(requestId, "APPROVED", adminUserId, notes);

      if (!updated) {
        return reply.code(404).send({ error: "request_not_found", message: "Verification request not found." });
      }

      return reply.send({ ok: true, message: "Verification approved successfully." });
    } catch (err: any) {
      req.log?.error?.({ err, requestId }, "Failed to approve verification");
      return reply.code(500).send({ error: "approve_failed", message: "Failed to approve verification." });
    }
  });

  /**
   * POST /admin/verification-requests/:id/deny - Deny verification request
   */
  app.post("/admin/verification-requests/:id/deny", {
    preHandler: requireAdmin,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const requestId = parseInt((req.params as any).id, 10);
    const adminUserId = req.marketplaceUserId!;
    const { notes } = (req.body || {}) as { notes?: string };
    if (isNaN(requestId)) return reply.code(400).send({ error: "invalid_request_id" });

    if (!notes) {
      return reply.code(400).send({ error: "notes_required", message: "Denial reason is required." });
    }

    try {
      const updated = await updateVerificationRequestStatus(requestId, "DENIED", adminUserId, notes);

      if (!updated) {
        return reply.code(404).send({ error: "request_not_found", message: "Verification request not found." });
      }

      return reply.send({ ok: true, message: "Verification denied." });
    } catch (err: any) {
      req.log?.error?.({ err, requestId }, "Failed to deny verification");
      return reply.code(500).send({ error: "deny_failed", message: "Failed to deny verification." });
    }
  });

  /**
   * POST /admin/verification-requests/:id/request-info - Request more information
   */
  app.post("/admin/verification-requests/:id/request-info", {
    preHandler: requireAdmin,
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const requestId = parseInt((req.params as any).id, 10);
    const adminUserId = req.marketplaceUserId!;
    const { note } = (req.body || {}) as { note?: string };
    if (isNaN(requestId)) return reply.code(400).send({ error: "invalid_request_id" });

    if (!note) {
      return reply.code(400).send({ error: "note_required", message: "Please specify what information is needed." });
    }

    try {
      const updated = await requestMoreInfo(requestId, adminUserId, note);

      if (!updated) {
        return reply.code(404).send({ error: "request_not_found", message: "Verification request not found." });
      }

      return reply.send({ ok: true, message: "Information requested from user." });
    } catch (err: any) {
      req.log?.error?.({ err, requestId }, "Failed to request info");
      return reply.code(500).send({ error: "request_info_failed", message: "Failed to request more information." });
    }
  });

  /**
   * GET /admin/verification-stats - Verification queue statistics
   */
  app.get("/admin/verification-stats", { preHandler: requireAdmin }, async (req, reply) => {
    try {
      const [
        totalPending,
        totalInReview,
        totalNeedsInfo,
        totalApproved,
        totalDenied,
        breederPending,
        servicePending,
      ] = await Promise.all([
        prisma.verificationRequest.count({ where: { status: "PENDING" } }),
        prisma.verificationRequest.count({ where: { status: "IN_REVIEW" } }),
        prisma.verificationRequest.count({ where: { status: "NEEDS_INFO" } }),
        prisma.verificationRequest.count({ where: { status: "APPROVED" } }),
        prisma.verificationRequest.count({ where: { status: "DENIED" } }),
        prisma.verificationRequest.count({ where: { status: "PENDING", userType: "BREEDER" } }),
        prisma.verificationRequest.count({ where: { status: "PENDING", userType: "SERVICE_PROVIDER" } }),
      ]);

      return reply.send({
        ok: true,
        stats: {
          queue: {
            pending: totalPending,
            inReview: totalInReview,
            needsInfo: totalNeedsInfo,
          },
          completed: {
            approved: totalApproved,
            denied: totalDenied,
          },
          pendingByType: {
            breeder: breederPending,
            serviceProvider: servicePending,
          },
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to fetch verification stats");
      return reply.code(500).send({ error: "stats_failed", message: "Failed to fetch verification statistics." });
    }
  });
}
