// src/routes/listing-payments.ts
/**
 * Listing Payment Routes
 *
 * Endpoints for service listing payment configuration, checkout, status,
 * and subscription management (cancel / renew).
 *
 * Endpoints:
 *   GET  /service-listing-payment-config          - Get current pricing & founding status
 *   POST /service-listings/:id/checkout           - Create Stripe Checkout session
 *   GET  /service-listings/:id/payment            - Get payment/subscription status
 *   POST /service-listings/:id/cancel             - Cancel subscription (at period end)
 *   POST /service-listings/:id/renew              - Renew / resubscribe a listing
 */

import type { FastifyInstance } from "fastify";
import prisma from "../prisma.js";
import {
  getListingPaymentSettings,
  isFoundingProvider,
  createListingCheckoutSession,
  cancelListingSubscription,
  getListingPaymentStatus,
} from "../services/listing-payment-service.js";

export default async function listingPaymentsRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/service-listing-payment-config
   *
   * Returns the current listing payment configuration for display purposes.
   * If the caller is authenticated, also checks their founding provider status.
   *
   * No tenant context required — works for both breeder (tenant-scoped) and
   * marketplace provider (JWT-scoped) callers.
   */
  app.get("/service-listing-payment-config", async (req, reply) => {
    const settings = await getListingPaymentSettings();

    // Check founding status if caller is authenticated
    let isFounder = false;
    const tenantId = (req as any).tenantId as number | null;
    const provider = (req as any).marketplaceProvider as { id: number } | undefined;

    if (provider?.id || tenantId) {
      isFounder = await isFoundingProvider(provider?.id ?? null, tenantId);
    }

    return reply.send({
      enabled: settings.enabled,
      listingFeeCents: settings.listingFeeCents,
      listingDurationDays: settings.listingDurationDays,
      foundingFreeUntil: settings.foundingFreeUntil,
      isFoundingProvider: isFounder,
    });
  });

  /**
   * POST /api/v1/service-listings/:id/checkout
   *
   * Creates a Stripe Checkout session for a listing subscription.
   * The caller must own the listing (provider or tenant).
   *
   * Body: { returnUrl: string }
   * Response: { checkoutUrl: string }
   */
  app.post<{
    Params: { id: string };
    Body: { returnUrl: string };
  }>("/service-listings/:id/checkout", async (req, reply) => {
    try {
      const listingId = parseInt(req.params.id, 10);
      if (!listingId || isNaN(listingId)) {
        return reply.code(400).send({ error: "invalid_listing_id" });
      }

      const { returnUrl } = req.body || {};
      if (!returnUrl) {
        return reply.code(400).send({ error: "missing_return_url" });
      }

      const tenantId = (req as any).tenantId as number | null;
      const provider = (req as any).marketplaceProvider as { id: number; userId: string } | undefined;

      if (!tenantId && !provider?.id) {
        return reply.code(401).send({ error: "authentication_required" });
      }

      // Verify listing ownership
      const listing = await prisma.mktListingBreederService.findFirst({
        where: {
          id: listingId,
          ...(provider?.id ? { providerId: provider.id } : {}),
          ...(tenantId ? { tenantId } : {}),
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!listing) {
        return reply.code(404).send({ error: "listing_not_found" });
      }

      // Only DRAFT or PAUSED listings can start a checkout
      if (listing.status !== "DRAFT" && listing.status !== "PAUSED") {
        return reply.code(400).send({
          error: "invalid_status",
          message: "Only draft or paused listings can start a checkout.",
        });
      }

      // Resolve caller email
      let customerEmail = "";
      if (provider?.id) {
        const providerRecord = await prisma.marketplaceProvider.findUnique({
          where: { id: provider.id },
          select: { user: { select: { email: true } } },
        });
        customerEmail = providerRecord?.user?.email || "";
      } else if (tenantId) {
        const org = await prisma.organization.findFirst({
          where: { tenantId },
          select: { party: { select: { email: true } } },
        }) as any;
        customerEmail = org?.party?.email || "";
      }

      const checkoutUrl = await createListingCheckoutSession(
        listingId,
        provider?.id ?? null,
        tenantId,
        customerEmail,
        returnUrl
      );

      return reply.send({ checkoutUrl });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create listing checkout session");
      return reply.code(500).send({ error: "checkout_failed", message: err.message });
    }
  });

  /**
   * GET /api/v1/service-listings/:id/payment
   *
   * Returns the payment/subscription status for a listing.
   * The caller must own the listing.
   *
   * Response: {
   *   status: "free" | "active" | "canceling" | "past_due" | "expired" | "founding_free",
   *   currentPeriodEnd: string | null,
   *   listingFeeCents: number,
   *   isFoundingProvider: boolean,
   *   foundingFreeUntil: string | null,
   * }
   */
  app.get<{
    Params: { id: string };
  }>("/service-listings/:id/payment", async (req, reply) => {
    try {
      const listingId = parseInt(req.params.id, 10);
      if (!listingId || isNaN(listingId)) {
        return reply.code(400).send({ error: "invalid_listing_id" });
      }

      const tenantId = (req as any).tenantId as number | null;
      const provider = (req as any).marketplaceProvider as { id: number } | undefined;

      if (!tenantId && !provider?.id) {
        return reply.code(401).send({ error: "authentication_required" });
      }

      // Verify listing ownership
      const listing = await prisma.mktListingBreederService.findFirst({
        where: {
          id: listingId,
          ...(provider?.id ? { providerId: provider.id } : {}),
          ...(tenantId ? { tenantId } : {}),
        },
        select: { id: true },
      });

      if (!listing) {
        return reply.code(404).send({ error: "listing_not_found" });
      }

      const paymentStatus = await getListingPaymentStatus(listingId);

      return reply.send({
        status: paymentStatus.status,
        currentPeriodEnd: paymentStatus.currentPeriodEnd?.toISOString() ?? null,
        listingFeeCents: paymentStatus.listingFeeCents,
        isFoundingProvider: paymentStatus.isFoundingProvider,
        foundingFreeUntil: paymentStatus.foundingFreeUntil,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get listing payment status");
      return reply.code(500).send({ error: "payment_status_failed", message: err.message });
    }
  });

  /**
   * POST /api/v1/service-listings/:id/cancel
   *
   * Cancels auto-renewal for a listing subscription. The listing stays LIVE
   * until the current period ends. The cron job (Phase 5) handles pausing.
   *
   * Auth: owner only (provider or tenant)
   * Response: { ok: true, expiresAt: string }
   */
  app.post<{
    Params: { id: string };
  }>("/service-listings/:id/cancel", async (req, reply) => {
    try {
      const listingId = parseInt(req.params.id, 10);
      if (!listingId || isNaN(listingId)) {
        return reply.code(400).send({ error: "invalid_listing_id" });
      }

      const tenantId = (req as any).tenantId as number | null;
      const provider = (req as any).marketplaceProvider as { id: number } | undefined;

      if (!tenantId && !provider?.id) {
        return reply.code(401).send({ error: "authentication_required" });
      }

      const result = await cancelListingSubscription(
        listingId,
        provider?.id ?? null,
        tenantId
      );

      return reply.send({
        ok: true,
        expiresAt: result.expiresAt?.toISOString() ?? null,
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to cancel listing subscription");

      if (err.message === "No active subscription for this listing") {
        return reply.code(400).send({ error: "no_subscription", message: err.message });
      }

      return reply.code(500).send({ error: "cancel_failed", message: err.message });
    }
  });

  /**
   * POST /api/v1/service-listings/:id/renew
   *
   * Creates a new checkout session for a listing whose subscription was
   * canceled or has expired. Returns a Stripe Checkout URL.
   *
   * Auth: owner only (provider or tenant)
   * Body: { returnUrl: string }
   * Response: { checkoutUrl: string }
   */
  app.post<{
    Params: { id: string };
    Body: { returnUrl: string };
  }>("/service-listings/:id/renew", async (req, reply) => {
    try {
      const listingId = parseInt(req.params.id, 10);
      if (!listingId || isNaN(listingId)) {
        return reply.code(400).send({ error: "invalid_listing_id" });
      }

      const { returnUrl } = req.body || {};
      if (!returnUrl) {
        return reply.code(400).send({ error: "missing_return_url" });
      }

      const tenantId = (req as any).tenantId as number | null;
      const provider = (req as any).marketplaceProvider as { id: number } | undefined;

      if (!tenantId && !provider?.id) {
        return reply.code(401).send({ error: "authentication_required" });
      }

      // Verify listing ownership and status
      const listing = await prisma.mktListingBreederService.findFirst({
        where: {
          id: listingId,
          ...(provider?.id ? { providerId: provider.id } : {}),
          ...(tenantId ? { tenantId } : {}),
        },
        select: {
          id: true,
          status: true,
          stripeSubscriptionStatus: true,
        } as any,
      }) as any;

      if (!listing) {
        return reply.code(404).send({ error: "listing_not_found" });
      }

      // Only allow renew for canceled/expired subscriptions or paused/draft listings
      const subStatus = listing.stripeSubscriptionStatus as string | null;
      const isRenewable =
        listing.status === "PAUSED" ||
        listing.status === "DRAFT" ||
        subStatus === "canceling" ||
        subStatus === "canceled" ||
        subStatus === null;

      if (!isRenewable) {
        return reply.code(400).send({
          error: "not_renewable",
          message: "This listing already has an active subscription.",
        });
      }

      // Resolve caller email
      let customerEmail = "";
      if (provider?.id) {
        const providerRecord = await prisma.marketplaceProvider.findUnique({
          where: { id: provider.id },
          select: { user: { select: { email: true } } },
        });
        customerEmail = providerRecord?.user?.email || "";
      } else if (tenantId) {
        const org = await prisma.organization.findFirst({
          where: { tenantId },
          select: { party: { select: { email: true } } },
        }) as any;
        customerEmail = org?.party?.email || "";
      }

      const checkoutUrl = await createListingCheckoutSession(
        listingId,
        provider?.id ?? null,
        tenantId,
        customerEmail,
        returnUrl
      );

      return reply.send({ checkoutUrl });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create renewal checkout session");
      return reply.code(500).send({ error: "renew_failed", message: err.message });
    }
  });
}
