// src/services/marketplace-email-service.ts
/**
 * Marketplace Email Service
 *
 * Email templates and sending functions for marketplace authentication.
 */

import { sendEmail } from "./email-service.js";

const MARKETPLACE_URL = process.env.MARKETPLACE_URL || "https://marketplace.breederhq.com";
const FROM_NAME = process.env.RESEND_FROM_NAME || "BreederHQ Marketplace";

// ---------- Email Templates ----------

/**
 * Send welcome + email verification email
 */
export async function sendMarketplaceWelcomeEmail(data: {
  email: string;
  firstName: string;
  verificationToken: string;
}): Promise<void> {
  const verifyUrl = `${MARKETPLACE_URL}/verify-email?token=${data.verificationToken}`;
  const userName = data.firstName || "there";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Welcome to ${FROM_NAME}!</h2>
      <p>Hi ${userName},</p>
      <p>Thanks for joining our marketplace! Please verify your email address to complete your registration.</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          Verify Email Address
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour.</p>
      <p style="color: #6b7280; font-size: 14px;">If you didn't create this account, you can safely ignore this email.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
Welcome to ${FROM_NAME}!

Hi ${userName},

Thanks for joining our marketplace! Please verify your email address to complete your registration.

Click this link to verify: ${verifyUrl}

This link will expire in 1 hour.

If you didn't create this account, you can safely ignore this email.

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0, // System email
    to: data.email,
    subject: `Welcome to ${FROM_NAME} - Please verify your email`,
    html,
    text,
    templateKey: "marketplace_welcome_verify",
    category: "transactional",
  });
}

/**
 * Send password reset email
 */
export async function sendMarketplacePasswordResetEmail(data: {
  email: string;
  firstName: string | null;
  resetToken: string;
}): Promise<void> {
  const resetUrl = `${MARKETPLACE_URL}/reset-password?token=${data.resetToken}`;
  const userName = data.firstName || "there";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Reset Your Password</h2>
      <p>Hi ${userName},</p>
      <p>We received a request to reset the password for your ${FROM_NAME} account.</p>
      <p>Click the button below to set a new password:</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          Reset Password
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link will expire in 30 minutes.</p>
      <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
Reset Your Password

Hi ${userName},

We received a request to reset the password for your ${FROM_NAME} account.

Click this link to set a new password: ${resetUrl}

This link will expire in 30 minutes.

If you didn't request this, you can safely ignore this email.

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0, // System email
    to: data.email,
    subject: `Reset your ${FROM_NAME} password`,
    html,
    text,
    templateKey: "marketplace_password_reset",
    category: "transactional",
  });
}

/**
 * Send email verification (standalone, for re-verification)
 */
export async function sendMarketplaceVerificationEmail(data: {
  email: string;
  firstName: string | null;
  verificationToken: string;
}): Promise<void> {
  const verifyUrl = `${MARKETPLACE_URL}/verify-email?token=${data.verificationToken}`;
  const userName = data.firstName || "there";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Verify Your Email</h2>
      <p>Hi ${userName},</p>
      <p>Please verify your email address to continue using ${FROM_NAME}.</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          Verify Email Address
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour.</p>
      <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
Verify Your Email

Hi ${userName},

Please verify your email address to continue using ${FROM_NAME}.

Click this link to verify: ${verifyUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0, // System email
    to: data.email,
    subject: `Verify your ${FROM_NAME} email address`,
    html,
    text,
    templateKey: "marketplace_email_verify",
    category: "transactional",
  });
}
