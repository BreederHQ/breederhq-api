// src/middleware/bearer-auth.ts
// Bearer token authentication middleware for mobile clients
// Validates JWT access tokens in Authorization header

import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken, type TokenPayload } from "../services/jwt.service.js";

/**
 * Fastify preHandler hook for Bearer token authentication.
 * Extracts and validates JWT from Authorization header.
 * Sets req.userId and req.tenantId on success.
 */
export async function bearerAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Authorization required" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

    // Set request context for downstream handlers
    req.userId = payload.userId;
    req.tenantId = payload.tenantId;
  } catch (error) {
    reply.code(401).send({ error: "Invalid or expired token" });
    return;
  }
}

/**
 * Optional bearer auth - extracts token if present but doesn't fail if missing.
 * Useful for endpoints that work both authenticated and unauthenticated.
 */
export async function optionalBearerAuth(
  req: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return; // No auth, but that's OK
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.tenantId = payload.tenantId;
  } catch {
    // Invalid token - treat as unauthenticated
  }
}
