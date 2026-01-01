// src/routes/messages.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { evaluateAndSendAutoReply } from "../services/auto-reply-service.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /messages/threads - Create new thread with initial message
  app.post("/messages/threads", async (req, reply) => {
    // Enforce CLIENT party scope
    const { tenantId, partyId: senderPartyId } = await requireClientPartyScope(req);

    const { recipientPartyId, subject, initialMessage } = req.body as any;

    if (!recipientPartyId || !initialMessage) {
      return reply.code(400).send({ error: "missing_required_fields", required: ["recipientPartyId", "initialMessage"] });
    }

    const now = new Date();

    try {
      const thread = await prisma.messageThread.create({
        data: {
          tenantId,
          subject,
          lastMessageAt: now,
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
            include: { party: { select: { id: true, name: true, email: true } } },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: { senderParty: { select: { id: true, name: true } } },
          },
        },
      });

      // Check if sender is non-tenant party, evaluate auto-reply
      const tenantParty = await prisma.party.findFirst({
        where: { tenantId, type: "ORGANIZATION" },
      });

      if (tenantParty && senderPartyId !== tenantParty.id) {
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
    // Enforce CLIENT party scope
    const { tenantId, partyId: currentUserPartyId } = await requireClientPartyScope(req);

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
            include: { party: { select: { id: true, name: true, email: true } } },
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
    // Enforce CLIENT party scope
    const { tenantId, partyId: userPartyId } = await requireClientPartyScope(req);

    const threadId = Number((req.params as any).id);

    try {
      const thread = await prisma.messageThread.findFirst({
        where: { id: threadId, tenantId },
        include: {
          participants: {
            include: { party: { select: { id: true, name: true, email: true } } },
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
    // Enforce CLIENT party scope
    const { tenantId, partyId: userPartyId } = await requireClientPartyScope(req);

    const threadId = Number((req.params as any).id);
    const { body: messageBody } = req.body as any;

    if (!messageBody) {
      return reply.code(400).send({ error: "missing_required_fields", required: ["body"] });
    }

    try {
      const thread = await prisma.messageThread.findFirst({
        where: { id: threadId, tenantId },
        select: { id: true, participants: { select: { partyId: true } } },
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

      // Update thread lastMessageAt and updatedAt
      await prisma.messageThread.update({
        where: { id: threadId },
        data: { lastMessageAt: now, updatedAt: now },
      });

      // Update sender's lastReadAt (they've seen their own message)
      await prisma.messageParticipant.updateMany({
        where: { threadId, partyId: userPartyId },
        data: { lastReadAt: now },
      });

      // Check if sender is non-tenant party, evaluate auto-reply
      const tenantParty = await prisma.party.findFirst({
        where: { tenantId, type: "ORGANIZATION" },
      });

      if (tenantParty && userPartyId !== tenantParty.id) {
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
};

export default routes;
