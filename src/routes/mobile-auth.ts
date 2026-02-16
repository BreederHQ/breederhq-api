// src/routes/mobile-auth.ts
// Mobile authentication endpoints (JWT-based)
// Supports both platform users (breeders) and marketplace users (providers).
//
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

/** Resolve tenant ID for user (defaultTenantId with active membership, or first active membership) */
async function resolveTenantId(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultTenantId: true },
  });

  // If user has a defaultTenantId, verify they have active membership to it
  if (user?.defaultTenantId) {
    const defaultMembership = await prisma.tenantMembership.findFirst({
      where: {
        userId,
        tenantId: user.defaultTenantId,
        membershipStatus: "ACTIVE",
      },
      select: { tenantId: true },
    });
    if (defaultMembership) {
      return user.defaultTenantId;
    }
    // defaultTenantId is invalid/no membership - fall through to find any active membership
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

/** Try to find and verify a marketplace user by email and password */
async function tryMarketplaceLogin(email: string, password: string) {
  const mktUser = await prisma.marketplaceUser.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      passwordHash: true,
      userType: true,
      status: true,
      suspendedAt: true,
      suspendedReason: true,
      deletedAt: true,
    },
  });

  if (!mktUser || !mktUser.passwordHash) return null;
  if (mktUser.deletedAt) return null;

  const valid = await bcrypt.compare(password, mktUser.passwordHash);
  if (!valid) return null;

  return mktUser;
}

/** Fetch provider profile for a marketplace user */
async function fetchProviderProfile(marketplaceUserId: number) {
  return prisma.marketplaceProvider.findUnique({
    where: { userId: marketplaceUserId },
    select: {
      id: true,
      businessName: true,
      providerType: true,
      status: true,
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
   * Supports both platform users (breeders) and marketplace users (providers).
   *
   * Login flow:
   *   1. Try public.User (platform) by email
   *   2. If found + valid password + has tenant → accountMode="breeder"
   *   3. If platform user not found, or found but no tenant → try marketplace.MarketplaceUser
   *   4. If marketplace user found + valid password + userType="provider" → accountMode="provider"
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
   *   - tenant: { id, name, slug } | null
   *   - accountMode: "breeder" | "provider"
   *   - provider?: { id, businessName, providerType, status }
   */
  app.post<{
    Body: { email?: string; password?: string; deviceId?: string };
  }>("/mobile-login", async (req, reply) => {
    const { email, password, deviceId } = req.body || {};

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    try {
      // ─── Step 1: Try platform user ───────────────────────────────────
      const platformUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
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

      if (platformUser && platformUser.passwordHash) {
        const passwordValid = await bcrypt.compare(
          password,
          platformUser.passwordHash
        );

        if (passwordValid) {
          // Platform user authenticated — resolve tenant
          const tenantId = await resolveTenantId(platformUser.id);

          if (tenantId) {
            // ─── Breeder path: platform user with tenant ───────────────
            const tokens = await generateTokens(
              { id: platformUser.id, email: platformUser.email },
              tenantId,
              deviceId,
              { accountMode: "breeder", userSource: "platform" }
            );

            const tenant = await fetchTenant(tenantId);

            await prisma.user.update({
              where: { id: platformUser.id },
              data: { lastLoginAt: new Date() },
            });

            return reply.send({
              ...tokens,
              user: {
                id: platformUser.id,
                email: platformUser.email,
                name: platformUser.name,
                firstName: platformUser.firstName,
                lastName: platformUser.lastName,
              },
              tenant: tenant
                ? { id: tenant.id, name: tenant.name, slug: tenant.slug }
                : null,
              accountMode: "breeder" as const,
            });
          }

          // ─── Platform user with no tenant — check if they're a marketplace provider
          const mktUser = await prisma.marketplaceUser.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, userType: true, status: true, suspendedAt: true },
          });

          if (mktUser?.userType === "provider") {
            if (mktUser.suspendedAt) {
              return reply.code(403).send({ error: "Account suspended" });
            }
            if (mktUser.status !== "active") {
              return reply.code(403).send({ error: "Account inactive" });
            }

            const provider = await fetchProviderProfile(mktUser.id);

            const tokens = await generateTokens(
              { id: `mkt_${mktUser.id}`, email: normalizedEmail },
              null,
              deviceId,
              {
                accountMode: "provider",
                userSource: "marketplace",
                marketplaceUserId: mktUser.id,
              }
            );

            await prisma.user.update({
              where: { id: platformUser.id },
              data: { lastLoginAt: new Date() },
            });

            return reply.send({
              ...tokens,
              user: {
                id: `mkt_${mktUser.id}`,
                email: normalizedEmail,
                name: platformUser.name,
                firstName: platformUser.firstName,
                lastName: platformUser.lastName,
              },
              tenant: null,
              accountMode: "provider" as const,
              provider: provider
                ? {
                    id: provider.id,
                    businessName: provider.businessName,
                    providerType: provider.providerType,
                    status: provider.status,
                  }
                : null,
            });
          }

          // Platform user with no tenant and not a provider
          return reply.code(403).send({ error: "No active tenant membership" });
        }
      }

      // ─── Step 2: Try marketplace user (provider-only) ────────────────
      const mktUser = await tryMarketplaceLogin(normalizedEmail, password);

      if (mktUser) {
        if (mktUser.suspendedAt) {
          return reply.code(403).send({ error: "Account suspended" });
        }
        if (mktUser.status !== "active") {
          return reply.code(403).send({ error: "Account inactive" });
        }
        if (mktUser.userType !== "provider") {
          // Marketplace buyers can't log into mobile app
          return reply.code(401).send({ error: "Invalid email or password" });
        }

        const provider = await fetchProviderProfile(mktUser.id);

        const tokens = await generateTokens(
          { id: `mkt_${mktUser.id}`, email: mktUser.email },
          null,
          deviceId,
          {
            accountMode: "provider",
            userSource: "marketplace",
            marketplaceUserId: mktUser.id,
          }
        );

        // Update last login
        prisma.marketplaceUser
          .update({
            where: { id: mktUser.id },
            data: { lastLoginAt: new Date() },
          })
          .catch((err: unknown) => {
            req.log.error(err, "Failed to update marketplace user last login");
          });

        return reply.send({
          ...tokens,
          user: {
            id: `mkt_${mktUser.id}`,
            email: mktUser.email,
            name:
              [mktUser.firstName, mktUser.lastName].filter(Boolean).join(" ") ||
              null,
            firstName: mktUser.firstName ?? "",
            lastName: mktUser.lastName ?? "",
          },
          tenant: null,
          accountMode: "provider" as const,
          provider: provider
            ? {
                id: provider.id,
                businessName: provider.businessName,
                providerType: provider.providerType,
                status: provider.status,
              }
            : null,
        });
      }

      // ─── Neither platform nor marketplace user found ─────────────────
      return reply.code(401).send({ error: "Invalid email or password" });
    } catch (error) {
      req.log.error(error, "Mobile login error");
      return reply.code(500).send({ error: "Login failed" });
    }
  });

  /**
   * POST /refresh
   * Refresh the access token using a valid refresh token.
   * Works for both platform and marketplace users.
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
      return reply
        .code(401)
        .send({ error: "Invalid or expired refresh token" });
    }
  });

  /**
   * POST /mobile-logout
   * Revoke the refresh token to end the session.
   * This is a best-effort operation - always returns success.
   * Works for both platform and marketplace users.
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
