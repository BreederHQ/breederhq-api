// src/routes/messages.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { evaluateAndSendAutoReply } from "../services/auto-reply-service.js";
import { autoProvisionPortalAccessForDM, sendNewMessageNotification } from "../services/portal-provisioning-service.js";
import { requireMessagingPartyScope } from "../middleware/actor-context.js";
import {
  calculateBusinessHoursSeconds,
  shouldHaveQuickResponderBadge,
  updateRunningAverage,
  type BusinessHoursSchedule,
} from "../utils/business-hours.js";
import { broadcastNewMessage } from "../services/websocket-service.js";
import { broadcastBreederMessageToMarketplaceUser } from "../services/marketplace-websocket-service.js";
import path from "path";
import fs from "fs/promises";

// Allowed MIME types for message attachments
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Helper to save uploaded file and return attachment metadata
async function saveMessageAttachment(
  tenantId: number,
  threadId: number,
  file: { filename: string; mimetype: string; toBuffer: () => Promise<Buffer> }
): Promise<{ filename: string; mime: string; bytes: number; key: string } | null> {
  const buffer = await file.toBuffer();

  if (buffer.length > MAX_FILE_SIZE) {
    return null;
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return null;
  }

  // Create directory structure: uploads/messages/{tenantId}/{threadId}/
  const uploadDir = path.join(process.cwd(), "uploads", "messages", String(tenantId), String(threadId));
  await fs.mkdir(uploadDir, { recursive: true });

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const sanitizedFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedFilename = `${timestamp}-${sanitizedFilename}`;
  const filepath = path.join(uploadDir, storedFilename);

  await fs.writeFile(filepath, buffer);

  return {
    filename: file.filename,
    mime: file.mimetype,
    bytes: buffer.length,
    key: `messages/${tenantId}/${threadId}/${storedFilename}`,
  };
}

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /messages/threads - Create new thread with initial message
  app.post("/messages/threads", async (req, reply) => {
    // Enforce messaging party scope (supports both STAFF and CLIENT)
    const { tenantId, partyId: senderPartyId } = await requireMessagingPartyScope(req);

    const { recipientPartyId, subject, initialMessage } = req.body as any;

    if (!recipientPartyId || !initialMessage) {
      return reply.code(400).send({ error: "missing_required_fields", required: ["recipientPartyId", "initialMessage"] });
    }

    const now = new Date();

    try {
      // Check if sender is the org party (for response time tracking)
      // Use Organization table to get the correct partyId (more reliable than Party.type lookup)
      const tenantOrg = await prisma.organization.findFirst({
        where: { tenantId },
        select: { partyId: true },
      });
      const isOrgSending = tenantOrg && senderPartyId === tenantOrg.partyId;

      const thread = await prisma.messageThread.create({
        data: {
          tenantId,
          subject,
          lastMessageAt: now,
          // Track first inbound message time for response metrics
          firstInboundAt: isOrgSending ? undefined : now,
          participants: {
            create: [
              { partyId: senderPartyId, lastReadAt: now },
              { partyId: recipientPartyId },
            ],
          },
          messages: {
            create: {
              senderPartyId,
              body: initialMessage,
            },
          },
        },
        include: {
          participants: {
            include: { party: { select: { id: true, name: true, email: true, type: true } } },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: { senderParty: { select: { id: true, name: true } } },
          },
        },
      });

      // Auto-provision portal access if org/breeder is sending to a contact without access
      // This ensures the recipient can log in to the portal to view and reply to the message
      if (isOrgSending) {
        const userId = (req as any).userId as string | undefined;
        const senderParty = thread.participants.find(p => p.partyId === senderPartyId)?.party;
        const recipientParty = thread.participants.find(p => p.partyId === recipientPartyId)?.party;

        // Auto-provision portal access for the recipient
        const provisionResult = await autoProvisionPortalAccessForDM(
          tenantId,
          recipientPartyId,
          { userId, senderPartyId }
        );

        // If recipient already had access (or just got it), send new message notification
        // Skip if we just sent the portal invite (they'll get that email first)
        if (!provisionResult.inviteSent && recipientParty?.email) {
          try {
            await sendNewMessageNotification(
              tenantId,
              recipientParty.email,
              recipientParty.name || "there",
              senderParty?.name || "Your breeder",
              initialMessage,
              thread.id // Pass threadId for reply-to address generation
            );
          } catch (notifErr) {
            // Don't fail the thread creation if notification fails
            console.error("Failed to send new message notification:", notifErr);
          }
        }
      }

      if (tenantOrg && senderPartyId !== tenantOrg.partyId) {
        try {
          await evaluateAndSendAutoReply({
            prisma,
            tenantId,
            threadId: thread.id,
            inboundSenderPartyId: senderPartyId,
          });
        } catch (autoReplyErr: any) {
          await prisma.autoReplyLog.create({
            data: {
              tenantId,
              channel: "dm",
              partyId: senderPartyId,
              threadId: thread.id,
              status: "failed",
              reason: `Auto-reply evaluation error: ${autoReplyErr.message || "unknown"}`,
            },
          }).catch((logErr) => {
            console.error("Failed to log auto-reply error:", logErr);
          });
        }
      }

      // Broadcast new thread/message via WebSocket for real-time updates
      const firstMessage = thread.messages[0];
      if (firstMessage && firstMessage.senderPartyId !== null) {
        broadcastNewMessage(tenantId, thread.id, {
          id: firstMessage.id,
          body: firstMessage.body,
          senderPartyId: firstMessage.senderPartyId,
          createdAt: firstMessage.createdAt.toISOString(),
        }, [senderPartyId, recipientPartyId]);
      }

      return reply.send({ ok: true, thread });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // GET /messages/threads - List threads for current user's party
  app.get("/messages/threads", async (req, reply) => {
    // Enforce messaging party scope (supports both STAFF and CLIENT)
    const { tenantId, partyId: currentUserPartyId } = await requireMessagingPartyScope(req);

    try {
      // Get threads where user is a participant
      const participantRecords = await prisma.messageParticipant.findMany({
        where: { partyId: currentUserPartyId },
        select: { threadId: true, lastReadAt: true },
      });

      const threadIds = participantRecords.map((p) => p.threadId);
      if (threadIds.length === 0) {
        return reply.send({ threads: [] });
      }

      const threads = await prisma.messageThread.findMany({
        where: { id: { in: threadIds }, tenantId },
        include: {
          participants: {
            include: { party: { select: { id: true, name: true, email: true, type: true } } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      // Calculate unread count efficiently
      const threadsWithUnread = await Promise.all(
        threads.map(async (t) => {
          const participant = participantRecords.find((p) => p.threadId === t.id);
          const lastReadAt = participant?.lastReadAt;

          // Count messages created after lastReadAt, excluding sender's own messages
          const unreadCount = lastReadAt
            ? await prisma.message.count({
                where: {
                  threadId: t.id,
                  createdAt: { gt: lastReadAt },
                  senderPartyId: { not: currentUserPartyId },
                },
              })
            : await prisma.message.count({
                where: {
                  threadId: t.id,
                  senderPartyId: { not: currentUserPartyId },
                },
              });

          return {
            ...t,
            unreadCount,
          };
        })
      );

      return reply.send({ threads: threadsWithUnread });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // GET /messages/threads/:id - Get thread details with all messages
  app.get("/messages/threads/:id", async (req, reply) => {
    // Enforce messaging party scope (supports both STAFF and CLIENT)
    const { tenantId, partyId: userPartyId } = await requireMessagingPartyScope(req);

    const threadId = Number((req.params as any).id);

    try {
      const thread = await prisma.messageThread.findFirst({
        where: { id: threadId, tenantId },
        include: {
          participants: {
            include: { party: { select: { id: true, name: true, email: true, type: true } } },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: { senderParty: { select: { id: true, name: true, type: true } } },
          },
        },
      });

      if (!thread) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Enforce: user's party must be participant
      const isParticipant = thread.participants.some((p) => p.partyId === userPartyId);
      if (!isParticipant) {
        return reply.code(403).send({ error: "forbidden" });
      }

      // Mark as read: update lastReadAt to now
      await prisma.messageParticipant.updateMany({
        where: { threadId, partyId: userPartyId },
        data: { lastReadAt: new Date() },
      });

      // Transform messages to include attachment URLs
      const messagesWithUrls = thread.messages.map((msg) => ({
        ...msg,
        attachment: msg.attachmentKey
          ? {
              filename: msg.attachmentFilename,
              mime: msg.attachmentMime,
              bytes: msg.attachmentBytes,
              url: `/api/v1/messages/attachments/${msg.id}`,
            }
          : null,
      }));

      return reply.send({
        thread: {
          ...thread,
          messages: messagesWithUrls,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // POST /messages/threads/:id/messages - Send message in thread
  app.post("/messages/threads/:id/messages", async (req, reply) => {
    // Enforce messaging party scope (supports both STAFF and CLIENT)
    const { tenantId, partyId: userPartyId } = await requireMessagingPartyScope(req);

    const threadId = Number((req.params as any).id);
    const { body: messageBody } = req.body as any;

    if (!messageBody) {
      return reply.code(400).send({ error: "missing_required_fields", required: ["body"] });
    }

    try {
      const thread = await prisma.messageThread.findFirst({
        where: { id: threadId, tenantId },
        select: {
          id: true,
          firstInboundAt: true,
          firstOrgReplyAt: true,
          participants: { select: { partyId: true } },
        },
      });

      if (!thread) {
        return reply.code(404).send({ error: "not_found" });
      }

      const isParticipant = thread.participants.some((p) => p.partyId === userPartyId);
      if (!isParticipant) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const now = new Date();

      const message = await prisma.message.create({
        data: {
          threadId,
          senderPartyId: userPartyId,
          body: messageBody,
        },
        include: {
          senderParty: { select: { id: true, name: true } },
        },
      });

      // Check if sender is the org party (for response time tracking)
      // Use Organization table to get the correct partyId (more reliable than Party.type lookup)
      const tenantOrg = await prisma.organization.findFirst({
        where: { tenantId },
        select: { partyId: true },
      });
      const isOrgSending = tenantOrg && userPartyId === tenantOrg.partyId;

      // Build update data for thread
      const threadUpdateData: any = { lastMessageAt: now, updatedAt: now };

      // Response time tracking
      if (!isOrgSending && !thread.firstInboundAt) {
        // First inbound message from non-org party
        threadUpdateData.firstInboundAt = now;
      } else if (isOrgSending && thread.firstInboundAt && !thread.firstOrgReplyAt) {
        // First reply from org to an inbound conversation
        threadUpdateData.firstOrgReplyAt = now;
        const responseTimeMs = now.getTime() - new Date(thread.firstInboundAt).getTime();
        threadUpdateData.responseTimeSeconds = Math.floor(responseTimeMs / 1000);

        // Calculate business hours response time for Quick Responder badge
        // Fetch tenant's business hours settings
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            businessHours: true,
            timeZone: true,
            avgBusinessHoursResponseTime: true,
            totalResponseCount: true,
            quickResponderBadge: true,
          },
        });

        if (tenant) {
          const businessHoursResponse = calculateBusinessHoursSeconds(
            new Date(thread.firstInboundAt),
            now,
            tenant.businessHours as BusinessHoursSchedule | null,
            tenant.timeZone
          );

          threadUpdateData.businessHoursResponseTime = businessHoursResponse;

          // Update tenant's running average and badge status
          const { newAvg, newCount } = updateRunningAverage(
            tenant.avgBusinessHoursResponseTime,
            tenant.totalResponseCount,
            businessHoursResponse
          );

          const shouldHaveBadge = shouldHaveQuickResponderBadge(newAvg, newCount);

          await prisma.tenant.update({
            where: { id: tenantId },
            data: {
              avgBusinessHoursResponseTime: newAvg,
              totalResponseCount: newCount,
              quickResponderBadge: shouldHaveBadge,
              lastBadgeEvaluatedAt: now,
            },
          });
        }
      }

      // Update thread
      await prisma.messageThread.update({
        where: { id: threadId },
        data: threadUpdateData,
      });

      // Update sender's lastReadAt (they've seen their own message)
      await prisma.messageParticipant.updateMany({
        where: { threadId, partyId: userPartyId },
        data: { lastReadAt: now },
      });

      if (tenantOrg && userPartyId !== tenantOrg.partyId) {
        try {
          await evaluateAndSendAutoReply({
            prisma,
            tenantId,
            threadId,
            inboundSenderPartyId: userPartyId,
          });
        } catch (autoReplyErr: any) {
          await prisma.autoReplyLog.create({
            data: {
              tenantId,
              channel: "dm",
              partyId: userPartyId,
              threadId,
              status: "failed",
              reason: `Auto-reply evaluation error: ${autoReplyErr.message || "unknown"}`,
            },
          }).catch((logErr) => {
            console.error("Failed to log auto-reply error:", logErr);
          });
        }
      }

      // Broadcast new message via WebSocket for real-time updates
      const participantPartyIds = thread.participants.map((p) => p.partyId);
      if (message.senderPartyId !== null) {
        broadcastNewMessage(tenantId, threadId, {
          id: message.id,
          body: message.body,
          senderPartyId: message.senderPartyId,
          createdAt: message.createdAt.toISOString(),
        }, participantPartyIds);
      }

      // Also broadcast to marketplace WebSocket for marketplace buyers
      // (they connect via a different WebSocket endpoint)
      if (isOrgSending && message.senderPartyId !== null) {
        const recipientPartyIds = participantPartyIds.filter(id => id !== userPartyId);
        for (const recipientPartyId of recipientPartyIds) {
          try {
            // Get the party's email
            const party = await prisma.party.findFirst({
              where: { id: recipientPartyId, tenantId },
              select: { email: true },
            });
            if (party?.email) {
              // Look up MarketplaceUser by email
              const marketplaceUser = await prisma.marketplaceUser.findFirst({
                where: { email: party.email },
                select: { id: true },
              });
              if (marketplaceUser) {
                // Broadcast to marketplace WebSocket
                broadcastBreederMessageToMarketplaceUser(
                  marketplaceUser.id,
                  threadId,
                  {
                    id: message.id,
                    body: message.body,
                    senderPartyId: message.senderPartyId,
                    senderParty: { type: "ORGANIZATION" },
                    createdAt: message.createdAt.toISOString(),
                  }
                );
              }
            }
          } catch (marketplaceWsErr) {
            // Don't fail if marketplace broadcast fails
            console.error("[WS] Failed to broadcast to marketplace user:", marketplaceWsErr);
          }
        }
      }

      // Send email notification to recipient(s) when breeder/org sends a reply
      if (isOrgSending) {
        // Find recipients (participants who are not the sender)
        const recipientPartyIds = participantPartyIds.filter(id => id !== userPartyId);

        // Get recipient party info for notifications
        for (const recipientPartyId of recipientPartyIds) {
          try {
            const recipientParty = await prisma.party.findFirst({
              where: { id: recipientPartyId, tenantId },
              select: { id: true, name: true, email: true },
            });

            if (recipientParty?.email) {
              // Check if recipient has active portal access
              const portalAccess = await prisma.portalAccess.findFirst({
                where: { partyId: recipientPartyId, tenantId, status: "ACTIVE" },
              });

              // Only send notification if they have active portal access
              // (otherwise they can't view the message anyway)
              if (portalAccess) {
                const senderParty = await prisma.party.findFirst({
                  where: { id: userPartyId, tenantId },
                  select: { name: true },
                });

                await sendNewMessageNotification(
                  tenantId,
                  recipientParty.email,
                  recipientParty.name || "there",
                  senderParty?.name || "Your breeder",
                  messageBody,
                  threadId // Pass threadId for reply-to address generation
                );
              }
            }
          } catch (notifErr) {
            // Don't fail the message send if notification fails
            console.error("Failed to send reply notification:", notifErr);
          }
        }
      }

      return reply.send({ ok: true, message });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // POST /messages/threads/:id/messages/upload - Send message with file attachment (multipart)
  app.post("/messages/threads/:id/messages/upload", async (req, reply) => {
    // Enforce messaging party scope (supports both STAFF and CLIENT)
    const { tenantId, partyId: userPartyId } = await requireMessagingPartyScope(req);

    const threadId = Number((req.params as any).id);

    try {
      const thread = await prisma.messageThread.findFirst({
        where: { id: threadId, tenantId },
        select: {
          id: true,
          firstInboundAt: true,
          firstOrgReplyAt: true,
          participants: { select: { partyId: true } },
        },
      });

      if (!thread) {
        return reply.code(404).send({ error: "not_found" });
      }

      const isParticipant = thread.participants.some((p) => p.partyId === userPartyId);
      if (!isParticipant) {
        return reply.code(403).send({ error: "forbidden" });
      }

      // Parse multipart form data
      const mpReq = req as any;
      const data = await mpReq.file();

      if (!data) {
        return reply.code(400).send({ error: "file_required" });
      }

      // Get message body from form fields
      const fields: Record<string, string> = {};
      for await (const part of mpReq.parts()) {
        if (part.type === "field") {
          fields[part.fieldname] = part.value;
        }
      }

      const messageBody = fields.body || "";

      // Save the file
      const attachment = await saveMessageAttachment(tenantId, threadId, data);

      if (!attachment) {
        return reply.code(400).send({
          error: "invalid_file",
          detail: "File too large (max 10MB) or unsupported type",
        });
      }

      const now = new Date();

      // Create message with attachment
      const message = await prisma.message.create({
        data: {
          threadId,
          senderPartyId: userPartyId,
          body: messageBody,
          attachmentFilename: attachment.filename,
          attachmentMime: attachment.mime,
          attachmentBytes: attachment.bytes,
          attachmentKey: attachment.key,
        },
        include: {
          senderParty: { select: { id: true, name: true } },
        },
      });

      // Update thread timestamps
      await prisma.messageThread.update({
        where: { id: threadId },
        data: { lastMessageAt: now, updatedAt: now },
      });

      // Update sender's lastReadAt
      await prisma.messageParticipant.updateMany({
        where: { threadId, partyId: userPartyId },
        data: { lastReadAt: now },
      });

      // Broadcast new message via WebSocket
      const participantPartyIds = thread.participants.map((p) => p.partyId);
      if (message.senderPartyId !== null) {
        broadcastNewMessage(tenantId, threadId, {
          id: message.id,
          body: message.body,
          senderPartyId: message.senderPartyId,
          createdAt: message.createdAt.toISOString(),
          attachmentFilename: message.attachmentFilename,
          attachmentMime: message.attachmentMime,
          attachmentBytes: message.attachmentBytes,
        }, participantPartyIds);
      }

      // Also broadcast to marketplace WebSocket for marketplace buyers
      // Check if sender is org (breeder) by party type
      const senderParty = await prisma.party.findFirst({
        where: { id: userPartyId, tenantId },
        select: { type: true },
      });
      const isOrgSendingUpload = senderParty?.type === "ORGANIZATION";

      if (isOrgSendingUpload && message.senderPartyId !== null) {
        const recipientPartyIds = participantPartyIds.filter(id => id !== userPartyId);
        for (const recipientPartyId of recipientPartyIds) {
          try {
            const party = await prisma.party.findFirst({
              where: { id: recipientPartyId, tenantId },
              select: { email: true },
            });
            if (party?.email) {
              const marketplaceUser = await prisma.marketplaceUser.findFirst({
                where: { email: party.email },
                select: { id: true },
              });
              if (marketplaceUser) {
                broadcastBreederMessageToMarketplaceUser(
                  marketplaceUser.id,
                  threadId,
                  {
                    id: message.id,
                    body: message.body,
                    senderPartyId: message.senderPartyId,
                    senderParty: { type: "ORGANIZATION" },
                    createdAt: message.createdAt.toISOString(),
                  }
                );
              }
            }
          } catch (marketplaceWsErr) {
            console.error("[WS] Failed to broadcast to marketplace user:", marketplaceWsErr);
          }
        }
      }

      return reply.send({
        ok: true,
        message: {
          ...message,
          attachment: attachment ? {
            filename: attachment.filename,
            mime: attachment.mime,
            bytes: attachment.bytes,
            url: `/api/v1/messages/attachments/${message.id}`,
          } : null,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // GET /messages/attachments/:messageId - Download/serve attachment
  app.get("/messages/attachments/:messageId", async (req, reply) => {
    // Enforce messaging party scope (supports both STAFF and CLIENT)
    const { tenantId, partyId: userPartyId } = await requireMessagingPartyScope(req);

    const messageId = Number((req.params as any).messageId);

    try {
      const message = await prisma.message.findFirst({
        where: { id: messageId },
        select: {
          id: true,
          threadId: true,
          attachmentFilename: true,
          attachmentMime: true,
          attachmentKey: true,
          thread: {
            select: {
              tenantId: true,
              participants: { select: { partyId: true } },
            },
          },
        },
      });

      if (!message || message.thread.tenantId !== tenantId) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Verify user is a participant
      const isParticipant = message.thread.participants.some((p) => p.partyId === userPartyId);
      if (!isParticipant) {
        return reply.code(403).send({ error: "forbidden" });
      }

      if (!message.attachmentKey) {
        return reply.code(404).send({ error: "no_attachment" });
      }

      // Resolve file path
      const filepath = path.join(process.cwd(), "uploads", message.attachmentKey);

      try {
        await fs.access(filepath);
      } catch {
        return reply.code(404).send({ error: "file_not_found" });
      }

      const fileBuffer = await fs.readFile(filepath);

      reply.header("Content-Type", message.attachmentMime || "application/octet-stream");
      reply.header("Content-Disposition", `inline; filename="${message.attachmentFilename || "attachment"}"`);
      reply.header("Content-Length", fileBuffer.length);

      return reply.send(fileBuffer);
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // PATCH /messages/threads/:id - Update thread (flag/archive)
  app.patch("/messages/threads/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const threadId = Number((req.params as any).id);
    const { flagged, archived } = req.body as {
      flagged?: boolean;
      archived?: boolean;
    };

    try {
      const existing = await prisma.messageThread.findFirst({
        where: { id: threadId, tenantId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      const now = new Date();
      const updateData: any = {};

      if (flagged !== undefined) {
        updateData.flagged = flagged;
        updateData.flaggedAt = flagged ? now : null;
      }

      if (archived !== undefined) {
        updateData.archived = archived;
      }

      if (Object.keys(updateData).length === 0) {
        return reply.code(400).send({ error: "no_updates_provided" });
      }

      const updated = await prisma.messageThread.update({
        where: { id: threadId },
        data: updateData,
        include: {
          participants: {
            include: { party: { select: { id: true, name: true, email: true, type: true } } },
          },
        },
      });

      return reply.send({ ok: true, thread: updated });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // DELETE /messages/threads/:id - Soft delete thread (mark as deleted)
  app.delete("/messages/threads/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const threadId = Number((req.params as any).id);

    try {
      const existing = await prisma.messageThread.findFirst({
        where: { id: threadId, tenantId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Soft delete: archive the thread
      await prisma.messageThread.update({
        where: { id: threadId },
        data: {
          archived: true,
        },
      });

      return reply.send({ ok: true });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // PUT alias for PATCH (some clients use PUT for updates)
  app.put("/messages/threads/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const threadId = Number((req.params as any).id);
    const { flagged, archived, isRead } = req.body as {
      flagged?: boolean;
      archived?: boolean;
      isRead?: boolean;
    };

    try {
      const existing = await prisma.messageThread.findFirst({
        where: { id: threadId, tenantId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      const now = new Date();
      const updateData: any = {};

      if (flagged !== undefined) {
        updateData.flagged = flagged;
        updateData.flaggedAt = flagged ? now : null;
      }

      if (archived !== undefined) {
        updateData.archived = archived;
      }

      // Handle marking as unread (update participant's lastReadAt)
      if (isRead === false) {
        // Get the org participant and set lastReadAt to null or a past date
        const { partyId: userPartyId } = await requireMessagingPartyScope(req);
        await prisma.messageParticipant.updateMany({
          where: { threadId, partyId: userPartyId },
          data: { lastReadAt: null },
        });
        return reply.send({ ok: true });
      }

      if (Object.keys(updateData).length === 0) {
        return reply.code(400).send({ error: "no_updates_provided" });
      }

      const updated = await prisma.messageThread.update({
        where: { id: threadId },
        data: updateData,
      });

      return reply.send({ ok: true, thread: updated });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });
};

export default routes;
