// src/routes/marketplace-identity-verification.ts
// Identity Verification API for Service Provider Portal
// Uses Stripe Identity for government ID verification

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";
import Stripe from "stripe";
import { sendProviderVerificationFailedNotification } from "../services/marketplace-email-service.js";

// Initialize Stripe (only if API key is configured)
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-12-15.clover" }) : null;

/**
 * POST /api/v1/marketplace/identity/verify
 * Start Stripe Identity verification session
 * Requires: 2FA must be enabled first
 */
async function startVerification(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = (request as any).marketplaceUserId || (request as any).userId;

  if (!userId) {
    return reply.status(401).send({
      error: "unauthorized",
      message: "Authentication required",
    });
  }

  if (!stripe) {
    return reply.status(503).send({
      error: "service_unavailable",
      message: "Identity verification is not configured on this server.",
    });
  }

  try {
    // Get user and provider info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        error: "user_not_found",
        message: "User not found.",
      });
    }

    // Require 2FA to be enabled first
    if (!user.twoFactorEnabled) {
      return reply.status(400).send({
        error: "2fa_required",
        message: "You must enable two-factor authentication before verifying your identity.",
      });
    }

    // Check if provider exists
    const provider = await prisma.marketplaceProvider.findUnique({
      where: { userId },
      select: {
        id: true,
        verificationTier: true,
        stripeIdentitySessionId: true,
      },
    });

    if (!provider) {
      return reply.status(404).send({
        error: "provider_not_found",
        message: "Service provider profile not found.",
      });
    }

    // Check if already verified at tier 2
    if (provider.verificationTier === "IDENTITY_VERIFIED") {
      return reply.status(400).send({
        error: "already_verified",
        message: "Your identity is already verified.",
      });
    }

    // Create Stripe Identity verification session
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: {
        userId,
        providerId: provider.id.toString(),
      },
      options: {
        document: {
          // Require government-issued ID
          allowed_types: ["driving_license", "passport", "id_card"],
          require_id_number: false,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
    });

    // Store session ID in provider record
    await prisma.marketplaceProvider.update({
      where: { id: provider.id },
      data: {
        stripeIdentitySessionId: verificationSession.id,
      },
    });

    return reply.send({
      sessionId: verificationSession.id,
      clientSecret: verificationSession.client_secret,
      url: verificationSession.url,
      status: verificationSession.status,
    });
  } catch (error: any) {
    request.log.error(error, "Failed to create verification session");

    if (error.type === "StripeInvalidRequestError") {
      return reply.status(400).send({
        error: "stripe_error",
        message: error.message,
      });
    }

    return reply.status(500).send({
      error: "server_error",
      message: "Failed to start verification. Please try again.",
    });
  }
}

/**
 * GET /api/v1/marketplace/identity/status
 * Check identity verification status
 */
async function getVerificationStatus(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = (request as any).marketplaceUserId || (request as any).userId;

  if (!userId) {
    return reply.status(401).send({
      error: "unauthorized",
      message: "Authentication required",
    });
  }

  try {
    const provider = await prisma.marketplaceProvider.findUnique({
      where: { userId },
      select: {
        verificationTier: true,
        verifiedProvider: true,
        stripeIdentitySessionId: true,
      },
    });

    if (!provider) {
      return reply.status(404).send({
        error: "provider_not_found",
        message: "Service provider profile not found.",
      });
    }

    let sessionStatus = null;

    // If there's an active Stripe session, fetch its status
    if (stripe && provider.stripeIdentitySessionId) {
      try {
        const session = await stripe.identity.verificationSessions.retrieve(
          provider.stripeIdentitySessionId
        );
        sessionStatus = {
          id: session.id,
          status: session.status,
          lastError: session.last_error?.reason || null,
        };
      } catch (error) {
        request.log.warn(
          { error, sessionId: provider.stripeIdentitySessionId },
          "Failed to retrieve Stripe verification session"
        );
      }
    }

    return reply.send({
      verificationTier: provider.verificationTier,
      verifiedProvider: provider.verifiedProvider,
      stripeSession: sessionStatus,
    });
  } catch (error) {
    request.log.error(error, "Failed to get verification status");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to get verification status.",
    });
  }
}

/**
 * POST /api/webhooks/stripe/identity
 * Webhook handler for Stripe Identity events
 * This endpoint should be registered separately without auth middleware
 */
async function handleStripeWebhook(
  request: FastifyRequest<{
    Body: any;
  }>,
  reply: FastifyReply
) {
  if (!stripe) {
    return reply.status(503).send({ error: "stripe_not_configured" });
  }

  const signature = request.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    request.log.error("STRIPE_IDENTITY_WEBHOOK_SECRET not configured");
    return reply.status(500).send({ error: "webhook_secret_not_configured" });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      request.body as any,
      signature,
      webhookSecret
    );
  } catch (err: any) {
    request.log.error({ err }, "Webhook signature verification failed");
    return reply.status(400).send({ error: "invalid_signature" });
  }

  try {
    // Handle verification session completed
    if (event.type === "identity.verification_session.verified") {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      const providerId = parseInt(session.metadata?.providerId || "0", 10);

      if (!providerId) {
        request.log.warn(
          { sessionId: session.id },
          "Verification session missing providerId in metadata"
        );
        return reply.send({ received: true });
      }

      // Update provider verification tier
      await prisma.marketplaceProvider.update({
        where: { id: providerId },
        data: {
          verificationTier: "IDENTITY_VERIFIED",
          verifiedProvider: true,
        },
      });

      request.log.info(
        { providerId, sessionId: session.id },
        "Provider identity verified successfully"
      );
    }

    // Handle verification session failed
    if (
      event.type === "identity.verification_session.requires_input" ||
      event.type === "identity.verification_session.canceled"
    ) {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      const providerId = parseInt(session.metadata?.providerId || "0", 10);

      if (providerId) {
        request.log.warn(
          {
            providerId,
            sessionId: session.id,
            status: session.status,
            lastError: session.last_error,
          },
          "Provider identity verification failed or requires input"
        );

        // P-02 FIX: Send notification to provider about verification failure
        const provider = await prisma.marketplaceProvider.findUnique({
          where: { id: providerId },
          select: {
            businessName: true,
            user: {
              select: { email: true, firstName: true },
            },
          },
        });

        if (provider?.user?.email) {
          const errorMessage = session.last_error?.reason
            || session.last_error?.code
            || "Verification could not be completed";

          sendProviderVerificationFailedNotification({
            email: provider.user.email,
            firstName: provider.user.firstName,
            businessName: provider.businessName,
            failureReason: errorMessage,
          }).catch((err) => {
            request.log.error({ err, providerId }, "Failed to send verification failure notification");
          });
        }
      }
    }

    return reply.send({ received: true });
  } catch (error) {
    request.log.error({ error, event }, "Failed to process webhook event");
    return reply.status(500).send({ error: "webhook_processing_failed" });
  }
}

/**
 * Register routes
 */
export default async function marketplaceIdentityVerificationRoutes(
  fastify: FastifyInstance
) {
  // POST /api/v1/marketplace/identity/verify - Start verification (requires auth)
  fastify.post("/verify", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 hour",
      },
    },
    handler: startVerification,
  });

  // GET /api/v1/marketplace/identity/status - Get verification status (requires auth)
  fastify.get("/status", {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "1 minute",
      },
    },
    handler: getVerificationStatus,
  });
}

// Export webhook handler separately (to be registered without auth middleware)
export { handleStripeWebhook };
