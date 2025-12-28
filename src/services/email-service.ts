// src/services/email-service.ts
import { Resend } from "resend";
import prisma from "../prisma.js";
import { canContactViaChannel } from "./comm-prefs-service.js";

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
}

export interface SendEmailResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

/**
 * Send email via Resend and log to EmailSendLog.
 * Enforces PartyCommPreference (EMAIL channel) before sending.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { tenantId, to, subject, html, text, templateKey, metadata } = params;

  // Validate recipient party comm preferences
  const party = await prisma.party.findFirst({
    where: { tenantId, email: { equals: to, mode: "insensitive" } },
  });

  if (party) {
    const allowed = await canContactViaChannel(party.id, "EMAIL");
    if (!allowed) {
      const logId = await prisma.emailSendLog.create({
        data: {
          tenantId,
          to,
          from: FROM,
          subject,
          templateKey,
          provider: "resend",
          status: "failed",
          error: { reason: "comm_preference_blocked", channel: "EMAIL" },
          metadata,
        },
      });
      return { ok: false, error: "recipient_has_blocked_email" };
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
        provider: "resend",
        providerMessageId: messageId,
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
        provider: "resend",
        status: "failed",
        error: { exception: err.message },
        metadata,
      },
    });
    return { ok: false, error: err.message || "unknown_error" };
  }
}
