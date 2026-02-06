// src/routes/marketplace-messages.ts
// Marketplace messaging endpoints for buyer-to-breeder communication
//
// Endpoints:
//   GET  /messages/counts               - Get unread counts for notification badge
//   GET  /messages/threads              - List threads for current marketplace user
//   GET  /messages/threads/:id          - Get thread details (auto-marks as read)
//   POST /messages/threads/:id/mark-read - Explicitly mark thread as read
//   POST /messages/threads              - Create new thread with breeder
//   POST /messages/threads/:id/messages - Send message in thread
//
// Security:
// - Requires valid marketplace session (PUBLIC context with MARKETPLACE_ACCESS)
// - Creates per-tenant Party for user when messaging a breeder
// - Messages are stored in the breeder's tenant

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { isBlocked } from "../services/marketplace-block.js";
import { isUserSuspended } from "../services/marketplace-flag.js";
import { requireMarketplaceAuth as authMiddleware } from "../middleware/marketplace-auth.js";
import { broadcastNewMessage } from "../services/websocket-service.js";

/**
 * Get user info for messaging context.
 * For marketplace users, userId is a string integer (e.g. "160") from MarketplaceUser table.
 */
async function getUserInfo(userId: string): Promise<{ id: string; email: string; name: string }> {
  // Parse marketplace user ID (string integer)
  const marketplaceUserId = parseInt(userId, 10);

  if (!Number.isFinite(marketplaceUserId) || marketplaceUserId <= 0) {
    throw { statusCode: 401, error: "unauthorized", detail: "invalid_user_id" };
  }

  const user = await prisma.marketplaceUser.findUnique({
    where: { id: marketplaceUserId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!user) {
    throw { statusCode: 401, error: "unauthorized", detail: "user_not_found" };
  }

  return {
    id: String(user.id), // Convert back to string for consistency
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
  };
}

/**
 * Get or create a Party for a marketplace user within a specific tenant.
 * Marketplace users get a CONTACT party created in each breeder's tenant they message.
 */
async function getOrCreateUserPartyInTenant(
  userId: string,
  tenantId: number
): Promise<{ id: number; name: string }> {
  const userInfo = await getUserInfo(userId);

  // Check if user already has a party in this tenant (lookup by email)
  const existingParty = await prisma.party.findFirst({
    where: {
      tenantId,
      email: userInfo.email,
      type: "CONTACT",
    },
    select: { id: true, name: true },
  });

  if (existingParty) {
    return existingParty;
  }

  // Create a new CONTACT party for this user in the breeder's tenant
  const party = await prisma.party.create({
    data: {
      tenantId,
      name: userInfo.name,
      email: userInfo.email,
      type: "CONTACT",
    },
    select: { id: true, name: true },
  });

  return party;
}

/**
 * Require marketplace authentication.
 * Returns userId as string if authenticated, throws 401 otherwise.
 * NOTE: Routes should also use authMiddleware as preHandler!
 */
function requireMarketplaceAuth(req: any): string {
  const userId = req.marketplaceUserId;
  if (!userId) {
    throw { statusCode: 401, error: "unauthorized", detail: "no_session" };
  }
  return String(userId);
}

/**
 * Get all tenantIds where user has message threads.
 */
async function getUserMessageTenants(userId: string): Promise<number[]> {
  const userInfo = await getUserInfo(userId);

  // Find all parties with this user's email across all tenants
  const parties = await prisma.party.findMany({
    where: { email: userInfo.email, type: "CONTACT" },
    select: { id: true, tenantId: true },
  });

  return [...new Set(parties.map((p) => p.tenantId))];
}

/**
 * Get all party IDs for this user across all tenants.
 */
async function getUserPartyIds(userId: string): Promise<number[]> {
  const userInfo = await getUserInfo(userId);

  const parties = await prisma.party.findMany({
    where: { email: userInfo.email, type: "CONTACT" },
    select: { id: true },
  });

  return parties.map((p) => p.id);
}

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /messages/counts - Get unread message counts for notification badge
  // --------------------------------------------------------------------------
  app.get(
    "/counts",
    {
      preHandler: authMiddleware,
      config: {
        rateLimit: { max: 100, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const userId = requireMarketplaceAuth(req);

      try {
        // Get all party IDs for this user across all tenants
        const userPartyIds = await getUserPartyIds(userId);

        if (userPartyIds.length === 0) {
          return reply.send({
            ok: true,
            counts: {
              unreadThreads: 0,
              totalUnreadMessages: 0,
            },
          });
        }

        // Get threads where user is a participant
        const participantRecords = await prisma.messageParticipant.findMany({
          where: { partyId: { in: userPartyIds } },
          select: { threadId: true, lastReadAt: true, partyId: true },
        });

        const threadIds = participantRecords.map((p) => p.threadId);
        if (threadIds.length === 0) {
          return reply.send({
            ok: true,
            counts: {
              unreadThreads: 0,
              totalUnreadMessages: 0,
            },
          });
        }

        // Calculate unread counts for all threads
        let unreadThreadsCount = 0;
        let totalUnreadMessages = 0;

        for (const participant of participantRecords) {
          const lastReadAt = participant.lastReadAt;
          const userPartyId = participant.partyId;

          const unreadCount = Number(lastReadAt
            ? await prisma.message.count({
                where: {
                  threadId: participant.threadId,
                  createdAt: { gt: lastReadAt },
                  senderPartyId: { not: userPartyId },
                },
              })
            : await prisma.message.count({
                where: {
                  threadId: participant.threadId,
                  senderPartyId: { not: userPartyId },
                },
              }));

          if (unreadCount > 0) {
            unreadThreadsCount++;
            totalUnreadMessages += unreadCount;
          }
        }

        return reply.send({
          ok: true,
          counts: {
            unreadThreads: unreadThreadsCount,
            totalUnreadMessages,
          },
        });
      } catch (err: any) {
        if (err.statusCode) throw err;
        return reply.code(500).send({ error: "internal_error", detail: err.message });
      }
    }
  );

  // --------------------------------------------------------------------------
  // GET /messages/threads - List threads for current marketplace user
  // --------------------------------------------------------------------------
  app.get("/threads", { preHandler: authMiddleware }, async (req, reply) => {
    const userId = requireMarketplaceAuth(req);

    try {
      // Get all party IDs for this user across all tenants
      const userPartyIds = await getUserPartyIds(userId);

      if (userPartyIds.length === 0) {
        return reply.send({ threads: [] });
      }

      // Get threads where user is a participant
      const participantRecords = await prisma.messageParticipant.findMany({
        where: { partyId: { in: userPartyIds } },
        select: { threadId: true, lastReadAt: true, partyId: true },
      });

      const threadIds = participantRecords.map((p) => p.threadId);
      if (threadIds.length === 0) {
        return reply.send({ threads: [] });
      }

      const threads = await prisma.messageThread.findMany({
        where: { id: { in: threadIds } },
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

      // Calculate unread count for each thread
      const threadsWithUnread = await Promise.all(
        threads.map(async (t) => {
          // Find this user's participant record for this thread
          const participant = participantRecords.find((p) => p.threadId === t.id);
          const lastReadAt = participant?.lastReadAt;
          const userPartyId = participant?.partyId;

          const unreadCount = Number(lastReadAt
            ? await prisma.message.count({
                where: {
                  threadId: t.id,
                  createdAt: { gt: lastReadAt },
                  senderPartyId: { not: userPartyId },
                },
              })
            : await prisma.message.count({
                where: {
                  threadId: t.id,
                  senderPartyId: { not: userPartyId },
                },
              }));

          return { ...t, unreadCount };
        })
      );

      return reply.send({ threads: threadsWithUnread });
    } catch (err: any) {
      if (err.statusCode) throw err;
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // GET /messages/threads/:id - Get thread details with messages
  // --------------------------------------------------------------------------
  app.get("/threads/:id", { preHandler: authMiddleware }, async (req, reply) => {
    const userId = requireMarketplaceAuth(req);
    const threadId = Number((req.params as any).id);

    // Validate thread ID is a valid number
    if (!Number.isFinite(threadId) || threadId <= 0) {
      return reply.code(400).send({ error: "invalid_thread_id" });
    }

    try {
      const userPartyIds = await getUserPartyIds(userId);

      const thread = await prisma.messageThread.findFirst({
        where: { id: threadId },
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

      // Verify user is a participant (via any of their party IDs)
      const isParticipant = thread.participants.some((p) => userPartyIds.includes(p.partyId));
      if (!isParticipant) {
        return reply.code(403).send({ error: "forbidden" });
      }

      // Mark as read for this user's party
      const userPartyInThread = thread.participants.find((p) => userPartyIds.includes(p.partyId));
      if (userPartyInThread) {
        await prisma.messageParticipant.updateMany({
          where: { threadId, partyId: userPartyInThread.partyId },
          data: { lastReadAt: new Date() },
        });
      }

      return reply.send({ thread });
    } catch (err: any) {
      if (err.statusCode) throw err;
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /messages/threads/:id/mark-read - Mark thread as read
  // --------------------------------------------------------------------------
  app.post(
    "/threads/:id/mark-read",
    {
      preHandler: authMiddleware,
      config: {
        rateLimit: { max: 60, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const userId = requireMarketplaceAuth(req);
      const threadId = Number((req.params as any).id);

      // Validate thread ID is a valid number
      if (!Number.isFinite(threadId) || threadId <= 0) {
        return reply.code(400).send({ error: "invalid_thread_id" });
      }

      try {
        const userPartyIds = await getUserPartyIds(userId);

        const thread = await prisma.messageThread.findFirst({
          where: { id: threadId },
          select: { id: true, participants: { select: { partyId: true } } },
        });

        if (!thread) {
          return reply.code(404).send({ error: "not_found" });
        }

        // Verify user is a participant
        const userPartyInThread = thread.participants.find((p) => userPartyIds.includes(p.partyId));
        if (!userPartyInThread) {
          return reply.code(403).send({ error: "forbidden" });
        }

        // Update lastReadAt for this user's party
        await prisma.messageParticipant.updateMany({
          where: { threadId, partyId: userPartyInThread.partyId },
          data: { lastReadAt: new Date() },
        });

        return reply.send({ ok: true, message: "Thread marked as read" });
      } catch (err: any) {
        if (err.statusCode) throw err;
        return reply.code(500).send({ error: "internal_error", detail: err.message });
      }
    }
  );

  // --------------------------------------------------------------------------
  // POST /messages/threads - Create new thread with a breeder
  // --------------------------------------------------------------------------
  app.post("/threads", { preHandler: authMiddleware }, async (req, reply) => {
    const userId = requireMarketplaceAuth(req);

    // Check if email is verified before allowing messages
    const user = await prisma.marketplaceUser.findUnique({
      where: { id: parseInt(userId, 10) },
      select: { emailVerified: true },
    });

    if (!user) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "User not found.",
      });
    }

    if (!user.emailVerified) {
      return reply.code(403).send({
        error: "email_verification_required",
        message: "Please verify your email address before sending messages.",
      });
    }

    const { recipientPartyId, breederTenantId, subject, initialMessage, context } = req.body as any;

    if (!recipientPartyId || !initialMessage || !breederTenantId) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["recipientPartyId", "breederTenantId", "initialMessage"],
      });
    }

    const tenantId = Number(breederTenantId);
    const now = new Date();

    // Check if user is suspended platform-wide
    const suspended = await isUserSuspended(userId);
    if (suspended) {
      return reply.code(403).send({
        error: "not_accepting",
        message: "This breeder is not accepting messages at this time.",
      });
    }

    // Check if user is blocked by this breeder (MEDIUM level or higher)
    const blocked = await isBlocked(tenantId, userId, "MEDIUM");
    if (blocked) {
      return reply.code(403).send({
        error: "not_accepting",
        message: "This breeder is not accepting messages at this time.",
      });
    }

    try {
      // Get or create user's party in this breeder's tenant
      const userParty = await getOrCreateUserPartyInTenant(userId, tenantId);

      // Verify recipient party exists and belongs to this tenant
      const recipientParty = await prisma.party.findFirst({
        where: { id: Number(recipientPartyId), tenantId },
        select: { id: true, name: true, type: true },
      });

      if (!recipientParty) {
        return reply.code(404).send({ error: "recipient_not_found" });
      }

      // Check for existing thread between these parties
      const existingThread = await prisma.messageThread.findFirst({
        where: {
          tenantId,
          participants: {
            every: {
              partyId: { in: [userParty.id, Number(recipientPartyId)] },
            },
          },
        },
        include: {
          participants: true,
        },
      });

      // If thread exists with both participants, just return it (don't add another message)
      // User can compose their own message in the chat view
      if (existingThread) {
        const hasUser = existingThread.participants.some((p) => p.partyId === userParty.id);
        const hasRecipient = existingThread.participants.some((p) => p.partyId === Number(recipientPartyId));

        if (hasUser && hasRecipient) {
          // Return the existing thread without adding a duplicate message
          const thread = await prisma.messageThread.findUnique({
            where: { id: existingThread.id },
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

          return reply.send({ ok: true, thread, reused: true });
        }
      }

      // Create new thread
      const threadSubject = subject || (context?.programName ? `Inquiry about ${context.programName}` : null);

      const thread = await prisma.messageThread.create({
        data: {
          tenantId,
          subject: threadSubject,
          lastMessageAt: now,
          // Marketplace messages are always inbound (from buyers), track for response time
          firstInboundAt: now,
          participants: {
            create: [
              { partyId: userParty.id, lastReadAt: now },
              { partyId: Number(recipientPartyId) },
            ],
          },
          messages: {
            create: {
              senderPartyId: userParty.id,
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
            include: { senderParty: { select: { id: true, name: true, type: true } } },
          },
        },
      });

      return reply.send({ ok: true, thread });
    } catch (err: any) {
      if (err.statusCode) throw err;
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /messages/threads/:id/messages - Send message in existing thread
  // --------------------------------------------------------------------------
  app.post("/threads/:id/messages", { preHandler: authMiddleware }, async (req, reply) => {
    const userId = requireMarketplaceAuth(req);

    // Check if email is verified before allowing messages
    const user = await prisma.marketplaceUser.findUnique({
      where: { id: parseInt(userId, 10) },
      select: { emailVerified: true },
    });

    if (!user) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "User not found.",
      });
    }

    if (!user.emailVerified) {
      return reply.code(403).send({
        error: "email_verification_required",
        message: "Please verify your email address before sending messages.",
      });
    }

    const threadId = Number((req.params as any).id);
    const { body: messageBody } = req.body as any;

    // Validate thread ID is a valid number
    if (!Number.isFinite(threadId) || threadId <= 0) {
      return reply.code(400).send({ error: "invalid_thread_id" });
    }

    if (!messageBody) {
      return reply.code(400).send({ error: "missing_required_fields", required: ["body"] });
    }

    try {
      const userPartyIds = await getUserPartyIds(userId);

      const thread = await prisma.messageThread.findFirst({
        where: { id: threadId },
        select: { id: true, tenantId: true, participants: { select: { partyId: true } } },
      });

      if (!thread) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Check if user is suspended platform-wide
      const suspended = await isUserSuspended(userId);
      if (suspended) {
        return reply.code(403).send({
          error: "not_accepting",
          message: "This breeder is not accepting messages at this time.",
        });
      }

      // Check if user is blocked by this breeder (MEDIUM level or higher)
      const blocked = await isBlocked(thread.tenantId, userId, "MEDIUM");
      if (blocked) {
        return reply.code(403).send({
          error: "not_accepting",
          message: "This breeder is not accepting messages at this time.",
        });
      }

      // Find user's party in this thread
      const userParticipant = thread.participants.find((p) => userPartyIds.includes(p.partyId));
      if (!userParticipant) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const userPartyId = userParticipant.partyId;
      const now = new Date();

      const message = await prisma.message.create({
        data: {
          threadId,
          senderPartyId: userPartyId,
          body: messageBody,
        },
        include: {
          senderParty: { select: { id: true, name: true, type: true } },
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

      // Broadcast new message via WebSocket to breeder and all participants
      const participantPartyIds = thread.participants.map((p) => p.partyId);
      broadcastNewMessage(
        thread.tenantId,
        threadId,
        {
          id: message.id,
          body: message.body,
          senderPartyId: message.senderPartyId,
          createdAt: message.createdAt.toISOString(),
        },
        participantPartyIds
      );

      return reply.send({ ok: true, message });
    } catch (err: any) {
      if (err.statusCode) throw err;
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });
};

export default routes;
