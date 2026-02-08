// src/routes/mobile-auth.ts
// Mobile authentication endpoints (JWT-based)
// Endpoints:
//   POST /mobile-login  → Login with email/password, get JWT tokens
//   POST /refresh       → Refresh access token using refresh token
//   POST /mobile-logout → Revoke refresh token

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import {
  generateTokens,
  refreshAccessToken,
  revokeRefreshToken,
} from "../services/jwt.service.js";

// Environment
const NODE_ENV = String(process.env.NODE_ENV || "").toLowerCase();
const IS_PROD = NODE_ENV === "production";

/** Resolve tenant ID for user (defaultTenantId or first active membership) */
async function resolveTenantId(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultTenantId: true },
  });

  if (user?.defaultTenantId) {
    return user.defaultTenantId;
  }

  // Fall back to first active membership
  const membership = await prisma.tenantMembership.findFirst({
    where: { userId, membershipStatus: "ACTIVE" },
    select: { tenantId: true },
    orderBy: { tenantId: "asc" },
  });

  return membership?.tenantId ?? null;
}

/** Fetch tenant info for response */
async function fetchTenant(tenantId: number) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}

export default async function mobileAuthRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /**
   * POST /mobile-login
   * Authenticate user with email/password, return JWT tokens.
   *
   * Request body:
   *   - email: string
   *   - password: string
   *   - deviceId?: string (optional device identifier for push notifications)
   *
   * Response:
   *   - accessToken: JWT access token (1h expiry)
   *   - refreshToken: Opaque refresh token (30d expiry)
   *   - expiresIn: Access token lifetime in seconds
   *   - user: { id, email, name, firstName, lastName }
   *   - tenant: { id, name, slug }
   */
  app.post<{
    Body: { email?: string; password?: string; deviceId?: string };
  }>("/mobile-login", async (req, reply) => {
    const { email, password, deviceId } = req.body || {};

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password required" });
    }

    try {
      // Find user by email (case-insensitive)
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          passwordHash: true,
          defaultTenantId: true,
        },
      });

      if (!user || !user.passwordHash) {
        // User not found or no password set
        return reply.code(401).send({ error: "Invalid email or password" });
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        return reply.code(401).send({ error: "Invalid email or password" });
      }

      // Resolve tenant
      const tenantId = await resolveTenantId(user.id);
      if (!tenantId) {
        return reply.code(403).send({ error: "No active tenant membership" });
      }

      // Generate JWT tokens
      const tokens = await generateTokens(
        { id: user.id, email: user.email },
        tenantId,
        deviceId
      );

      // Fetch tenant details
      const tenant = await fetchTenant(tenantId);

      // Update lastLoginAt
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return reply.send({
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        tenant: tenant
          ? {
              id: tenant.id,
              name: tenant.name,
              slug: tenant.slug,
            }
          : null,
      });
    } catch (error) {
      req.log.error(error, "Mobile login error");
      return reply.code(500).send({ error: "Login failed" });
    }
  });

  /**
   * POST /refresh
   * Refresh the access token using a valid refresh token.
   *
   * Request body:
   *   - refreshToken: string
   *
   * Response:
   *   - accessToken: New JWT access token
   *   - expiresIn: Access token lifetime in seconds
   */
  app.post<{
    Body: { refreshToken?: string };
  }>("/refresh", async (req, reply) => {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
      return reply.code(400).send({ error: "Refresh token required" });
    }

    try {
      const tokens = await refreshAccessToken(refreshToken);
      return reply.send(tokens);
    } catch (error) {
      return reply.code(401).send({ error: "Invalid or expired refresh token" });
    }
  });

  /**
   * POST /mobile-logout
   * Revoke the refresh token to end the session.
   * This is a best-effort operation - always returns success.
   *
   * Request body:
   *   - refreshToken: string
   *
   * Response:
   *   - success: true
   */
  app.post<{
    Body: { refreshToken?: string };
  }>("/mobile-logout", async (req, reply) => {
    const { refreshToken } = req.body || {};

    if (refreshToken) {
      try {
        await revokeRefreshToken(refreshToken);
      } catch {
        // Ignore errors - logout should always succeed from client perspective
      }
    }

    return reply.send({ success: true });
  });
}
