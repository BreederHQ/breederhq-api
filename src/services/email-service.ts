// src/services/email-service.ts
import { Resend } from "resend";
import prisma from "../prisma.js";
import { canContactViaChannel } from "./comm-prefs-service.js";
import { generateUnsubscribeToken } from "./unsubscribe-token-service.js";
import { renderTemplate } from "./template-renderer.js";
import { wrapEmailLayout, emailButton, emailInfoCard, emailDetailRows, emailGreeting, emailParagraph, emailFootnote, emailHeading, emailAccent, emailBulletList, emailFeatureList } from "./email-layout.js";
import { captureMessage } from "../lib/sentry.js";

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
export function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

// ────────────────────────────────────────────────────────────────────────────
// Retry helpers
// ────────────────────────────────────────────────────────────────────────────

const MAX_INLINE_RETRIES = 3;
const INLINE_BACKOFF_BASE_MS = 1000; // 1s, 4s, 16s (base * 4^attempt)

/** Cron retry delays: 5min, 30min, 2hr, 12hr, 24hr */
const CRON_RETRY_DELAYS_MS = [
  5 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];
const MAX_CRON_RETRIES = CRON_RETRY_DELAYS_MS.length;

/**
 * Determine if an error is retriable (network/5xx/rate-limit).
 * 4xx errors (bad request, auth, validation) are NOT retriable.
 */
function isRetriableError(error: any): boolean {
  // Network errors (no response received)
  const networkCodes = ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EPIPE", "EAI_AGAIN"];
  if (error?.code && networkCodes.includes(error.code)) return true;

  // Resend SDK error with status code
  const status = error?.statusCode ?? error?.status;
  if (typeof status === "number") {
    if (status >= 500) return true; // Server error
    if (status === 429) return true; // Rate limit
  }

  // Resend error object format: { name: 'rate_limit_exceeded', ... }
  if (error?.name === "rate_limit_exceeded") return true;

  return false;
}

/**
 * Calculate next retry time for the cron job.
 * Returns null if max retries exceeded.
 */
export function calculateNextRetryAt(retryCount: number): Date | null {
  if (retryCount >= MAX_CRON_RETRIES) return null;
  const delayMs = CRON_RETRY_DELAYS_MS[retryCount];
  return new Date(Date.now() + delayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  /** Optional partyId — enables List-Unsubscribe headers and pre-send compliance check */
  partyId?: number;
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
  /** Optional partyId — enables List-Unsubscribe headers and pre-send compliance check */
  partyId?: number;
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
  const { tenantId, to, templateId, context, category, relatedInvoiceId, metadata, from, replyTo, partyId } = params;

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
    partyId,
  });
}

/**
 * Send email via Resend and log to EmailSendLog.
 * - Enforces PartyCommPreference (EMAIL channel) when partyId is provided.
 * - Also enforces for marketing emails via email lookup when partyId is not provided.
 * - Invoice emails are idempotent via unique constraint on (tenantId, templateKey, relatedInvoiceId).
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { tenantId, to, subject, html, text, templateKey, metadata, relatedInvoiceId, category, from, replyTo, partyId } = params;

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

  // Compliance check: block emails to unsubscribed recipients when partyId is known
  if (partyId) {
    const allowed = await canContactViaChannel(partyId, "EMAIL");
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
          error: { reason: "compliance_blocked", channel: "EMAIL" },
          metadata,
        },
      });
      return { ok: false, error: "recipient_unsubscribed" };
    }
  }

  // Fallback: validate recipient via email lookup for marketing emails without partyId
  if (!partyId && tenantId !== null && category === "marketing") {
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

  // Send via Resend (with inline retry for transient failures)
  const resendClient = getResendClient();

  // In dev mode with redirect, prepend original recipient to subject
  const actualSubject = devMode.redirected
    ? `[DEV: ${to}] ${subject}`
    : subject;

  // Build List-Unsubscribe headers when partyId and tenantId are available
  const emailHeaders: Record<string, string> = {};
  if (partyId && tenantId !== null) {
    try {
      const token = generateUnsubscribeToken({
        partyId,
        channel: "EMAIL",
        tenantId,
        purpose: "unsubscribe",
      });
      const apiBaseUrl = process.env.API_URL || process.env.APP_URL || "https://api.breederhq.com";
      const unsubUrl = `${apiBaseUrl}/api/v1/unsubscribe?token=${token}`;
      emailHeaders["List-Unsubscribe"] = `<${unsubUrl}>`;
      emailHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    } catch (err) {
      // Don't block email sending if header generation fails (e.g., missing secret)
      console.warn("[email-service] Failed to generate unsubscribe headers:", (err as Error).message);
    }
  }

  // Inline retry loop: 3 attempts with exponential backoff (1s, 4s, 16s)
  let lastError: any = null;
  let sendData: { id: string } | null = null;

  for (let attempt = 1; attempt <= MAX_INLINE_RETRIES; attempt++) {
    try {
      const { data, error } = await resendClient.emails.send({
        from: fromAddress,
        to: actualRecipient,
        subject: actualSubject,
        html: html || text || "",
        text,
        ...(replyTo && { reply_to: replyTo }),
        ...(Object.keys(emailHeaders).length > 0 && { headers: emailHeaders }),
      });

      if (error) {
        if (attempt < MAX_INLINE_RETRIES && isRetriableError(error)) {
          const backoffMs = INLINE_BACKOFF_BASE_MS * Math.pow(4, attempt - 1);
          console.warn(
            `[email-service] Resend error on attempt ${attempt}/${MAX_INLINE_RETRIES}, ` +
            `retrying in ${backoffMs}ms: ${error.message}`
          );
          await sleep(backoffMs);
          lastError = error;
          continue;
        }
        // Non-retriable or final attempt
        lastError = error;
        break;
      }

      // Success
      sendData = data as { id: string } | null;
      lastError = null;
      break;
    } catch (err: any) {
      if (attempt < MAX_INLINE_RETRIES && isRetriableError(err)) {
        const backoffMs = INLINE_BACKOFF_BASE_MS * Math.pow(4, attempt - 1);
        console.warn(
          `[email-service] Send exception on attempt ${attempt}/${MAX_INLINE_RETRIES}, ` +
          `retrying in ${backoffMs}ms: ${err.message}`
        );
        await sleep(backoffMs);
        lastError = err;
        continue;
      }
      lastError = err;
      break;
    }
  }

  // Handle final outcome after retry loop
  if (lastError) {
    // All retries exhausted — log failure and schedule for cron retry
    const isResendError = lastError.message && !lastError.stack;
    const errorDetail = isResendError
      ? { resendError: lastError }
      : { exception: lastError.message || String(lastError) };

    const nextRetryAt = calculateNextRetryAt(0);
    const errorMessage = lastError.message || "send_failed";

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
        error: { ...errorDetail, inlineAttempts: MAX_INLINE_RETRIES },
        metadata: {
          ...metadata,
          replyTo,
          ...(html ? { retryHtml: html } : {}),
          ...(text ? { retryText: text } : {}),
        },
        retryCount: 0,
        nextRetryAt,
        partyId: partyId ?? undefined,
      },
    });

    captureMessage(
      `Email send failed after ${MAX_INLINE_RETRIES} inline attempts`,
      "warning",
      { to, templateKey, tenantId, error: errorMessage }
    );
    console.warn(
      `[email-service] Send failed after ${MAX_INLINE_RETRIES} inline attempts to ${to}: ${errorMessage}` +
      (nextRetryAt ? ` — scheduled cron retry at ${nextRetryAt.toISOString()}` : " — no cron retry (max retries exceeded)")
    );

    return { ok: false, error: errorMessage };
  }

  // Success — log the sent email
  const messageId = sendData?.id || null;
  await prisma.emailSendLog.create({
    data: {
      tenantId,
      to: devMode.redirected ? to : actualRecipient,
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
      partyId: partyId ?? undefined,
    },
  });

  return { ok: true, providerMessageId: messageId || undefined };
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
  const html = wrapEmailLayout({
    title: "Quota Warning",
    body: [
      emailGreeting(recipient.name),
      emailParagraph(`You're approaching your quota limit for <strong style="color: #ffffff;">${metricLabel}</strong>.`),
      emailInfoCard(
        `<p style="color: #e5e5e5; margin: 0;"><strong style="color: #ffffff;">Current Usage:</strong> ${current} / ${limit} (${Math.round(percentUsed)}%)</p>`,
        { borderColor: "yellow" }
      ),
      emailParagraph("To avoid any interruption to your service, consider upgrading your plan."),
      emailButton("Manage Subscription", `${APP_URL}/settings?tab=billing`, "orange"),
    ].join("\n"),
  });

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
  const html = wrapEmailLayout({
    title: "Critical Quota Alert",
    body: [
      emailGreeting(recipient.name),
      emailParagraph(`<strong style="color: #ffffff;">Your ${metricLabel} quota is almost full!</strong>`),
      emailInfoCard(
        [
          `<p style="color: #e5e5e5; margin: 0 0 8px 0;"><strong style="color: #ffffff;">Current Usage:</strong> ${current} / ${limit} (${Math.round(percentUsed)}%)</p>`,
          `<p style="color: #e5e5e5; margin: 0;"><strong style="color: #ffffff;">Remaining:</strong> ${limit - current} ${metricLabel.toLowerCase()}</p>`,
        ].join("\n"),
        { borderColor: "red" }
      ),
      emailParagraph(`Once you reach 100%, you won't be able to add more ${metricLabel.toLowerCase()} until you upgrade your plan.`),
      emailButton("Upgrade Now", `${APP_URL}/settings?tab=billing`, "red"),
    ].join("\n"),
  });

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
  const html = wrapEmailLayout({
    title: "Quota Limit Reached",
    body: [
      emailGreeting(recipient.name),
      emailParagraph(`<strong style="color: #ffffff;">You've reached your ${metricLabel} quota limit of ${limit}.</strong>`),
      emailInfoCard(
        `<p style="color: #e5e5e5; margin: 0;">You cannot add more ${metricLabel.toLowerCase()} until you upgrade your plan.</p>`,
        { borderColor: "red" }
      ),
      emailParagraph(`Upgrade now to continue adding ${metricLabel.toLowerCase()}:`),
      emailButton("Upgrade Your Plan", `${APP_URL}/settings?tab=billing`, "red"),
    ].join("\n"),
  });

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

  const html = wrapEmailLayout({
    title: "Payment Failed",
    body: [
      emailGreeting(recipient.name),
      emailParagraph("We were unable to process your payment for your BreederHQ subscription."),
      emailInfoCard(
        [
          `<p style="color: #e5e5e5; margin: 0 0 8px 0;"><strong style="color: #ffffff;">Plan:</strong> ${planName}</p>`,
          `<p style="color: #e5e5e5; margin: 0 0 8px 0;"><strong style="color: #ffffff;">Amount Due:</strong> $${amountStr}</p>`,
          nextAttemptStr ? `<p style="color: #e5e5e5; margin: 0;"><strong style="color: #ffffff;">Next Payment Attempt:</strong> ${nextAttemptStr}</p>` : "",
        ].filter(Boolean).join("\n"),
        { borderColor: "red" }
      ),
      emailParagraph(`<strong style="color: #ffffff;">Please update your payment method to avoid service interruption.</strong>`),
      emailButton("Update Payment Method", invoiceUrl || `${APP_URL}/settings?tab=billing`, "red"),
      emailFootnote("If you have questions, please contact our support team."),
    ].join("\n"),
  });

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

  const html = wrapEmailLayout({
    title: "Subscription Canceled",
    body: [
      emailGreeting(recipient.name),
      emailParagraph(`Your <strong style="color: #ffffff;">${planName}</strong> subscription has been canceled.`),
      emailInfoCard(
        `<p style="color: #e5e5e5; margin: 0;">Your subscription will remain active until <strong style="color: #ffffff;">${endDateStr}</strong>.</p>`,
        { borderColor: "gray" }
      ),
      emailParagraph("You can reactivate your subscription at any time:"),
      emailButton("Reactivate Subscription", `${APP_URL}/settings?tab=billing`, "orange"),
      emailFootnote("We're sorry to see you go. If you have feedback, we'd love to hear it."),
    ].join("\n"),
  });

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

  const html = wrapEmailLayout({
    title: "Subscription Renewed",
    body: [
      emailGreeting(recipient.name),
      emailParagraph("Your BreederHQ subscription has been renewed successfully!"),
      emailInfoCard(
        [
          `<p style="color: #e5e5e5; margin: 0 0 8px 0;"><strong style="color: #ffffff;">Plan:</strong> ${planName}</p>`,
          `<p style="color: #e5e5e5; margin: 0 0 8px 0;"><strong style="color: #ffffff;">Amount Charged:</strong> $${amountStr}</p>`,
          `<p style="color: #e5e5e5; margin: 0;"><strong style="color: #ffffff;">Next Billing Date:</strong> ${nextDateStr}</p>`,
        ].join("\n"),
        { borderColor: "green" }
      ),
      emailButton(invoiceUrl ? "View Invoice" : "View Billing Details", invoiceUrl || `${APP_URL}/settings?tab=billing`, "green"),
    ].join("\n"),
  });

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
    `<strong style="color: #ffffff;">Email:</strong> <a href="mailto:${data.applicantEmail}" style="color: #f97316; text-decoration: none;">${data.applicantEmail}</a>`,
    data.applicantPhone ? `<strong style="color: #ffffff;">Phone:</strong> <span style="color: #e5e5e5;">${data.applicantPhone}</span>` : null,
  ].filter(Boolean).join("<br>");

  const messageParts: string[] = [];
  if (data.message) {
    messageParts.push(
      emailInfoCard(
        `<p style="color: #ffffff; margin: 0 0 8px 0; font-weight: 600;">Message from applicant:</p>
        <p style="color: #a3a3a3; margin: 0; white-space: pre-wrap;">${data.message}</p>`,
        { borderColor: "gray" }
      )
    );
  }

  const html = wrapEmailLayout({
    title: "New Waitlist Signup!",
    body: [
      emailGreeting(recipient.name),
      emailParagraph(`Great news! Someone has joined your waitlist for <strong style="color: #ffffff;">${data.programName}</strong>.`),
      emailInfoCard(
        [
          `<p style="color: #f97316; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">${data.applicantName}</p>`,
          contactInfo,
        ].join("\n"),
        { borderColor: "orange" }
      ),
      ...messageParts,
      emailButton("View Waitlist", `${APP_URL}/waitlist`, "orange"),
      emailFootnote("This applicant's request is pending your review. You can approve, reject, or message them from your waitlist dashboard."),
    ].join("\n"),
  });

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
    ? emailParagraph(`<span style="color: #f59e0b;">&#9200; This contract expires on ${new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(data.expiresAt)}.</span>`)
    : "";

  const personalMessage = data.message
    ? emailInfoCard(
        `<p style="color: #ffffff; margin: 0 0 8px 0; font-weight: 600;">Message from ${data.breederName}:</p>
        <p style="color: #a3a3a3; margin: 0; white-space: pre-wrap;">${data.message}</p>`,
        { borderColor: "gray" }
      )
    : "";

  const html = wrapEmailLayout({
    title: "Contract Ready for Your Signature",
    body: [
      emailGreeting(data.recipientName),
      emailParagraph(`<strong style="color: #ffffff;">${data.breederName}</strong> has sent you a contract to review and sign.`),
      emailInfoCard(
        `<p style="color: #f97316; margin: 0; font-size: 18px; font-weight: 600;">${data.contractTitle}</p>`,
        { borderColor: "orange" }
      ),
      personalMessage,
      expirationNote,
      emailParagraph("Please review the document and sign electronically to complete the agreement."),
      emailButton("Review & Sign Contract", signingUrl, "orange"),
      emailFootnote(`If you have any questions about this contract, please contact ${data.breederName} directly.`),
    ].filter(Boolean).join("\n"),
  });

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

  const html = wrapEmailLayout({
    title: "Reminder: Contract Awaiting Signature",
    body: [
      emailGreeting(data.recipientName),
      emailParagraph(`This is a friendly reminder that the following contract from <strong style="color: #ffffff;">${data.breederName}</strong> ${urgencyText}.`),
      emailInfoCard(
        [
          `<p style="color: #f59e0b; margin: 0; font-size: 18px; font-weight: 600;">${data.contractTitle}</p>`,
          data.expiresAt
            ? `<p style="color: #a3a3a3; margin: 8px 0 0 0; font-size: 14px;">Expires: ${new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(data.expiresAt)}</p>`
            : "",
        ].filter(Boolean).join("\n"),
        { borderColor: "yellow" }
      ),
      emailButton("Review & Sign Now", signingUrl, "orange"),
      emailFootnote(`If you've already signed or have questions, please contact ${data.breederName}.`),
    ].join("\n"),
  });

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
    ? emailParagraph(`<strong style="color: #10b981;">&#10003; All parties have now signed. The contract is fully executed.</strong>`)
    : emailParagraph("There are still other parties who need to sign before the contract is complete.");

  const html = wrapEmailLayout({
    title: "Contract Signed",
    body: [
      emailGreeting(data.recipientName),
      emailParagraph(`<strong style="color: #ffffff;">${data.signedByName}</strong> has signed the following contract:`),
      emailInfoCard(
        [
          `<p style="color: #10b981; margin: 0; font-size: 18px; font-weight: 600;">${data.contractTitle}</p>`,
          `<p style="color: #a3a3a3; margin: 8px 0 0 0; font-size: 14px;">Signed on ${new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }).format(data.signedAt)}</p>`,
        ].join("\n"),
        { borderColor: "green" }
      ),
      statusMessage,
      emailButton(data.allPartiesSigned ? "View Signed Contract" : "View Contract Status", viewUrl, "green"),
      data.allPartiesSigned ? emailFootnote("A copy of the signed document will be sent to all parties.") : "",
    ].filter(Boolean).join("\n"),
  });

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
    ? emailInfoCard(
        `<p style="color: #ffffff; margin: 0 0 8px 0; font-weight: 600;">Reason given:</p>
        <p style="color: #a3a3a3; margin: 0; white-space: pre-wrap;">${data.reason}</p>`,
        { borderColor: "gray" }
      )
    : "";

  const html = wrapEmailLayout({
    title: "Contract Declined",
    body: [
      emailGreeting(data.recipientName),
      emailParagraph(`<strong style="color: #ffffff;">${data.declinedByName}</strong> has declined to sign the following contract:`),
      emailInfoCard(
        [
          `<p style="color: #dc2626; margin: 0; font-size: 18px; font-weight: 600;">${data.contractTitle}</p>`,
          `<p style="color: #a3a3a3; margin: 8px 0 0 0; font-size: 14px;">Declined on ${new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }).format(data.declinedAt)}</p>`,
        ].join("\n"),
        { borderColor: "red" }
      ),
      reasonSection,
      emailParagraph("You may want to reach out to discuss their concerns or create a new contract with updated terms."),
      emailButton("View Contract Details", viewUrl, "gray"),
    ].filter(Boolean).join("\n"),
  });

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
    ? emailInfoCard(
        `<p style="color: #ffffff; margin: 0 0 8px 0; font-weight: 600;">Reason:</p>
        <p style="color: #a3a3a3; margin: 0; white-space: pre-wrap;">${data.reason}</p>`,
        { borderColor: "gray" }
      )
    : "";

  const html = wrapEmailLayout({
    title: "Contract Voided",
    body: [
      emailGreeting(data.recipientName),
      emailParagraph(`<strong style="color: #ffffff;">${data.breederName}</strong> has voided the following contract:`),
      emailInfoCard(
        `<p style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">${data.contractTitle}</p>`,
        { borderColor: "gray" }
      ),
      reasonSection,
      emailParagraph("This contract is no longer valid and no action is required from you."),
      emailParagraph(`If you have questions, please contact ${data.breederName} directly.`),
    ].filter(Boolean).join("\n"),
  });

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
  const html = wrapEmailLayout({
    title: "Contract Expired",
    body: [
      emailGreeting(data.recipientName),
      emailParagraph("The following contract has expired and can no longer be signed:"),
      emailInfoCard(
        [
          `<p style="color: #f59e0b; margin: 0; font-size: 18px; font-weight: 600;">${data.contractTitle}</p>`,
          `<p style="color: #a3a3a3; margin: 8px 0 0 0; font-size: 14px;">From: ${data.breederName}</p>`,
        ].join("\n"),
        { borderColor: "yellow" }
      ),
      emailParagraph(`If you still wish to proceed with this agreement, please contact ${data.breederName} to request a new contract.`),
    ].join("\n"),
  });

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
  const html = wrapEmailLayout({
    title: "Contract Fully Executed",
    body: [
      emailGreeting(data.recipientName),
      emailParagraph("Great news! All parties have signed the following contract:"),
      emailInfoCard(
        `<p style="color: #10b981; margin: 0; font-size: 18px; font-weight: 600;">${data.contractTitle}</p>`,
        { borderColor: "green" }
      ),
      emailParagraph("Your signed copy is ready for download. This document includes all signatures and a certificate of completion for your records."),
      emailButton("Download Signed Contract (PDF)", data.pdfDownloadUrl, "green"),
      emailFootnote("Keep this document for your records. The signed contract is legally binding."),
    ].join("\n"),
  });

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
  const html = wrapEmailLayout({
    title: "Payment Failed",
    body: [
      emailGreeting(recipient.name),
      emailParagraph(`A payment attempt for invoice <strong style="color: #ffffff;">${data.invoiceNumber}</strong> has failed.`),
      emailInfoCard(
        [
          `<p style="color: #e5e5e5; margin: 0;"><strong style="color: #ffffff;">Invoice:</strong> ${data.invoiceNumber}</p>`,
          `<p style="color: #e5e5e5; margin: 8px 0 0 0;"><strong style="color: #ffffff;">Client:</strong> ${data.clientName}</p>`,
          `<p style="color: #e5e5e5; margin: 8px 0 0 0;"><strong style="color: #ffffff;">Amount:</strong> ${data.totalAmount}</p>`,
          `<p style="color: #e5e5e5; margin: 8px 0 0 0;"><strong style="color: #ffffff;">Payment Attempts:</strong> ${data.attemptCount}</p>`,
        ].join("\n"),
        { borderColor: "red" }
      ),
      emailHeading("What happens next?"),
      emailBulletList([
        "Stripe will automatically retry the payment",
        "The client has been notified to update their payment method",
        "You can reach out to the client directly if needed",
      ]),
      emailButton("View Invoice", `${APP_URL}/invoices/${data.invoiceId}`, "blue"),
    ].join("\n"),
  });

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
    ? emailInfoCard(
        [
          `<p style="color: #f59e0b; margin: 0 0 12px 0; font-weight: 600;">Your Login Credentials</p>`,
          `<p style="color: #e5e5e5; margin: 0 0 8px 0;"><strong style="color: #ffffff;">Email:</strong> ${data.ownerEmail}</p>`,
          `<p style="color: #e5e5e5; margin: 0;"><strong style="color: #ffffff;">Temporary Password:</strong> <code style="background: #262626; padding: 2px 8px; border-radius: 4px; font-family: monospace; color: #ffffff;">${data.tempPassword}</code></p>`,
          `<p style="color: #a3a3a3; margin: 12px 0 0 0; font-size: 13px;">&#9888;&#65039; Please change your password after logging in.</p>`,
        ].join("\n"),
        { borderColor: "yellow" }
      )
    : emailInfoCard(
        `<p style="color: #a3a3a3; margin: 0;">Your account has been created with your existing password, or you can use the "Forgot Password" link on the login page to set a new one.</p>`,
        { borderColor: "blue" }
      );

  const html = wrapEmailLayout({
    title: "Welcome to BreederHQ!",
    body: [
      emailGreeting(ownerName),
      emailParagraph(`Great news! Your BreederHQ account for <strong style="color: #ffffff;">${data.tenantName}</strong> has been created and is ready to use.`),
      credentialsSection,
      emailButton("Log In to BreederHQ", loginUrl, "orange"),
      emailHeading("Getting Started"),
      emailFeatureList([
        "Add your animals to start tracking your breeding program",
        "Set up your contacts and client management",
        "Configure your marketplace profile to attract new clients",
        "Explore the dashboard for insights into your operation",
      ]),
      emailFootnote("If you have any questions or need help getting started, our support team is here to assist."),
    ].join("\n"),
  });

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
