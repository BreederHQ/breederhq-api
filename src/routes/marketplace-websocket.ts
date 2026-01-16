// src/routes/marketplace-websocket.ts
// WebSocket endpoint for marketplace real-time messaging

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { parseVerifiedSession } from "../utils/session.js";
import {
  registerMarketplaceClient,
  unregisterMarketplaceClient,
  getMarketplaceConnectionStats,
  type MarketplaceWebSocketClient,
} from "../services/marketplace-websocket-service.js";

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * WebSocket endpoint for marketplace real-time updates
   * Clients connect to: ws://marketplace.breederhq.test:6001/api/v1/marketplace/ws
   *
   * Authentication: Uses same session cookie as REST API
   * After connecting, client receives "connected" event with userId
   *
   * Events sent to client:
   * - new_message: New message in a transaction thread
   * - unread_count: Updated unread message counts
   * - transaction_update: Transaction status changed
   */
  app.get("/ws", { websocket: true }, async (socket, req) => {
    // Verify session using the same method as REST endpoints
    const session = parseVerifiedSession(req, "MARKETPLACE");

    if (!session) {
      socket.close(4001, "Unauthorized: Invalid session");
      return;
    }

    const userId = parseInt(session.userId, 10);

    // Get provider ID if user is a provider
    let providerId: number | undefined;
    try {
      const provider = await prisma.marketplaceProvider.findUnique({
        where: { userId },
        select: { id: true },
      });
      providerId = provider?.id;
    } catch (err) {
      console.error("[Marketplace WS] Error looking up provider:", err);
    }

    // Create client object
    const client: MarketplaceWebSocketClient = {
      ws: socket,
      userId,
      providerId,
    };

    // Register the client
    registerMarketplaceClient(client);

    // Send connection confirmation
    socket.send(
      JSON.stringify({
        event: "connected",
        payload: {
          userId,
          isProvider: !!providerId,
        },
      })
    );

    // Handle incoming messages
    socket.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle ping (keep-alive)
        if (message.type === "ping") {
          socket.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          return;
        }

        // Handle subscribe to specific transaction
        if (message.type === "subscribe" && message.transactionId) {
          // Verify user has access to this transaction
          const transactionId = BigInt(message.transactionId);
          const transaction = await prisma.marketplaceTransaction.findUnique({
            where: { id: transactionId },
            select: {
              clientId: true,
              provider: {
                select: { userId: true },
              },
            },
          });

          if (!transaction) {
            socket.send(
              JSON.stringify({
                event: "error",
                payload: { message: "Transaction not found" },
              })
            );
            return;
          }

          const isClient = transaction.clientId === userId;
          const isProvider = transaction.provider.userId === userId;

          if (!isClient && !isProvider) {
            socket.send(
              JSON.stringify({
                event: "error",
                payload: { message: "Not authorized to subscribe to this transaction" },
              })
            );
            return;
          }

          socket.send(
            JSON.stringify({
              event: "subscribed",
              payload: { transactionId: message.transactionId },
            })
          );
        }
      } catch (err) {
        // Ignore invalid messages
        console.error("[Marketplace WS] Message parse error:", err);
      }
    });

    // Handle disconnect
    socket.on("close", () => {
      unregisterMarketplaceClient(client);
    });

    socket.on("error", (err: Error) => {
      console.error("[Marketplace WS] Socket error:", err);
      unregisterMarketplaceClient(client);
    });
  });

  /**
   * Health check endpoint for marketplace WebSocket stats
   * GET /api/v1/marketplace/ws/stats
   */
  app.get("/ws/stats", async (req, reply) => {
    const stats = getMarketplaceConnectionStats();
    return reply.send({ ok: true, ...stats });
  });
};

export default routes;
