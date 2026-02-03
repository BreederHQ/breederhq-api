// src/routes/marketplace-auth.ts
/**
 * Marketplace Authentication Routes
 *
 * Mounted at: /api/v1/marketplace/auth
 *
 * Endpoints:
 *   POST /register
 *   POST /login
 *   POST /logout
 *   POST /verify-email
 *   GET  /verify-email
 *   POST /forgot-password
 *   POST /reset-password
 *   GET  /reset-password
 *   GET  /me
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import {
  registerMarketplaceUser,
  verifyMarketplacePassword,
  updateLastLogin,
  createEmailVerificationToken,
  verifyEmailToken,
  createPasswordResetToken,
  verifyPasswordResetToken,
  resetPassword,
  findMarketplaceUserByEmail,
  findMarketplaceUserById,
} from "../services/marketplace-auth-service.js";
import {
  sendMarketplaceWelcomeEmail,
  sendMarketplacePasswordResetEmail,
} from "../services/marketplace-email-service.js";
import {
  setSessionCookies,
  clearSessionCookies,
  parseVerifiedSession,
  maybeRotateSession,
  type SessionPayload,
} from "../utils/session.js";
import { requireMarketplaceAuth } from "../middleware/marketplace-auth.js";
import { randomBytes } from "node:crypto";

const NODE_ENV = String(process.env.NODE_ENV || "").toLowerCase();
const IS_PROD = NODE_ENV === "production";
const EXPOSE_DEV_TOKENS = !IS_PROD;

const MARKETPLACE_URL = process.env.MARKETPLACE_URL || "https://marketplace.breederhq.com";

// Helper to check if redirect URL is safe
function isSafeRedirect(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export default async function marketplaceAuthRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /* ───────────────────────── Register ───────────────────────── */

  app.post("/register", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const {
      email = "",
      password = "",
      firstName = "",
      lastName = "",
      phone = "",
    } = (req.body || {}) as {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    };

    // Validation
    const e = String(email).trim();
    const p = String(password);
    const fn = String(firstName).trim();
    const ln = String(lastName).trim();

    if (!e) {
      return reply.code(400).send({ error: "email_required" });
    }
    if (!p) {
      return reply.code(400).send({ error: "password_required" });
    }
    if (p.length < 8) {
      return reply.code(400).send({ error: "password_too_short", message: "Password must be at least 8 characters" });
    }
    if (!fn) {
      return reply.code(400).send({ error: "first_name_required" });
    }
    if (!ln) {
      return reply.code(400).send({ error: "last_name_required" });
    }

    // Check if user already exists
    const existing = await findMarketplaceUserByEmail(e);
    if (existing) {
      return reply.code(409).send({ error: "email_already_registered" });
    }

    // Create user
    try {
      const user = await registerMarketplaceUser({
        email: e,
        password: p,
        firstName: fn,
        lastName: ln,
        phone: phone.trim() || undefined,
        userType: "buyer",
      });

      // Create email verification token
      const { raw } = await createEmailVerificationToken(user.id, user.email);

      // Send welcome email with verification link (fire and forget)
      sendMarketplaceWelcomeEmail({
        email: user.email,
        firstName: user.firstName || "there",
        verificationToken: raw,
      }).catch((err) => {
        req.log?.error?.({ err, email: user.email }, "Failed to send welcome email");
      });

      // Create session using unified session system
      setSessionCookies(
        reply,
        {
          userId: String(user.id),
          tenantId: user.tenantId ?? undefined,
        },
        "MARKETPLACE"
      );

      return reply.code(201).send({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          emailVerified: user.emailVerified,
        },
        ...(EXPOSE_DEV_TOKENS ? { dev_verification_token: raw } : {}),
      });
    } catch (err: any) {
      req.log?.error?.({ err, email: e }, "Registration failed");
      return reply.code(500).send({ error: "registration_failed" });
    }
  });

  /* ───────────────────────── Login ───────────────────────── */

  app.post("/login", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { email = "", password = "" } = (req.body || {}) as {
      email?: string;
      password?: string;
    };

    const e = String(email).trim().toLowerCase();
    const p = String(password);

    if (!e || !p) {
      return reply.code(400).send({ error: "email_and_password_required" });
    }

    // First, try to verify as marketplace user
    let user = await verifyMarketplacePassword(e, p);

    // If not found in marketplace, check platform user table and create/fetch marketplace user
    if (!user) {
      // Check if this is a platform user trying to login
      const platformUser = await prisma.user.findUnique({
        where: { email: e },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          passwordHash: true,
        },
      });

      if (platformUser && platformUser.passwordHash) {
        // Verify platform password
        const validPassword = await bcrypt.compare(p, platformUser.passwordHash);

        if (validPassword) {
          // Check if MarketplaceUser already exists (from previous SSO or login)
          user = await findMarketplaceUserByEmail(e);

          if (!user) {
            // Create new marketplace user from platform user (SSO-style)
            const randomPassword = randomBytes(32).toString("base64");
            const passwordHash = await bcrypt.hash(randomPassword, 12);

            // Check if they're a breeder
            const tenantMembership = await prisma.tenantMembership.findFirst({
              where: { userId: platformUser.id },
              include: {
                tenant: {
                  include: {
                    subscriptions: {
                      where: { status: { in: ["ACTIVE", "TRIAL"] } },
                      take: 1,
                    },
                  },
                },
              },
            });

            const isBreeder = !!(
              tenantMembership?.tenant?.subscriptions &&
              tenantMembership.tenant.subscriptions.length > 0
            );

            user = await prisma.marketplaceUser.create({
              data: {
                email: e,
                passwordHash, // Random password - they'll use platform password or SSO
                firstName: platformUser.firstName,
                lastName: platformUser.lastName,
                userType: "buyer",
                status: "active",
                emailVerified: true, // Platform users already verified
                tenantId: isBreeder && tenantMembership ? tenantMembership.tenant.id : null,
              },
            });

            req.log?.info?.({
              platformUserId: platformUser.id,
              marketplaceUserId: user.id,
              email: e,
              isBreeder,
            }, "Created MarketplaceUser via platform login fallback");
          } else {
            req.log?.info?.({
              platformUserId: platformUser.id,
              marketplaceUserId: user.id,
              email: e,
            }, "Found existing MarketplaceUser via platform login fallback");
          }
        }
      }
    }

    if (!user) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    // Check if account is suspended
    if (user.suspendedAt) {
      return reply.code(403).send({
        error: "account_suspended",
        message: user.suspendedReason || "Your account has been suspended.",
      });
    }

    // Check if account is inactive
    if (user.status !== "active") {
      return reply.code(403).send({
        error: "account_inactive",
        message: "Your account is not active.",
      });
    }

    // Update last login
    updateLastLogin(user.id).catch((err) => {
      req.log?.error?.({ err, userId: user.id }, "Failed to update last login");
    });

    // Create session using unified session system
    setSessionCookies(
      reply,
      {
        userId: String(user.id),
        tenantId: user.tenantId ?? undefined,
      },
      "MARKETPLACE"
    );

    return reply.send({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        emailVerified: user.emailVerified,
      },
    });
  });

  /* ───────────────────────── Logout ───────────────────────── */

  app.post("/logout", async (req, reply) => {
    const { redirect } = (req.query || {}) as { redirect?: string };

    // Clear session cookies for marketplace surface
    clearSessionCookies(reply, "MARKETPLACE");

    if (redirect && isSafeRedirect(redirect)) {
      return reply.redirect(encodeURI(redirect));
    }

    return reply.send({ ok: true });
  });

  /* ───────────────────────── Verify Email ───────────────────────── */

  // POST /verify-email { token }
  app.post("/verify-email", async (req, reply) => {
    const { token = "" } = (req.body || {}) as { token?: string };

    if (!token) {
      return reply.code(400).send({ error: "token_required" });
    }

    const user = await verifyEmailToken(token);

    if (!user) {
      return reply.code(400).send({ error: "invalid_or_expired_token" });
    }

    return reply.send({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });
  });

  // GET /verify-email?token=...&redirect=...
  app.get("/verify-email", async (req, reply) => {
    const { token = "", redirect } = (req.query || {}) as {
      token?: string;
      redirect?: string;
    };

    if (!token) {
      return reply.code(400).send({ error: "token_required" });
    }

    const user = await verifyEmailToken(token);
    const ok = !!user;

    if (redirect && isSafeRedirect(redirect)) {
      const url = new URL(redirect);
      url.searchParams.set("verified", ok ? "1" : "0");
      return reply.redirect(url.toString());
    }

    return reply.type("text/html").send(
      ok
        ? "<!doctype html><meta charset=utf-8><title>Email Verified</title><p>Email verified successfully! You may close this window.</p>"
        : "<!doctype html><meta charset=utf-8><title>Invalid Token</title><p>Verification link is invalid or expired.</p>"
    );
  });

  /* ───────────────────────── Resend Verification Email ───────────────────────── */

  app.post("/resend-verification", {
    config: { rateLimit: { max: 3, timeWindow: "10 minutes" } },
  }, async (req, reply) => {
    const { email = "" } = (req.body || {}) as { email?: string };
    const e = String(email).trim().toLowerCase();

    if (!e) {
      return reply.code(400).send({ error: "email_required" });
    }

    // Find user by email
    const user = await findMarketplaceUserByEmail(e);

    // Always return success (don't reveal if email exists)
    if (!user) {
      return reply.send({
        ok: true,
        message: "If an account exists with that email, you'll receive a verification link."
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return reply.code(400).send({
        error: "already_verified",
        message: "This email address is already verified."
      });
    }

    // Create new verification token
    const { raw } = await createEmailVerificationToken(user.id, user.email);

    // Send welcome email with verification link (fire and forget)
    sendMarketplaceWelcomeEmail({
      email: user.email,
      firstName: user.firstName || "there",
      verificationToken: raw,
    }).catch((err) => {
      req.log?.error?.({ err, email: user.email }, "Failed to resend verification email");
    });

    return reply.send({
      ok: true,
      message: "Verification email sent. Please check your inbox."
    });
  });

  /* ───────────────────────── Forgot Password ───────────────────────── */

  app.post("/forgot-password", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { email = "" } = (req.body || {}) as { email?: string };
    const e = String(email).trim();

    if (!e) {
      return reply.code(400).send({ error: "email_required" });
    }

    // Always return success to prevent email enumeration
    const token = await createPasswordResetToken(e);

    if (token) {
      const user = await findMarketplaceUserByEmail(e);

      if (user) {
        // Send password reset email (fire and forget)
        sendMarketplacePasswordResetEmail({
          email: user.email,
          firstName: user.firstName,
          resetToken: token.raw,
        }).catch((err) => {
          req.log?.error?.({ err, email: e }, "Failed to send password reset email");
        });

        if (EXPOSE_DEV_TOKENS) {
          return reply.send({ ok: true, dev_reset_token: token.raw });
        }
      }
    }

    return reply.send({ ok: true });
  });

  /* ───────────────────────── Reset Password ───────────────────────── */

  // GET /reset-password?token=...&redirect=...
  app.get("/reset-password", async (req, reply) => {
    const { token = "", redirect } = (req.query || {}) as {
      token?: string;
      redirect?: string;
    };

    if (!token) {
      return reply.code(400).send({ error: "token_required" });
    }

    const user = await verifyPasswordResetToken(token);
    const ok = !!user;

    if (redirect && isSafeRedirect(redirect)) {
      const url = new URL(redirect);
      url.searchParams.set("ok", ok ? "1" : "0");
      if (ok) url.searchParams.set("token", token);
      return reply.redirect(url.toString());
    }

    return reply.type("text/html").send(
      ok
        ? "<!doctype html><meta charset=utf-8><title>Reset Password</title><p>Token is valid. Continue in the app to reset your password.</p>"
        : "<!doctype html><meta charset=utf-8><title>Invalid Token</title><p>Reset link is invalid or expired.</p>"
    );
  });

  // POST /reset-password { token, password }
  app.post("/reset-password", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { token = "", password = "" } = (req.body || {}) as {
      token?: string;
      password?: string;
    };

    if (!token || !password) {
      return reply.code(400).send({ error: "token_and_password_required" });
    }

    if (password.length < 8) {
      return reply.code(400).send({ error: "password_too_short", message: "Password must be at least 8 characters" });
    }

    const user = await resetPassword(token, password);

    if (!user) {
      return reply.code(400).send({ error: "invalid_or_expired_token" });
    }

    return reply.send({ ok: true });
  });

  /* ───────────────────────── Me (Current User) ───────────────────────── */

  app.get("/me", {
    preHandler: requireMarketplaceAuth,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const session = req.marketplaceSession!;

    // Fetch fresh user data
    const user = await findMarketplaceUserById(userId);

    if (!user) {
      return reply.code(401).send({ error: "unauthorized", message: "User not found" });
    }

    // Maybe rotate session if close to expiry
    maybeRotateSession(req, reply, session, "MARKETPLACE");

    return reply.send({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      userType: user.userType,
      emailVerified: user.emailVerified,
      status: user.status,
      suspendedAt: user.suspendedAt,
      suspendedReason: user.suspendedReason,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      city: user.city,
      state: user.state,
      zip: user.zip,
      country: user.country,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  });

  // PATCH /me - Update user profile
  app.patch("/me", {
    preHandler: requireMarketplaceAuth,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { firstName, lastName, phone } = (req.body || {}) as {
      firstName?: string;
      lastName?: string;
      phone?: string;
    };

    // Validate inputs
    if (firstName !== undefined && firstName.trim().length === 0) {
      return reply.code(400).send({ error: "first_name_required" });
    }
    if (lastName !== undefined && lastName.trim().length === 0) {
      return reply.code(400).send({ error: "last_name_required" });
    }
    if (phone !== undefined && phone.trim().length < 10) {
      return reply.code(400).send({ error: "invalid_phone", message: "Phone number must be at least 10 characters" });
    }

    try {
      // Update user profile
      const updatedUser = await prisma.marketplaceUser.update({
        where: { id: userId },
        data: {
          ...(firstName !== undefined && { firstName: firstName.trim() }),
          ...(lastName !== undefined && { lastName: lastName.trim() }),
          ...(phone !== undefined && { phone: phone.trim() }),
        },
      });

      return reply.send({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
        userType: updatedUser.userType,
        emailVerified: updatedUser.emailVerified,
        status: updatedUser.status,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      });
    } catch (err) {
      req.log?.error?.({ err, userId }, "Failed to update user profile");
      return reply.code(500).send({ error: "update_failed", message: "Unable to update profile" });
    }
  });

  /* ───────────────────────── Change Password ───────────────────────── */

  app.post("/change-password", {
    preHandler: requireMarketplaceAuth,
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { currentPassword, newPassword } = (req.body || {}) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ error: "current_and_new_password_required" });
    }

    if (newPassword.length < 8) {
      return reply.code(400).send({ error: "password_too_short", message: "Password must be at least 8 characters" });
    }

    try {
      // Verify current password - need to fetch user with passwordHash
      const user = await prisma.marketplaceUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          passwordHash: true,
        },
      });

      if (!user || !user.passwordHash) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!validPassword) {
        return reply.code(401).send({ error: "invalid_current_password", message: "Current password is incorrect" });
      }

      // Hash and update new password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.marketplaceUser.update({
        where: { id: userId },
        data: { passwordHash },
      });

      return reply.send({ ok: true, message: "Password changed successfully" });
    } catch (err) {
      req.log?.error?.({ err, userId }, "Failed to change password");
      return reply.code(500).send({ error: "change_failed", message: "Unable to change password" });
    }
  });

  /* ───────────────────────── SSO from Platform ───────────────────────── */

  /**
   * SSO endpoint for platform users to auto-login to marketplace.
   *
   * If user has a valid PLATFORM session (bhq_s_app cookie), this endpoint:
   * 1. Validates the platform session
   * 2. Finds the platform User record
   * 3. Finds or creates a matching MarketplaceUser (by email)
   * 4. Sets the MARKETPLACE session cookie (bhq_s_mkt)
   *
   * This enables seamless SSO: platform users visiting marketplace.breederhq.com
   * are automatically logged in without re-entering credentials.
   */
  app.post("/sso", async (req, reply) => {
    // Check for valid PLATFORM session
    const platformSession = parseVerifiedSession(req, "PLATFORM");

    if (!platformSession) {
      return reply.code(401).send({
        error: "no_platform_session",
        message: "No valid platform session found.",
      });
    }

    const platformUserId = platformSession.userId;

    // Fetch platform user to get email
    const platformUser = await prisma.user.findUnique({
      where: { id: platformUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!platformUser) {
      return reply.code(401).send({
        error: "platform_user_not_found",
        message: "Platform user not found.",
      });
    }

    // Find existing MarketplaceUser by email (case-insensitive)
    const email = platformUser.email.toLowerCase();
    let marketplaceUser = await prisma.marketplaceUser.findUnique({
      where: { email },
    });

    if (!marketplaceUser) {
      // Create new MarketplaceUser linked to platform user
      // Generate a random password hash (user will use SSO, not password login)
      const randomPassword = randomBytes(32).toString("base64");
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      marketplaceUser = await prisma.marketplaceUser.create({
        data: {
          email,
          passwordHash,
          firstName: platformUser.firstName,
          lastName: platformUser.lastName,
          userType: "buyer", // Default to buyer, can be upgraded later
          status: "active",
          emailVerified: true, // Platform users already verified their email
          // tenantId can be set later if they have a breeder account
        },
      });

      req.log?.info?.({
        platformUserId,
        marketplaceUserId: marketplaceUser.id,
        email,
      }, "Created MarketplaceUser via SSO from platform");
    }

    // Check if marketplace user is suspended
    if (marketplaceUser.suspendedAt) {
      return reply.code(403).send({
        error: "account_suspended",
        message: marketplaceUser.suspendedReason || "Your marketplace account has been suspended.",
      });
    }

    // Check if marketplace user is inactive
    if (marketplaceUser.status !== "active") {
      return reply.code(403).send({
        error: "account_inactive",
        message: "Your marketplace account is not active.",
      });
    }

    // Update last login
    updateLastLogin(marketplaceUser.id).catch((err) => {
      req.log?.error?.({ err, userId: marketplaceUser!.id }, "Failed to update last login via SSO");
    });

    // Check if platform user is a breeder (has tenant membership with active subscription)
    const tenantMembership = await prisma.tenantMembership.findFirst({
      where: { userId: platformUserId },
      include: {
        tenant: {
          include: {
            subscriptions: {
              where: { status: { in: ["ACTIVE", "TRIAL"] } },
              take: 1,
            },
          },
        },
      },
    });

    const isBreeder = !!(
      tenantMembership?.tenant?.subscriptions &&
      tenantMembership.tenant.subscriptions.length > 0
    );

    // Update marketplace user's tenantId if they're a breeder and not already linked
    if (isBreeder && tenantMembership && !marketplaceUser.tenantId) {
      await prisma.marketplaceUser.update({
        where: { id: marketplaceUser.id },
        data: { tenantId: tenantMembership.tenant.id },
      });
      marketplaceUser.tenantId = tenantMembership.tenant.id;
    }

    // Set MARKETPLACE session cookie
    setSessionCookies(
      reply,
      {
        userId: String(marketplaceUser.id),
        tenantId: marketplaceUser.tenantId ?? undefined,
      },
      "MARKETPLACE"
    );

    return reply.send({
      ok: true,
      sso: true,
      isBreeder,
      breederTenant: isBreeder && tenantMembership ? {
        id: tenantMembership.tenant.id,
        name: tenantMembership.tenant.name,
      } : null,
      user: {
        id: marketplaceUser.id,
        email: marketplaceUser.email,
        firstName: marketplaceUser.firstName,
        lastName: marketplaceUser.lastName,
        userType: marketplaceUser.userType,
        emailVerified: marketplaceUser.emailVerified,
      },
    });
  });

  /* ───────────────────────── SSO Check ───────────────────────── */

  /**
   * Check if SSO is available (has valid platform session).
   * Used by frontend to decide whether to show SSO button or redirect automatically.
   */
  app.get("/sso/check", async (req, reply) => {
    // Check for existing MARKETPLACE session first
    const marketplaceSession = parseVerifiedSession(req, "MARKETPLACE");

    if (marketplaceSession) {
      const userId = parseInt(marketplaceSession.userId, 10);
      if (Number.isFinite(userId) && userId > 0) {
        const user = await findMarketplaceUserById(userId);
        if (user) {
          // Check if this marketplace user is linked to a breeder account
          let isBreeder = false;
          let breederTenant = null;

          if (user.tenantId) {
            const tenant = await prisma.tenant.findUnique({
              where: { id: user.tenantId },
              include: {
                subscriptions: {
                  where: { status: { in: ["ACTIVE", "TRIAL"] } },
                  take: 1,
                },
              },
            });

            isBreeder = !!(
              tenant?.subscriptions &&
              tenant.subscriptions.length > 0
            );

            if (isBreeder && tenant) {
              breederTenant = { id: tenant.id, name: tenant.name };
            }
          }

          return reply.send({
            hasMarketplaceSession: true,
            hasPlatformSession: false, // Don't check if already logged in
            isBreeder,
            breederTenant,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              userType: user.userType,
              emailVerified: user.emailVerified,
            },
          });
        }
      }
    }

    // Check for PLATFORM session
    const platformSession = parseVerifiedSession(req, "PLATFORM");

    if (platformSession) {
      const platformUser = await prisma.user.findUnique({
        where: { id: platformSession.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      if (platformUser) {
        // Check if platform user is a breeder
        const tenantMembership = await prisma.tenantMembership.findFirst({
          where: { userId: platformSession.userId },
          include: {
            tenant: {
              include: {
                subscriptions: {
                  where: { status: { in: ["ACTIVE", "TRIAL"] } },
                  take: 1,
                },
              },
            },
          },
        });

        const isBreeder = !!(
          tenantMembership?.tenant?.subscriptions &&
          tenantMembership.tenant.subscriptions.length > 0
        );

        return reply.send({
          hasMarketplaceSession: false,
          hasPlatformSession: true,
          isBreeder,
          breederTenant: isBreeder && tenantMembership ? {
            id: tenantMembership.tenant.id,
            name: tenantMembership.tenant.name,
          } : null,
          platformUser: {
            email: platformUser.email,
            firstName: platformUser.firstName,
            lastName: platformUser.lastName,
          },
        });
      }
    }

    return reply.send({
      hasMarketplaceSession: false,
      hasPlatformSession: false,
      isBreeder: false,
      breederTenant: null,
    });
  });
}
