// src/middleware/mobile-provider-auth.ts
// JWT-based authentication middleware for mobile provider routes.
// Unlike marketplace-provider-auth.ts (session-based), this uses
// Bearer token authentication for native mobile clients.

import type { FastifyRequest, FastifyReply } from "fastify";
import type { MarketplaceProvider, MarketplaceUser } from "@prisma/client";
import { verifyAccessToken } from "../services/jwt.service.js";
import prisma from "../prisma.js";

// Extend Fastify request with mobile provider context
declare module "fastify" {
  interface FastifyRequest {
    mobileProviderId?: number;
    mobileMarketplaceUserId?: number;
    mobileProvider?: MarketplaceProvider & {
      user: MarketplaceUser;
    };
  }
}

/**
 * Extract the numeric marketplace user ID from a JWT userId.
 * Provider JWTs use the format "mkt_123" where 123 is the MarketplaceUser.id.
 */
function parseMarketplaceUserId(userId: string): number | null {
  if (!userId.startsWith("mkt_")) return null;
  const id = parseInt(userId.slice(4), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Middleware to require JWT-authenticated mobile provider.
 * Extracts Bearer token, verifies it's a provider account,
 * and loads the MarketplaceProvider record.
 *
 * Sets on request:
 *   - req.mobileMarketplaceUserId: number
 *   - req.mobileProviderId: number
 *   - req.mobileProvider: MarketplaceProvider & { user: MarketplaceUser }
 */
export async function requireMobileProvider(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Authorization required" });
    return;
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    reply.code(401).send({ error: "Invalid or expired token" });
    return;
  }

  // Must be a provider account
  if (payload.accountMode !== "provider") {
    reply.code(403).send({
      error: "forbidden",
      message: "This endpoint requires a service provider account.",
    });
    return;
  }

  // Extract marketplace user ID from "mkt_123" format
  const marketplaceUserId = parseMarketplaceUserId(payload.userId);
  if (!marketplaceUserId) {
    reply.code(401).send({ error: "Invalid provider token" });
    return;
  }

  // Load provider record with user
  const provider = await prisma.marketplaceProvider.findUnique({
    where: { userId: marketplaceUserId },
    include: { user: true },
  });

  if (!provider) {
    reply.code(403).send({
      error: "provider_not_found",
      message:
        "No provider account found. Please register as a provider first.",
    });
    return;
  }

  if (provider.suspendedAt) {
    reply.code(403).send({
      error: "provider_suspended",
      message:
        provider.suspendedReason ||
        "Your provider account has been suspended.",
    });
    return;
  }

  if (provider.status !== "active" && provider.status !== "pending") {
    reply.code(403).send({
      error: "provider_inactive",
      message: "Your provider account is not active.",
    });
    return;
  }

  // Attach to request
  req.mobileMarketplaceUserId = marketplaceUserId;
  req.mobileProviderId = provider.id;
  req.mobileProvider = provider;
}
