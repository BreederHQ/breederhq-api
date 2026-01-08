// src/services/email-service.ts
import { Resend } from "resend";
import prisma from "../prisma.js";
import { canContactViaChannel } from "./comm-prefs-service.js";
import { renderTemplate } from "./template-renderer.js";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@breederhq.com";
const FROM_NAME = process.env.RESEND_FROM_NAME || "BreederHQ";
const FROM = `${FROM_NAME} <${FROM_EMAIL}>`;

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

export interface SendEmailParams {
  tenantId: number;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  templateKey?: string;
  metadata?: Record<string, any>;
  relatedInvoiceId?: number;
  category: "transactional" | "marketing";
}

export interface SendTemplatedEmailParams {
  tenantId: number;
  to: string;
  templateId: number;
  context: Record<string, any>;
  category: "transactional" | "marketing";
  relatedInvoiceId?: number;
  metadata?: Record<string, any>;
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
  const { tenantId, to, templateId, context, category, relatedInvoiceId, metadata } = params;

  const template = await prisma.template.findFirst({
    where: { id: templateId, tenantId },
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
    subject: rendered.subject || `Message from ${FROM_NAME}`,
    html: rendered.bodyHtml,
    text: rendered.bodyText,
    templateKey: template.key || undefined,
    metadata,
    relatedInvoiceId,
    category,
  });
}

/**
 * Send email via Resend and log to EmailSendLog.
 * - Enforces PartyCommPreference (EMAIL channel) for marketing emails only.
 * - Transactional emails (invoices, receipts, etc.) bypass preferences.
 * - Invoice emails are idempotent via unique constraint on (tenantId, templateKey, relatedInvoiceId).
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { tenantId, to, subject, html, text, templateKey, metadata, relatedInvoiceId, category } = params;

  // Idempotency check for invoice emails
  if (templateKey === "invoice_issued" && relatedInvoiceId) {
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

  // Validate recipient party comm preferences (marketing only)
  if (category === "marketing") {
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
            from: FROM,
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

  // Send via Resend
  try {
    const resendClient = getResendClient();
    const { data, error } = await resendClient.emails.send({
      from: FROM,
      to,
      subject,
      html: html || text || "",
      text,
    });

    if (error) {
      await prisma.emailSendLog.create({
        data: {
          tenantId,
          to,
          from: FROM,
          subject,
          templateKey,
          provider: "resend",
          relatedInvoiceId,
          status: "failed",
          error: { resendError: error },
          metadata,
        },
      });
      return { ok: false, error: error.message || "resend_error" };
    }

    const messageId = data?.id || null;
    await prisma.emailSendLog.create({
      data: {
        tenantId,
        to,
        from: FROM,
        subject,
        templateKey,
        category,
        provider: "resend",
        providerMessageId: messageId,
        relatedInvoiceId,
        status: "sent",
        metadata,
      },
    });

    return { ok: true, providerMessageId: messageId || undefined };
  } catch (err: any) {
    await prisma.emailSendLog.create({
      data: {
        tenantId,
        to,
        from: FROM,
        subject,
        templateKey,
        category,
        provider: "resend",
        relatedInvoiceId,
        status: "failed",
        error: { exception: err.message },
        metadata,
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
