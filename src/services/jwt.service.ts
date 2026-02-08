// src/services/jwt.service.ts
// JWT-based authentication for mobile clients
// - Access tokens: short-lived (1h), stateless
// - Refresh tokens: long-lived (30d), stored in DB for revocation

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

/**
 * Payload embedded in the JWT access token.
 * Kept minimal to reduce token size.
 */
export interface TokenPayload {
  userId: string;
  tenantId: number;
  email: string;
}

/**
 * Generates both access and refresh tokens for a user.
 * The refresh token is stored (hashed) in the database for revocation support.
 */
export async function generateTokens(
  user: { id: string; email: string },
  tenantId: number,
  deviceId?: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  ensureSecrets();

  const payload: TokenPayload = {
    userId: user.id,
    tenantId,
    email: user.email,
  };

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  // Generate a random refresh token and hash it for storage
  const refreshToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      deviceId,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: 3600, // 1 hour in seconds
  };
}

/**
 * Verifies an access token and returns the payload.
 * Throws if the token is invalid or expired.
 */
export function verifyAccessToken(token: string): TokenPayload {
  ensureSecrets();
  return jwt.verify(token, ACCESS_TOKEN_SECRET!) as TokenPayload;
}

/**
 * Refreshes an access token using a valid refresh token.
 * Returns a new access token if the refresh token is valid and not revoked.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  ensureSecrets();

  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
    throw new Error("Invalid or expired refresh token");
  }

  // Get user's default tenant for the new token
  const tenantMembership = await prisma.tenantMembership.findFirst({
    where: { userId: storedToken.user.id, membershipStatus: "ACTIVE" },
    select: { tenantId: true },
  });

  const tenantId = storedToken.user.defaultTenantId ?? tenantMembership?.tenantId;
  if (!tenantId) {
    throw new Error("User has no active tenant membership");
  }

  const payload: TokenPayload = {
    userId: storedToken.user.id,
    tenantId,
    email: storedToken.user.email,
  };

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  return {
    accessToken,
    expiresIn: 3600,
  };
}

/**
 * Revokes a refresh token by marking it in the database.
 * Subsequent attempts to use this token will fail.
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  try {
    await prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Token may not exist - this is fine for logout
  }
}

/**
 * Revokes all refresh tokens for a user.
 * Use when user changes password or for security concerns.
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Cleans up expired refresh tokens from the database.
 * Should be run periodically (e.g., daily cron job).
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { not: null } },
      ],
    },
  });
  return result.count;
}
