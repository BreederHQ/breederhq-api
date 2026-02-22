// src/services/marketplace-email-service.ts
/**
 * Marketplace Email Service
 *
 * Email templates and sending functions for marketplace authentication.
 */

import { sendEmail } from "./email-service.js";
import {
  wrapEmailLayout,
  emailGreeting,
  emailParagraph,
  emailAccent,
  emailButton,
  emailInfoCard,
  emailDetailRows,
  emailFeatureList,
  emailBulletList,
  emailHeading,
  emailFootnote,
  emailCodeBlock,
} from "./email-layout.js";

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

  const html = wrapEmailLayout({
    title: `Welcome to ${FROM_NAME}!`,
    body: [
      emailGreeting(userName),
      emailParagraph("Thanks for joining our marketplace! Please verify your email address to complete your registration."),
      emailButton("Verify Email Address", verifyUrl),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          ${emailAccent("&#9432; This link will expire in 1 hour")}<br>
          <span style="color: #a3a3a3;">If you didn't create this account, you can safely ignore this email.</span>
        </p>
      `, { borderColor: "orange" }),
    ].join("\n"),
  });

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
    tenantId: null,  // Marketplace/system email - no tenant context
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

  const html = wrapEmailLayout({
    title: "Reset Your Password",
    body: [
      emailGreeting(userName),
      emailParagraph(`We received a request to reset the password for your ${FROM_NAME} account. Click the button below to set a new password:`),
      emailButton("Reset Password", resetUrl),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          ${emailAccent("&#9432; This link will expire in 30 minutes")}<br>
          <span style="color: #a3a3a3;">If you didn't request this, you can safely ignore this email.</span>
        </p>
      `, { borderColor: "orange" }),
    ].join("\n"),
  });

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
    tenantId: null,  // Marketplace/system email - no tenant context
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

  const html = wrapEmailLayout({
    title: "Verify Your Email",
    body: [
      emailGreeting(userName),
      emailParagraph(`Please verify your email address to continue using ${FROM_NAME}.`),
      emailButton("Verify Email Address", verifyUrl),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          ${emailAccent("&#9432; This link will expire in 1 hour")}<br>
          <span style="color: #a3a3a3;">If you didn't request this, you can safely ignore this email.</span>
        </p>
      `, { borderColor: "orange" }),
    ].join("\n"),
  });

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
    tenantId: null,  // Marketplace/system email - no tenant context
    to: data.email,
    subject: `Verify your ${FROM_NAME} email address`,
    html,
    text,
    templateKey: "marketplace_email_verify",
    category: "transactional",
  });
}

/**
 * Send a 6-digit email verification code (inline verification flow)
 */
export async function sendEmailVerificationCodeEmail(data: {
  email: string;
  firstName: string | null;
  code: string;
}): Promise<void> {
  const userName = data.firstName || "there";

  const html = wrapEmailLayout({
    title: "Your Verification Code",
    body: [
      emailGreeting(userName),
      emailParagraph(`Use the code below to verify your email address on ${FROM_NAME}.`),
      emailCodeBlock(data.code),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          ${emailAccent("&#9432; This code will expire in 10 minutes")}<br>
          <span style="color: #a3a3a3;">If you didn't request this code, you can safely ignore this email.</span>
        </p>
      `, { borderColor: "orange" }),
    ].join("\n"),
  });

  const text = `
Your Verification Code

Hi ${userName},

Use the code below to verify your email address on ${FROM_NAME}.

${data.code}

This code will expire in 10 minutes.

If you didn't request this code, you can safely ignore this email.

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,
    to: data.email,
    subject: `${data.code} is your ${FROM_NAME} verification code`,
    html,
    text,
    templateKey: "marketplace_email_verification_code",
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

  const html = wrapEmailLayout({
    title: `Welcome to ${FROM_NAME} Providers!`,
    body: [
      emailGreeting(userName),
      emailParagraph(`Congratulations! You're now registered as a service provider on ${FROM_NAME}.`),
      emailDetailRows([
        { label: "Business Name", value: data.businessName },
        { label: "Payment Mode", value: data.paymentMode === "stripe" ? "Automated (Stripe)" : "Manual" },
      ]),
      emailHeading("Next Steps"),
      emailParagraph(nextSteps),
      emailButton("Go to Provider Dashboard", dashboardUrl),
      emailHeading("What You Can Do"),
      emailBulletList([
        "Create service listings",
        "Set your pricing and availability",
        "Manage bookings and transactions",
        "Respond to customer inquiries",
        "Track your revenue and reviews",
      ]),
      emailFootnote("Need help? Visit our provider resources or contact support anytime."),
    ].join("\n"),
  });

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
    tenantId: null,  // Marketplace/system email - no tenant context
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

  const html = wrapEmailLayout({
    title: "Stripe Connect Setup Complete!",
    body: [
      emailGreeting(userName),
      emailParagraph(`Great news! Your Stripe Connect account has been successfully set up for ${emailAccent(data.businessName)}.`),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          <strong style="color: #10b981;">&#10003; Automated Payments Enabled</strong><br>
          <span style="color: #a3a3a3;">You can now accept credit card payments directly through the platform.</span>
        </p>
      `, { borderColor: "green" }),
      emailHeading("What This Means"),
      emailBulletList([
        "Customers can pay you automatically via credit card",
        "Funds are securely transferred to your bank account",
        "You'll receive payout notifications from Stripe",
        "Platform fees are deducted automatically",
      ]),
      emailHeading("Next Steps"),
      emailParagraph('You can now switch your payment mode to "stripe" in your provider settings to start accepting automated payments.'),
      emailButton("View Dashboard", dashboardUrl),
      emailFootnote("Questions about payouts? Check Stripe's documentation or contact our support team."),
    ].join("\n"),
  });

  const text = `
Stripe Connect Setup Complete!

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
    tenantId: null,  // Marketplace/system email - no tenant context
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

  const html = wrapEmailLayout({
    title: "Action Required: Stripe Account Verification",
    body: [
      emailGreeting(userName),
      emailParagraph(`Your Stripe Connect account for ${emailAccent(data.businessName)} requires additional information.`),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          <strong style="color: #f59e0b;">&#9888; Verification Needed</strong><br>
          <span style="color: #a3a3a3;">${data.issueDescription}</span>
        </p>
      `, { borderColor: "yellow" }),
      emailHeading("Why This Happens"),
      emailParagraph("Stripe requires additional verification to comply with financial regulations and protect both you and your customers."),
      emailHeading("What To Do"),
      emailParagraph("Click the button below to complete the verification process. This usually takes just a few minutes."),
      emailButton("Complete Verification", onboardingUrl),
      emailFootnote("Until verification is complete, you may not be able to receive payouts."),
    ].join("\n"),
  });

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
    tenantId: null,  // Marketplace/system email - no tenant context
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
    ? [
        emailHeading("Payment Instructions"),
        emailInfoCard(`
          <p style="color: #d4d4d4; font-size: 14px; margin: 0;">${data.paymentInstructions || "Contact the provider for payment details."}</p>
        `),
        emailParagraph('<span style="color: #a3a3a3; font-size: 14px;">After sending payment, mark it as paid in your transaction page.</span>'),
      ].join("\n")
    : emailButton("Pay Now", transactionUrl);

  const html = wrapEmailLayout({
    title: "Booking Confirmed!",
    body: [
      emailGreeting(userName),
      emailParagraph(`Your booking has been confirmed with ${emailAccent(data.providerBusinessName)}.`),
      emailDetailRows([
        { label: "Service", value: data.serviceTitle },
        { label: "Total", value: data.totalAmount },
        { label: "Transaction ID", value: `#${data.transactionId}` },
      ]),
      paymentSection,
      emailButton("View Booking Details", transactionUrl, "gray"),
    ].join("\n"),
  });

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
    tenantId: null,  // Marketplace/system email - no tenant context
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
    ? [
        emailHeading("Buyer Notes"),
        emailInfoCard(`<p style="color: #d4d4d4; font-size: 14px; margin: 0; white-space: pre-wrap;">${data.buyerNotes}</p>`),
      ].join("\n")
    : "";

  const html = wrapEmailLayout({
    title: "New Booking Received!",
    body: [
      emailGreeting(data.providerBusinessName),
      emailParagraph("You have received a new booking."),
      emailDetailRows([
        { label: "Service", value: data.serviceTitle },
        { label: "Buyer", value: data.buyerName },
        { label: "Amount", value: data.totalAmount },
        { label: "Transaction ID", value: `#${data.transactionId}` },
      ]),
      notesSection,
      emailButton("View Booking", transactionUrl),
    ].join("\n"),
  });

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
    tenantId: null,  // Marketplace/system email - no tenant context
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

  const html = wrapEmailLayout({
    title: "Service Started!",
    body: [
      emailGreeting(userName),
      emailParagraph(`${emailAccent(data.providerBusinessName)} has started working on your service.`),
      emailInfoCard(`<p style="color: #e5e5e5; font-size: 15px; font-weight: 600; margin: 0;">${data.serviceTitle}</p>`),
      emailParagraph("You can track the progress and communicate with the provider through your transaction page."),
      emailButton("View Transaction", transactionUrl),
    ].join("\n"),
  });

  const text = `
Service Started!

Hi ${userName},

${data.providerBusinessName} has started working on your service.

Service: ${data.serviceTitle}

You can track the progress and communicate with the provider: ${transactionUrl}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,  // Marketplace/system email - no tenant context
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

  const html = wrapEmailLayout({
    title: "Service Completed!",
    body: [
      emailGreeting(userName),
      emailParagraph(`${emailAccent(data.providerBusinessName)} has marked your service as complete.`),
      emailInfoCard(`<p style="color: #e5e5e5; font-size: 15px; font-weight: 600; margin: 0;">${data.serviceTitle}</p>`),
      emailParagraph("How was your experience?"),
      emailButton("Leave a Review", reviewUrl, "green"),
      emailFootnote("Your feedback helps other buyers make informed decisions."),
    ].join("\n"),
  });

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
    tenantId: null,  // Marketplace/system email - no tenant context
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
    ? emailInfoCard(`
        <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 4px 0; font-weight: 600;">Reason:</p>
        <p style="color: #d4d4d4; font-size: 14px; margin: 0;">${data.reason}</p>
      `, { borderColor: "gray" })
    : "";

  const refundSection = data.refundInitiated
    ? emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          <strong style="color: #f59e0b;">A refund has been initiated.</strong><br>
          <span style="color: #a3a3a3;">You should receive it within 5-10 business days.</span>
        </p>
      `, { borderColor: "yellow" })
    : "";

  const html = wrapEmailLayout({
    title: "Booking Cancelled",
    body: [
      emailGreeting(data.recipientName),
      emailParagraph("A booking has been cancelled."),
      emailDetailRows([
        { label: "Service", value: data.serviceTitle },
        { label: "Transaction ID", value: `#${data.transactionId}` },
      ]),
      reasonSection,
      refundSection,
      emailButton("View Transaction", transactionUrl, "gray"),
    ].join("\n"),
  });

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
    tenantId: null,  // Marketplace/system email - no tenant context
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

  const html = wrapEmailLayout({
    title: "Payment Confirmed!",
    body: [
      emailGreeting(data.buyerFirstName),
      emailParagraph(`Your payment for ${emailAccent(data.serviceTitle)} has been confirmed.`),
      emailDetailRows([
        { label: "Service", value: data.serviceTitle },
        { label: "Provider", value: data.providerBusinessName },
        { label: "Amount Paid", value: data.totalAmount },
        { label: "Transaction ID", value: `#${data.transactionId}` },
      ]),
      emailHeading("What's Next?"),
      emailBulletList([
        "The provider will be in touch to coordinate service delivery",
        "You can message them directly through your transaction page",
        "Once the service is complete, you'll be able to leave a review",
      ]),
      emailButton("View Transaction", transactionUrl),
    ].join("\n"),
  });

  const text = `
Payment Confirmed!

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
    tenantId: null,  // Marketplace/system email - no tenant context
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

  const html = wrapEmailLayout({
    title: "Payment Received",
    body: [
      emailGreeting(data.providerBusinessName),
      emailParagraph("Payment has been confirmed for your service booking."),
      emailDetailRows([
        { label: "Service", value: data.serviceTitle },
        { label: "Customer", value: data.buyerName },
        { label: "Amount", value: data.totalAmount },
        { label: "Transaction ID", value: `#${data.transactionId}` },
      ]),
      emailHeading("Next Steps"),
      emailBulletList([
        "Coordinate with the customer to schedule service delivery",
        "Mark the service as complete when finished",
        paymentInfo,
      ]),
      emailButton("View Transaction", transactionUrl),
    ].join("\n"),
  });

  const text = `
Payment Received

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
    tenantId: null,  // Marketplace/system email - no tenant context
    to: data.providerEmail,
    subject: `Payment Received - ${data.serviceTitle}`,
    html,
    text,
    templateKey: "marketplace_payment_received_provider",
    category: "transactional",
  });
}

/**
 * Send new message notification email
 * Sent when a user receives a new message on a transaction
 */
export async function sendNewMessageNotificationEmail(data: {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  messagePreview: string;
  serviceTitle: string;
  transactionId: number;
}): Promise<void> {
  const transactionUrl = `${MARKETPLACE_URL}/transactions/${data.transactionId}`;

  // Truncate message preview to 200 characters
  const preview =
    data.messagePreview.length > 200
      ? data.messagePreview.substring(0, 200) + "..."
      : data.messagePreview;

  const html = wrapEmailLayout({
    title: "New Message",
    body: [
      emailGreeting(data.recipientName),
      emailParagraph(`You have a new message from ${emailAccent(data.senderName)} regarding:`),
      emailParagraph(`<strong style="color: #ffffff;">${data.serviceTitle}</strong>`),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; font-style: italic; line-height: 1.6;">
          "${preview}"
        </p>
      `, { borderColor: "blue" }),
      emailButton("View & Reply", transactionUrl, "blue"),
      emailFootnote(`Transaction #${data.transactionId}`),
    ].join("\n"),
  });

  const text = `
New Message from ${data.senderName}

Hi ${data.recipientName},

You have a new message regarding: ${data.serviceTitle}

"${preview}"

View and reply: ${transactionUrl}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,  // Marketplace/system email - no tenant context
    to: data.recipientEmail,
    subject: `New message from ${data.senderName} - ${data.serviceTitle}`,
    html,
    text,
    templateKey: "marketplace_new_message",
    category: "transactional",
  });
}

// ---------- Inquiry Email Notifications ----------

/**
 * Send confirmation email to user when they submit an inquiry
 */
export async function sendInquiryConfirmationToUser(data: {
  userEmail: string;
  userName: string;
  breederName: string;
  listingTitle?: string;
  message: string;
}): Promise<void> {
  const userName = data.userName || "there";
  const subject = data.listingTitle
    ? `Your inquiry about "${data.listingTitle}" has been sent`
    : `Your inquiry to ${data.breederName} has been sent`;

  const html = wrapEmailLayout({
    title: "Inquiry Sent Successfully!",
    body: [
      emailGreeting(userName),
      emailParagraph(`Your inquiry to ${emailAccent(data.breederName)}${data.listingTitle ? ` about "${data.listingTitle}"` : ""} has been sent.`),
      emailInfoCard(`
        <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">Your message:</p>
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; white-space: pre-wrap;">${data.message}</p>
      `, { borderColor: "gray" }),
      emailParagraph("The breeder will receive your message and respond as soon as possible. You'll get an email notification when they reply."),
      emailButton("View Your Inquiries", `${MARKETPLACE_URL}/inquiries`),
    ].join("\n"),
  });

  const text = `
Inquiry Sent Successfully!

Hi ${userName},

Your inquiry to ${data.breederName}${data.listingTitle ? ` about "${data.listingTitle}"` : ""} has been sent.

Your message:
${data.message}

The breeder will receive your message and respond as soon as possible. You'll get an email notification when they reply.

View your inquiries at: ${MARKETPLACE_URL}/inquiries

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,  // Marketplace/system email - no tenant context
    to: data.userEmail,
    subject,
    html,
    text,
    templateKey: "marketplace_inquiry_confirmation",
    category: "transactional",
  });
}

/**
 * Send notification email to breeder when they receive a new inquiry
 */
export async function sendInquiryNotificationToBreeder(data: {
  breederEmail: string;
  breederName: string;
  inquirerName: string;
  inquirerEmail: string;
  listingTitle?: string;
  message: string;
  threadId: number;
  tenantId: number;
}): Promise<void> {
  const APP_URL = process.env.APP_URL || "https://app.breederhq.com";
  const breederName = data.breederName || "there";
  const subject = data.listingTitle
    ? `New inquiry from ${data.inquirerName}: ${data.listingTitle}`
    : `New inquiry from ${data.inquirerName}`;

  const html = wrapEmailLayout({
    title: "New Inquiry Received!",
    body: [
      emailGreeting(breederName),
      emailParagraph(`You have a new inquiry from the marketplace${data.listingTitle ? ` about ${emailAccent(`"${data.listingTitle}"`)}` : ""}.`),
      emailInfoCard(`
        <p style="color: #f97316; font-size: 18px; font-weight: 600; margin: 0 0 12px 0;">${data.inquirerName}</p>
        <p style="color: #a3a3a3; font-size: 14px; margin: 0;"><strong style="color: #d4d4d4;">Email:</strong> <a href="mailto:${data.inquirerEmail}" style="color: #f97316; text-decoration: none;">${data.inquirerEmail}</a></p>
      `, { borderColor: "orange" }),
      emailInfoCard(`
        <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">Their message:</p>
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; white-space: pre-wrap;">${data.message}</p>
      `, { borderColor: "gray" }),
      emailButton("Reply to Inquiry", `${APP_URL}/messages/${data.threadId}`),
      emailFootnote("Quick responses help build trust with potential buyers!"),
    ].join("\n"),
  });

  const text = `
New Inquiry Received!

Hi ${breederName},

You have a new inquiry from the marketplace${data.listingTitle ? ` about "${data.listingTitle}"` : ""}.

From: ${data.inquirerName}
Email: ${data.inquirerEmail}

Their message:
${data.message}

Reply to this inquiry at: ${APP_URL}/messages/${data.threadId}

Quick responses help build trust with potential buyers!

— The BreederHQ Team
  `.trim();

  await sendEmail({
    tenantId: data.tenantId,
    to: data.breederEmail,
    subject,
    html,
    text,
    templateKey: "marketplace_inquiry_to_breeder",
    category: "transactional",
  });
}

// ---------- Waitlist Email Notifications ----------

/**
 * Send confirmation email to user when they submit a waitlist request
 */
export async function sendWaitlistConfirmationToUser(data: {
  userEmail: string;
  userName: string;
  breederName: string;
  programName: string;
  message?: string;
}): Promise<void> {
  const userName = data.userName || "there";

  const messageSection = data.message
    ? emailInfoCard(`
        <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">Your message:</p>
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; white-space: pre-wrap;">${data.message}</p>
      `, { borderColor: "gray" })
    : "";

  const html = wrapEmailLayout({
    title: "Waitlist Request Submitted!",
    body: [
      emailGreeting(userName),
      emailParagraph(`Your request to join the waitlist for ${emailAccent(data.programName)} at ${emailAccent(data.breederName)} has been submitted.`),
      messageSection,
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          <strong style="color: #3b82f6;">What happens next?</strong><br>
          <span style="color: #a3a3a3;">The breeder will review your request and may reach out with questions or next steps. You'll receive an email notification when your request is approved.</span>
        </p>
      `, { borderColor: "blue" }),
      emailButton("View Your Waitlist Requests", `${MARKETPLACE_URL}/inquiries?tab=waitlist`),
    ].join("\n"),
  });

  const text = `
Waitlist Request Submitted!

Hi ${userName},

Your request to join the waitlist for ${data.programName} at ${data.breederName} has been submitted.

${data.message ? `Your message:\n${data.message}\n` : ""}

What happens next?
The breeder will review your request and may reach out with questions or next steps. You'll receive an email notification when your request is approved.

View your waitlist requests at: ${MARKETPLACE_URL}/inquiries?tab=waitlist

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,  // Marketplace/system email - no tenant context
    to: data.userEmail,
    subject: `Waitlist request submitted for ${data.programName}`,
    html,
    text,
    templateKey: "marketplace_waitlist_confirmation",
    category: "transactional",
  });
}

/**
 * Send approval email to user when their waitlist request is approved
 */
export async function sendWaitlistApprovalToUser(data: {
  userEmail: string;
  userName: string;
  breederName: string;
  programName?: string;
  tenantSlug?: string;
}): Promise<void> {
  const userName = data.userName || "there";
  const programInfo = data.programName ? ` for ${emailAccent(data.programName)}` : "";
  const programInfoText = data.programName ? ` for ${data.programName}` : "";
  const viewUrl = data.tenantSlug
    ? `${MARKETPLACE_URL}/breeders/${data.tenantSlug}`
    : `${MARKETPLACE_URL}/inquiries?tab=waitlist`;

  const html = wrapEmailLayout({
    title: "Great News - You've Been Approved!",
    body: [
      emailGreeting(userName),
      emailParagraph(`Your waitlist request${programInfo} at ${emailAccent(data.breederName)} has been <strong style="color: #10b981;">approved</strong>!`),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          <strong style="color: #10b981;">You're on the list!</strong><br>
          <span style="color: #a3a3a3;">The breeder may reach out with next steps, including any deposit requirements or additional information needed.</span>
        </p>
      `, { borderColor: "green" }),
      emailButton("View Details", viewUrl, "green"),
    ].join("\n"),
  });

  const text = `
Great News - You've Been Approved!

Hi ${userName},

Your waitlist request${programInfoText} at ${data.breederName} has been approved!

You're on the list!
The breeder may reach out with next steps, including any deposit requirements or additional information needed.

View details at: ${viewUrl}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,  // Marketplace/system email - no tenant context
    to: data.userEmail,
    subject: `Approved! Your waitlist request at ${data.breederName}`,
    html,
    text,
    templateKey: "marketplace_waitlist_approved",
    category: "transactional",
  });
}

/**
 * Send rejection email to user when their waitlist request is rejected
 */
export async function sendWaitlistRejectionToUser(data: {
  userEmail: string;
  userName: string;
  breederName: string;
  programName?: string;
  reason?: string;
}): Promise<void> {
  const userName = data.userName || "there";
  const programInfo = data.programName ? ` for ${emailAccent(data.programName)}` : "";
  const programInfoText = data.programName ? ` for ${data.programName}` : "";

  const reasonSection = data.reason
    ? emailInfoCard(`
        <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">Reason provided:</p>
        <p style="color: #d4d4d4; font-size: 14px; margin: 0;">${data.reason}</p>
      `, { borderColor: "gray" })
    : "";

  const html = wrapEmailLayout({
    title: "Waitlist Request Update",
    body: [
      emailGreeting(userName),
      emailParagraph(`We wanted to let you know that your waitlist request${programInfo} at ${emailAccent(data.breederName)} was not approved at this time.`),
      reasonSection,
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          <strong style="color: #f59e0b;">Don't be discouraged!</strong><br>
          <span style="color: #a3a3a3;">Breeders often have limited availability and receive many requests. You're welcome to explore other breeders on our marketplace or try again in the future.</span>
        </p>
      `, { borderColor: "yellow" }),
      emailButton("Browse Other Breeders", `${MARKETPLACE_URL}/breeders`),
    ].join("\n"),
  });

  const text = `
Waitlist Request Update

Hi ${userName},

We wanted to let you know that your waitlist request${programInfoText} at ${data.breederName} was not approved at this time.

${data.reason ? `Reason provided:\n${data.reason}\n` : ""}

Don't be discouraged!
Breeders often have limited availability and receive many requests. You're welcome to explore other breeders on our marketplace or try again in the future.

Browse other breeders at: ${MARKETPLACE_URL}/breeders

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,  // Marketplace/system email - no tenant context
    to: data.userEmail,
    subject: `Update on your waitlist request at ${data.breederName}`,
    html,
    text,
    templateKey: "marketplace_waitlist_rejected",
    category: "transactional",
  });
}

/**
 * Send notification to user when a breeder removes them from their waitlist.
 */
export async function sendWaitlistRemovalToUser(data: {
  userEmail: string;
  userName: string;
  breederName: string;
}): Promise<void> {
  const userName = data.userName || "there";

  const html = wrapEmailLayout({
    title: "Waitlist Update",
    body: [
      emailGreeting(userName),
      emailParagraph(`We wanted to let you know that ${emailAccent(data.breederName)} has removed your entry from their waitlist.`),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          <span style="color: #a3a3a3;">This can happen for a variety of reasons and doesn't reflect on you. You're welcome to explore other breeders on our marketplace or reach out to them directly if you'd like more information.</span>
        </p>
      `, { borderColor: "gray" }),
      emailButton("Browse Other Breeders", `${MARKETPLACE_URL}/breeders`),
    ].join("\n"),
  });

  const text = `
Waitlist Update

Hi ${userName},

We wanted to let you know that ${data.breederName} has removed your entry from their waitlist.

This can happen for a variety of reasons and doesn't reflect on you. You're welcome to explore other breeders on our marketplace or reach out to them directly if you'd like more information.

Browse other breeders at: ${MARKETPLACE_URL}/breeders

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,
    to: data.userEmail,
    subject: `Waitlist update from ${data.breederName}`,
    html,
    text,
    templateKey: "marketplace_waitlist_removed",
    category: "transactional",
  });
}

// ---------- Admin & Operational Notifications (P-02) ----------

// Admin notification email (configurable)
const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "support@breederhq.com";

/**
 * P-02: Send admin notification when a listing is auto-flagged due to abuse reports
 */
export async function sendAdminListingFlaggedNotification(data: {
  listingId: number;
  listingTitle: string;
  providerId: number;
  providerBusinessName: string;
  reportCount: number;
  latestReportId: number;
}): Promise<void> {
  const adminUrl = `${MARKETPLACE_URL}/admin/listings/${data.listingId}`;

  const html = wrapEmailLayout({
    title: "Listing Auto-Flagged",
    body: [
      emailParagraph("A service listing has been automatically flagged due to multiple abuse reports."),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; font-weight: 600;">Listing Details</p>
        <p style="color: #a3a3a3; font-size: 14px; margin: 8px 0 0 0;"><strong style="color: #d4d4d4;">Title:</strong> ${data.listingTitle}</p>
        <p style="color: #a3a3a3; font-size: 14px; margin: 4px 0 0 0;"><strong style="color: #d4d4d4;">Listing ID:</strong> ${data.listingId}</p>
        <p style="color: #a3a3a3; font-size: 14px; margin: 4px 0 0 0;"><strong style="color: #d4d4d4;">Provider:</strong> ${data.providerBusinessName} (ID: ${data.providerId})</p>
        <p style="color: #a3a3a3; font-size: 14px; margin: 4px 0 0 0;"><strong style="color: #d4d4d4;">Reports in 24h:</strong> <span style="color: #dc2626; font-weight: 600;">${data.reportCount}</span></p>
      `, { borderColor: "red" }),
      emailParagraph("Please review this listing and take appropriate action."),
      emailButton("Review Listing", adminUrl, "red"),
    ].join("\n"),
  });

  const text = `
Listing Auto-Flagged

A service listing has been automatically flagged due to multiple abuse reports.

Listing Details:
- Title: ${data.listingTitle}
- Listing ID: ${data.listingId}
- Provider: ${data.providerBusinessName} (ID: ${data.providerId})
- Reports in 24h: ${data.reportCount}

Please review this listing and take appropriate action.

Review at: ${adminUrl}

— ${FROM_NAME} Automated Notifications
  `.trim();

  await sendEmail({
    tenantId: null,  // Marketplace/system email - no tenant context
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: `[Action Required] Listing Auto-Flagged: ${data.listingTitle}`,
    html,
    text,
    templateKey: "admin_listing_flagged",
    category: "transactional",
  });
}

/**
 * P-02: Send notification to provider when identity verification fails
 */
export async function sendProviderVerificationFailedNotification(data: {
  email: string;
  firstName: string | null;
  businessName: string | null;
  failureReason?: string | null;
}): Promise<void> {
  const userName = data.firstName || "there";
  const verificationUrl = `${MARKETPLACE_URL}/provider/settings/verification`;

  const reasonText = data.failureReason
    ? `<br><span style="color: #a3a3a3;">${data.failureReason}</span>`
    : "";

  const html = wrapEmailLayout({
    title: "Identity Verification Update",
    body: [
      emailGreeting(userName),
      emailParagraph(`We were unable to complete your identity verification${data.businessName ? ` for ${emailAccent(data.businessName)}` : ""}.`),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0; line-height: 1.5;">
          <strong style="color: #f59e0b;">&#9888; Verification Incomplete</strong>${reasonText}
        </p>
      `, { borderColor: "yellow" }),
      emailHeading("What To Do Next"),
      emailParagraph("Please try the verification process again. Common issues include:"),
      emailBulletList([
        "Document was unclear or partially visible",
        "Photo didn't match the document",
        "Document type wasn't accepted",
        "Session timed out",
      ]),
      emailButton("Try Again", verificationUrl, "blue"),
      emailFootnote("If you continue to have issues, please contact our support team."),
    ].join("\n"),
  });

  const text = `
Identity Verification Update

Hi ${userName},

We were unable to complete your identity verification${data.businessName ? ` for ${data.businessName}` : ""}.

${data.failureReason ? `Details: ${data.failureReason}\n` : ""}
What To Do Next:
Please try the verification process again. Common issues include:
• Document was unclear or partially visible
• Photo didn't match the document
• Document type wasn't accepted
• Session timed out

Try again at: ${verificationUrl}

If you continue to have issues, please contact our support team.

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,  // Marketplace/system email - no tenant context
    to: data.email,
    subject: `Identity Verification Update - ${FROM_NAME}`,
    html,
    text,
    templateKey: "provider_verification_failed",
    category: "transactional",
  });
}

// ---------- Payment Failed Notifications ----------

/**
 * Send invoice payment failed notification to provider (marketplace)
 */
export async function sendInvoicePaymentFailedToProvider(data: {
  providerEmail: string;
  providerBusinessName: string;
  clientName: string;
  invoiceNumber: string;
  invoiceId: number;
  totalAmount: string;
  attemptCount: number;
}): Promise<void> {
  const dashboardUrl = `${MARKETPLACE_URL}/provider/invoices/${data.invoiceId}`;

  const html = wrapEmailLayout({
    title: "Payment Failed",
    body: [
      emailGreeting(data.providerBusinessName),
      emailParagraph(`A payment attempt for invoice ${emailAccent(data.invoiceNumber)} has failed.`),
      emailDetailRows([
        { label: "Invoice", value: data.invoiceNumber },
        { label: "Customer", value: data.clientName },
        { label: "Amount", value: data.totalAmount },
        { label: "Payment Attempts", value: String(data.attemptCount) },
      ]),
      emailHeading("What happens next?"),
      emailBulletList([
        "Stripe will automatically retry the payment",
        "The customer has been notified to update their payment method",
        "You can reach out to the customer directly if needed",
      ]),
      emailButton("View Invoice", dashboardUrl, "blue"),
    ].join("\n"),
  });

  const text = `
Payment Failed

Hi ${data.providerBusinessName},

A payment attempt for invoice ${data.invoiceNumber} has failed.

Invoice: ${data.invoiceNumber}
Customer: ${data.clientName}
Amount: ${data.totalAmount}
Payment Attempts: ${data.attemptCount}

What happens next?
• Stripe will automatically retry the payment
• The customer has been notified to update their payment method
• You can reach out to the customer directly if needed

View invoice: ${dashboardUrl}

— The ${FROM_NAME} Team
  `.trim();

  await sendEmail({
    tenantId: null,  // Marketplace/system email - no tenant context
    to: data.providerEmail,
    subject: `Payment Failed - Invoice ${data.invoiceNumber}`,
    html,
    text,
    templateKey: "marketplace_invoice_payment_failed_provider",
    category: "transactional",
  });
}

/**
 * P-02: Send auto-reply when inbound email is received for an inactive/unknown address
 */
export async function sendInactiveAddressAutoReply(data: {
  toEmail: string;
  fromSlug: string;
  originalSubject: string;
}): Promise<void> {
  const html = wrapEmailLayout({
    title: "Email Delivery Failed",
    body: [
      emailParagraph(`Your email to <strong style="color: #ffffff;">${data.fromSlug}@mail.breederhq.com</strong> could not be delivered.`),
      emailInfoCard(`
        <p style="color: #d4d4d4; font-size: 14px; margin: 0;"><strong style="color: #a3a3a3;">Original Subject:</strong> ${data.originalSubject || "(no subject)"}</p>
      `),
      emailParagraph("This email address is not currently active or does not exist. Possible reasons:"),
      emailBulletList([
        "The business may have changed their email address",
        "The account may no longer be active on BreederHQ",
        "There may be a typo in the address",
      ]),
      emailParagraph("If you're trying to reach a breeder or service provider on BreederHQ, please visit our marketplace to find their current contact information."),
      emailButton("Visit BreederHQ Marketplace", MARKETPLACE_URL),
      emailFootnote("This is an automated message. Please do not reply."),
    ].join("\n"),
  });

  const text = `
Email Delivery Failed

Your email to ${data.fromSlug}@mail.breederhq.com could not be delivered.

Original Subject: ${data.originalSubject || "(no subject)"}

This email address is not currently active or does not exist. Possible reasons:
• The business may have changed their email address
• The account may no longer be active on BreederHQ
• There may be a typo in the address

If you're trying to reach a breeder or service provider on BreederHQ, please visit our marketplace to find their current contact information.

Visit: ${MARKETPLACE_URL}

This is an automated message. Please do not reply.
— ${FROM_NAME}
  `.trim();

  await sendEmail({
    tenantId: null,  // Marketplace/system email - no tenant context
    to: data.toEmail,
    subject: `Undeliverable: ${data.originalSubject || "(no subject)"}`,
    html,
    text,
    templateKey: "inbound_inactive_address_reply",
    category: "transactional",
  });
}
