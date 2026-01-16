// src/middleware/marketplace-provider-auth.ts
/**
 * Marketplace Provider Authentication Middleware
 *
 * Extends marketplace auth to load and verify provider records.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { MarketplaceProvider, MarketplaceUser } from "@prisma/client";
import { requireMarketplaceAuth } from "./marketplace-auth.js";
import prisma from "../prisma.js";

// Extend Fastify request to include provider
declare module "fastify" {
  interface FastifyRequest {
    marketplaceProvider?: MarketplaceProvider & {
      user: MarketplaceUser;
    };
  }
}

/**
 * Middleware to require authenticated user with provider account
 *
 * Usage:
 * ```ts
 * app.post("/listings", { preHandler: requireProvider }, async (req, reply) => {
 *   const provider = req.marketplaceProvider!; // guaranteed to exist
 *   // ...
 * });
 * ```
 */
export async function requireProvider(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // First check marketplace auth
  await requireMarketplaceAuth(req, reply);
  if (reply.sent) return;

  const userId = req.marketplaceUserId!;

  // Fetch provider record with user
  const provider = await prisma.marketplaceProvider.findUnique({
    where: { userId },
    include: { user: true },
  });

  if (!provider) {
    return reply.code(403).send({
      error: "forbidden",
      message: "This action requires a provider account. Please register as a provider first.",
    });
  }

  // Check if provider is suspended
  if (provider.suspendedAt) {
    return reply.code(403).send({
      error: "provider_suspended",
      message: provider.suspendedReason || "Your provider account has been suspended.",
    });
  }

  // Check if provider is active
  if (provider.status !== "active" && provider.status !== "pending") {
    return reply.code(403).send({
      error: "provider_inactive",
      message: "Your provider account is not active.",
    });
  }

  // Attach to request
  req.marketplaceProvider = provider;
}

/**
 * Middleware to require provider with completed Stripe Connect onboarding
 *
 * Usage:
 * ```ts
 * app.get("/payout-history", { preHandler: requireProviderWithStripe }, async (req, reply) => {
 *   const provider = req.marketplaceProvider!;
 *   // Provider definitely has Stripe account
 * });
 * ```
 */
export async function requireProviderWithStripe(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireProvider(req, reply);
  if (reply.sent) return;

  const provider = req.marketplaceProvider!;

  if (
    !provider.stripeConnectAccountId ||
    !provider.stripeConnectOnboardingComplete
  ) {
    return reply.code(403).send({
      error: "stripe_onboarding_required",
      message: "This action requires Stripe Connect onboarding. Please complete setup to enable automated payments.",
      needsOnboarding: true,
    });
  }

  if (!provider.stripeConnectPayoutsEnabled) {
    return reply.code(403).send({
      error: "stripe_payouts_not_enabled",
      message: "Your Stripe account is not yet enabled for payouts. Please contact support.",
      needsOnboarding: false,
    });
  }
}

/**
 * Middleware to optionally load provider (doesn't require it)
 *
 * Usage:
 * ```ts
 * app.get("/listings", { preHandler: optionalProvider }, async (req, reply) => {
 *   const provider = req.marketplaceProvider; // may be undefined
 *   if (provider) {
 *     // Show provider-specific features
 *   }
 * });
 * ```
 */
export async function optionalProvider(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // First check marketplace auth
  await requireMarketplaceAuth(req, reply);
  if (reply.sent) return;

  const userId = req.marketplaceUserId!;

  // Try to fetch provider record
  const provider = await prisma.marketplaceProvider.findUnique({
    where: { userId },
    include: { user: true },
  });

  if (provider) {
    req.marketplaceProvider = provider;
  }
}
