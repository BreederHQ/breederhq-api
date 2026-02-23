/**
 * Tenant Stripe Connect Routes
 *
 * Mounted at: /api/v1/tenant/stripe-connect
 *
 * Endpoints:
 *   GET    /status          - Get Stripe Connect account status
 *   POST   /onboarding      - Start Stripe Connect onboarding (new account)
 *   POST   /refresh         - Refresh expired onboarding link
 *   POST   /dashboard-link  - Get link to Stripe Express Dashboard
 *   DELETE /disconnect      - Disconnect Stripe account (unlink, not delete)
 *   GET    /oauth-url       - Get OAuth URL for existing Stripe accounts
 *   POST   /oauth/callback  - Handle OAuth callback
 *
 * All endpoints require tenant authentication.
 */

import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";

const PLATFORM_URL = process.env.PLATFORM_URL || "https://app.breederhq.com";

export default async function tenantStripeConnectRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /* ───────────────────────── Get Status ───────────────────────── */

  /**
   * GET /status - Get Stripe Connect account status for current tenant
   */
  app.get("/status", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).tenantId as number;

    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    try {
      const tenantConnect = await import("../services/tenant-stripe-connect-service.js");
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeConnectAccountId: true,
          stripeConnectOnboardingComplete: true,
          stripeConnectPayoutsEnabled: true,
          invoicingMode: true,
          paymentInstructions: true,
        },
      });

      if (!tenant) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }

      // Not connected
      if (!tenant.stripeConnectAccountId) {
        return reply.send({
          connected: false,
          accountId: null,
          payoutsEnabled: false,
          detailsSubmitted: false,
          chargesEnabled: false,
          invoicingMode: tenant.invoicingMode,
          paymentInstructions: tenant.paymentInstructions,
        });
      }

      // Get live status from Stripe
      const status = await tenantConnect.getTenantAccountStatus(tenant.stripeConnectAccountId);

      return reply.send({
        ...status,
        accountId: tenant.stripeConnectAccountId,
        invoicingMode: tenant.invoicingMode,
        paymentInstructions: tenant.paymentInstructions,
      });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "Stripe Connect status check failed");
      return reply.code(500).send({
        error: "status_check_failed",
        message: "Failed to check Stripe Connect status.",
      });
    }
  });

  /* ───────────────────────── Start Onboarding ───────────────────────── */

  /**
   * POST /onboarding - Start Stripe Connect onboarding (creates new Express account)
   */
  app.post("/onboarding", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).tenantId as number;
    const { returnUrl, refreshUrl } = (req.body || {}) as {
      returnUrl?: string;
      refreshUrl?: string;
    };

    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (!returnUrl || !refreshUrl) {
      return reply.code(400).send({
        error: "missing_urls",
        message: "returnUrl and refreshUrl are required",
      });
    }

    try {
      const tenantConnect = await import("../services/tenant-stripe-connect-service.js");

      // Check if tenant already has a Stripe account
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeConnectAccountId: true },
      });

      let accountId = tenant?.stripeConnectAccountId;

      // Create Connect account if not exists
      if (!accountId) {
        accountId = await tenantConnect.createTenantConnectAccount(tenantId);
      }

      // Create account link for onboarding
      const accountLinkUrl = await tenantConnect.createTenantAccountLink(
        accountId,
        returnUrl,
        refreshUrl
      );

      return reply.send({ accountLinkUrl, accountId });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "Stripe Connect onboarding failed");
      return reply.code(500).send({
        error: "onboarding_failed",
        message: "Failed to start Stripe Connect onboarding. Please try again.",
      });
    }
  });

  /* ───────────────────────── Refresh Onboarding Link ───────────────────────── */

  /**
   * POST /refresh - Refresh expired onboarding link
   */
  app.post("/refresh", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).tenantId as number;
    const { returnUrl, refreshUrl } = (req.body || {}) as {
      returnUrl?: string;
      refreshUrl?: string;
    };

    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (!returnUrl || !refreshUrl) {
      return reply.code(400).send({
        error: "missing_urls",
        message: "returnUrl and refreshUrl are required",
      });
    }

    try {
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeConnectAccountId: true },
      });

      if (!tenant?.stripeConnectAccountId) {
        return reply.code(400).send({
          error: "not_connected",
          message: "Stripe Connect is not set up for this account. Start onboarding first.",
        });
      }

      const tenantConnect = await import("../services/tenant-stripe-connect-service.js");
      const accountLinkUrl = await tenantConnect.createTenantAccountLink(
        tenant.stripeConnectAccountId,
        returnUrl,
        refreshUrl
      );

      return reply.send({ accountLinkUrl });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "Stripe Connect refresh failed");
      return reply.code(500).send({
        error: "refresh_failed",
        message: "Failed to refresh Stripe Connect onboarding link.",
      });
    }
  });

  /* ───────────────────────── Dashboard Link ───────────────────────── */

  /**
   * POST /dashboard-link - Get link to Stripe Express Dashboard
   */
  app.post("/dashboard-link", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).tenantId as number;

    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    try {
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeConnectAccountId: true },
      });

      if (!tenant?.stripeConnectAccountId) {
        return reply.code(400).send({
          error: "not_connected",
          message: "Stripe Connect is not set up for this account.",
        });
      }

      const tenantConnect = await import("../services/tenant-stripe-connect-service.js");
      const dashboardUrl = await tenantConnect.createTenantDashboardLink(
        tenant.stripeConnectAccountId
      );

      return reply.send({ dashboardUrl });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "Stripe Connect dashboard link failed");
      return reply.code(500).send({
        error: "dashboard_link_failed",
        message: "Failed to create Stripe dashboard link.",
      });
    }
  });

  /* ───────────────────────── OAuth Flow (Existing Accounts) ───────────────────────── */

  /**
   * GET /oauth-url - Get OAuth authorization URL for connecting existing Stripe account
   */
  app.get("/oauth-url", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).tenantId as number;
    const { redirectUri } = (req.query || {}) as { redirectUri?: string };

    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    // Default redirect URI
    const callbackUri = redirectUri || `${PLATFORM_URL}/settings/payments?oauth=callback`;

    try {
      const tenantConnect = await import("../services/tenant-stripe-connect-service.js");
      const oauthUrl = tenantConnect.generateOAuthUrl(tenantId, callbackUri);

      return reply.send({ oauthUrl });
    } catch (err: any) {
      // If OAuth client ID is not configured, return helpful error
      if (err.message?.includes("STRIPE_CONNECT_CLIENT_ID")) {
        return reply.code(501).send({
          error: "oauth_not_configured",
          message: "OAuth for existing Stripe accounts is not yet configured. Please use the standard onboarding flow.",
        });
      }

      req.log.error({ err, tenantId }, "OAuth URL generation failed");
      return reply.code(500).send({
        error: "oauth_url_failed",
        message: "Failed to generate OAuth URL.",
      });
    }
  });

  /**
   * DELETE /disconnect - Disconnect Stripe Connect account from tenant
   * Note: This does NOT delete the Stripe account, just unlinks it from BreederHQ
   */
  app.delete("/disconnect", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).tenantId as number;

    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    try {
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeConnectAccountId: true },
      });

      if (!tenant?.stripeConnectAccountId) {
        return reply.code(400).send({
          error: "not_connected",
          message: "Stripe Connect is not set up for this account.",
        });
      }

      // Check for open Stripe invoices before disconnecting
      const openStripeInvoices = await app.prisma.invoice.count({
        where: {
          tenantId,
          stripeInvoiceId: { not: null },
          status: { in: ["issued", "partially_paid"] },
          deletedAt: null,
        },
      });

      if (openStripeInvoices > 0) {
        return reply.code(409).send({
          error: "open_stripe_invoices",
          message: `Cannot disconnect: ${openStripeInvoices} open Stripe invoice(s) exist. Void or collect payment on them first.`,
          openCount: openStripeInvoices,
        });
      }

      // Clear the Stripe Connect account and set invoicing mode to manual
      // Note: We don't delete the Stripe account - breeder can reconnect or use it elsewhere
      await app.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          stripeConnectAccountId: null,
          stripeConnectOnboardingComplete: false,
          stripeConnectPayoutsEnabled: false,
          invoicingMode: "manual",
        },
      });

      req.log.info({ tenantId }, "Stripe Connect account disconnected, invoicingMode set to manual");

      return reply.send({
        success: true,
        message: "Stripe account disconnected. Invoicing mode set to manual. You can reconnect at any time.",
      });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "Stripe Connect disconnect failed");
      return reply.code(500).send({
        error: "disconnect_failed",
        message: "Failed to disconnect Stripe account. Please try again.",
      });
    }
  });

  /**
   * POST /oauth/callback - Handle OAuth callback (exchange code for account)
   */
  app.post("/oauth/callback", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).tenantId as number;
    const { code, state } = (req.body || {}) as { code?: string; state?: string };

    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (!code) {
      return reply.code(400).send({
        error: "missing_code",
        message: "OAuth authorization code is required",
      });
    }

    // Verify state matches tenantId (security check)
    if (state && Number(state) !== tenantId) {
      return reply.code(400).send({
        error: "state_mismatch",
        message: "OAuth state does not match. Please try again.",
      });
    }

    try {
      const tenantConnect = await import("../services/tenant-stripe-connect-service.js");
      const accountId = await tenantConnect.handleOAuthCallback(code, tenantId);

      // Get updated status
      const status = await tenantConnect.getTenantAccountStatus(accountId);

      return reply.send({
        success: true,
        message: "Stripe account connected successfully",
        ...status,
      });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "OAuth callback failed");
      return reply.code(500).send({
        error: "oauth_failed",
        message: "Failed to connect Stripe account. Please try again.",
      });
    }
  });

  /* ───────────────────────── Invoicing Settings ───────────────────────── */

  /**
   * PUT /invoicing-settings - Update invoicing mode and payment instructions
   * Body: { invoicingMode: "manual" | "stripe", paymentInstructions?: string }
   */
  app.put("/invoicing-settings", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).tenantId as number;
    const { invoicingMode, paymentInstructions } = (req.body || {}) as {
      invoicingMode?: string;
      paymentInstructions?: string;
    };

    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    // Validate invoicingMode
    if (invoicingMode && !["manual", "stripe"].includes(invoicingMode)) {
      return reply.code(400).send({
        error: "invalid_mode",
        message: "invoicingMode must be 'manual' or 'stripe'.",
      });
    }

    // If switching to stripe, verify Stripe Connect is active
    if (invoicingMode === "stripe") {
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeConnectAccountId: true,
          stripeConnectPayoutsEnabled: true,
        },
      });

      if (!tenant?.stripeConnectAccountId || !tenant.stripeConnectPayoutsEnabled) {
        return reply.code(400).send({
          error: "stripe_not_ready",
          message: "Cannot switch to Stripe mode: Stripe Connect is not set up or payouts are not enabled.",
        });
      }
    }

    // Validate paymentInstructions length
    if (paymentInstructions && paymentInstructions.length > 500) {
      return reply.code(400).send({
        error: "instructions_too_long",
        message: "Payment instructions must be 500 characters or fewer.",
      });
    }

    try {
      const data: Record<string, any> = {};
      if (invoicingMode) data.invoicingMode = invoicingMode;
      if (paymentInstructions !== undefined) data.paymentInstructions = paymentInstructions || null;

      await app.prisma.tenant.update({
        where: { id: tenantId },
        data,
      });

      req.log.info({ tenantId, invoicingMode, hasInstructions: !!paymentInstructions }, "Invoicing settings updated");

      return reply.send({ success: true, invoicingMode, paymentInstructions: paymentInstructions || null });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "Failed to update invoicing settings");
      return reply.code(500).send({
        error: "update_failed",
        message: "Failed to update invoicing settings.",
      });
    }
  });

  /* ───────────────────────── Can Invoice (Stripe) ───────────────────────── */

  /**
   * GET /can-invoice - Check if tenant can create Stripe invoices
   */
  app.get("/can-invoice", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).tenantId as number;

    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    try {
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeConnectAccountId: true,
          stripeConnectPayoutsEnabled: true,
          invoicingMode: true,
        },
      });

      const canCreateStripeInvoices = !!(
        tenant?.stripeConnectAccountId &&
        tenant?.stripeConnectPayoutsEnabled &&
        tenant?.invoicingMode === "stripe"
      );

      return reply.send({ canCreateStripeInvoices, invoicingMode: tenant?.invoicingMode || "manual" });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "Can-invoice check failed");
      return reply.code(500).send({ error: "check_failed" });
    }
  });
}
