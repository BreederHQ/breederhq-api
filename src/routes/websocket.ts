// src/routes/websocket.ts
// WebSocket endpoint for real-time messaging

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { parseVerifiedSession, Surface as SessionSurface } from "../utils/session.js";
import { deriveSurface } from "../middleware/actor-context.js";
import { registerClient, unregisterClient, getConnectionStats, type WebSocketClient } from "../services/websocket-service.js";
import prisma from "../prisma.js";

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // WebSocket endpoint for real-time updates
  // Clients connect to: ws://host/api/v1/ws/messages
  app.get("/ws/messages", { websocket: true }, async (socket, req) => {
    // Authenticate the connection using session cookie
    const surface = deriveSurface(req) as SessionSurface;
    const sess = parseVerifiedSession(req, surface);

    if (!sess) {
      socket.close(4001, "Unauthorized");
      return;
    }

    // Get tenant context from header or query param (WebSocket doesn't support custom headers in browsers)
    let tenantId = Number(req.headers["x-tenant-id"]) || null;
    if (!tenantId) {
      // Try query param as fallback for browser WebSocket connections
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      tenantId = Number(url.searchParams.get("tenantId")) || null;
    }

    // Client will be registered after auth message if tenantId not provided initially
    let client: WebSocketClient | null = null;

    // Helper to complete registration
    const completeRegistration = async (tid: number) => {
      if (client) return; // Already registered

      // Get user's party ID (if they have one in this tenant)
      let partyId: number | undefined;
      try {
        // First try to get from TenantMembership
        const membership = await prisma.tenantMembership.findFirst({
          where: { userId: sess.userId, tenantId: tid },
        });

        if (membership) {
          // For staff, get the organization's party ID
          const org = await prisma.organization.findFirst({
            where: { tenantId: tid },
            select: { partyId: true },
          });
          partyId = org?.partyId ?? undefined;
        }
      } catch (err) {
        console.error("[WS] Error getting party ID:", err);
      }

      client = {
        ws: socket,
        tenantId: tid,
        userId: sess.userId,
        partyId,
      };

      // Register the client
      registerClient(client);

      // Send connection confirmation
      socket.send(JSON.stringify({
        event: "connected",
        payload: { tenantId: tid, userId: sess.userId },
      }));

      console.log(`[WS] Client registered: tenant=${tid}, user=${sess.userId}, party=${partyId}`);
    };

    // If tenantId was provided upfront, register immediately
    if (tenantId) {
      await completeRegistration(tenantId);
    }

    // Handle incoming messages
    socket.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle auth message (for browser clients that can't set headers)
        if (message.type === "auth" && message.tenantId && !client) {
          await completeRegistration(Number(message.tenantId));
          return;
        }

        // Handle ping
        if (message.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // Ignore invalid messages
      }
    });

    // Handle disconnect
    socket.on("close", () => {
      if (client) {
        unregisterClient(client);
      }
    });

    socket.on("error", (err: Error) => {
      console.error("[WS] Socket error:", err);
      if (client) {
        unregisterClient(client);
      }
    });
  });

  // Health check endpoint for WebSocket stats
  app.get("/ws/stats", async (req, reply) => {
    const stats = getConnectionStats();
    return reply.send({ ok: true, ...stats });
  });
};

export default routes;
