// src/routes/marketplace-transaction-messages.ts
// Marketplace transaction messaging endpoints
//
// Uses MarketplaceMessageThread and MarketplaceMessage models
// for direct client-provider communication on transactions.
//
// Endpoints:
//   GET  /transactions/:id/messages       - Get messages for a transaction
//   POST /transactions/:id/messages       - Send message on a transaction
//
// Security:
// - Requires marketplace authentication
// - User must be client or provider on the transaction

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";
import { requireMarketplaceAuth } from "../middleware/marketplace-auth.js";

/**
 * Convert BigInt fields to strings for JSON serialization
 */
function convertThreadToJSON(thread: any): any {
  if (!thread) return null;

  return {
    ...thread,
    transactionId: thread.transactionId ? String(thread.transactionId) : null,
    messages: thread.messages?.map((msg: any) => ({
      ...msg,
      id: String(msg.id),
    })) || [],
  };
}

/**
 * Verify user is participant in transaction (client or provider)
 */
async function verifyTransactionParticipant(
  transactionId: bigint,
  userId: number
): Promise<{ clientId: number; providerId: number; threadId: number | null }> {
  const transaction = await prisma.marketplaceTransaction.findUnique({
    where: { id: transactionId },
    select: {
      clientId: true,
      providerId: true,
      threads: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!transaction) {
    throw { statusCode: 404, error: "not_found", message: "Transaction not found" };
  }

  // Check if user is provider (via userId)
  const provider = await prisma.marketplaceProvider.findUnique({
    where: { id: transaction.providerId },
    select: { userId: true },
  });

  const isClient = transaction.clientId === userId;
  const isProvider = provider?.userId === userId;

  if (!isClient && !isProvider) {
    throw { statusCode: 403, error: "forbidden", message: "Not authorized to view this transaction" };
  }

  return {
    clientId: transaction.clientId,
    providerId: transaction.providerId,
    threadId: transaction.threads[0]?.id || null,
  };
}

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /messages/transaction-counts - Get unread counts for transaction messages
  // --------------------------------------------------------------------------
  app.get(
    "/messages/transaction-counts",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: { max: 100, timeWindow: "1 minute" },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;

      try {
        // Find all threads where user is either client or provider
        const threads = await prisma.marketplaceMessageThread.findMany({
          where: {
            OR: [
              { clientId: userId },
              {
                provider: {
                  userId: userId,
                },
              },
            ],
            status: "active",
          },
          include: {
            messages: {
              select: {
                id: true,
                senderId: true,
                readAt: true,
              },
            },
          },
        });

        let unreadThreadsCount = 0;
        let totalUnreadMessages = 0;

        for (const thread of threads) {
          // Count messages not sent by this user and not read
          const unreadCount = thread.messages.filter(
            (msg) => msg.senderId !== userId && !msg.readAt
          ).length;

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
        console.error("Error fetching transaction message counts:", err);
        return reply.code(500).send({ error: "internal_error", message: err.message });
      }
    }
  );

  // --------------------------------------------------------------------------
  // GET /transactions/:id/messages - Get messages for a transaction
  // --------------------------------------------------------------------------
  app.get(
    "/transactions/:id/messages",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: { max: 100, timeWindow: "1 minute" },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const transactionIdStr = (req.params as any).id;

      let transactionId: bigint;
      try {
        transactionId = BigInt(transactionIdStr);
      } catch {
        return reply.code(400).send({ error: "invalid_transaction_id" });
      }

      if (transactionId <= 0n) {
        return reply.code(400).send({ error: "invalid_transaction_id" });
      }

      try {
        // Verify user is participant
        const { threadId } = await verifyTransactionParticipant(transactionId, userId);

        if (!threadId) {
          // No thread exists yet, return empty
          return reply.send({
            ok: true,
            messages: [],
            thread: null,
          });
        }

        // Get thread with messages
        const thread = await prisma.marketplaceMessageThread.findUnique({
          where: { id: threadId },
          include: {
            client: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            provider: {
              select: {
                id: true,
                businessName: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: "asc" },
              include: {
                sender: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        });

        // Auto-mark messages as read (messages not sent by this user)
        if (thread) {
          await prisma.marketplaceMessage.updateMany({
            where: {
              threadId: thread.id,
              senderId: { not: userId },
              readAt: null,
            },
            data: {
              readAt: new Date(),
            },
          });
        }

        const convertedThread = convertThreadToJSON(thread);
        return reply.send({
          ok: true,
          thread: convertedThread,
          messages: convertedThread?.messages || [],
        });
      } catch (err: any) {
        if (err.statusCode) {
          return reply.code(err.statusCode).send({
            error: err.error,
            message: err.message,
          });
        }
        console.error("Error fetching transaction messages:", err);
        console.error("Error stack:", err.stack);
        return reply.code(500).send({ error: "internal_error", message: err.message, details: err.toString() });
      }
    }
  );

  // --------------------------------------------------------------------------
  // POST /transactions/:id/messages - Send message on a transaction
  // --------------------------------------------------------------------------
  app.post(
    "/transactions/:id/messages",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: { max: 20, timeWindow: "1 hour" },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const transactionIdStr = (req.params as any).id;
      const { messageText } = req.body as any;

      let transactionId: bigint;
      try {
        transactionId = BigInt(transactionIdStr);
      } catch {
        return reply.code(400).send({ error: "invalid_transaction_id" });
      }

      if (transactionId <= 0n) {
        return reply.code(400).send({ error: "invalid_transaction_id" });
      }

      if (!messageText || typeof messageText !== "string") {
        return reply.code(400).send({
          error: "missing_required_fields",
          required: ["messageText"],
        });
      }

      if (messageText.length > 5000) {
        return reply.code(400).send({
          error: "message_too_long",
          message: "Message must be 5000 characters or less",
        });
      }

      try {
        // Verify user is participant
        const { clientId, providerId, threadId } = await verifyTransactionParticipant(
          transactionId,
          userId
        );

        // If no thread exists, create one
        let finalThreadId = threadId;
        if (!finalThreadId) {
          const listing = await prisma.marketplaceTransaction.findUnique({
            where: { id: transactionId },
            select: {
              listingId: true,
              listing: { select: { title: true } },
            },
          });

          const thread = await prisma.marketplaceMessageThread.create({
            data: {
              clientId,
              providerId,
              listingId: listing?.listingId || null,
              transactionId: transactionId,
              subject: `Booking: ${listing?.listing?.title || "Service"}`,
              status: "active",
            },
          });

          finalThreadId = thread.id;
        }

        // Create message
        const message = await prisma.marketplaceMessage.create({
          data: {
            threadId: finalThreadId,
            senderId: userId,
            messageText,
          },
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        // Update thread lastMessageAt
        await prisma.marketplaceMessageThread.update({
          where: { id: finalThreadId },
          data: { lastMessageAt: new Date() },
        });

        return reply.send({
          ok: true,
          message: {
            ...message,
            id: String(message.id),
          },
        });
      } catch (err: any) {
        if (err.statusCode) {
          return reply.code(err.statusCode).send({
            error: err.error,
            message: err.message,
          });
        }
        console.error("Error sending transaction message:", err);
        return reply.code(500).send({ error: "internal_error", message: err.message });
      }
    }
  );
};

export default routes;
