// src/middleware/marketplace-auth.ts
/**
 * Marketplace Authentication Middleware
 *
 * Protects marketplace routes by requiring valid session.
 * Uses the unified session system with MARKETPLACE surface.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { parseVerifiedSession, type SessionPayload } from "../utils/session.js";
import { findMarketplaceUserById } from "../services/marketplace-auth-service.js";

// Extend Fastify request to include marketplace session
declare module "fastify" {
  interface FastifyRequest {
    marketplaceSession?: SessionPayload;
    marketplaceUserId?: number;
  }
}

/**
 * Middleware to require marketplace authentication
 *
 * Usage in routes:
 * ```ts
 * app.get("/protected", { preHandler: requireMarketplaceAuth }, async (req, reply) => {
 *   const userId = req.marketplaceUserId; // guaranteed to exist
 *   // ...
 * });
 * ```
 */
export async function requireMarketplaceAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const session = parseVerifiedSession(req, "MARKETPLACE");

  if (!session) {
    return reply.code(401).send({
      error: "unauthorized",
      message: "Authentication required. Please log in.",
    });
  }

  // Attach session to request
  req.marketplaceSession = session;
  req.marketplaceUserId = parseInt(session.userId, 10);
}

/**
 * Middleware to optionally load marketplace session (doesn't require it)
 *
 * Usage in routes:
 * ```ts
 * app.get("/maybe-protected", { preHandler: optionalMarketplaceAuth }, async (req, reply) => {
 *   const userId = req.marketplaceUserId; // may be undefined
 *   if (userId) {
 *     // User is logged in
 *   } else {
 *     // User is anonymous
 *   }
 * });
 * ```
 */
export async function optionalMarketplaceAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const session = parseVerifiedSession(req, "MARKETPLACE");

  if (session) {
    req.marketplaceSession = session;
    req.marketplaceUserId = parseInt(session.userId, 10);
  }
}

/**
 * Check if authenticated user has specific user type
 */
export function requireUserType(userType: string) {
  return async function(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    // First ensure user is authenticated
    await requireMarketplaceAuth(req, reply);

    // Check if response was already sent (auth failed)
    if (reply.sent) return;

    const userId = req.marketplaceUserId;
    if (!userId) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "Authentication required.",
      });
    }

    // Fetch user to check type
    const user = await findMarketplaceUserById(userId);
    if (!user || user.userType !== userType) {
      return reply.code(403).send({
        error: "forbidden",
        message: `This action requires ${userType} account type.`,
      });
    }
  };
}

/**
 * Middleware to require provider account
 */
export const requireProvider = requireUserType("provider");

/**
 * Middleware to require buyer account
 */
export const requireBuyer = requireUserType("buyer");

/**
 * Middleware to require admin account
 */
export const requireAdmin = requireUserType("admin");
