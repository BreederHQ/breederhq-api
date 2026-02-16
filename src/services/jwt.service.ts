// src/services/jwt.service.ts
// JWT-based authentication for mobile clients
// - Access tokens: short-lived (1h), stateless
// - Refresh tokens: long-lived (30d), stored in DB for revocation
// - Supports both platform users (breeders) and marketplace users (providers)

import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import prisma from "../prisma.js";

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

// Validate secrets are configured (will throw at runtime if missing)
function ensureSecrets(): void {
  if (!ACCESS_TOKEN_SECRET) {
    throw new Error("JWT_ACCESS_SECRET environment variable is required");
  }
  if (!REFRESH_TOKEN_SECRET) {
    throw new Error("JWT_REFRESH_SECRET environment variable is required");
  }
}

export type AccountMode = "breeder" | "provider";
export type UserSource = "platform" | "marketplace";

/**
 * Payload embedded in the JWT access token.
 * Kept minimal to reduce token size.
 */
export interface TokenPayload {
  userId: string;
  tenantId: number | null;
  email: string;
  accountMode: AccountMode;
  userSource: UserSource;
}

export interface GenerateTokenOptions {
  accountMode?: AccountMode;
  userSource?: UserSource;
  /** Required when userSource is "marketplace" — the MarketplaceUser.id */
  marketplaceUserId?: number;
}

/**
 * Generates both access and refresh tokens for a user.
 * The refresh token is stored (hashed) in the database for revocation support.
 *
 * For platform users (breeders): stores in public.refresh_tokens
 * For marketplace users (providers): stores in marketplace.mobile_refresh_tokens
 */
export async function generateTokens(
  user: { id: string; email: string },
  tenantId: number | null,
  deviceId?: string,
  options?: GenerateTokenOptions
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  ensureSecrets();

  const accountMode = options?.accountMode ?? "breeder";
  const userSource = options?.userSource ?? "platform";

  const payload: TokenPayload = {
    userId: user.id,
    tenantId,
    email: user.email,
    accountMode,
    userSource,
  };

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  // Generate a random refresh token and hash it for storage
  const refreshToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  if (userSource === "marketplace" && options?.marketplaceUserId) {
    // Store in marketplace refresh token table
    await prisma.marketplaceMobileRefreshToken.create({
      data: {
        userId: options.marketplaceUserId,
        tokenHash,
        deviceId,
        expiresAt,
      },
    });
  } else {
    // Store in platform refresh token table (default)
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        deviceId,
        expiresAt,
      },
    });
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: 3600, // 1 hour in seconds
  };
}

/**
 * Verifies an access token and returns the payload.
 * Throws if the token is invalid or expired.
 *
 * Handles both old tokens (without accountMode) and new tokens.
 */
export function verifyAccessToken(token: string): TokenPayload {
  ensureSecrets();
  const raw = jwt.verify(token, ACCESS_TOKEN_SECRET!) as Record<string, unknown>;

  return {
    userId: raw.userId as string,
    tenantId: (raw.tenantId as number) ?? null,
    email: raw.email as string,
    // Backwards-compatible: old tokens won't have these fields
    accountMode: (raw.accountMode as AccountMode) ?? "breeder",
    userSource: (raw.userSource as UserSource) ?? "platform",
  };
}

/**
 * Refreshes an access token using a valid refresh token.
 * Returns a new access token if the refresh token is valid and not revoked.
 *
 * Checks both platform and marketplace refresh token tables.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  ensureSecrets();

  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  // Try platform refresh token table first
  const platformToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (platformToken) {
    if (platformToken.revokedAt || platformToken.expiresAt < new Date()) {
      throw new Error("Invalid or expired refresh token");
    }

    // Determine tenant ID - verify membership exists before using defaultTenantId
    let tenantId: number | null = null;

    if (platformToken.user.defaultTenantId) {
      const defaultMembership = await prisma.tenantMembership.findFirst({
        where: {
          userId: platformToken.user.id,
          tenantId: platformToken.user.defaultTenantId,
          membershipStatus: "ACTIVE",
        },
        select: { tenantId: true },
      });
      if (defaultMembership) {
        tenantId = platformToken.user.defaultTenantId;
      }
    }

    if (!tenantId) {
      const tenantMembership = await prisma.tenantMembership.findFirst({
        where: { userId: platformToken.user.id, membershipStatus: "ACTIVE" },
        select: { tenantId: true },
        orderBy: { tenantId: "asc" },
      });
      tenantId = tenantMembership?.tenantId ?? null;
    }

    if (!tenantId) {
      throw new Error("User has no active tenant membership");
    }

    const payload: TokenPayload = {
      userId: platformToken.user.id,
      tenantId,
      email: platformToken.user.email,
      accountMode: "breeder",
      userSource: "platform",
    };

    const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET!, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    return { accessToken, expiresIn: 3600 };
  }

  // Try marketplace refresh token table
  const marketplaceToken =
    await prisma.marketplaceMobileRefreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

  if (!marketplaceToken) {
    throw new Error("Invalid or expired refresh token");
  }

  if (
    marketplaceToken.revokedAt ||
    marketplaceToken.expiresAt < new Date()
  ) {
    throw new Error("Invalid or expired refresh token");
  }

  // Marketplace providers don't need a tenant
  const payload: TokenPayload = {
    userId: `mkt_${marketplaceToken.user.id}`,
    tenantId: null,
    email: marketplaceToken.user.email,
    accountMode: "provider",
    userSource: "marketplace",
  };

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  return { accessToken, expiresIn: 3600 };
}

/**
 * Revokes a refresh token by marking it in the database.
 * Subsequent attempts to use this token will fail.
 * Checks both platform and marketplace tables.
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  // Try platform table first
  try {
    await prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
    return;
  } catch {
    // Not found in platform table — try marketplace
  }

  try {
    await prisma.marketplaceMobileRefreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Token may not exist in either table - this is fine for logout
  }
}

/**
 * Revokes all refresh tokens for a platform user.
 * Use when user changes password or for security concerns.
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revokes all mobile refresh tokens for a marketplace user.
 */
export async function revokeAllMarketplaceUserTokens(
  marketplaceUserId: number
): Promise<void> {
  await prisma.marketplaceMobileRefreshToken.updateMany({
    where: { userId: marketplaceUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Cleans up expired refresh tokens from both tables.
 * Should be run periodically (e.g., daily cron job).
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const [platformResult, marketplaceResult] = await Promise.all([
    prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    }),
    prisma.marketplaceMobileRefreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    }),
  ]);
  return platformResult.count + marketplaceResult.count;
}
