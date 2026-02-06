// @ts-nocheck - Marketplace admin features temporarily disabled pending migration
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
import { requireMarketplaceAuth, requireEmailVerified } from "../middleware/marketplace-auth.js";
import { broadcastTransactionMessage, broadcastUnreadCount } from "../services/marketplace-websocket-service.js";
import { sendNewMessageNotificationEmail } from "../services/marketplace-email-service.js";

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
      preHandler: [requireMarketplaceAuth, requireEmailVerified],
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

        // Broadcast to WebSocket clients
        // Get provider's user ID for WebSocket broadcast
        const provider = await prisma.marketplaceProvider.findUnique({
          where: { id: providerId },
          select: { userId: true },
        });

        if (provider) {
          // Broadcast message to both parties (excluding the sender)
          // Determine sender type based on who is sending
          const isProvider = provider.userId === userId;
          broadcastTransactionMessage(
            clientId, // buyer's userId (same as MarketplaceUser.id)
            provider.userId, // provider's userId
            userId, // sender's userId
            {
              id: String(message.id),
              threadId: finalThreadId,
              transactionId: String(transactionId),
              messageText: message.messageText,
              createdAt: message.createdAt.toISOString(),
              senderId: userId,
              senderType: isProvider ? "provider" : "client",
              source: "provider", // Identify this as a provider/marketplace message
              sender: {
                id: message.sender.id,
                firstName: message.sender.firstName,
                lastName: message.sender.lastName,
              },
            }
          );

          // Broadcast updated unread count to the recipient
          const recipientId = userId === clientId ? provider.userId : clientId;
          const unreadCount = Number(await prisma.marketplaceMessage.count({
            where: {
              thread: {
                OR: [{ clientId: recipientId }, { provider: { userId: recipientId } }],
              },
              senderId: { not: recipientId },
              readAt: null,
            },
          }));

          const unreadThreads = Number(await prisma.marketplaceMessageThread.count({
            where: {
              OR: [{ clientId: recipientId }, { provider: { userId: recipientId } }],
              messages: {
                some: {
                  senderId: { not: recipientId },
                  readAt: null,
                },
              },
            },
          }));

          broadcastUnreadCount(recipientId, {
            unreadThreads,
            totalUnreadMessages: unreadCount,
          });

          // Send email notification to recipient (async, don't wait)
          const recipientUser = await prisma.marketplaceUser.findUnique({
            where: { id: recipientId },
            select: { email: true, firstName: true, lastName: true },
          });

          // Get service title from transaction
          const txn = await prisma.marketplaceTransaction.findUnique({
            where: { id: transactionId },
            select: {
              serviceDescription: true,
              listing: { select: { title: true } },
            },
          });

          if (recipientUser && txn) {
            const senderName =
              `${message.sender.firstName || ""} ${message.sender.lastName || ""}`.trim() || "Someone";
            const recipientName = recipientUser.firstName || "there";
            const serviceTitle = txn.listing?.title || txn.serviceDescription.split(":")[0];

            sendNewMessageNotificationEmail({
              recipientEmail: recipientUser.email,
              recipientName,
              senderName,
              messagePreview: message.messageText,
              serviceTitle,
              transactionId: Number(transactionId),
            }).catch((err) => {
              console.error("Failed to send new message notification email:", err);
            });
          }
        }

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

  /* ───────────────────────── Buyer/Client Messaging ───────────────────────── */

  /**
   * GET /my-threads - List all message threads where user is the client (buyer)
   * This shows service provider inquiries and transaction messages from the buyer's perspective
   */
  app.get(
    "/my-threads",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: { max: 100, timeWindow: "1 minute" },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const { page = "1", limit = "20" } = req.query as {
        page?: string;
        limit?: string;
      };

      try {
        const where = {
          clientId: userId,
          status: "active" as const,
        };

        const [threads, total] = await Promise.all([
          prisma.marketplaceMessageThread.findMany({
            where,
            include: {
              provider: {
                select: {
                  id: true,
                  businessName: true,
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
              listing: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                },
              },
              transaction: {
                select: {
                  id: true,
                  status: true,
                },
              },
              messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
            orderBy: { lastMessageAt: "desc" },
            skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
            take: parseInt(limit, 10),
          }),
          prisma.marketplaceMessageThread.count({ where }),
        ]);

        // Calculate unread count per thread (messages from provider not read by client)
        const threadsWithUnread = await Promise.all(
          threads.map(async (thread) => {
            const unreadCount = Number(
              await prisma.marketplaceMessage.count({
                where: {
                  threadId: thread.id,
                  senderType: "provider",
                  readAt: null,
                },
              })
            );

            // Serialize BigInt fields
            const lastMessage = thread.messages[0]
              ? {
                  ...thread.messages[0],
                  id: String(thread.messages[0].id),
                }
              : null;

            const transaction = thread.transaction
              ? {
                  ...thread.transaction,
                  id: String(thread.transaction.id),
                }
              : null;

            return {
              id: thread.id,
              clientId: thread.clientId,
              providerId: thread.providerId,
              listingId: thread.listingId,
              transactionId: thread.transactionId ? String(thread.transactionId) : null,
              subject: thread.subject,
              status: thread.status,
              lastMessageAt: thread.lastMessageAt,
              createdAt: thread.createdAt,
              unreadCount,
              threadType: thread.transactionId ? "transaction" : "inquiry",
              lastMessage,
              provider: thread.provider,
              listing: thread.listing,
              transaction,
            };
          })
        );

        return reply.send({
          ok: true,
          threads: threadsWithUnread,
          total: Number(total),
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
        });
      } catch (err: any) {
        console.error("Error fetching buyer threads:", err);
        return reply.code(500).send({ error: "internal_error", message: err.message });
      }
    }
  );

  /**
   * GET /my-threads/:id - Get single thread with all messages (buyer view)
   */
  app.get(
    "/my-threads/:id",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: { max: 100, timeWindow: "1 minute" },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const { id } = req.params as { id: string };
      const threadId = parseInt(id, 10);

      if (isNaN(threadId)) {
        return reply.code(400).send({ error: "invalid_thread_id" });
      }

      try {
        const thread = await prisma.marketplaceMessageThread.findFirst({
          where: { id: threadId, clientId: userId },
          include: {
            provider: {
              select: {
                id: true,
                businessName: true,
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            listing: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
            transaction: {
              select: {
                id: true,
                status: true,
                servicePriceCents: true,
              },
            },
          },
        });

        if (!thread) {
          return reply.code(404).send({ error: "not_found", message: "Thread not found" });
        }

        const messages = await prisma.marketplaceMessage.findMany({
          where: { threadId, deletedAt: null },
          orderBy: { createdAt: "asc" },
        });

        // Auto-mark messages as read (messages from provider)
        await prisma.marketplaceMessage.updateMany({
          where: {
            threadId: thread.id,
            senderType: "provider",
            readAt: null,
          },
          data: {
            readAt: new Date(),
          },
        });

        // Serialize BigInt fields
        const transaction = thread.transaction
          ? {
              ...thread.transaction,
              id: String(thread.transaction.id),
            }
          : null;

        return reply.send({
          ok: true,
          thread: {
            id: thread.id,
            clientId: thread.clientId,
            providerId: thread.providerId,
            listingId: thread.listingId,
            transactionId: thread.transactionId ? String(thread.transactionId) : null,
            subject: thread.subject,
            status: thread.status,
            lastMessageAt: thread.lastMessageAt,
            createdAt: thread.createdAt,
            threadType: thread.transactionId ? "transaction" : "inquiry",
            provider: thread.provider,
            listing: thread.listing,
            transaction,
          },
          messages: messages.map((m) => ({
            id: String(m.id),
            threadId: m.threadId,
            senderId: m.senderId,
            senderType: m.senderType,
            messageText: m.messageText,
            createdAt: m.createdAt,
            readAt: m.readAt,
          })),
        });
      } catch (err: any) {
        console.error("Error fetching buyer thread:", err);
        return reply.code(500).send({ error: "internal_error", message: err.message });
      }
    }
  );

  /**
   * POST /my-threads/:id/messages - Send message as buyer/client
   */
  app.post(
    "/my-threads/:id/messages",
    {
      preHandler: [requireMarketplaceAuth, requireEmailVerified],
      config: {
        rateLimit: { max: 20, timeWindow: "1 hour" },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const { id } = req.params as { id: string };
      const threadId = parseInt(id, 10);
      const { messageText } = req.body as { messageText?: string };

      if (isNaN(threadId)) {
        return reply.code(400).send({ error: "invalid_thread_id" });
      }

      if (!messageText?.trim()) {
        return reply.code(400).send({ error: "message_required", message: "Message text is required" });
      }

      if (messageText.length > 5000) {
        return reply.code(400).send({
          error: "message_too_long",
          message: "Message must be 5000 characters or less",
        });
      }

      try {
        // Verify thread belongs to this buyer
        const thread = await prisma.marketplaceMessageThread.findFirst({
          where: { id: threadId, clientId: userId },
          include: {
            provider: {
              select: { userId: true },
            },
          },
        });

        if (!thread) {
          return reply.code(404).send({ error: "not_found", message: "Thread not found" });
        }

        // Create message
        const message = await prisma.marketplaceMessage.create({
          data: {
            threadId,
            senderId: userId,
            senderType: "client",
            messageText: messageText.trim(),
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        // Update thread lastMessageAt
        await prisma.marketplaceMessageThread.update({
          where: { id: threadId },
          data: { lastMessageAt: new Date() },
        });

        // Broadcast to WebSocket clients (if provider is connected)
        if (thread.provider?.userId) {
          broadcastTransactionMessage(
            userId, // buyer
            thread.provider.userId, // provider
            userId, // sender (buyer)
            {
              id: String(message.id),
              threadId,
              transactionId: thread.transactionId ? String(thread.transactionId) : null,
              messageText: message.messageText,
              createdAt: message.createdAt.toISOString(),
              senderId: message.senderId,
              senderType: message.senderType,
              source: "provider", // Identify this as a provider/marketplace message
              sender: {
                id: message.sender.id,
                firstName: message.sender.firstName,
                lastName: message.sender.lastName,
              },
            }
          );

          // Broadcast updated unread count to provider
          const providerUserId = thread.provider.userId;
          const unreadCount = Number(
            await prisma.marketplaceMessage.count({
              where: {
                thread: {
                  OR: [{ clientId: providerUserId }, { provider: { userId: providerUserId } }],
                },
                senderId: { not: providerUserId },
                readAt: null,
              },
            })
          );

          const unreadThreads = Number(
            await prisma.marketplaceMessageThread.count({
              where: {
                OR: [{ clientId: providerUserId }, { provider: { userId: providerUserId } }],
                messages: {
                  some: {
                    senderId: { not: providerUserId },
                    readAt: null,
                  },
                },
              },
            })
          );

          broadcastUnreadCount(providerUserId, {
            unreadThreads,
            totalUnreadMessages: unreadCount,
          });
        }

        return reply.send({
          ok: true,
          message: {
            id: String(message.id),
            threadId: message.threadId,
            senderId: message.senderId,
            senderType: message.senderType,
            messageText: message.messageText,
            createdAt: message.createdAt,
          },
        });
      } catch (err: any) {
        console.error("Error sending buyer message:", err);
        return reply.code(500).send({ error: "internal_error", message: err.message });
      }
    }
  );
};

export default routes;
