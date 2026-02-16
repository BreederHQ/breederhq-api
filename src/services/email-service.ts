// src/services/email-service.ts
import { Resend } from "resend";
import prisma from "../prisma.js";
import { canContactViaChannel } from "./comm-prefs-service.js";
import { renderTemplate } from "./template-renderer.js";

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

// From address configuration (defaults)
const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@mail.breederhq.com";
const DEFAULT_FROM_NAME = process.env.RESEND_FROM_NAME || "BreederHQ";
const DEFAULT_FROM = `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`;

// Inbound email domain (for reply-to addresses)
export const INBOUND_DOMAIN = process.env.RESEND_INBOUND_DOMAIN || "mail.breederhq.com";

/**
 * Build a formatted from address
 * @param name Display name (e.g., "Sunny Acres Farm")
 * @param localPart Local part of email (e.g., "notifications") - defaults to "noreply"
 * @returns Formatted from address (e.g., "Sunny Acres Farm" <notifications@mail.breederhq.com>)
 */
export function buildFromAddress(name: string, localPart: string = "noreply"): string {
  return `"${name}" <${localPart}@${INBOUND_DOMAIN}>`;
}

// Development mode settings
// In dev mode, emails can be:
// 1. Redirected to a test address (EMAIL_DEV_REDIRECT)
// 2. Logged only without sending (EMAIL_DEV_LOG_ONLY=true)
// 3. Sent normally to specific allowed domains (EMAIL_DEV_ALLOWED_DOMAINS)
const EMAIL_DEV_REDIRECT = process.env.EMAIL_DEV_REDIRECT; // e.g., "dev@yourdomain.com"
const EMAIL_DEV_LOG_ONLY = process.env.EMAIL_DEV_LOG_ONLY === "true";
const EMAIL_DEV_ALLOWED_DOMAINS = (process.env.EMAIL_DEV_ALLOWED_DOMAINS || "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

// Lazy initialization of Resend client
let resend: Resend | null = null;
function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

/**
 * Check if email should be sent in development mode
 * Returns the actual recipient address (may be redirected)
 */
function getDevModeRecipient(originalTo: string): { to: string; redirected: boolean; blocked: boolean } {
  // Production mode: no changes
  if (IS_PRODUCTION) {
    return { to: originalTo, redirected: false, blocked: false };
  }

  // Dev mode: log only (don't actually send)
  if (EMAIL_DEV_LOG_ONLY) {
    return { to: originalTo, redirected: false, blocked: true };
  }

  // Dev mode: check if recipient domain is in allowed list
  const recipientDomain = originalTo.split("@")[1]?.toLowerCase();
  if (EMAIL_DEV_ALLOWED_DOMAINS.length > 0 && recipientDomain) {
    if (EMAIL_DEV_ALLOWED_DOMAINS.includes(recipientDomain)) {
      return { to: originalTo, redirected: false, blocked: false };
    }
  }

  // Dev mode: redirect all emails to test address
  if (EMAIL_DEV_REDIRECT) {
    return { to: EMAIL_DEV_REDIRECT, redirected: true, blocked: false };
  }

  // Dev mode with no safeguards configured - allow but warn
  console.warn(
    `[email-service] WARNING: Sending email to ${originalTo} in ${NODE_ENV} mode. ` +
    `Set EMAIL_DEV_REDIRECT, EMAIL_DEV_LOG_ONLY, or EMAIL_DEV_ALLOWED_DOMAINS for safety.`
  );
  return { to: originalTo, redirected: false, blocked: false };
}

export interface SendEmailParams {
  tenantId: number | null;  // null for system/marketplace emails without tenant context
  to: string;
  subject: string;
  html?: string;
  text?: string;
  templateKey?: string;
  metadata?: Record<string, any>;
  relatedInvoiceId?: number;
  category: "transactional" | "marketing";
  /** Optional custom from address. Must be on verified domain (e.g., "Farm Name" <farm@mail.breederhq.com>) */
  from?: string;
  /** Optional reply-to address for threading (e.g., reply+t_123_abc@mail.breederhq.com) */
  replyTo?: string;
}

export interface SendTemplatedEmailParams {
  tenantId: number | null;  // null for system/marketplace emails without tenant context
  to: string;
  templateId: number;
  context: Record<string, any>;
  category: "transactional" | "marketing";
  relatedInvoiceId?: number;
  metadata?: Record<string, any>;
  /** Optional custom from address */
  from?: string;
  /** Optional reply-to address */
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Send templated email via Resend with template rendering
 */
export async function sendTemplatedEmail(
  params: SendTemplatedEmailParams
): Promise<SendEmailResult> {
  const { tenantId, to, templateId, context, category, relatedInvoiceId, metadata, from, replyTo } = params;

  const template = await prisma.template.findFirst({
    where: { id: templateId, tenantId: tenantId ?? undefined },
    include: { content: true },
  });

  if (!template) {
    return { ok: false, error: "template_not_found" };
  }

  if (template.status !== "active") {
    return { ok: false, error: "template_not_active" };
  }

  const rendered = await renderTemplate({ prisma, templateId, context });

  return sendEmail({
    tenantId,
    to,
    subject: rendered.subject || `Message from ${DEFAULT_FROM_NAME}`,
    html: rendered.bodyHtml,
    text: rendered.bodyText,
    templateKey: template.key || undefined,
    metadata,
    relatedInvoiceId,
    category,
    from,
    replyTo,
  });
}

/**
 * Send email via Resend and log to EmailSendLog.
 * - Enforces PartyCommPreference (EMAIL channel) for marketing emails only.
 * - Transactional emails (invoices, receipts, etc.) bypass preferences.
 * - Invoice emails are idempotent via unique constraint on (tenantId, templateKey, relatedInvoiceId).
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { tenantId, to, subject, html, text, templateKey, metadata, relatedInvoiceId, category, from, replyTo } = params;

  // Use custom from or default
  const fromAddress = from || DEFAULT_FROM;

  // Idempotency check for invoice emails (only for tenant-scoped emails)
  if (tenantId !== null && templateKey === "invoice_issued" && relatedInvoiceId) {
    const existing = await prisma.emailSendLog.findUnique({
      where: {
        tenantId_templateKey_relatedInvoiceId: {
          tenantId,
          templateKey,
          relatedInvoiceId,
        },
      },
      select: { id: true, status: true },
    });

    if (existing && existing.status === "sent") {
      return { ok: true, skipped: true, error: "invoice_email_already_sent" };
    }
  }

  // Validate recipient party comm preferences (marketing only, requires tenant context)
  if (tenantId !== null && category === "marketing") {
    const party = await prisma.party.findFirst({
      where: { tenantId, email: { equals: to, mode: "insensitive" } },
    });

    if (party) {
      const allowed = await canContactViaChannel(party.id, "EMAIL");
      if (!allowed) {
        await prisma.emailSendLog.create({
          data: {
            tenantId,
            to,
            from: fromAddress,
            subject,
            templateKey,
            provider: "resend",
            relatedInvoiceId,
            status: "failed",
            error: { reason: "comm_preference_blocked", channel: "EMAIL" },
            metadata,
          },
        });
        return { ok: false, error: "recipient_has_blocked_email" };
      }
    }
  }

  // Dev mode safeguards: redirect, block, or allow
  const devMode = getDevModeRecipient(to);
  const actualRecipient = devMode.to;

  // Dev mode: log only (don't send)
  if (devMode.blocked) {
    console.log(`[email-service] DEV LOG ONLY - Would send to: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Category: ${category}`);
    if (html) console.log(`  HTML: ${html.substring(0, 200)}...`);

    await prisma.emailSendLog.create({
      data: {
        tenantId,
        to,
        from: fromAddress,
        subject,
        templateKey,
        category,
        provider: "resend",
        relatedInvoiceId,
        status: "sent", // Mark as sent since it's intentionally blocked
        metadata: { ...metadata, devMode: "log_only", originalTo: to, replyTo },
      },
    });

    return { ok: true, skipped: true, providerMessageId: "dev-log-only" };
  }

  // Log if email was redirected in dev mode
  if (devMode.redirected) {
    console.log(`[email-service] DEV REDIRECT: ${to} -> ${actualRecipient}`);
  }

  // Send via Resend
  try {
    const resendClient = getResendClient();

    // In dev mode with redirect, prepend original recipient to subject
    const actualSubject = devMode.redirected
      ? `[DEV: ${to}] ${subject}`
      : subject;

    const { data, error } = await resendClient.emails.send({
      from: fromAddress,
      to: actualRecipient,
      subject: actualSubject,
      html: html || text || "",
      text,
      ...(replyTo && { reply_to: replyTo }),
    });

    if (error) {
      await prisma.emailSendLog.create({
        data: {
          tenantId,
          to,
          from: fromAddress,
          subject,
          templateKey,
          provider: "resend",
          relatedInvoiceId,
          status: "failed",
          error: { resendError: error },
          metadata: { ...metadata, replyTo },
        },
      });
      return { ok: false, error: error.message || "resend_error" };
    }

    const messageId = data?.id || null;
    await prisma.emailSendLog.create({
      data: {
        tenantId,
        to: devMode.redirected ? to : actualRecipient, // Log original recipient
        from: fromAddress,
        subject,
        templateKey,
        category,
        provider: "resend",
        providerMessageId: messageId,
        relatedInvoiceId,
        status: "sent",
        metadata: devMode.redirected
          ? { ...metadata, devMode: "redirected", actualRecipient, originalTo: to, replyTo }
          : { ...metadata, replyTo },
      },
    });

    return { ok: true, providerMessageId: messageId || undefined };
  } catch (err: any) {
    await prisma.emailSendLog.create({
      data: {
        tenantId,
        to,
        from: fromAddress,
        subject,
        templateKey,
        category,
        provider: "resend",
        relatedInvoiceId,
        status: "failed",
        error: { exception: err.message },
        metadata: { ...metadata, replyTo },
      },
    });
    return { ok: false, error: err.message || "unknown_error" };
  }
}

/** ───────────────────────── Billing & Quota Notifications ───────────────────────── */

const APP_URL = process.env.APP_URL || "https://app.breederhq.com";

/**
 * Get tenant owner email for notifications
 */
async function getTenantOwnerEmail(tenantId: number): Promise<{ email: string; name: string } | null> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        organizations: {
          take: 1,
          include: {
            party: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!tenant?.organizations?.[0]?.party?.email) {
      return null;
    }

    return {
      email: tenant.organizations[0].party.email,
      name: tenant.organizations[0].party.name || tenant.name,
    };
  } catch (error) {
    console.error("Failed to get tenant owner email:", error);
    return null;
  }
}

/**
 * Send quota warning email (80%+ usage)
 */
export async function sendQuotaWarningEmail(
  tenantId: number,
  metricLabel: string,
  current: number,
  limit: number,
  percentUsed: number
): Promise<void> {
  const recipient = await getTenantOwnerEmail(tenantId);
  if (!recipient) return;

  const subject = `⚠️ Quota Warning: ${metricLabel} at ${Math.round(percentUsed)}%`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f97316;">Quota Warning</h2>
      <p>Hi ${recipient.name},</p>
      <p>You're approaching your quota limit for <strong>${metricLabel}</strong>.</p>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0;">
        <strong>Current Usage:</strong> ${current} / ${limit} (${Math.round(percentUsed)}%)
      </div>

      <p>To avoid any interruption to your service, consider upgrading your plan.</p>

      <p>
        <a href="${APP_URL}/settings?tab=billing" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Manage Subscription
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        Thanks,<br>
        The BreederHQ Team
      </p>
    </div>
  `;

  await sendEmail({
    tenantId,
    to: recipient.email,
    subject,
    html,
    category: "transactional",
    templateKey: "quota_warning",
  });
}

/**
 * Send quota critical email (95%+ usage)
 */
export async function sendQuotaCriticalEmail(
  tenantId: number,
  metricLabel: string,
  current: number,
  limit: number,
  percentUsed: number
): Promise<void> {
  const recipient = await getTenantOwnerEmail(tenantId);
  if (!recipient) return;

  const subject = `🚨 Critical: ${metricLabel} quota at ${Math.round(percentUsed)}%`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Critical Quota Alert</h2>
      <p>Hi ${recipient.name},</p>
      <p><strong>Your ${metricLabel} quota is almost full!</strong></p>

      <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 24px 0;">
        <strong>Current Usage:</strong> ${current} / ${limit} (${Math.round(percentUsed)}%)
        <br>
        <strong>Remaining:</strong> ${limit - current} ${metricLabel.toLowerCase()}
      </div>

      <p>Once you reach 100%, you won't be able to add more ${metricLabel.toLowerCase()} until you upgrade your plan.</p>

      <p>
        <a href="${APP_URL}/settings?tab=billing" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Upgrade Now
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        Thanks,<br>
        The BreederHQ Team
      </p>
    </div>
  `;

  await sendEmail({
    tenantId,
    to: recipient.email,
    subject,
    html,
    category: "transactional",
    templateKey: "quota_critical",
  });
}

/**
 * Send quota exceeded email (100% usage)
 */
export async function sendQuotaExceededEmail(
  tenantId: number,
  metricLabel: string,
  limit: number
): Promise<void> {
  const recipient = await getTenantOwnerEmail(tenantId);
  if (!recipient) return;

  const subject = `🛑 ${metricLabel} quota limit reached`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Quota Limit Reached</h2>
      <p>Hi ${recipient.name},</p>
      <p><strong>You've reached your ${metricLabel} quota limit of ${limit}.</strong></p>

      <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 24px 0;">
        <p style="margin: 0;">You cannot add more ${metricLabel.toLowerCase()} until you upgrade your plan.</p>
      </div>

      <p>Upgrade now to continue adding ${metricLabel.toLowerCase()}:</p>

      <p>
        <a href="${APP_URL}/settings?tab=billing" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Upgrade Your Plan
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        Thanks,<br>
        The BreederHQ Team
      </p>
    </div>
  `;

  await sendEmail({
    tenantId,
    to: recipient.email,
    subject,
    html,
    category: "transactional",
    templateKey: "quota_exceeded",
  });
}

/**
 * Send payment failed email
 */
export async function sendPaymentFailedEmail(
  tenantId: number,
  planName: string,
  amountDue: number,
  invoiceUrl?: string,
  nextAttemptDate?: Date
): Promise<void> {
  const recipient = await getTenantOwnerEmail(tenantId);
  if (!recipient) return;

  const subject = "Payment Failed - Action Required";
  const amountStr = amountDue.toFixed(2);
  const nextAttemptStr = nextAttemptDate
    ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(nextAttemptDate)
    : null;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Payment Failed</h2>
      <p>Hi ${recipient.name},</p>
      <p>We were unable to process your payment for your BreederHQ subscription.</p>

      <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Plan:</strong> ${planName}</p>
        <p style="margin: 0 0 8px 0;"><strong>Amount Due:</strong> $${amountStr}</p>
        ${nextAttemptStr ? `<p style="margin: 0;"><strong>Next Payment Attempt:</strong> ${nextAttemptStr}</p>` : ""}
      </div>

      <p><strong>Please update your payment method to avoid service interruption.</strong></p>

      <p>
        <a href="${invoiceUrl || `${APP_URL}/settings?tab=billing`}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Update Payment Method
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        If you have questions, please contact our support team.<br><br>
        Thanks,<br>
        The BreederHQ Team
      </p>
    </div>
  `;

  await sendEmail({
    tenantId,
    to: recipient.email,
    subject,
    html,
    category: "transactional",
    templateKey: "payment_failed",
  });
}

/**
 * Send subscription canceled email
 */
export async function sendSubscriptionCanceledEmail(
  tenantId: number,
  planName: string,
  periodEndDate: Date
): Promise<void> {
  const recipient = await getTenantOwnerEmail(tenantId);
  if (!recipient) return;

  const subject = "Subscription Canceled";
  const endDateStr = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(periodEndDate);

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6b7280;">Subscription Canceled</h2>
      <p>Hi ${recipient.name},</p>
      <p>Your <strong>${planName}</strong> subscription has been canceled.</p>

      <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px; margin: 24px 0;">
        <p style="margin: 0;">Your subscription will remain active until <strong>${endDateStr}</strong>.</p>
      </div>

      <p>You can reactivate your subscription at any time:</p>

      <p>
        <a href="${APP_URL}/settings?tab=billing" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Reactivate Subscription
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        We're sorry to see you go. If you have feedback, we'd love to hear it.<br><br>
        Thanks,<br>
        The BreederHQ Team
      </p>
    </div>
  `;

  await sendEmail({
    tenantId,
    to: recipient.email,
    subject,
    html,
    category: "transactional",
    templateKey: "subscription_canceled",
  });
}

/**
 * Send subscription renewed email
 */
export async function sendSubscriptionRenewedEmail(
  tenantId: number,
  planName: string,
  nextBillingDate: Date,
  amountCharged: number,
  invoiceUrl?: string
): Promise<void> {
  const recipient = await getTenantOwnerEmail(tenantId);
  if (!recipient) return;

  const subject = "Subscription Renewed Successfully";
  const amountStr = amountCharged.toFixed(2);
  const nextDateStr = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(nextBillingDate);

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10b981;">Subscription Renewed</h2>
      <p>Hi ${recipient.name},</p>
      <p>Your BreederHQ subscription has been renewed successfully!</p>

      <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Plan:</strong> ${planName}</p>
        <p style="margin: 0 0 8px 0;"><strong>Amount Charged:</strong> $${amountStr}</p>
        <p style="margin: 0;"><strong>Next Billing Date:</strong> ${nextDateStr}</p>
      </div>

      <p>
        <a href="${invoiceUrl || `${APP_URL}/settings?tab=billing`}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          ${invoiceUrl ? "View Invoice" : "View Billing Details"}
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        Thanks for being a BreederHQ customer!<br><br>
        The BreederHQ Team
      </p>
    </div>
  `;

  await sendEmail({
    tenantId,
    to: recipient.email,
    subject,
    html,
    category: "transactional",
    templateKey: "subscription_renewed",
  });
}

/** ───────────────────────── Marketplace Notifications ───────────────────────── */

export interface WaitlistSignupNotificationData {
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  programName: string;
  message?: string;
  waitlistEntryId: number;
}

/**
 * Send notification email to breeder when someone joins their waitlist from the marketplace
 */
export async function sendWaitlistSignupNotificationEmail(
  tenantId: number,
  data: WaitlistSignupNotificationData
): Promise<void> {
  const recipient = await getTenantOwnerEmail(tenantId);
  if (!recipient) return;

  const subject = `New Waitlist Signup: ${data.applicantName} for ${data.programName}`;

  const contactInfo = [
    `<strong>Email:</strong> <a href="mailto:${data.applicantEmail}">${data.applicantEmail}</a>`,
    data.applicantPhone ? `<strong>Phone:</strong> ${data.applicantPhone}` : null,
  ].filter(Boolean).join("<br>");

  const messageSection = data.message
    ? `
      <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Message from applicant:</p>
        <p style="margin: 0; color: #4b5563; white-space: pre-wrap;">${data.message}</p>
      </div>
    `
    : "";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f97316;">New Waitlist Signup!</h2>
      <p>Hi ${recipient.name},</p>
      <p>Great news! Someone has joined your waitlist for <strong>${data.programName}</strong>.</p>

      <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin: 24px 0;">
        <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #c2410c;">
          ${data.applicantName}
        </p>
        ${contactInfo}
      </div>

      ${messageSection}

      <p>
        <a href="${APP_URL}/waitlist" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Waitlist
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        This applicant's request is pending your review. You can approve, reject, or message them from your waitlist dashboard.
        <br><br>
        The BreederHQ Team
      </p>
    </div>
  `;

  const text = `
New Waitlist Signup!

Hi ${recipient.name},

Great news! Someone has joined your waitlist for ${data.programName}.

Applicant: ${data.applicantName}
Email: ${data.applicantEmail}
${data.applicantPhone ? `Phone: ${data.applicantPhone}` : ""}

${data.message ? `Message from applicant:\n${data.message}\n` : ""}

View and manage this request at: ${APP_URL}/waitlist

This applicant's request is pending your review.

The BreederHQ Team
  `.trim();

  await sendEmail({
    tenantId,
    to: recipient.email,
    subject,
    html,
    text,
    category: "transactional",
    templateKey: "waitlist_signup_notification",
  });
}

/** ───────────────────────── Contract/E-Signature Notifications ───────────────────────── */

const PORTAL_URL = process.env.PORTAL_DOMAIN || "https://portal.breederhq.com";

export interface ContractEmailData {
  contractId: number;
  contractTitle: string;
  breederName: string;
  recipientName: string;
  recipientEmail: string;
  expiresAt?: Date;
  message?: string;
}

export interface ContractSignedEmailData extends ContractEmailData {
  signedByName: string;
  signedAt: Date;
  allPartiesSigned: boolean;
}

export interface ContractDeclinedEmailData extends ContractEmailData {
  declinedByName: string;
  declinedAt: Date;
  reason?: string;
}

/**
 * Send contract to recipient for signing
 */
export async function sendContractSentEmail(
  tenantId: number,
  data: ContractEmailData
): Promise<SendEmailResult> {
  const signingUrl = `${PORTAL_URL}/contracts/${data.contractId}/sign`;

  const expirationNote = data.expiresAt
    ? `<p style="color: #b45309; font-size: 14px;">⏰ This contract expires on ${new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(data.expiresAt)}.</p>`
    : "";

  const personalMessage = data.message
    ? `
      <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Message from ${data.breederName}:</p>
        <p style="margin: 0; color: #4b5563; white-space: pre-wrap;">${data.message}</p>
      </div>
    `
    : "";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f97316;">Contract Ready for Your Signature</h2>
      <p>Hi ${data.recipientName},</p>
      <p><strong>${data.breederName}</strong> has sent you a contract to review and sign.</p>

      <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #c2410c;">
          ${data.contractTitle}
        </p>
      </div>

      ${personalMessage}
      ${expirationNote}

      <p>Please review the document and sign electronically to complete the agreement.</p>

      <p>
        <a href="${signingUrl}" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Review & Sign Contract
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        If you have any questions about this contract, please contact ${data.breederName} directly.
        <br><br>
        The BreederHQ Team
      </p>
    </div>
  `;

  const text = `
Contract Ready for Your Signature

Hi ${data.recipientName},

${data.breederName} has sent you a contract to review and sign.

Contract: ${data.contractTitle}

${data.message ? `Message from ${data.breederName}:\n${data.message}\n` : ""}
${data.expiresAt ? `This contract expires on ${new Intl.DateTimeFormat("en-US").format(data.expiresAt)}.\n` : ""}

Please review and sign at: ${signingUrl}

If you have questions, please contact ${data.breederName} directly.

The BreederHQ Team
  `.trim();

  return sendEmail({
    tenantId,
    to: data.recipientEmail,
    subject: `Contract from ${data.breederName}: ${data.contractTitle}`,
    html,
    text,
    category: "transactional",
    templateKey: "contract_sent",
    metadata: { contractId: data.contractId },
  });
}

/**
 * Send contract reminder email
 */
export async function sendContractReminderEmail(
  tenantId: number,
  data: ContractEmailData,
  daysUntilExpiry?: number
): Promise<SendEmailResult> {
  const signingUrl = `${PORTAL_URL}/contracts/${data.contractId}/sign`;

  const urgencyText = daysUntilExpiry !== undefined
    ? daysUntilExpiry <= 1
      ? "expires tomorrow"
      : `expires in ${daysUntilExpiry} days`
    : "is awaiting your signature";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">Reminder: Contract Awaiting Your Signature</h2>
      <p>Hi ${data.recipientName},</p>
      <p>This is a friendly reminder that the following contract from <strong>${data.breederName}</strong> ${urgencyText}.</p>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #b45309;">
          ${data.contractTitle}
        </p>
        ${data.expiresAt ? `
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #92400e;">
          Expires: ${new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(data.expiresAt)}
        </p>
        ` : ""}
      </div>

      <p>
        <a href="${signingUrl}" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Review & Sign Now
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        If you've already signed or have questions, please contact ${data.breederName}.
        <br><br>
        The BreederHQ Team
      </p>
    </div>
  `;

  return sendEmail({
    tenantId,
    to: data.recipientEmail,
    subject: `Reminder: Contract ${urgencyText} - ${data.contractTitle}`,
    html,
    category: "transactional",
    templateKey: "contract_reminder",
    metadata: { contractId: data.contractId, daysUntilExpiry },
  });
}

/**
 * Send notification when a party signs the contract
 */
export async function sendContractSignedEmail(
  tenantId: number,
  data: ContractSignedEmailData
): Promise<SendEmailResult> {
  const viewUrl = data.allPartiesSigned
    ? `${APP_URL}/contracts/${data.contractId}`
    : `${APP_URL}/contracts/${data.contractId}`;

  const statusMessage = data.allPartiesSigned
    ? `<p style="color: #059669; font-weight: 600;">✓ All parties have now signed. The contract is fully executed.</p>`
    : `<p>There are still other parties who need to sign before the contract is complete.</p>`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10b981;">Contract Signed</h2>
      <p>Hi ${data.recipientName},</p>
      <p><strong>${data.signedByName}</strong> has signed the following contract:</p>

      <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #065f46;">
          ${data.contractTitle}
        </p>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #047857;">
          Signed on ${new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }).format(data.signedAt)}
        </p>
      </div>

      ${statusMessage}

      <p>
        <a href="${viewUrl}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          ${data.allPartiesSigned ? "View Signed Contract" : "View Contract Status"}
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        ${data.allPartiesSigned ? "A copy of the signed document will be sent to all parties." : ""}
        <br><br>
        The BreederHQ Team
      </p>
    </div>
  `;

  return sendEmail({
    tenantId,
    to: data.recipientEmail,
    subject: data.allPartiesSigned
      ? `Contract Fully Signed: ${data.contractTitle}`
      : `Contract Update: ${data.signedByName} has signed`,
    html,
    category: "transactional",
    templateKey: data.allPartiesSigned ? "contract_completed" : "contract_party_signed",
    metadata: { contractId: data.contractId, signedBy: data.signedByName },
  });
}

/**
 * Send notification when a party declines the contract
 */
export async function sendContractDeclinedEmail(
  tenantId: number,
  data: ContractDeclinedEmailData
): Promise<SendEmailResult> {
  const viewUrl = `${APP_URL}/contracts/${data.contractId}`;

  const reasonSection = data.reason
    ? `
      <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Reason given:</p>
        <p style="margin: 0; color: #4b5563; white-space: pre-wrap;">${data.reason}</p>
      </div>
    `
    : "";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Contract Declined</h2>
      <p>Hi ${data.recipientName},</p>
      <p><strong>${data.declinedByName}</strong> has declined to sign the following contract:</p>

      <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #991b1b;">
          ${data.contractTitle}
        </p>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #b91c1c;">
          Declined on ${new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }).format(data.declinedAt)}
        </p>
      </div>

      ${reasonSection}

      <p>You may want to reach out to discuss their concerns or create a new contract with updated terms.</p>

      <p>
        <a href="${viewUrl}" style="background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Contract Details
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        The BreederHQ Team
      </p>
    </div>
  `;

  return sendEmail({
    tenantId,
    to: data.recipientEmail,
    subject: `Contract Declined: ${data.contractTitle}`,
    html,
    category: "transactional",
    templateKey: "contract_declined",
    metadata: { contractId: data.contractId, declinedBy: data.declinedByName },
  });
}

/**
 * Send notification when contract is voided by breeder
 */
export async function sendContractVoidedEmail(
  tenantId: number,
  data: ContractEmailData & { reason?: string }
): Promise<SendEmailResult> {
  const reasonSection = data.reason
    ? `
      <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Reason:</p>
        <p style="margin: 0; color: #4b5563; white-space: pre-wrap;">${data.reason}</p>
      </div>
    `
    : "";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6b7280;">Contract Voided</h2>
      <p>Hi ${data.recipientName},</p>
      <p><strong>${data.breederName}</strong> has voided the following contract:</p>

      <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #374151;">
          ${data.contractTitle}
        </p>
      </div>

      ${reasonSection}

      <p>This contract is no longer valid and no action is required from you.</p>

      <p>If you have questions, please contact ${data.breederName} directly.</p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        The BreederHQ Team
      </p>
    </div>
  `;

  return sendEmail({
    tenantId,
    to: data.recipientEmail,
    subject: `Contract Voided: ${data.contractTitle}`,
    html,
    category: "transactional",
    templateKey: "contract_voided",
    metadata: { contractId: data.contractId },
  });
}

/**
 * Send notification when contract expires
 */
export async function sendContractExpiredEmail(
  tenantId: number,
  data: ContractEmailData
): Promise<SendEmailResult> {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b45309;">Contract Expired</h2>
      <p>Hi ${data.recipientName},</p>
      <p>The following contract has expired and can no longer be signed:</p>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #92400e;">
          ${data.contractTitle}
        </p>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #b45309;">
          From: ${data.breederName}
        </p>
      </div>

      <p>If you still wish to proceed with this agreement, please contact ${data.breederName} to request a new contract.</p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        The BreederHQ Team
      </p>
    </div>
  `;

  return sendEmail({
    tenantId,
    to: data.recipientEmail,
    subject: `Contract Expired: ${data.contractTitle}`,
    html,
    category: "transactional",
    templateKey: "contract_expired",
    metadata: { contractId: data.contractId },
  });
}

/**
 * Send signed PDF to all parties after contract is fully executed
 */
export async function sendContractCompletedWithPdfEmail(
  tenantId: number,
  data: ContractEmailData & { pdfDownloadUrl: string }
): Promise<SendEmailResult> {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10b981;">✓ Contract Fully Executed</h2>
      <p>Hi ${data.recipientName},</p>
      <p>Great news! All parties have signed the following contract:</p>

      <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #065f46;">
          ${data.contractTitle}
        </p>
      </div>

      <p>Your signed copy is ready for download. This document includes all signatures and a certificate of completion for your records.</p>

      <p>
        <a href="${data.pdfDownloadUrl}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Download Signed Contract (PDF)
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        Keep this document for your records. The signed contract is legally binding.
        <br><br>
        The BreederHQ Team
      </p>
    </div>
  `;

  return sendEmail({
    tenantId,
    to: data.recipientEmail,
    subject: `Signed Contract Ready: ${data.contractTitle}`,
    html,
    category: "transactional",
    templateKey: "contract_completed_pdf",
    metadata: { contractId: data.contractId },
  });
}

/** ───────────────────────── Tenant Invoice Payment Notifications ───────────────────────── */

/**
 * Send invoice payment failed notification to breeder (tenant invoices)
 */
export async function sendTenantInvoicePaymentFailedEmail(
  tenantId: number,
  data: {
    breederEmail: string;
    breederName: string;
    clientName: string;
    invoiceNumber: string;
    invoiceId: number;
    totalAmount: string;
    attemptCount: number;
  }
): Promise<void> {
  const recipient = { email: data.breederEmail, name: data.breederName };

  const subject = `⚠️ Payment Failed - Invoice ${data.invoiceNumber}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">⚠️ Payment Failed</h2>

      <p>Hi ${recipient.name},</p>

      <p>A payment attempt for invoice <strong>${data.invoiceNumber}</strong> has failed.</p>

      <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #dc2626;">
        <p style="margin: 0;"><strong>Invoice:</strong> ${data.invoiceNumber}</p>
        <p style="margin: 8px 0 0 0;"><strong>Client:</strong> ${data.clientName}</p>
        <p style="margin: 8px 0 0 0;"><strong>Amount:</strong> ${data.totalAmount}</p>
        <p style="margin: 8px 0 0 0;"><strong>Payment Attempts:</strong> ${data.attemptCount}</p>
      </div>

      <p><strong>What happens next?</strong></p>
      <ul style="color: #6b7280;">
        <li>Stripe will automatically retry the payment</li>
        <li>The client has been notified to update their payment method</li>
        <li>You can reach out to the client directly if needed</li>
      </ul>

      <p>
        <a href="${APP_URL}/invoices/${data.invoiceId}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Invoice
        </a>
      </p>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        Thanks,<br>
        The BreederHQ Team
      </p>
    </div>
  `;

  await sendEmail({
    tenantId,
    to: recipient.email,
    subject,
    html,
    category: "transactional",
    templateKey: "tenant_invoice_payment_failed",
    relatedInvoiceId: data.invoiceId,
  });
}

/** ───────────────────────── Tenant Provisioning Notifications ───────────────────────── */

export interface TenantWelcomeEmailData {
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName?: string | null;
  tenantName: string;
  tempPassword?: string;
  loginUrl?: string;
}

/**
 * Send welcome email to new tenant owner with login credentials
 */
export async function sendTenantWelcomeEmail(
  data: TenantWelcomeEmailData
): Promise<SendEmailResult> {
  const loginUrl = data.loginUrl || APP_URL;
  const ownerName = data.ownerFirstName + (data.ownerLastName ? ` ${data.ownerLastName}` : "");

  // If we have a temp password, show credentials section
  const credentialsSection = data.tempPassword
    ? `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0;">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: #92400e;">Your Login Credentials</p>
        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${data.ownerEmail}</p>
        <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #fff; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${data.tempPassword}</code></p>
        <p style="margin: 12px 0 0 0; font-size: 13px; color: #b45309;">⚠️ Please change your password after logging in.</p>
      </div>
    `
    : `
      <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #1e40af;">Your account has been created with your existing password, or you can use the "Forgot Password" link on the login page to set a new one.</p>
      </div>
    `;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f97316;">Welcome to BreederHQ! 🎉</h2>
      <p>Hi ${ownerName},</p>
      <p>Great news! Your BreederHQ account for <strong>${data.tenantName}</strong> has been created and is ready to use.</p>

      ${credentialsSection}

      <p>
        <a href="${loginUrl}" style="display: inline-block; background: #f97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Log In to BreederHQ
        </a>
      </p>

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <h3 style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">Getting Started</h3>
        <ul style="color: #4b5563; padding-left: 20px; margin: 0;">
          <li style="margin-bottom: 8px;">Add your animals to start tracking your breeding program</li>
          <li style="margin-bottom: 8px;">Set up your contacts and client management</li>
          <li style="margin-bottom: 8px;">Configure your marketplace profile to attract new clients</li>
          <li style="margin-bottom: 8px;">Explore the dashboard for insights into your operation</li>
        </ul>
      </div>

      <p style="color: #666; font-size: 14px; margin-top: 32px;">
        If you have any questions or need help getting started, our support team is here to assist.
        <br><br>
        Welcome aboard!<br>
        The BreederHQ Team
      </p>
    </div>
  `;

  const text = `
Welcome to BreederHQ!

Hi ${ownerName},

Great news! Your BreederHQ account for ${data.tenantName} has been created and is ready to use.

${data.tempPassword ? `Your Login Credentials:
Email: ${data.ownerEmail}
Temporary Password: ${data.tempPassword}

Please change your password after logging in.` : `Your account has been created. Use the "Forgot Password" link on the login page if you need to set a new password.`}

Log in at: ${loginUrl}

Getting Started:
- Add your animals to start tracking your breeding program
- Set up your contacts and client management
- Configure your marketplace profile to attract new clients
- Explore the dashboard for insights into your operation

If you have questions, our support team is here to help.

Welcome aboard!
The BreederHQ Team
  `.trim();

  return sendEmail({
    tenantId: null, // System-level email, no tenant context
    to: data.ownerEmail,
    subject: `Welcome to BreederHQ - Your ${data.tenantName} Account is Ready!`,
    html,
    text,
    category: "transactional",
    templateKey: "tenant_welcome",
    metadata: { tenantName: data.tenantName },
  });
}
