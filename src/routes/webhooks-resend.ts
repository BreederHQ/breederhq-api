// src/routes/webhooks-resend.ts
// Webhook endpoint for Resend inbound emails
//
// POST /api/v1/webhooks/resend/inbound - Handle inbound email from Resend

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Resend } from "resend";
import prisma from "../prisma.js";
import {
  parseReplyToAddress,
  parseTenantInboundAddress,
  stripEmailReplyContent,
  extractNameFromEmail,
  parseFromHeader,
} from "../services/inbound-email-service.js";
import { sendNewMessageNotification } from "../services/portal-provisioning-service.js";
import { broadcastNewMessage } from "../services/websocket-service.js";
import { sendInactiveAddressAutoReply } from "../services/marketplace-email-service.js";
import {
  checkRateLimit,
  checkEmailFilter,
  calculateSpamScore,
  checkAuthentication,
  sanitizeMessageBody,
  checkUrlThreatIntelligence,
} from "../services/email-security-service.js";

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

interface ResendInboundEvent {
  type: string;
  data: {
    from: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
    attachments?: Array<{
      filename: string;
      content_type: string;
      size: number;
    }>;
  };
}

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /api/v1/webhooks/resend/inbound
   *
   * Handles inbound emails from Resend webhook.
   * Two scenarios:
   * 1. Reply to existing thread: reply+t_{threadId}_{hmac}@mail.breederhq.com
   * 2. New conversation to tenant: {tenant-slug}@mail.breederhq.com
   */
  app.post("/inbound", async (req, reply) => {
    // TODO: Implement Resend webhook signature verification
    // Resend likely uses Svix standard (svix-signature header)
    // For now, signature verification is disabled to get basic functionality working
    // See: https://resend.com/docs/webhooks/verify-webhook-signatures

    // Log headers for debugging (remove in production)
    req.log.info({
      headers: Object.keys(req.headers),
      hasSignature: !!(req.headers["svix-signature"] || req.headers["resend-signature"]),
    }, "Inbound webhook received");

    const event = req.body as ResendInboundEvent;

    // Only process email.received events
    if (event.type !== "email.received") {
      return reply.send({ ok: true, ignored: true, reason: "not_email_received" });
    }

    const { from, to, subject, text, html } = event.data;
    const toAddress = Array.isArray(to) ? to[0] : to;
    const body = text || html || "";

    // Parse the From header to extract display name and email
    const { displayName, email: fromEmail } = parseFromHeader(from);

    req.log.info({ from, fromEmail, displayName, to: toAddress, subject }, "Inbound email received");

    // Try to parse as reply-to-thread address
    const threadInfo = parseReplyToAddress(toAddress);
    if (threadInfo) {
      const result = await handleThreadReply(
        threadInfo.threadId,
        fromEmail,
        displayName,
        body,
        subject,
        event.data.attachments?.length || 0,
        event.data.headers,
        req.log
      );
      return reply.send({ ok: true, type: "thread_reply", ...result });
    }

    // Try to parse as tenant inbound address
    const tenantInfo = parseTenantInboundAddress(toAddress);
    if (tenantInfo) {
      const result = await handleNewInboundThread(
        tenantInfo.slug,
        fromEmail,
        displayName,
        body,
        subject,
        event.data.attachments?.length || 0,
        event.data.headers,
        req.log
      );
      return reply.send({ ok: true, type: "new_thread", ...result });
    }

    // Unknown address - log and acknowledge
    req.log.warn({ toAddress }, "Inbound email to unknown address");
    return reply.send({ ok: true, type: "unknown_ignored" });
  });
};

/**
 * Handle a reply to an existing thread
 */
async function handleThreadReply(
  threadId: number,
  fromEmail: string,
  displayName: string | null,
  body: string,
  subject: string,
  attachmentCount: number,
  headers: Record<string, string> | undefined,
  log: any
): Promise<{ threadId?: number; messageId?: number; error?: string }> {
  try {
    // Find the thread
    const thread = await prisma.messageThread.findUnique({
      where: { id: threadId },
      include: {
        participants: {
          include: { party: { select: { id: true, name: true, email: true, type: true } } },
        },
      },
    });

    if (!thread) {
      log.warn({ threadId }, "Thread not found for inbound email");
      return { error: "thread_not_found" };
    }

    // Find sender by email (case-insensitive)
    let senderParty = await prisma.party.findFirst({
      where: {
        tenantId: thread.tenantId,
        email: { equals: fromEmail, mode: "insensitive" },
      },
    });

    // If sender not found, create a new contact
    if (!senderParty) {
      senderParty = await prisma.party.create({
        data: {
          tenantId: thread.tenantId,
          email: fromEmail,
          name: displayName || extractNameFromEmail(fromEmail),
          type: "CONTACT",
        },
      });
      log.info({ partyId: senderParty.id, email: fromEmail, displayName }, "Created new contact from inbound email");
    }

    // Security checks - BLOCK email if any fail
    const rateLimitResult = await checkRateLimit(fromEmail, thread.tenantId, prisma);
    if (!rateLimitResult.allowed) {
      log.warn({ fromEmail, threadId, count: rateLimitResult.count }, "Rate limit exceeded - email rejected");
      return { error: "rate_limit_exceeded" };
    }

    const filterResult = await checkEmailFilter(fromEmail, thread.tenantId, prisma);
    if (filterResult.blocked) {
      log.warn({ fromEmail, threadId, pattern: filterResult.filter?.pattern, reason: filterResult.filter?.reason }, "Sender blocked by filter - email rejected");
      return { error: "sender_blocked" };
    }

    // Strip email reply cruft and sanitize message body
    let cleanBody = stripEmailReplyContent(body);
    cleanBody = sanitizeMessageBody(cleanBody);

    // Check for malicious URLs (Google Safe Browsing)
    const threatResult = await checkUrlThreatIntelligence(cleanBody + " " + subject);
    if (!threatResult.safe) {
      log.warn({
        fromEmail,
        threadId,
        threats: threatResult.threats,
        threatTypes: threatResult.threatTypes,
      }, "Email rejected - malicious URLs detected");
      return { error: "malicious_content" };
    }

    // Calculate spam score - REJECT if score too high
    const spamResult = calculateSpamScore({
      from: fromEmail,
      displayName,
      subject,
      body: cleanBody,
    });

    if (spamResult.score >= 7) {
      log.warn({
        fromEmail,
        threadId,
        spamScore: spamResult.score,
        flags: spamResult.flags,
        warnings: spamResult.warnings
      }, "Email rejected - spam score too high");
      return { error: "spam_detected" };
    }

    if (spamResult.warnings.length > 0) {
      log.info({ fromEmail, threadId, warnings: spamResult.warnings }, "Spam warnings detected (email allowed)");
    }

    // Check email authentication
    const authResult = checkAuthentication(headers);
    if (!authResult.passed) {
      log.info({ fromEmail, threadId, spf: authResult.spf, dkim: authResult.dkim, dmarc: authResult.dmarc }, "Email authentication failed (email allowed)");
    }

    // Check if sender is already a participant, if not add them
    const isParticipant = thread.participants.some((p) => p.partyId === senderParty!.id);
    if (!isParticipant) {
      await prisma.messageParticipant.create({
        data: {
          threadId,
          partyId: senderParty.id,
        },
      });
    }

    // Add note about attachments if any
    if (attachmentCount > 0) {
      cleanBody += `\n\n[This email had ${attachmentCount} attachment${attachmentCount > 1 ? "s" : ""} that could not be imported]`;
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        threadId,
        senderPartyId: senderParty.id,
        body: cleanBody,
        isAutomated: false,
      },
    });

    // Update thread timestamp, guest info, and spam tracking
    const updateData: any = {
      lastMessageAt: new Date(),
      spamScore: spamResult.score,
      spamFlags: spamResult.flags,
      authenticationPass: authResult.passed,
    };
    if (!thread.guestEmail) {
      updateData.guestEmail = fromEmail;
    }
    if (!thread.guestName) {
      updateData.guestName = displayName || senderParty.name || extractNameFromEmail(fromEmail);
    }
    await prisma.messageThread.update({
      where: { id: threadId },
      data: updateData,
    });

    // Broadcast via WebSocket
    const participantIds = thread.participants.map((p) => p.partyId);
    broadcastNewMessage(thread.tenantId, threadId, {
      id: message.id,
      body: cleanBody,
      senderPartyId: senderParty.id,
      createdAt: message.createdAt.toISOString(),
    }, participantIds);

    // Notify other participants (not the sender)
    const otherParticipants = thread.participants.filter(
      (p) => p.partyId !== senderParty!.id && p.party.email
    );

    for (const participant of otherParticipants) {
      try {
        await sendNewMessageNotification(
          thread.tenantId,
          participant.party.email!,
          participant.party.name || "there",
          senderParty.name || fromEmail,
          cleanBody,
          threadId // Pass threadId for reply-to generation
        );
      } catch (notifErr) {
        log.error({ err: notifErr, partyId: participant.partyId }, "Failed to send message notification");
      }
    }

    log.info({ threadId, messageId: message.id, senderPartyId: senderParty.id }, "Created message from inbound email");

    return { threadId, messageId: message.id };
  } catch (err: any) {
    log.error({ err, threadId }, "Error handling thread reply");
    return { error: err.message };
  }
}

/**
 * Handle a new inbound email to a tenant address
 */
async function handleNewInboundThread(
  slug: string,
  fromEmail: string,
  displayName: string | null,
  body: string,
  subject: string,
  attachmentCount: number,
  headers: Record<string, string> | undefined,
  log: any
): Promise<{ threadId?: number; error?: string }> {
  try {
    // Find tenant by inbound slug
    const tenant = await prisma.tenant.findFirst({
      where: { inboundEmailSlug: slug },
      include: {
        organizations: {
          take: 1,
          include: { party: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!tenant) {
      log.warn({ slug }, "No tenant found for inbound slug");
      // P-02 FIX: Send auto-reply that address is not active
      sendInactiveAddressAutoReply({
        toEmail: fromEmail,
        fromSlug: slug,
        originalSubject: subject,
      }).catch((err) => {
        log.error({ err, slug, fromEmail }, "Failed to send inactive address auto-reply");
      });
      return { error: "tenant_not_found" };
    }

    const orgParty = tenant.organizations[0]?.party;
    if (!orgParty) {
      log.warn({ tenantId: tenant.id }, "No org party for tenant");
      return { error: "no_org_party" };
    }

    // Find or create sender as a contact
    let senderParty = await prisma.party.findFirst({
      where: {
        tenantId: tenant.id,
        email: { equals: fromEmail, mode: "insensitive" },
      },
    });

    if (!senderParty) {
      senderParty = await prisma.party.create({
        data: {
          tenantId: tenant.id,
          email: fromEmail,
          name: displayName || extractNameFromEmail(fromEmail),
          type: "CONTACT",
        },
      });
      log.info({ partyId: senderParty.id, email: fromEmail, displayName }, "Created new contact from inbound email");
    }

    // Security checks - BLOCK email if any fail (before creating thread)
    const rateLimitResult = await checkRateLimit(fromEmail, tenant.id, prisma);
    if (!rateLimitResult.allowed) {
      log.warn({ fromEmail, tenantId: tenant.id, count: rateLimitResult.count }, "Rate limit exceeded - email rejected");
      return { error: "rate_limit_exceeded" };
    }

    const filterResult = await checkEmailFilter(fromEmail, tenant.id, prisma);
    if (filterResult.blocked) {
      log.warn({ fromEmail, tenantId: tenant.id, pattern: filterResult.filter?.pattern, reason: filterResult.filter?.reason }, "Sender blocked by filter - email rejected");
      return { error: "sender_blocked" };
    }

    // Strip reply cruft and sanitize message body
    let cleanBody = stripEmailReplyContent(body);
    cleanBody = sanitizeMessageBody(cleanBody);

    // Check for malicious URLs (Google Safe Browsing)
    const threatResult = await checkUrlThreatIntelligence(cleanBody + " " + subject);
    if (!threatResult.safe) {
      log.warn({
        fromEmail,
        tenantId: tenant.id,
        threats: threatResult.threats,
        threatTypes: threatResult.threatTypes,
      }, "Email rejected - malicious URLs detected");
      return { error: "malicious_content" };
    }

    // Calculate spam score - REJECT if score too high
    const spamResult = calculateSpamScore({
      from: fromEmail,
      displayName,
      subject,
      body: cleanBody,
    });

    if (spamResult.score >= 7) {
      log.warn({
        fromEmail,
        tenantId: tenant.id,
        spamScore: spamResult.score,
        flags: spamResult.flags,
        warnings: spamResult.warnings
      }, "Email rejected - spam score too high");
      return { error: "spam_detected" };
    }

    if (spamResult.warnings.length > 0) {
      log.info({ fromEmail, tenantId: tenant.id, warnings: spamResult.warnings }, "Spam warnings detected (email allowed)");
    }

    // Check email authentication
    const authResult = checkAuthentication(headers);
    if (!authResult.passed) {
      log.info({ fromEmail, tenantId: tenant.id, spf: authResult.spf, dkim: authResult.dkim, dmarc: authResult.dmarc }, "Email authentication failed (email allowed)");
    }

    if (attachmentCount > 0) {
      cleanBody += `\n\n[This email had ${attachmentCount} attachment${attachmentCount > 1 ? "s" : ""} that could not be imported]`;
    }

    const now = new Date();

    // Create new thread with initial message and security tracking
    const thread = await prisma.messageThread.create({
      data: {
        tenantId: tenant.id,
        subject: subject || "New message",
        lastMessageAt: now,
        firstInboundAt: now,
        guestEmail: fromEmail,
        guestName: displayName || senderParty.name || extractNameFromEmail(fromEmail),
        spamScore: spamResult.score,
        spamFlags: spamResult.flags,
        authenticationPass: authResult.passed,
        participants: {
          create: [
            { partyId: orgParty.id },
            { partyId: senderParty.id, lastReadAt: now },
          ],
        },
        messages: {
          create: {
            senderPartyId: senderParty.id,
            body: cleanBody,
            isAutomated: false,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    // Broadcast via WebSocket
    const firstMessage = thread.messages[0];
    if (firstMessage) {
      broadcastNewMessage(tenant.id, thread.id, {
        id: firstMessage.id,
        body: cleanBody,
        senderPartyId: senderParty.id,
        createdAt: firstMessage.createdAt.toISOString(),
      }, [orgParty.id, senderParty.id]);
    }

    // Notify breeder of new message
    if (orgParty.email) {
      try {
        await sendNewMessageNotification(
          tenant.id,
          orgParty.email,
          orgParty.name || "there",
          senderParty.name || fromEmail,
          cleanBody,
          thread.id // Pass threadId for reply-to generation
        );
      } catch (notifErr) {
        log.error({ err: notifErr }, "Failed to send new thread notification to breeder");
      }
    }

    log.info({ tenantId: tenant.id, threadId: thread.id, senderPartyId: senderParty.id }, "Created new thread from inbound email");

    return { threadId: thread.id };
  } catch (err: any) {
    log.error({ err, slug }, "Error handling new inbound thread");
    return { error: err.message };
  }
}

export default routes;
