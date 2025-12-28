// src/routes/messages.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /messages/threads - Create new thread with initial message
  app.post("/messages/threads", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { recipientPartyId, subject, initialMessage } = req.body as any;

    if (!recipientPartyId || !initialMessage) {
      return reply.code(400).send({ error: "missing_required_fields", required: ["recipientPartyId", "initialMessage"] });
    }

    // Get sender party from current user
    const userId = (req as any).userId;
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { partyId: true },
    });

    if (!user?.partyId) {
      return reply.code(400).send({ error: "user_has_no_party" });
    }

    const senderPartyId = user.partyId;
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

      return reply.send({ ok: true, thread });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // GET /messages/threads - List threads for current user's party
  app.get("/messages/threads", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const userId = (req as any).userId;
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { partyId: true },
    });

    if (!user?.partyId) {
      return reply.send({ threads: [] });
    }

    try {
      // Get threads where user is a participant
      const participantRecords = await prisma.messageParticipant.findMany({
        where: { partyId: user.partyId },
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
                  senderPartyId: { not: user.partyId },
                },
              })
            : await prisma.message.count({
                where: {
                  threadId: t.id,
                  senderPartyId: { not: user.partyId },
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
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const userId = (req as any).userId;
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const threadId = Number((req.params as any).id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { partyId: true },
    });

    if (!user?.partyId) {
      return reply.code(403).send({ error: "forbidden" });
    }

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
      const isParticipant = thread.participants.some((p) => p.partyId === user.partyId);
      if (!isParticipant) {
        return reply.code(403).send({ error: "forbidden" });
      }

      // Mark as read: update lastReadAt to now
      await prisma.messageParticipant.updateMany({
        where: { threadId, partyId: user.partyId },
        data: { lastReadAt: new Date() },
      });

      return reply.send({ thread });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // POST /messages/threads/:id/messages - Send message in thread
  app.post("/messages/threads/:id/messages", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const userId = (req as any).userId;
    if (!userId) return reply.code(401).send({ error: "unauthorized" });

    const threadId = Number((req.params as any).id);
    const { body: messageBody } = req.body as any;

    if (!messageBody) {
      return reply.code(400).send({ error: "missing_required_fields", required: ["body"] });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { partyId: true },
    });

    if (!user?.partyId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    try {
      const thread = await prisma.messageThread.findFirst({
        where: { id: threadId, tenantId },
        select: { id: true, participants: { select: { partyId: true } } },
      });

      if (!thread) {
        return reply.code(404).send({ error: "not_found" });
      }

      const isParticipant = thread.participants.some((p) => p.partyId === user.partyId);
      if (!isParticipant) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const now = new Date();

      const message = await prisma.message.create({
        data: {
          threadId,
          senderPartyId: user.partyId,
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
        where: { threadId, partyId: user.partyId },
        data: { lastReadAt: now },
      });

      return reply.send({ ok: true, message });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });
};

export default routes;
