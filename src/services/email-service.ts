// src/services/email-service.ts
import { Resend } from "resend";
import prisma from "../prisma.js";
import { canContactViaChannel } from "./comm-prefs-service.js";
import { renderTemplate } from "./template-renderer.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@breederhq.com";
const FROM_NAME = process.env.RESEND_FROM_NAME || "BreederHQ";
const FROM = `${FROM_NAME} <${FROM_EMAIL}>`;

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

  const categoryEnum = category === "transactional" ? "TRANSACTIONAL" : "MARKETING";

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

  const categoryEnum = category === "transactional" ? "TRANSACTIONAL" : "MARKETING";

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
    const { data, error } = await resend.emails.send({
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
        category: categoryEnum,
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
        category: categoryEnum,
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
