// src/services/marketplace-auth-service.ts
/**
 * Marketplace Authentication Service
 *
 * Handles authentication for marketplace users (buyers and service providers).
 * Uses marketplace.users table instead of public.User table.
 */

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import prisma from "../prisma.js";

// ---------- Token Utilities ----------

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sha256b64url(input: string | Buffer): string {
  return b64url(createHash("sha256").update(input).digest());
}

function newRawToken(): string {
  return b64url(randomBytes(32));
}

// ---------- Types ----------

export type MarketplaceUser = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  userType: string;
  tenantId: number | null;
  tenantVerified: boolean;
  stripeCustomerId: string | null;
  status: string;
  emailVerified: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VerificationToken = {
  raw: string;
  hash: string;
  expires: Date;
};

// ---------- User Operations ----------

/**
 * Find marketplace user by email
 */
export async function findMarketplaceUserByEmail(email: string): Promise<MarketplaceUser | null> {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return null;

  const user = await prisma.marketplaceUser.findUnique({
    where: { email: e },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      firstName: true,
      lastName: true,
      phone: true,
      userType: true,
      tenantId: true,
      tenantVerified: true,
      stripeCustomerId: true,
      status: true,
      emailVerified: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      suspendedAt: true,
      suspendedReason: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return null;

  // Return without passwordHash for security
  const { passwordHash, ...safeUser } = user;
  return safeUser as MarketplaceUser;
}

/**
 * Find marketplace user by ID
 */
export async function findMarketplaceUserById(id: number): Promise<MarketplaceUser | null> {
  const user = await prisma.marketplaceUser.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      userType: true,
      tenantId: true,
      tenantVerified: true,
      stripeCustomerId: true,
      status: true,
      emailVerified: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      suspendedAt: true,
      suspendedReason: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user as MarketplaceUser | null;
}

/**
 * Register a new marketplace user
 */
export async function registerMarketplaceUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userType?: string;
}): Promise<MarketplaceUser> {
  const email = data.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.marketplaceUser.create({
    data: {
      email,
      passwordHash,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone?.trim() || null,
      userType: data.userType || "buyer",
      status: "active",
      emailVerified: false,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      userType: true,
      tenantId: true,
      tenantVerified: true,
      stripeCustomerId: true,
      status: true,
      emailVerified: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      suspendedAt: true,
      suspendedReason: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user as MarketplaceUser;
}

/**
 * Verify password for marketplace user
 */
export async function verifyMarketplacePassword(email: string, password: string): Promise<MarketplaceUser | null> {
  const e = email.trim().toLowerCase();

  const user = await prisma.marketplaceUser.findUnique({
    where: { email: e },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      firstName: true,
      lastName: true,
      phone: true,
      userType: true,
      tenantId: true,
      tenantVerified: true,
      stripeCustomerId: true,
      status: true,
      emailVerified: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      suspendedAt: true,
      suspendedReason: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || !user.passwordHash) return null;

  const valid = await bcrypt.compare(password, user.passwordHash).catch(() => false);
  if (!valid) return null;

  // Return without passwordHash
  const { passwordHash, ...safeUser } = user;
  return safeUser as MarketplaceUser;
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(userId: number): Promise<void> {
  await prisma.marketplaceUser.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

// ---------- Email Verification ----------

/**
 * Create email verification token
 */
export async function createEmailVerificationToken(userId: number, email: string): Promise<VerificationToken> {
  const raw = newRawToken();
  const hash = sha256b64url(raw);
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.marketplaceUser.update({
    where: { id: userId },
    data: {
      emailVerifyToken: hash,
      emailVerifyExpires: expires,
    },
  });

  return { raw, hash, expires };
}

/**
 * Verify email token and mark email as verified
 */
export async function verifyEmailToken(rawToken: string): Promise<MarketplaceUser | null> {
  const hash = sha256b64url(rawToken);

  const user = await prisma.marketplaceUser.findFirst({
    where: {
      emailVerifyToken: hash,
      emailVerifyExpires: { gt: new Date() },
    },
  });

  if (!user) return null;

  // Mark email as verified and clear token
  const updated = await prisma.marketplaceUser.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      userType: true,
      tenantId: true,
      tenantVerified: true,
      stripeCustomerId: true,
      status: true,
      emailVerified: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      suspendedAt: true,
      suspendedReason: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updated as MarketplaceUser;
}

/**
 * Create a 6-digit email verification code (for inline verification flows).
 * Stores SHA256 hash in the existing emailVerifyToken field, 10-minute expiry.
 */
export async function createEmailVerificationCode(userId: number): Promise<string> {
  // Generate 6-digit code: 100000–999999
  const code = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
  const hash = sha256b64url(code);
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.marketplaceUser.update({
    where: { id: userId },
    data: {
      emailVerifyToken: hash,
      emailVerifyExpires: expires,
    },
  });

  return code;
}

/**
 * Verify a 6-digit email code and mark email as verified.
 */
export async function verifyEmailCode(userId: number, code: string): Promise<boolean> {
  const hash = sha256b64url(code);

  const user = await prisma.marketplaceUser.findUnique({
    where: { id: userId },
    select: {
      emailVerifyToken: true,
      emailVerifyExpires: true,
    },
  });

  if (!user || !user.emailVerifyToken || !user.emailVerifyExpires) {
    return false;
  }

  // Check if token matches and hasn't expired
  if (user.emailVerifyToken !== hash || user.emailVerifyExpires < new Date()) {
    return false;
  }

  // Mark as verified, clear token
  await prisma.marketplaceUser.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
    },
  });

  return true;
}

// ---------- Password Reset ----------

/**
 * Create password reset token
 */
export async function createPasswordResetToken(email: string): Promise<VerificationToken | null> {
  const e = email.trim().toLowerCase();

  const user = await prisma.marketplaceUser.findUnique({
    where: { email: e },
  });

  if (!user) return null;

  const raw = newRawToken();
  const hash = sha256b64url(raw);
  const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await prisma.marketplaceUser.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hash,
      passwordResetExpires: expires,
    },
  });

  return { raw, hash, expires };
}

/**
 * Verify password reset token (without consuming)
 */
export async function verifyPasswordResetToken(rawToken: string): Promise<MarketplaceUser | null> {
  const hash = sha256b64url(rawToken);

  const user = await prisma.marketplaceUser.findFirst({
    where: {
      passwordResetToken: hash,
      passwordResetExpires: { gt: new Date() },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      userType: true,
      tenantId: true,
      tenantVerified: true,
      stripeCustomerId: true,
      status: true,
      emailVerified: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      suspendedAt: true,
      suspendedReason: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user as MarketplaceUser | null;
}

/**
 * Reset password using token
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<MarketplaceUser | null> {
  const hash = sha256b64url(rawToken);

  const user = await prisma.marketplaceUser.findFirst({
    where: {
      passwordResetToken: hash,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) return null;

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const updated = await prisma.marketplaceUser.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      userType: true,
      tenantId: true,
      tenantVerified: true,
      stripeCustomerId: true,
      status: true,
      emailVerified: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zip: true,
      country: true,
      suspendedAt: true,
      suspendedReason: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updated as MarketplaceUser;
}
