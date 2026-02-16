// src/routes/admin-marketplace.ts
// Admin-only endpoints for marketplace user management (flagged users, suspension, settings)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";
import {
  getFlaggedUsers,
  getUserFlag,
  suspendUser,
  unsuspendUser,
  clearFlaggedStatus,
  getAbuseSettings,
  updateAbuseSettings,
  type FlaggedUserStatus,
  type MarketplaceAbuseSettings,
} from "../services/marketplace-flag.js";
import { getUserBlockHistory } from "../services/marketplace-block.js";
import type { MarketplaceListingPaymentSettings } from "../services/listing-payment-service.js";
import {
  getListingPaymentSettings,
  updateListingPaymentSettings,
} from "../services/listing-payment-service.js";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Require the current user to be a super admin
 * Returns the actor ID if authorized, or sends error response and returns null
 */
async function requireSuperAdmin(req: any, reply: any): Promise<string | null> {
  const actorId = getActorId(req);
  if (!actorId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { isSuperAdmin: true },
  });

  if (!actor?.isSuperAdmin) {
    reply.code(403).send({ error: "forbidden", message: "Super admin access required" });
    return null;
  }

  return actorId;
}

// ============================================================================
// Routes
// ============================================================================

const adminMarketplaceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /admin/marketplace/metrics
  // Get marketplace overview metrics for admin dashboard
  // --------------------------------------------------------------------------
  app.get("/admin/marketplace/metrics", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      // Calculate date 30 days ago for "recent" counts
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        totalUsers,
        totalProviders,
        totalProviderListings,
        totalBreedingListings,
        totalAnimalListings,
        termsAcceptedCount,
        recentSignups,
        recentProviders,
      ] = await Promise.all([
        // Total marketplace users
        prisma.marketplaceUser.count(),
        // Total service providers
        prisma.marketplaceProvider.count(),
        // Total breeder service listings (from marketplace providers and breeders)
        prisma.mktListingBreederService.count({ where: { deletedAt: null } }),
        // Total breeding booking listings (no deletedAt field on this model)
        prisma.mktListingBreedingBooking.count(),
        // Total individual animal listings (no deletedAt field on this model)
        prisma.mktListingIndividualAnimal.count(),
        // Total provider terms acceptances
        prisma.marketplaceProviderTermsAcceptance.count(),
        // Recent signups (last 30 days)
        prisma.marketplaceUser.count({
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),
        // Recent providers (last 30 days)
        prisma.marketplaceProvider.count({
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),
      ]);

      return reply.send({
        totalUsers,
        totalProviders,
        totalProviderListings,
        totalBreedingListings,
        totalAnimalListings,
        termsAcceptedCount,
        recentSignups,
        recentProviders,
      });
    } catch (err: any) {
      console.error("[admin/marketplace/metrics] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // GET /admin/marketplace/flagged-users
  // Get paginated list of flagged/suspended marketplace users
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: {
      status?: FlaggedUserStatus;
      page?: string;
      limit?: string;
    };
  }>("/admin/marketplace/flagged-users", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const q = req.query;
      const status = (q.status as FlaggedUserStatus) || "all";
      const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "25", 10) || 25));

      const result = await getFlaggedUsers({ status, page, limit });

      return reply.send({
        items: result.items.map((f) => ({
          id: f.id,
          userId: f.userId,
          email: f.user.email,
          name: f.user.name || `${f.user.firstName} ${f.user.lastName}`.trim(),
          totalBlocks: f.totalBlocks,
          activeBlocks: f.activeBlocks,
          lightBlocks: f.lightBlocks,
          mediumBlocks: f.mediumBlocks,
          heavyBlocks: f.heavyBlocks,
          totalApprovals: f.totalApprovals,
          totalRejections: f.totalRejections,
          flaggedAt: f.flaggedAt?.toISOString() ?? null,
          flagReason: f.flagReason,
          suspendedAt: f.suspendedAt?.toISOString() ?? null,
          suspendedReason: f.suspendedReason,
          updatedAt: f.updatedAt.toISOString(),
        })),
        total: result.total,
        page,
        limit,
      });
    } catch (err: any) {
      console.error("[admin/marketplace/flagged-users] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // GET /admin/marketplace/users/:userId
  // Get detailed flag info and block history for a specific user
  // --------------------------------------------------------------------------
  app.get<{
    Params: { userId: string };
  }>("/admin/marketplace/users/:userId", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const { userId } = req.params;

      const flag = await getUserFlag(userId);
      const blockHistory = await getUserBlockHistory(userId);

      // Get tenant names for block history
      const tenantIds = [...new Set(blockHistory.map((b) => b.tenantId))];
      const tenants = await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true, slug: true },
      });
      const tenantMap = new Map(tenants.map((t) => [t.id, t]));

      return reply.send({
        flag: flag
          ? {
              id: flag.id,
              userId: flag.userId,
              email: flag.user.email,
              name: flag.user.name || `${flag.user.firstName} ${flag.user.lastName}`.trim(),
              totalBlocks: flag.totalBlocks,
              activeBlocks: flag.activeBlocks,
              lightBlocks: flag.lightBlocks,
              mediumBlocks: flag.mediumBlocks,
              heavyBlocks: flag.heavyBlocks,
              totalApprovals: flag.totalApprovals,
              totalRejections: flag.totalRejections,
              flaggedAt: flag.flaggedAt?.toISOString() ?? null,
              flagReason: flag.flagReason,
              suspendedAt: flag.suspendedAt?.toISOString() ?? null,
              suspendedReason: flag.suspendedReason,
              updatedAt: flag.updatedAt.toISOString(),
            }
          : null,
        blockHistory: blockHistory.map((b) => {
          const tenant = tenantMap.get(b.tenantId);
          return {
            id: b.id,
            tenantId: b.tenantId,
            tenantName: tenant?.name ?? null,
            tenantSlug: tenant?.slug ?? null,
            level: b.level,
            reason: b.reason,
            createdAt: b.createdAt.toISOString(),
            liftedAt: b.liftedAt?.toISOString() ?? null,
          };
        }),
      });
    } catch (err: any) {
      console.error("[admin/marketplace/users/:userId] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /admin/marketplace/users/:userId/suspend
  // Suspend a marketplace user
  // --------------------------------------------------------------------------
  app.post<{
    Params: { userId: string };
    Body: { reason: string };
  }>("/admin/marketplace/users/:userId/suspend", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const { userId } = req.params;
      const { reason } = req.body ?? {};

      if (!reason || typeof reason !== "string" || !reason.trim()) {
        return reply.code(400).send({ error: "reason_required" });
      }

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        return reply.code(404).send({ error: "user_not_found" });
      }

      await suspendUser(userId, reason.trim());

      return reply.send({ success: true });
    } catch (err: any) {
      console.error("[admin/marketplace/users/:userId/suspend] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /admin/marketplace/users/:userId/unsuspend
  // Unsuspend a marketplace user
  // --------------------------------------------------------------------------
  app.post<{
    Params: { userId: string };
  }>("/admin/marketplace/users/:userId/unsuspend", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const { userId } = req.params;

      await unsuspendUser(userId);

      return reply.send({ success: true });
    } catch (err: any) {
      console.error("[admin/marketplace/users/:userId/unsuspend] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /admin/marketplace/users/:userId/clear-flag
  // Clear the flagged status for a user (keep historical data)
  // --------------------------------------------------------------------------
  app.post<{
    Params: { userId: string };
  }>("/admin/marketplace/users/:userId/clear-flag", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const { userId } = req.params;

      await clearFlaggedStatus(userId);

      return reply.send({ success: true });
    } catch (err: any) {
      console.error("[admin/marketplace/users/:userId/clear-flag] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // GET /admin/platform-settings/marketplace-abuse
  // Get current abuse settings
  // --------------------------------------------------------------------------
  app.get("/admin/platform-settings/marketplace-abuse", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const settings = await getAbuseSettings();

      return reply.send(settings);
    } catch (err: any) {
      console.error("[admin/platform-settings/marketplace-abuse] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // PUT /admin/platform-settings/marketplace-abuse
  // Update abuse settings
  // --------------------------------------------------------------------------
  app.put<{
    Body: Partial<MarketplaceAbuseSettings>;
  }>("/admin/platform-settings/marketplace-abuse", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const updates = req.body ?? {};

      // Validate thresholds if provided
      if (updates.flagThreshold !== undefined) {
        if (typeof updates.flagThreshold !== "number" || updates.flagThreshold < 1) {
          return reply.code(400).send({
            error: "invalid_threshold",
            message: "flagThreshold must be a positive number",
          });
        }
      }

      if (updates.autoSuspendThreshold !== undefined) {
        if (typeof updates.autoSuspendThreshold !== "number" || updates.autoSuspendThreshold < 1) {
          return reply.code(400).send({
            error: "invalid_threshold",
            message: "autoSuspendThreshold must be a positive number",
          });
        }
      }

      if (updates.countWindow !== undefined && updates.countWindow !== null) {
        if (typeof updates.countWindow !== "number" || updates.countWindow < 1) {
          return reply.code(400).send({
            error: "invalid_window",
            message: "countWindow must be null or a positive number of days",
          });
        }
      }

      const settings = await updateAbuseSettings(updates);

      return reply.send(settings);
    } catch (err: any) {
      console.error("[admin/platform-settings/marketplace-abuse] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // ==========================================================================
  // Listing Payment Settings
  // ==========================================================================

  // --------------------------------------------------------------------------
  // GET /admin/marketplace-listing-payment-settings
  // Get current listing payment configuration
  // --------------------------------------------------------------------------
  app.get("/admin/marketplace-listing-payment-settings", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const settings = await getListingPaymentSettings();
      return reply.send(settings);
    } catch (err: any) {
      console.error("[admin/marketplace-listing-payment-settings GET] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // PUT /admin/marketplace-listing-payment-settings
  // Update listing payment configuration
  // --------------------------------------------------------------------------
  app.put<{
    Body: Partial<MarketplaceListingPaymentSettings>;
  }>("/admin/marketplace-listing-payment-settings", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const updates = req.body ?? {};

      // Validate listingFeeCents
      if (updates.listingFeeCents !== undefined) {
        if (typeof updates.listingFeeCents !== "number" || updates.listingFeeCents < 0) {
          return reply.code(400).send({
            error: "invalid_fee",
            message: "listingFeeCents must be a non-negative number",
          });
        }
      }

      // Validate listingDurationDays
      if (updates.listingDurationDays !== undefined) {
        if (typeof updates.listingDurationDays !== "number" || updates.listingDurationDays < 1) {
          return reply.code(400).send({
            error: "invalid_duration",
            message: "listingDurationDays must be a positive number",
          });
        }
      }

      // Validate date strings if provided
      if (updates.foundingFreeUntil !== undefined && updates.foundingFreeUntil !== null) {
        const d = new Date(updates.foundingFreeUntil);
        if (isNaN(d.getTime())) {
          return reply.code(400).send({
            error: "invalid_date",
            message: "foundingFreeUntil must be a valid ISO date string",
          });
        }
      }

      if (updates.foundingWindowEnd !== undefined && updates.foundingWindowEnd !== null) {
        const d = new Date(updates.foundingWindowEnd);
        if (isNaN(d.getTime())) {
          return reply.code(400).send({
            error: "invalid_date",
            message: "foundingWindowEnd must be a valid ISO date string",
          });
        }
      }

      // Validate featuredUpgradeFeeCents
      if (updates.featuredUpgradeFeeCents !== undefined) {
        if (typeof updates.featuredUpgradeFeeCents !== "number" || updates.featuredUpgradeFeeCents < 0) {
          return reply.code(400).send({
            error: "invalid_fee",
            message: "featuredUpgradeFeeCents must be a non-negative number",
          });
        }
      }

      const settings = await updateListingPaymentSettings(updates);
      return reply.send(settings);
    } catch (err: any) {
      console.error("[admin/marketplace-listing-payment-settings PUT] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /admin/marketplace-listing-payments/enable
  // "Flip the switch" — enable listing payments and set founding dates
  // --------------------------------------------------------------------------
  app.post<{
    Body: {
      foundingFreeUntil?: string;
      foundingWindowEnd?: string;
    };
  }>("/admin/marketplace-listing-payments/enable", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const current = await getListingPaymentSettings();

      if (current.enabled) {
        return reply.code(409).send({
          error: "already_enabled",
          message: "Listing payments are already enabled",
        });
      }

      // Validate stripePriceId is configured before enabling
      if (!current.stripePriceId) {
        return reply.code(400).send({
          error: "missing_stripe_config",
          message: "stripePriceId must be configured before enabling payments",
        });
      }

      const now = new Date();
      const { foundingFreeUntil, foundingWindowEnd } = req.body ?? {};

      // Default: founding free for 12 months, founding window for 30 days
      const freeUntil = foundingFreeUntil
        ? new Date(foundingFreeUntil)
        : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const windowEnd = foundingWindowEnd
        ? new Date(foundingWindowEnd)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (isNaN(freeUntil.getTime())) {
        return reply.code(400).send({
          error: "invalid_date",
          message: "foundingFreeUntil must be a valid ISO date string",
        });
      }
      if (isNaN(windowEnd.getTime())) {
        return reply.code(400).send({
          error: "invalid_date",
          message: "foundingWindowEnd must be a valid ISO date string",
        });
      }

      const settings = await updateListingPaymentSettings({
        enabled: true,
        foundingFreeUntil: freeUntil.toISOString(),
        foundingWindowEnd: windowEnd.toISOString(),
      });

      return reply.send({
        settings,
        message: "Listing payments enabled. Founding providers are free until " + freeUntil.toISOString(),
      });
    } catch (err: any) {
      console.error("[admin/marketplace-listing-payments/enable] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // GET /admin/marketplace-listing-payment-metrics
  // Dashboard metrics for listing payments
  // --------------------------------------------------------------------------
  app.get("/admin/marketplace-listing-payment-metrics", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const settings = await getListingPaymentSettings();

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [
        totalActiveSubscriptions,
        totalFoundingProviders,
        totalLiveListings,
        pastDueListings,
        cancelingListings,
        foundingListingsExpiringSoon,
      ] = await Promise.all([
        // Active paid subscriptions
        prisma.mktListingBreederService.count({
          where: {
            stripeSubscriptionStatus: "active",
            deletedAt: null,
          } as any,
        }),

        // Founding providers still on free period
        prisma.mktListingBreederService.count({
          where: {
            isFounding: true,
            stripeSubscriptionId: null,
            status: "LIVE",
            deletedAt: null,
          } as any,
        }),

        // Total live listings
        prisma.mktListingBreederService.count({
          where: {
            status: "LIVE",
            deletedAt: null,
          },
        }),

        // Past due listings
        prisma.mktListingBreederService.count({
          where: {
            stripeSubscriptionStatus: "past_due",
            deletedAt: null,
          } as any,
        }),

        // Canceling listings (will expire at period end)
        prisma.mktListingBreederService.count({
          where: {
            stripeSubscriptionStatus: "canceling",
            deletedAt: null,
          } as any,
        }),

        // Founding listings that will need payment in next 30 days
        settings.foundingFreeUntil && new Date(settings.foundingFreeUntil) <= thirtyDaysFromNow
          ? prisma.mktListingBreederService.count({
              where: {
                isFounding: true,
                stripeSubscriptionId: null,
                status: "LIVE",
                deletedAt: null,
              } as any,
            })
          : Promise.resolve(0),
      ]);

      // MRR = active subscriptions × fee
      const mrrCents = totalActiveSubscriptions * settings.listingFeeCents;

      return reply.send({
        totalActiveSubscriptions,
        mrrCents,
        mrrFormatted: `$${(mrrCents / 100).toFixed(2)}`,
        totalFoundingProviders,
        totalLiveListings,
        pastDueListings,
        cancelingListings,
        foundingListingsExpiringSoon,
        paymentsEnabled: settings.enabled,
        listingFeeCents: settings.listingFeeCents,
        foundingFreeUntil: settings.foundingFreeUntil,
      });
    } catch (err: any) {
      console.error("[admin/marketplace-listing-payment-metrics] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });
};

export default adminMarketplaceRoutes;
