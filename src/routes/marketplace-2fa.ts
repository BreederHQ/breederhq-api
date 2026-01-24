// src/routes/marketplace-2fa.ts
/**
 * Marketplace Two-Factor Authentication Routes
 *
 * Mounted at: /api/v1/marketplace/2fa
 *
 * Endpoints:
 *   GET  /status                 - Get 2FA status
 *   POST /totp/setup             - Generate TOTP secret
 *   POST /totp/verify            - Verify TOTP and enable 2FA
 *   POST /totp/challenge         - Verify TOTP code (for login challenge)
 *   POST /sms/send               - Send SMS verification code
 *   POST /sms/verify             - Verify SMS code and enable 2FA
 *   POST /sms/challenge          - Verify SMS code (for login challenge)
 *   POST /passkey/register/start - Start passkey registration
 *   POST /passkey/register/finish - Complete passkey registration
 *   POST /passkey/auth/start     - Start passkey authentication
 *   POST /passkey/auth/finish    - Complete passkey authentication
 *   POST /disable                - Disable 2FA
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { requireMarketplaceAuth } from "../middleware/marketplace-auth.js";
import {
  getUserTwoFactorStatus,
  generateTOTPSecret,
  verifyAndEnableTOTP,
  verifyTOTPCode,
  sendUserSMSVerification,
  verifyUserSMSCode,
  disableUserTwoFactor,
  checkAndSetServiceProviderTier,
} from "../services/marketplace-verification-service.js";
import prisma from "../prisma.js";
import bcrypt from "bcryptjs";
import {
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";

const NODE_ENV = String(process.env.NODE_ENV || "").toLowerCase();
const IS_PROD = NODE_ENV === "production";
const EXPOSE_DEV_TOKENS = !IS_PROD;

// WebAuthn configuration
const RP_ID = IS_PROD ? "breederhq.com" : "localhost";
const RP_NAME = "BreederHQ";
const EXPECTED_ORIGINS = IS_PROD
  ? ["https://breederhq.com", "https://www.breederhq.com", "https://marketplace.breederhq.com"]
  : ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"];

/**
 * B-02 FIX: Verify marketplace user password by userId
 * Used for security-sensitive operations like disabling 2FA
 */
async function verifyPasswordByUserId(userId: number, password: string): Promise<boolean> {
  const user = await prisma.marketplaceUser.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) return false;

  return bcrypt.compare(password, user.passwordHash).catch(() => false);
}

/**
 * Log security event for audit trail
 */
async function logSecurityEvent(data: {
  userId: number;
  event: string;
  ip?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  // Log to console for now - in production, this should go to a dedicated security log table
  console.info(`[SECURITY] ${data.event}`, {
    userId: data.userId,
    ip: data.ip,
    timestamp: new Date().toISOString(),
    ...data.details,
  });
}

export default async function marketplace2faRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /* ───────────────────────────────────────────────────────────────────
   * 2FA STATUS
   * ─────────────────────────────────────────────────────────────────── */

  /**
   * Get 2FA status for current user
   */
  app.get("/status", {
    preHandler: requireMarketplaceAuth,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;

    const status = await getUserTwoFactorStatus(userId);

    if (!status) {
      return reply.code(404).send({ error: "user_not_found" });
    }

    return reply.send(status);
  });

  /* ───────────────────────────────────────────────────────────────────
   * TOTP (AUTHENTICATOR APP)
   * ─────────────────────────────────────────────────────────────────── */

  /**
   * Generate TOTP secret and return QR code URL
   */
  app.post("/totp/setup", {
    preHandler: requireMarketplaceAuth,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;

    try {
      const { secret, otpauthUrl } = await generateTOTPSecret(userId);

      return reply.send({
        ok: true,
        secret, // For manual entry
        otpauthUrl, // For QR code generation
      });
    } catch (err: any) {
      req.log?.error?.({ err, userId }, "Failed to generate TOTP secret");
      return reply.code(500).send({ error: "setup_failed" });
    }
  });

  /**
   * Verify TOTP code and enable 2FA
   */
  app.post("/totp/verify", {
    preHandler: requireMarketplaceAuth,
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { code } = (req.body || {}) as { code?: string };

    if (!code) {
      return reply.code(400).send({ error: "code_required" });
    }

    const result = await verifyAndEnableTOTP(userId, code);

    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }

    // Check and set service provider tier if applicable
    await checkAndSetServiceProviderTier(userId);

    return reply.send({ ok: true, method: "TOTP" });
  });

  /**
   * Verify TOTP code for login challenge
   * Note: This would typically be called after initial login returns a 2FA challenge
   */
  app.post("/totp/challenge", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { userId, code } = (req.body || {}) as { userId?: number; code?: string };

    if (!userId || !code) {
      return reply.code(400).send({ error: "user_id_and_code_required" });
    }

    const isValid = await verifyTOTPCode(userId, code);

    if (!isValid) {
      return reply.code(401).send({ error: "invalid_code" });
    }

    return reply.send({ ok: true });
  });

  /* ───────────────────────────────────────────────────────────────────
   * SMS VERIFICATION
   * ─────────────────────────────────────────────────────────────────── */

  /**
   * Send SMS verification code
   */
  app.post("/sms/send", {
    preHandler: requireMarketplaceAuth,
    config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { phoneNumber } = (req.body || {}) as { phoneNumber?: string };

    if (!phoneNumber) {
      return reply.code(400).send({ error: "phone_number_required" });
    }

    // Validate phone number format (basic check)
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length < 10 || cleaned.length > 15) {
      return reply.code(400).send({ error: "invalid_phone_number" });
    }

    try {
      const result = await sendUserSMSVerification(userId, phoneNumber);

      return reply.send({
        ok: true,
        expiresAt: result.expiresAt,
        ...(EXPOSE_DEV_TOKENS && result.code ? { dev_code: result.code } : {}),
      });
    } catch (err: any) {
      req.log?.error?.({ err, userId }, "Failed to send SMS verification");
      return reply.code(500).send({ error: "send_failed" });
    }
  });

  /**
   * Verify SMS code and enable 2FA
   */
  app.post("/sms/verify", {
    preHandler: requireMarketplaceAuth,
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { code } = (req.body || {}) as { code?: string };

    if (!code) {
      return reply.code(400).send({ error: "code_required" });
    }

    const result = await verifyUserSMSCode(userId, code);

    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }

    // Check and set service provider tier if applicable
    await checkAndSetServiceProviderTier(userId);

    return reply.send({ ok: true, method: "SMS" });
  });

  /**
   * Verify SMS code for login challenge
   * Note: This would send a new SMS and verify it
   */
  app.post("/sms/challenge", {
    config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { userId, action } = (req.body || {}) as { userId?: number; action?: "send" | "verify"; code?: string };

    if (!userId) {
      return reply.code(400).send({ error: "user_id_required" });
    }

    // Get user to check SMS is their 2FA method
    const user = await prisma.marketplaceUser.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        twoFactorMethod: true,
        smsPhoneNumber: true,
      },
    });

    if (!user || !user.twoFactorEnabled || user.twoFactorMethod !== "SMS") {
      return reply.code(400).send({ error: "sms_2fa_not_enabled" });
    }

    if (!user.smsPhoneNumber) {
      return reply.code(400).send({ error: "no_phone_number" });
    }

    if (action === "send") {
      try {
        const result = await sendUserSMSVerification(userId, user.smsPhoneNumber);
        return reply.send({
          ok: true,
          expiresAt: result.expiresAt,
          ...(EXPOSE_DEV_TOKENS && result.code ? { dev_code: result.code } : {}),
        });
      } catch (err: any) {
        req.log?.error?.({ err, userId }, "Failed to send SMS challenge");
        return reply.code(500).send({ error: "send_failed" });
      }
    }

    if (action === "verify") {
      const { code } = (req.body || {}) as { code?: string };
      if (!code) {
        return reply.code(400).send({ error: "code_required" });
      }

      const result = await verifyUserSMSCode(userId, code);
      if (!result.success) {
        return reply.code(401).send({ error: result.error });
      }

      return reply.send({ ok: true });
    }

    return reply.code(400).send({ error: "invalid_action" });
  });

  /* ───────────────────────────────────────────────────────────────────
   * PASSKEY (WebAuthn)
   * ─────────────────────────────────────────────────────────────────── */

  /**
   * Start passkey registration
   * Returns challenge and options for navigator.credentials.create()
   */
  app.post("/passkey/register/start", {
    preHandler: requireMarketplaceAuth,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;

    // Get user
    const user = await prisma.marketplaceUser.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user) {
      return reply.code(404).send({ error: "user_not_found" });
    }

    // Generate challenge
    const challenge = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

    // Store challenge temporarily (expires in 5 minutes)
    await prisma.marketplaceUser.update({
      where: { id: userId },
      data: {
        passkeyChallenge: challenge,
        passkeyChallengeExpires: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // Return WebAuthn options for registration
    return reply.send({
      ok: true,
      options: {
        challenge,
        rp: {
          name: "BreederHQ",
          id: IS_PROD ? "breederhq.com" : undefined, // undefined allows any origin in dev
        },
        user: {
          id: Buffer.from(String(userId)).toString("base64url"),
          name: user.email,
          displayName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    });
  });

  /**
   * Complete passkey registration
   * B-01 FIX: Implements full WebAuthn credential verification
   */
  app.post("/passkey/register/finish", {
    preHandler: requireMarketplaceAuth,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { credential } = (req.body || {}) as {
      credential?: RegistrationResponseJSON;
    };

    if (!credential) {
      return reply.code(400).send({ error: "credential_required" });
    }

    // Get stored challenge
    const user = await prisma.marketplaceUser.findUnique({
      where: { id: userId },
      select: { passkeyChallenge: true, passkeyChallengeExpires: true },
    });

    if (!user?.passkeyChallenge || !user.passkeyChallengeExpires || user.passkeyChallengeExpires < new Date()) {
      return reply.code(400).send({ error: "challenge_expired" });
    }

    try {
      // B-01 FIX: Verify the registration response using @simplewebauthn/server
      // This validates:
      // 1. clientDataJSON.challenge matches stored challenge
      // 2. clientDataJSON.origin is in expected origins
      // 3. attestationObject is valid
      // 4. Extracts and returns the public key
      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: user.passkeyChallenge,
        expectedOrigin: EXPECTED_ORIGINS,
        expectedRPID: RP_ID,
        requireUserVerification: false, // "preferred" in authenticatorSelection
      });

      if (!verification.verified || !verification.registrationInfo) {
        req.log?.warn?.({ userId }, "Passkey registration verification failed");
        return reply.code(400).send({ error: "verification_failed" });
      }

      const { credential: verifiedCred } = verification.registrationInfo;

      // Store verified credential
      await prisma.marketplaceUser.update({
        where: { id: userId },
        data: {
          passkeyCredentialId: verifiedCred.id,
          passkeyPublicKey: Buffer.from(verifiedCred.publicKey), // Verified public key
          passkeyCounter: verifiedCred.counter,
          passkeyCreatedAt: new Date(),
          passkeyChallenge: null,
          passkeyChallengeExpires: null,
          twoFactorEnabled: true,
          twoFactorMethod: "PASSKEY",
          twoFactorEnabledAt: new Date(),
        },
      });

      // Log security event
      await logSecurityEvent({
        userId,
        event: "PASSKEY_REGISTERED",
        ip: req.ip,
      });

      // Check and set service provider tier if applicable
      await checkAndSetServiceProviderTier(userId);

      return reply.send({ ok: true, method: "PASSKEY" });
    } catch (err: any) {
      req.log?.error?.({ err, userId }, "Failed to register passkey");
      return reply.code(500).send({ error: "registration_failed" });
    }
  });

  /**
   * Start passkey authentication
   */
  app.post("/passkey/auth/start", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { userId } = (req.body || {}) as { userId?: number };

    if (!userId) {
      return reply.code(400).send({ error: "user_id_required" });
    }

    // Get user's passkey credential ID
    const user = await prisma.marketplaceUser.findUnique({
      where: { id: userId },
      select: {
        passkeyCredentialId: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
      },
    });

    if (!user || !user.twoFactorEnabled || user.twoFactorMethod !== "PASSKEY" || !user.passkeyCredentialId) {
      return reply.code(400).send({ error: "passkey_not_enabled" });
    }

    // Generate challenge
    const challenge = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

    // Store challenge
    await prisma.marketplaceUser.update({
      where: { id: userId },
      data: {
        passkeyChallenge: challenge,
        passkeyChallengeExpires: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return reply.send({
      ok: true,
      options: {
        challenge,
        rpId: IS_PROD ? "breederhq.com" : undefined,
        allowCredentials: [
          {
            id: user.passkeyCredentialId,
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "preferred",
        timeout: 60000,
      },
    });
  });

  /**
   * Complete passkey authentication
   * B-01 FIX: Implements full WebAuthn assertion verification
   */
  app.post("/passkey/auth/finish", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { userId, credential } = (req.body || {}) as {
      userId?: number;
      credential?: AuthenticationResponseJSON;
    };

    if (!userId || !credential) {
      return reply.code(400).send({ error: "user_id_and_credential_required" });
    }

    // Get stored challenge and credential
    const user = await prisma.marketplaceUser.findUnique({
      where: { id: userId },
      select: {
        passkeyChallenge: true,
        passkeyChallengeExpires: true,
        passkeyCredentialId: true,
        passkeyPublicKey: true,
        passkeyCounter: true,
      },
    });

    if (!user?.passkeyChallenge || !user.passkeyChallengeExpires || user.passkeyChallengeExpires < new Date()) {
      return reply.code(400).send({ error: "challenge_expired" });
    }

    if (!user.passkeyCredentialId || !user.passkeyPublicKey) {
      return reply.code(400).send({ error: "passkey_not_registered" });
    }

    if (credential.id !== user.passkeyCredentialId) {
      return reply.code(401).send({ error: "invalid_credential" });
    }

    try {
      // B-01 FIX: Verify the authentication response using @simplewebauthn/server
      // This validates:
      // 1. clientDataJSON.challenge matches stored challenge
      // 2. clientDataJSON.origin is in expected origins
      // 3. authenticatorData flags (UP required)
      // 4. signature is valid against stored public key
      // 5. signCount to detect cloned authenticators
      // Convert Buffer to Uint8Array for @simplewebauthn/server compatibility
      const publicKeyArray = new Uint8Array(user.passkeyPublicKey);

      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: user.passkeyChallenge,
        expectedOrigin: EXPECTED_ORIGINS,
        expectedRPID: RP_ID,
        credential: {
          id: user.passkeyCredentialId,
          publicKey: publicKeyArray,
          counter: user.passkeyCounter ?? 0,
        },
        requireUserVerification: false,
      });

      if (!verification.verified) {
        req.log?.warn?.({ userId }, "Passkey authentication verification failed");
        await logSecurityEvent({
          userId,
          event: "PASSKEY_AUTH_FAILED",
          ip: req.ip,
          details: { reason: "verification_failed" },
        });
        return reply.code(401).send({ error: "verification_failed" });
      }

      // Check for potential authenticator cloning (signCount should always increase)
      const newCounter = verification.authenticationInfo.newCounter;
      if (user.passkeyCounter != null && newCounter <= user.passkeyCounter) {
        req.log?.warn?.({ userId, oldCounter: user.passkeyCounter, newCounter }, "Possible authenticator clone detected");
        await logSecurityEvent({
          userId,
          event: "PASSKEY_CLONE_DETECTED",
          ip: req.ip,
          details: { oldCounter: user.passkeyCounter, newCounter },
        });
        // Still allow auth but log the security concern
      }

      // Update counter and clear challenge
      await prisma.marketplaceUser.update({
        where: { id: userId },
        data: {
          passkeyChallenge: null,
          passkeyChallengeExpires: null,
          passkeyCounter: newCounter,
        },
      });

      await logSecurityEvent({
        userId,
        event: "PASSKEY_AUTH_SUCCESS",
        ip: req.ip,
      });

      return reply.send({ ok: true });
    } catch (err: any) {
      req.log?.error?.({ err, userId }, "Passkey authentication error");
      return reply.code(401).send({ error: "authentication_failed" });
    }
  });

  /* ───────────────────────────────────────────────────────────────────
   * DISABLE 2FA
   * ─────────────────────────────────────────────────────────────────── */

  /**
   * Disable 2FA
   * B-02 FIX: Requires password verification before disabling
   */
  app.post("/disable", {
    preHandler: requireMarketplaceAuth,
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;
    const { password } = (req.body || {}) as { password?: string };

    // B-02 FIX: Require password to disable 2FA
    if (!password) {
      return reply.code(400).send({
        error: "password_required",
        message: "Password is required to disable 2FA.",
      });
    }

    // B-02 FIX: Verify password before allowing 2FA disable
    const passwordValid = await verifyPasswordByUserId(userId, password);
    if (!passwordValid) {
      await logSecurityEvent({
        userId,
        event: "2FA_DISABLE_FAILED",
        ip: req.ip,
        details: { reason: "invalid_password" },
      });
      return reply.code(401).send({
        error: "invalid_password",
        message: "Invalid password. Please try again.",
      });
    }

    // Disable 2FA
    await disableUserTwoFactor(userId);

    // Log security event
    await logSecurityEvent({
      userId,
      event: "2FA_DISABLED",
      ip: req.ip,
    });

    return reply.send({ ok: true });
  });
}
