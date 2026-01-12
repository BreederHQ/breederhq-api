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

/**
 * Send provider welcome email
 */
export async function sendProviderWelcomeEmail(data: {
  email: string;
  firstName: string;
  businessName: string;
  paymentMode: string;
}): Promise<void> {
  const userName = data.firstName || "there";
  const dashboardUrl = `${MARKETPLACE_URL}/provider/dashboard`;

  const nextSteps = data.paymentMode === "stripe"
    ? "Your next step is to complete Stripe Connect onboarding to accept automated payments."
    : "You can start creating service listings right away! Buyers will contact you using the payment instructions you provided.";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Welcome to ${FROM_NAME} Providers!</h2>
      <p>Hi ${userName},</p>
      <p>Congratulations! You're now registered as a service provider on ${FROM_NAME}.</p>

      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0; font-weight: 600;">Business Name:</p>
        <p style="margin: 4px 0 0 0;">${data.businessName}</p>
        <p style="margin: 16px 0 0 0; font-weight: 600;">Payment Mode:</p>
        <p style="margin: 4px 0 0 0;">${data.paymentMode === "stripe" ? "Automated (Stripe)" : "Manual"}</p>
      </div>

      <h3 style="color: #374151;">Next Steps</h3>
      <p>${nextSteps}</p>

      <p style="margin: 24px 0;">
        <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          Go to Provider Dashboard
        </a>
      </p>

      <h3 style="color: #374151;">What You Can Do</h3>
      <ul style="color: #6b7280;">
        <li>Create service listings</li>
        <li>Set your pricing and availability</li>
        <li>Manage bookings and transactions</li>
        <li>Respond to customer inquiries</li>
        <li>Track your revenue and reviews</li>
      </ul>

      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        Need help? Visit our provider resources or contact support anytime.
      </p>

      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
Welcome to ${FROM_NAME} Providers!

Hi ${userName},

Congratulations! You're now registered as a service provider on ${FROM_NAME}.

Business Name: ${data.businessName}
Payment Mode: ${data.paymentMode === "stripe" ? "Automated (Stripe)" : "Manual"}

Next Steps:
${nextSteps}

Go to your provider dashboard: ${dashboardUrl}

What You Can Do:
• Create service listings
• Set your pricing and availability
• Manage bookings and transactions
• Respond to customer inquiries
• Track your revenue and reviews

Need help? Visit our provider resources or contact support anytime.

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0, // System email
    to: data.email,
    subject: `Welcome to ${FROM_NAME} Providers!`,
    html,
    text,
    templateKey: "provider_welcome",
    category: "transactional",
  });
}

/**
 * Send Stripe Connect onboarding complete email
 */
export async function sendProviderStripeOnboardingCompleteEmail(data: {
  email: string;
  firstName: string;
  businessName: string;
}): Promise<void> {
  const userName = data.firstName || "there";
  const dashboardUrl = `${MARKETPLACE_URL}/provider/dashboard`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">🎉 Stripe Connect Setup Complete!</h2>
      <p>Hi ${userName},</p>
      <p>Great news! Your Stripe Connect account has been successfully set up for <strong>${data.businessName}</strong>.</p>

      <div style="background: #ecfdf5; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #10b981;">
        <p style="margin: 0; color: #065f46; font-weight: 600;">✓ Automated Payments Enabled</p>
        <p style="margin: 8px 0 0 0; color: #065f46;">You can now accept credit card payments directly through the platform.</p>
      </div>

      <h3 style="color: #374151;">What This Means</h3>
      <ul style="color: #6b7280;">
        <li>Customers can pay you automatically via credit card</li>
        <li>Funds are securely transferred to your bank account</li>
        <li>You'll receive payout notifications from Stripe</li>
        <li>Platform fees are deducted automatically</li>
      </ul>

      <h3 style="color: #374151;">Next Steps</h3>
      <p>You can now switch your payment mode to "stripe" in your provider settings to start accepting automated payments.</p>

      <p style="margin: 24px 0;">
        <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          View Dashboard
        </a>
      </p>

      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        Questions about payouts? Check Stripe's documentation or contact our support team.
      </p>

      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
🎉 Stripe Connect Setup Complete!

Hi ${userName},

Great news! Your Stripe Connect account has been successfully set up for ${data.businessName}.

✓ Automated Payments Enabled
You can now accept credit card payments directly through the platform.

What This Means:
• Customers can pay you automatically via credit card
• Funds are securely transferred to your bank account
• You'll receive payout notifications from Stripe
• Platform fees are deducted automatically

Next Steps:
You can now switch your payment mode to "stripe" in your provider settings to start accepting automated payments.

View your dashboard: ${dashboardUrl}

Questions about payouts? Check Stripe's documentation or contact our support team.

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0, // System email
    to: data.email,
    subject: `Stripe Connect Setup Complete - ${FROM_NAME}`,
    html,
    text,
    templateKey: "provider_stripe_onboarding_complete",
    category: "transactional",
  });
}

/**
 * Send Stripe Connect issue notification
 */
export async function sendProviderStripeIssueEmail(data: {
  email: string;
  firstName: string;
  businessName: string;
  issueDescription: string;
}): Promise<void> {
  const userName = data.firstName || "there";
  const onboardingUrl = `${MARKETPLACE_URL}/provider/settings/payments`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Action Required: Stripe Account Verification</h2>
      <p>Hi ${userName},</p>
      <p>Your Stripe Connect account for <strong>${data.businessName}</strong> requires additional information.</p>

      <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e; font-weight: 600;">⚠️ Verification Needed</p>
        <p style="margin: 8px 0 0 0; color: #92400e;">${data.issueDescription}</p>
      </div>

      <h3 style="color: #374151;">Why This Happens</h3>
      <p>Stripe requires additional verification to comply with financial regulations and protect both you and your customers.</p>

      <h3 style="color: #374151;">What To Do</h3>
      <p>Click the button below to complete the verification process. This usually takes just a few minutes.</p>

      <p style="margin: 24px 0;">
        <a href="${onboardingUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          Complete Verification
        </a>
      </p>

      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        Until verification is complete, you may not be able to receive payouts.
      </p>

      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
Action Required: Stripe Account Verification

Hi ${userName},

Your Stripe Connect account for ${data.businessName} requires additional information.

⚠️ Verification Needed
${data.issueDescription}

Why This Happens:
Stripe requires additional verification to comply with financial regulations and protect both you and your customers.

What To Do:
Click the link below to complete the verification process. This usually takes just a few minutes.

Complete verification: ${onboardingUrl}

Until verification is complete, you may not be able to receive payouts.

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0, // System email
    to: data.email,
    subject: `Action Required: Stripe Account Verification - ${FROM_NAME}`,
    html,
    text,
    templateKey: "provider_stripe_issue",
    category: "transactional",
  });
}

// ---------- Transaction Emails ----------

/**
 * Send transaction created email to buyer
 */
export async function sendTransactionCreatedEmailToBuyer(data: {
  buyerEmail: string;
  buyerFirstName: string;
  transactionId: number;
  serviceTitle: string;
  providerBusinessName: string;
  totalAmount: string; // e.g., "$113.49"
  paymentMode: "manual" | "stripe";
  paymentInstructions?: string | null;
}): Promise<void> {
  const transactionUrl = `${MARKETPLACE_URL}/transactions/${data.transactionId}`;
  const userName = data.buyerFirstName || "there";

  const paymentSection = data.paymentMode === "manual"
    ? `
      <h3 style="color: #1f2937; margin-top: 24px;">Payment Instructions</h3>
      <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 0;">${data.paymentInstructions || "Contact the provider for payment details."}</p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">After sending payment, mark it as paid in your transaction page.</p>
    `
    : `
      <p style="margin: 24px 0;">
        <a href="${transactionUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          Pay Now
        </a>
      </p>
    `;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Booking Confirmed!</h2>
      <p>Hi ${userName},</p>
      <p>Your booking has been confirmed with <strong>${data.providerBusinessName}</strong>.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 24px 0;">
        <h3 style="color: #1f2937; margin-top: 0;">Service Details</h3>
        <p style="margin: 8px 0;"><strong>${data.serviceTitle}</strong></p>
        <p style="margin: 8px 0;">Total: <strong>${data.totalAmount}</strong></p>
        <p style="margin: 8px 0;">Transaction ID: #${data.transactionId}</p>
      </div>
      ${paymentSection}
      <p style="margin: 24px 0;">
        <a href="${transactionUrl}" style="display: inline-block; padding: 12px 24px; background: #e5e7eb; color: #1f2937; text-decoration: none; border-radius: 6px;">
          View Booking Details
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
Booking Confirmed!

Hi ${userName},

Your booking has been confirmed with ${data.providerBusinessName}.

Service Details:
- ${data.serviceTitle}
- Total: ${data.totalAmount}
- Transaction ID: #${data.transactionId}

${data.paymentMode === "manual" ? `Payment Instructions:\n${data.paymentInstructions || "Contact the provider for payment details."}` : "Complete payment at: " + transactionUrl}

View booking details: ${transactionUrl}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0,
    to: data.buyerEmail,
    subject: `Booking Confirmed - ${data.serviceTitle}`,
    html,
    text,
    templateKey: "marketplace_transaction_created_buyer",
    category: "transactional",
  });
}

/**
 * Send transaction created email to provider
 */
export async function sendTransactionCreatedEmailToProvider(data: {
  providerEmail: string;
  providerBusinessName: string;
  transactionId: number;
  serviceTitle: string;
  buyerName: string;
  buyerNotes?: string | null;
  totalAmount: string;
}): Promise<void> {
  const transactionUrl = `${MARKETPLACE_URL}/provider/transactions/${data.transactionId}`;

  const notesSection = data.buyerNotes
    ? `
      <h3 style="color: #1f2937; margin-top: 24px;">Buyer Notes</h3>
      <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 0;">${data.buyerNotes}</p>
      </div>
    `
    : "";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">New Booking Received!</h2>
      <p>Hi ${data.providerBusinessName},</p>
      <p>You have received a new booking.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 24px 0;">
        <h3 style="color: #1f2937; margin-top: 0;">Booking Details</h3>
        <p style="margin: 8px 0;"><strong>${data.serviceTitle}</strong></p>
        <p style="margin: 8px 0;">Buyer: ${data.buyerName}</p>
        <p style="margin: 8px 0;">Amount: ${data.totalAmount}</p>
        <p style="margin: 8px 0;">Transaction ID: #${data.transactionId}</p>
      </div>
      ${notesSection}
      <p style="margin: 24px 0;">
        <a href="${transactionUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          View Booking
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
New Booking Received!

Hi ${data.providerBusinessName},

You have received a new booking.

Booking Details:
- ${data.serviceTitle}
- Buyer: ${data.buyerName}
- Amount: ${data.totalAmount}
- Transaction ID: #${data.transactionId}

${data.buyerNotes ? `Buyer Notes:\n${data.buyerNotes}` : ""}

View booking: ${transactionUrl}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0,
    to: data.providerEmail,
    subject: `New Booking - ${data.serviceTitle}`,
    html,
    text,
    templateKey: "marketplace_transaction_created_provider",
    category: "transactional",
  });
}

/**
 * Send service started email to buyer
 */
export async function sendServiceStartedEmailToBuyer(data: {
  buyerEmail: string;
  buyerFirstName: string;
  transactionId: number;
  serviceTitle: string;
  providerBusinessName: string;
}): Promise<void> {
  const transactionUrl = `${MARKETPLACE_URL}/transactions/${data.transactionId}`;
  const userName = data.buyerFirstName || "there";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Service Started!</h2>
      <p>Hi ${userName},</p>
      <p>${data.providerBusinessName} has started working on your service.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 24px 0;">
        <p style="margin: 0;"><strong>${data.serviceTitle}</strong></p>
      </div>
      <p>You can track the progress and communicate with the provider through your transaction page.</p>
      <p style="margin: 24px 0;">
        <a href="${transactionUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          View Transaction
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
Service Started!

Hi ${userName},

${data.providerBusinessName} has started working on your service.

Service: ${data.serviceTitle}

You can track the progress and communicate with the provider: ${transactionUrl}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0,
    to: data.buyerEmail,
    subject: `Service Started - ${data.serviceTitle}`,
    html,
    text,
    templateKey: "marketplace_service_started_buyer",
    category: "transactional",
  });
}

/**
 * Send service completed email to buyer (with review prompt)
 */
export async function sendServiceCompletedEmailToBuyer(data: {
  buyerEmail: string;
  buyerFirstName: string;
  transactionId: number;
  serviceTitle: string;
  providerBusinessName: string;
}): Promise<void> {
  const reviewUrl = `${MARKETPLACE_URL}/transactions/${data.transactionId}/review`;
  const userName = data.buyerFirstName || "there";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Service Completed!</h2>
      <p>Hi ${userName},</p>
      <p>${data.providerBusinessName} has marked your service as complete.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 24px 0;">
        <p style="margin: 0;"><strong>${data.serviceTitle}</strong></p>
      </div>
      <p>How was your experience?</p>
      <p style="margin: 24px 0;">
        <a href="${reviewUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          ★ Leave a Review
        </a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">Your feedback helps other buyers make informed decisions.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
Service Completed!

Hi ${userName},

${data.providerBusinessName} has marked your service as complete.

Service: ${data.serviceTitle}

How was your experience? Leave a review: ${reviewUrl}

Your feedback helps other buyers make informed decisions.

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0,
    to: data.buyerEmail,
    subject: `Service Complete - Please Review ${data.providerBusinessName}`,
    html,
    text,
    templateKey: "marketplace_service_completed_buyer",
    category: "transactional",
  });
}

/**
 * Send cancellation/refund email
 */
export async function sendCancellationEmail(data: {
  recipientEmail: string;
  recipientName: string;
  recipient: "buyer" | "provider";
  transactionId: number;
  serviceTitle: string;
  reason?: string | null;
  refundInitiated: boolean;
}): Promise<void> {
  const transactionUrl = data.recipient === "buyer"
    ? `${MARKETPLACE_URL}/transactions/${data.transactionId}`
    : `${MARKETPLACE_URL}/provider/transactions/${data.transactionId}`;

  const reasonSection = data.reason
    ? `
      <p><strong>Reason:</strong> ${data.reason}</p>
    `
    : "";

  const refundSection = data.refundInitiated
    ? `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 6px; margin: 24px 0;">
        <p style="margin: 0; color: #92400e;"><strong>A refund has been initiated.</strong> You should receive it within 5-10 business days.</p>
      </div>
    `
    : "";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">Booking Cancelled</h2>
      <p>Hi ${data.recipientName},</p>
      <p>A booking has been cancelled.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 24px 0;">
        <p style="margin: 0;"><strong>${data.serviceTitle}</strong></p>
        <p style="margin: 8px 0 0 0;">Transaction ID: #${data.transactionId}</p>
      </div>
      ${reasonSection}
      ${refundSection}
      <p style="margin: 24px 0;">
        <a href="${transactionUrl}" style="display: inline-block; padding: 12px 24px; background: #e5e7eb; color: #1f2937; text-decoration: none; border-radius: 6px;">
          View Transaction
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
Booking Cancelled

Hi ${data.recipientName},

A booking has been cancelled.

Service: ${data.serviceTitle}
Transaction ID: #${data.transactionId}

${data.reason ? `Reason: ${data.reason}` : ""}

${data.refundInitiated ? "A refund has been initiated. You should receive it within 5-10 business days." : ""}

View transaction: ${transactionUrl}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0,
    to: data.recipientEmail,
    subject: `Booking Cancelled - ${data.serviceTitle}`,
    html,
    text,
    templateKey: "marketplace_transaction_cancelled",
    category: "transactional",
  });
}

/**
 * Send payment received confirmation to buyer
 */
export async function sendPaymentReceivedEmailToBuyer(data: {
  buyerEmail: string;
  buyerFirstName: string;
  transactionId: number;
  serviceTitle: string;
  providerBusinessName: string;
  totalAmount: string;
}): Promise<void> {
  const transactionUrl = `${MARKETPLACE_URL}/transactions/${data.transactionId}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">✅ Payment Confirmed!</h2>

      <p>Hi ${data.buyerFirstName},</p>

      <p>Your payment for <strong>${data.serviceTitle}</strong> has been confirmed.</p>

      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0;"><strong>Service:</strong> ${data.serviceTitle}</p>
        <p style="margin: 8px 0 0 0;"><strong>Provider:</strong> ${data.providerBusinessName}</p>
        <p style="margin: 8px 0 0 0;"><strong>Amount Paid:</strong> ${data.totalAmount}</p>
        <p style="margin: 8px 0 0 0;"><strong>Transaction ID:</strong> #${data.transactionId}</p>
      </div>

      <p><strong>What's Next?</strong></p>
      <ul style="color: #6b7280;">
        <li>The provider will be in touch to coordinate service delivery</li>
        <li>You can message them directly through your transaction page</li>
        <li>Once the service is complete, you'll be able to leave a review</li>
      </ul>

      <p style="margin: 24px 0;">
        <a href="${transactionUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          View Transaction
        </a>
      </p>

      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
✅ Payment Confirmed!

Hi ${data.buyerFirstName},

Your payment for ${data.serviceTitle} has been confirmed.

Service: ${data.serviceTitle}
Provider: ${data.providerBusinessName}
Amount Paid: ${data.totalAmount}
Transaction ID: #${data.transactionId}

What's Next?
• The provider will be in touch to coordinate service delivery
• You can message them directly through your transaction page
• Once the service is complete, you'll be able to leave a review

View transaction: ${transactionUrl}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0,
    to: data.buyerEmail,
    subject: `Payment Confirmed - ${data.serviceTitle}`,
    html,
    text,
    templateKey: "marketplace_payment_received_buyer",
    category: "transactional",
  });
}

/**
 * Send payment received notification to provider
 */
export async function sendPaymentReceivedEmailToProvider(data: {
  providerEmail: string;
  providerBusinessName: string;
  transactionId: number;
  serviceTitle: string;
  buyerName: string;
  totalAmount: string;
  paymentMode: "manual" | "stripe";
}): Promise<void> {
  const transactionUrl = `${MARKETPLACE_URL}/providers/transactions/${data.transactionId}`;
  const paymentInfo = data.paymentMode === "stripe"
    ? "Funds will be transferred to your Stripe account according to your payout schedule."
    : "You have confirmed receipt of the payment.";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">💰 Payment Received</h2>

      <p>Hi ${data.providerBusinessName},</p>

      <p>Payment has been confirmed for your service booking.</p>

      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0;"><strong>Service:</strong> ${data.serviceTitle}</p>
        <p style="margin: 8px 0 0 0;"><strong>Customer:</strong> ${data.buyerName}</p>
        <p style="margin: 8px 0 0 0;"><strong>Amount:</strong> ${data.totalAmount}</p>
        <p style="margin: 8px 0 0 0;"><strong>Transaction ID:</strong> #${data.transactionId}</p>
      </div>

      <p><strong>Next Steps:</strong></p>
      <ul style="color: #6b7280;">
        <li>Coordinate with the customer to schedule service delivery</li>
        <li>Mark the service as complete when finished</li>
        <li>${paymentInfo}</li>
      </ul>

      <p style="margin: 24px 0;">
        <a href="${transactionUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          View Transaction
        </a>
      </p>

      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        — The ${FROM_NAME} Team
      </p>
    </div>
  `;

  const text = `
💰 Payment Received

Hi ${data.providerBusinessName},

Payment has been confirmed for your service booking.

Service: ${data.serviceTitle}
Customer: ${data.buyerName}
Amount: ${data.totalAmount}
Transaction ID: #${data.transactionId}

Next Steps:
• Coordinate with the customer to schedule service delivery
• Mark the service as complete when finished
• ${paymentInfo}

View transaction: ${transactionUrl}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: 0,
    to: data.providerEmail,
    subject: `Payment Received - ${data.serviceTitle}`,
    html,
    text,
    templateKey: "marketplace_payment_received_provider",
    category: "transactional",
  });
}
