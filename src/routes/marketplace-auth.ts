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

    const e = String(email).trim();
    const p = String(password);

    if (!e || !p) {
      return reply.code(400).send({ error: "email_and_password_required" });
    }

    // Verify credentials
    const user = await verifyMarketplacePassword(e, p);

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
}
