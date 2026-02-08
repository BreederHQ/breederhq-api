// src/routes/marketplace-verification.ts
/**
 * Marketplace Verification Routes
 *
 * Mounted at: /api/v1/marketplace/verification
 *
 * Endpoints:
 *   POST /providers/phone/send        - Send phone verification code (breeders)
 *   POST /providers/phone/verify      - Verify phone code (breeders)
 *   POST /providers/identity/start    - Start Stripe Identity verification (breeders)
 *   POST /providers/package/purchase  - Purchase verification package (breeders)
 *   GET  /providers/status            - Get provider verification status
 *   POST /users/identity/start        - Start Stripe Identity verification (service providers)
 *   POST /users/package/purchase      - Purchase verification package (service providers)
 *   GET  /users/status                - Get user verification status
 *   POST /users/request/:id/info      - Provide requested info for verification
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  requireMarketplaceAuth,
  requireProvider,
} from "../middleware/marketplace-auth.js";
import {
  sendProviderPhoneVerification,
  verifyProviderPhoneCode,
  createProviderIdentitySession,
  getProviderVerificationStatus,
  createUserIdentitySession,
  getUserVerificationStatus,
  createVerificationRequest,
  provideRequestedInfo,
} from "../services/marketplace-verification-service.js";
import prisma from "../prisma.js";
import { stripe } from "../services/stripe-service.js";

const NODE_ENV = String(process.env.NODE_ENV || "").toLowerCase();
const IS_PROD = NODE_ENV === "production";
const EXPOSE_DEV_TOKENS = !IS_PROD;

// Package prices in cents
const PACKAGE_PRICES = {
  BREEDER_VERIFIED: 14900, // $149
  BREEDER_ACCREDITED: 24900, // $249
  SERVICE_VERIFIED: 9900, // $99
  SERVICE_ACCREDITED: 19900, // $199
};

export default async function marketplaceVerificationRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /* ───────────────────────────────────────────────────────────────────
   * PROVIDER (BREEDER) VERIFICATION ROUTES
   * ─────────────────────────────────────────────────────────────────── */

  /**
   * Send phone verification code to provider
   * Requires: Provider authentication
   */
  app.post("/providers/phone/send", {
    preHandler: requireProvider,
    config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { phoneNumber } = (req.body || {}) as { phoneNumber?: string };

    if (!phoneNumber) {
      return reply.code(400).send({ error: "phone_number_required" });
    }

    // Validate phone number format (basic check)
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length < 10 || cleaned.length > 15) {
      return reply.code(400).send({ error: "invalid_phone_number" });
    }

    // Get provider for this user
    const provider = await prisma.marketplaceProvider.findFirst({
      where: { userId },
    });

    if (!provider) {
      return reply.code(404).send({ error: "provider_not_found" });
    }

    const result = await sendProviderPhoneVerification(provider.id, phoneNumber);

    if (!result.success) {
      return reply.code(501).send({ error: result.error, message: "SMS verification is not yet available" });
    }

    return reply.send({
      ok: true,
      expiresAt: result.expiresAt,
      ...(EXPOSE_DEV_TOKENS && result.code ? { dev_code: result.code } : {}),
    });
  });

  /**
   * Verify phone code for provider
   * Requires: Provider authentication
   */
  app.post("/providers/phone/verify", {
    preHandler: requireProvider,
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { code } = (req.body || {}) as { code?: string };

    if (!code) {
      return reply.code(400).send({ error: "code_required" });
    }

    // Get provider for this user
    const provider = await prisma.marketplaceProvider.findFirst({
      where: { userId },
    });

    if (!provider) {
      return reply.code(404).send({ error: "provider_not_found" });
    }

    const result = await verifyProviderPhoneCode(provider.id, code);

    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }

    return reply.send({ ok: true });
  });

  /**
   * Start Stripe Identity verification for provider
   * Requires: Provider authentication
   */
  app.post("/providers/identity/start", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;

    // Get provider for this user
    const provider = await prisma.marketplaceProvider.findFirst({
      where: { userId },
    });

    if (!provider) {
      return reply.code(404).send({ error: "provider_not_found" });
    }

    // Check if already identity verified
    if (provider.identityVerifiedAt) {
      return reply.code(400).send({ error: "already_verified" });
    }

    const session = await createProviderIdentitySession(provider.id);

    if (!session.success) {
      return reply.code(501).send({ error: session.error, message: "Identity verification is not yet available" });
    }

    return reply.send({
      ok: true,
      sessionId: session.sessionId,
      clientSecret: session.clientSecret,
    });
  });

  /**
   * Start verification package purchase for provider (breeder)
   * B-03 FIX: Creates Stripe PaymentIntent and returns client_secret
   * Requires: Provider authentication
   */
  app.post("/providers/package/purchase", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { packageType, submittedInfo } = (req.body || {}) as {
      packageType?: "VERIFIED" | "ACCREDITED";
      submittedInfo?: Record<string, unknown>;
    };

    if (!packageType || !["VERIFIED", "ACCREDITED"].includes(packageType)) {
      return reply.code(400).send({ error: "invalid_package_type" });
    }

    // Get provider and user for this user
    const provider = await prisma.marketplaceProvider.findFirst({
      where: { userId },
    });

    if (!provider) {
      return reply.code(404).send({ error: "provider_not_found" });
    }

    const user = await prisma.marketplaceUser.findUnique({
      where: { id: userId },
      select: { email: true, stripeCustomerId: true },
    });

    if (!user) {
      return reply.code(404).send({ error: "user_not_found" });
    }

    // Check prerequisites
    if (packageType === "VERIFIED") {
      // Must have identity verified
      if (!provider.identityVerifiedAt) {
        return reply.code(400).send({
          error: "identity_verification_required",
          message: "Identity verification is required before purchasing the Verified package.",
        });
      }
    } else if (packageType === "ACCREDITED") {
      // Must already be verified OR have identity verified
      if (!provider.verifiedPackageApprovedAt && !provider.identityVerifiedAt) {
        return reply.code(400).send({
          error: "verified_required",
          message: "Verified status or identity verification is required before purchasing the Accredited package.",
        });
      }
    }

    const priceKey = packageType === "VERIFIED" ? "BREEDER_VERIFIED" : "BREEDER_ACCREDITED";
    const amountCents = PACKAGE_PRICES[priceKey];

    try {
      // B-03 FIX: Create Stripe PaymentIntent for verification fee
      // Store packageType in metadata - submittedInfo will be passed in complete call
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        metadata: {
          type: "MARKETPLACE_VERIFICATION",
          userType: "BREEDER",
          providerId: String(provider.id),
          userId: String(userId),
          packageType,
        },
        ...(user.stripeCustomerId && { customer: user.stripeCustomerId }),
        description: `BreederHQ ${packageType} Verification Package`,
      });

      return reply.send({
        ok: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        packageType,
        amountCents,
      });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Failed to create payment intent");
      return reply.code(500).send({ error: "payment_setup_failed" });
    }
  });

  /**
   * Complete verification package purchase for provider (breeder)
   * B-03 FIX: Verifies payment succeeded before creating verification request
   * Requires: Provider authentication
   */
  app.post("/providers/package/complete", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { paymentIntentId, submittedInfo } = (req.body || {}) as {
      paymentIntentId?: string;
      submittedInfo?: Record<string, unknown>;
    };

    if (!paymentIntentId) {
      return reply.code(400).send({ error: "payment_intent_id_required" });
    }

    // Get provider for this user
    const provider = await prisma.marketplaceProvider.findFirst({
      where: { userId },
    });

    if (!provider) {
      return reply.code(404).send({ error: "provider_not_found" });
    }

    try {
      // B-03 FIX: Verify payment actually succeeded
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // Verify this payment is for this provider
      if (paymentIntent.metadata.providerId !== String(provider.id)) {
        return reply.code(400).send({ error: "invalid_payment_intent" });
      }

      if (paymentIntent.metadata.type !== "MARKETPLACE_VERIFICATION") {
        return reply.code(400).send({ error: "invalid_payment_type" });
      }

      if (paymentIntent.status !== "succeeded") {
        return reply.code(402).send({
          error: "payment_required",
          paymentStatus: paymentIntent.status,
          message: "Payment must be completed before verification can proceed.",
        });
      }

      // Check if this payment was already used
      const existingRequest = await prisma.verificationRequest.findFirst({
        where: { paymentIntentId },
      });
      if (existingRequest) {
        return reply.code(409).send({
          error: "already_processed",
          requestId: existingRequest.id,
        });
      }

      const packageType = paymentIntent.metadata.packageType as "VERIFIED" | "ACCREDITED";
      const priceKey = packageType === "VERIFIED" ? "BREEDER_VERIFIED" : "BREEDER_ACCREDITED";

      // Create the actual verification request now that payment is confirmed
      const request = await createVerificationRequest({
        userType: "BREEDER",
        providerId: provider.id,
        packageType,
        submittedInfo: submittedInfo || {},
        paymentIntentId,
        amountPaidCents: PACKAGE_PRICES[priceKey],
      });

      return reply.send({
        ok: true,
        requestId: request.id,
        status: request.status,
        packageType,
        amountPaidCents: PACKAGE_PRICES[priceKey],
      });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Failed to complete verification request");
      return reply.code(500).send({ error: "completion_failed" });
    }
  });

  /**
   * Get provider verification status
   * Requires: Provider authentication
   */
  app.get("/providers/status", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;

    // Get provider for this user
    const provider = await prisma.marketplaceProvider.findFirst({
      where: { userId },
    });

    if (!provider) {
      return reply.code(404).send({ error: "provider_not_found" });
    }

    const status = await getProviderVerificationStatus(provider.id);

    if (!status) {
      return reply.code(404).send({ error: "status_not_found" });
    }

    // Get any pending verification requests
    const pendingRequest = await prisma.verificationRequest.findFirst({
      where: {
        providerId: provider.id,
        status: { in: ["PENDING", "IN_REVIEW", "NEEDS_INFO"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        packageType: true,
        status: true,
        createdAt: true,
        infoRequestNote: true,
      },
    });

    return reply.send({
      ...status,
      pendingRequest,
    });
  });

  /* ───────────────────────────────────────────────────────────────────
   * MARKETPLACE USER (SERVICE PROVIDER) VERIFICATION ROUTES
   * ─────────────────────────────────────────────────────────────────── */

  /**
   * Start Stripe Identity verification for marketplace user
   * Requires: Marketplace authentication
   */
  app.post("/users/identity/start", {
    preHandler: requireMarketplaceAuth,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;

    // Get user
    const user = await prisma.marketplaceUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.code(404).send({ error: "user_not_found" });
    }

    // Check if already identity verified
    if (user.identityVerifiedAt) {
      return reply.code(400).send({ error: "already_verified" });
    }

    // Must have 2FA enabled first
    if (!user.twoFactorEnabled) {
      return reply.code(400).send({
        error: "2fa_required",
        message: "Two-factor authentication must be enabled before identity verification.",
      });
    }

    const session = await createUserIdentitySession(userId);

    if (!session.success) {
      return reply.code(501).send({ error: session.error, message: "Identity verification is not yet available" });
    }

    return reply.send({
      ok: true,
      sessionId: session.sessionId,
      clientSecret: session.clientSecret,
    });
  });

  /**
   * Start verification package purchase for marketplace user (service provider)
   * B-03 FIX: Creates Stripe PaymentIntent and returns client_secret
   * Requires: Marketplace authentication
   */
  app.post("/users/package/purchase", {
    preHandler: requireMarketplaceAuth,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { packageType, submittedInfo } = (req.body || {}) as {
      packageType?: "VERIFIED" | "ACCREDITED";
      submittedInfo?: Record<string, unknown>;
    };

    if (!packageType || !["VERIFIED", "ACCREDITED"].includes(packageType)) {
      return reply.code(400).send({ error: "invalid_package_type" });
    }

    // Get user
    const user = await prisma.marketplaceUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.code(404).send({ error: "user_not_found" });
    }

    // Check prerequisites
    if (packageType === "VERIFIED") {
      // Must have 2FA and identity verified
      if (!user.twoFactorEnabled) {
        return reply.code(400).send({
          error: "2fa_required",
          message: "Two-factor authentication is required before purchasing verification.",
        });
      }
      if (!user.identityVerifiedAt) {
        return reply.code(400).send({
          error: "identity_verification_required",
          message: "Identity verification is required before purchasing the Verified package.",
        });
      }
    } else if (packageType === "ACCREDITED") {
      // Must already be verified OR have identity verified
      if (!user.verifiedProfessionalApprovedAt && !user.identityVerifiedAt) {
        return reply.code(400).send({
          error: "verified_required",
          message: "Verified status or identity verification is required before purchasing the Accredited package.",
        });
      }
    }

    const priceKey = packageType === "VERIFIED" ? "SERVICE_VERIFIED" : "SERVICE_ACCREDITED";
    const amountCents = PACKAGE_PRICES[priceKey];

    try {
      // B-03 FIX: Create Stripe PaymentIntent for verification fee
      // Store packageType in metadata - submittedInfo will be passed in complete call
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        metadata: {
          type: "MARKETPLACE_VERIFICATION",
          userType: "SERVICE_PROVIDER",
          userId: String(userId),
          packageType,
        },
        ...(user.stripeCustomerId && { customer: user.stripeCustomerId }),
        description: `BreederHQ Service Provider ${packageType} Verification Package`,
      });

      return reply.send({
        ok: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        packageType,
        amountCents,
      });
    } catch (err: any) {
      req.log?.error?.({ err, userId }, "Failed to create payment intent");
      return reply.code(500).send({ error: "payment_setup_failed" });
    }
  });

  /**
   * Complete verification package purchase for marketplace user (service provider)
   * B-03 FIX: Verifies payment succeeded before creating verification request
   * Requires: Marketplace authentication
   */
  app.post("/users/package/complete", {
    preHandler: requireMarketplaceAuth,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { paymentIntentId, submittedInfo } = (req.body || {}) as {
      paymentIntentId?: string;
      submittedInfo?: Record<string, unknown>;
    };

    if (!paymentIntentId) {
      return reply.code(400).send({ error: "payment_intent_id_required" });
    }

    try {
      // B-03 FIX: Verify payment actually succeeded
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // Verify this payment is for this user
      if (paymentIntent.metadata.userId !== String(userId)) {
        return reply.code(400).send({ error: "invalid_payment_intent" });
      }

      if (paymentIntent.metadata.type !== "MARKETPLACE_VERIFICATION") {
        return reply.code(400).send({ error: "invalid_payment_type" });
      }

      if (paymentIntent.status !== "succeeded") {
        return reply.code(402).send({
          error: "payment_required",
          paymentStatus: paymentIntent.status,
          message: "Payment must be completed before verification can proceed.",
        });
      }

      // Check if this payment was already used
      const existingRequest = await prisma.verificationRequest.findFirst({
        where: { paymentIntentId },
      });
      if (existingRequest) {
        return reply.code(409).send({
          error: "already_processed",
          requestId: existingRequest.id,
        });
      }

      const packageType = paymentIntent.metadata.packageType as "VERIFIED" | "ACCREDITED";
      const priceKey = packageType === "VERIFIED" ? "SERVICE_VERIFIED" : "SERVICE_ACCREDITED";

      // Create the actual verification request now that payment is confirmed
      const request = await createVerificationRequest({
        userType: "SERVICE_PROVIDER",
        marketplaceUserId: userId,
        packageType,
        submittedInfo: submittedInfo || {},
        paymentIntentId,
        amountPaidCents: PACKAGE_PRICES[priceKey],
      });

      return reply.send({
        ok: true,
        requestId: request.id,
        status: request.status,
        packageType,
        amountPaidCents: PACKAGE_PRICES[priceKey],
      });
    } catch (err: any) {
      req.log?.error?.({ err, userId }, "Failed to complete verification request");
      return reply.code(500).send({ error: "completion_failed" });
    }
  });

  /**
   * Get user verification status
   * Requires: Marketplace authentication
   */
  app.get("/users/status", {
    preHandler: requireMarketplaceAuth,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;

    const status = await getUserVerificationStatus(userId);

    if (!status) {
      return reply.code(404).send({ error: "status_not_found" });
    }

    // Get any pending verification requests
    const pendingRequest = await prisma.verificationRequest.findFirst({
      where: {
        marketplaceUserId: userId,
        status: { in: ["PENDING", "IN_REVIEW", "NEEDS_INFO"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        packageType: true,
        status: true,
        createdAt: true,
        infoRequestNote: true,
      },
    });

    return reply.send({
      ...status,
      pendingRequest,
    });
  });

  /**
   * Provide requested info for a verification request
   * Requires: Marketplace authentication
   */
  app.post("/users/request/:id/info", {
    preHandler: requireMarketplaceAuth,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const requestId = parseInt((req.params as { id: string }).id, 10);
    const { additionalInfo } = (req.body || {}) as { additionalInfo?: Record<string, unknown> };

    if (!additionalInfo || Object.keys(additionalInfo).length === 0) {
      return reply.code(400).send({ error: "additional_info_required" });
    }

    // Get the request and verify ownership
    const request = await prisma.verificationRequest.findFirst({
      where: {
        id: requestId,
        marketplaceUserId: userId,
        status: "NEEDS_INFO",
      },
    });

    if (!request) {
      return reply.code(404).send({ error: "request_not_found" });
    }

    try {
      const updated = await provideRequestedInfo(requestId, additionalInfo);

      return reply.send({
        ok: true,
        request: {
          id: updated?.id,
          status: updated?.status,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err, requestId }, "Failed to provide requested info");
      return reply.code(500).send({ error: "update_failed" });
    }
  });

  /**
   * Provide requested info for a provider verification request
   * Requires: Provider authentication
   */
  app.post("/providers/request/:id/info", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const requestId = parseInt((req.params as { id: string }).id, 10);
    const { additionalInfo } = (req.body || {}) as { additionalInfo?: Record<string, unknown> };

    if (!additionalInfo || Object.keys(additionalInfo).length === 0) {
      return reply.code(400).send({ error: "additional_info_required" });
    }

    // Get provider for this user
    const provider = await prisma.marketplaceProvider.findFirst({
      where: { userId },
    });

    if (!provider) {
      return reply.code(404).send({ error: "provider_not_found" });
    }

    // Get the request and verify ownership
    const request = await prisma.verificationRequest.findFirst({
      where: {
        id: requestId,
        providerId: provider.id,
        status: "NEEDS_INFO",
      },
    });

    if (!request) {
      return reply.code(404).send({ error: "request_not_found" });
    }

    try {
      const updated = await provideRequestedInfo(requestId, additionalInfo);

      return reply.send({
        ok: true,
        request: {
          id: updated?.id,
          status: updated?.status,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err, requestId }, "Failed to provide requested info");
      return reply.code(500).send({ error: "update_failed" });
    }
  });
}
