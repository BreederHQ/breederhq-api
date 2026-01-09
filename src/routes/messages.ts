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
              initialMessage
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
            include: { senderParty: { select: { id: true, name: true } } },
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

      return reply.send({ thread });
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

      return reply.send({ ok: true, message });
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
};

export default routes;
