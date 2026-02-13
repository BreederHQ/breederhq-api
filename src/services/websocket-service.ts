// src/services/websocket-service.ts
// WebSocket service for real-time messaging (Platform/Portal)
//
// Multi-instance support:
// - When REDIS_URL is set, messages are published to Redis pub/sub
// - Each instance subscribes and broadcasts to its local WebSocket connections
// - Without Redis, falls back to local-only (single instance)

import type { WebSocket } from "ws";
import {
  initRedisPubSub,
  isRedisPubSubEnabled,
  publish,
  onMessage,
  channels,
} from "./redis-pubsub.js";

export interface WebSocketClient {
  ws: WebSocket;
  tenantId: number;
  userId: string;
  partyId?: number;
}

// Legacy alias for internal use
type Client = WebSocketClient;

// ---------- Local Client Registry ----------
// Tracks WebSocket connections on THIS instance only

const tenantClients = new Map<number, Set<Client>>();
const partyClients = new Map<number, Set<Client>>();

// ---------- Redis Pub/Sub Initialization ----------

// Initialize Redis pub/sub and register message handlers
initRedisPubSub();

// Handle messages from other instances via Redis
onMessage((channel: string, message: string) => {
  try {
    const data = JSON.parse(message);

    // Tenant channel: ws:tenant:{tenantId}
    if (channel.startsWith("tenant:")) {
      const tenantId = parseInt(channel.split(":")[1], 10);
      if (!isNaN(tenantId)) {
        broadcastToTenantLocal(tenantId, data.event, data.payload);
      }
    }

    // Party channel: ws:party:{partyId}
    if (channel.startsWith("party:")) {
      const partyId = parseInt(channel.split(":")[1], 10);
      if (!isNaN(partyId)) {
        broadcastToPartyLocal(partyId, data.event, data.payload);
      }
    }
  } catch (err) {
    console.error("[WS] Error handling Redis message:", err);
  }
});

// ---------- Client Registration ----------

/**
 * Register a new WebSocket client
 */
export function registerClient(client: Client): void {
  // Add to tenant clients
  if (!tenantClients.has(client.tenantId)) {
    tenantClients.set(client.tenantId, new Set());
  }
  tenantClients.get(client.tenantId)!.add(client);

  // Add to party clients if partyId is provided
  if (client.partyId) {
    if (!partyClients.has(client.partyId)) {
      partyClients.set(client.partyId, new Set());
    }
    partyClients.get(client.partyId)!.add(client);
  }

  console.log(`[WS] Client registered: tenant=${client.tenantId}, user=${client.userId}, party=${client.partyId}`);
}

/**
 * Unregister a WebSocket client
 */
export function unregisterClient(client: Client): void {
  // Remove from tenant clients
  const tenantSet = tenantClients.get(client.tenantId);
  if (tenantSet) {
    tenantSet.delete(client);
    if (tenantSet.size === 0) {
      tenantClients.delete(client.tenantId);
    }
  }

  // Remove from party clients
  if (client.partyId) {
    const partySet = partyClients.get(client.partyId);
    if (partySet) {
      partySet.delete(client);
      if (partySet.size === 0) {
        partyClients.delete(client.partyId);
      }
    }
  }

  console.log(`[WS] Client unregistered: tenant=${client.tenantId}, user=${client.userId}`);
}

// ---------- Local Broadcast (this instance only) ----------

function broadcastToTenantLocal(tenantId: number, event: string, payload: unknown): number {
  const clients = tenantClients.get(tenantId);
  if (!clients || clients.size === 0) {
    return 0;
  }

  const message = JSON.stringify({ event, payload });
  let sent = 0;

  for (const client of clients) {
    if (client.ws.readyState === 1) { // WebSocket.OPEN
      client.ws.send(message);
      sent++;
    }
  }

  return sent;
}

function broadcastToPartyLocal(partyId: number, event: string, payload: unknown): number {
  const clients = partyClients.get(partyId);
  if (!clients || clients.size === 0) {
    return 0;
  }

  const message = JSON.stringify({ event, payload });
  let sent = 0;

  for (const client of clients) {
    if (client.ws.readyState === 1) { // WebSocket.OPEN
      client.ws.send(message);
      sent++;
    }
  }

  return sent;
}

// ---------- Public Broadcast API (with Redis pub/sub) ----------

/**
 * Broadcast a message to all clients in a tenant (across all instances)
 */
export function broadcastToTenant(tenantId: number, event: string, payload: unknown): void {
  // Always broadcast locally first
  const localSent = broadcastToTenantLocal(tenantId, event, payload);

  // Publish to Redis for other instances (fire and forget)
  if (isRedisPubSubEnabled()) {
    publish(channels.tenant(tenantId), { event, payload }).catch((err) => {
      console.error("[WS] Redis publish error:", err);
    });
  }

  console.log(`[WS] Broadcast to tenant ${tenantId}: event=${event}, localClients=${localSent}, redis=${isRedisPubSubEnabled()}`);
}

/**
 * Broadcast a message to a specific party (across all instances)
 */
export function broadcastToParty(partyId: number, event: string, payload: unknown): void {
  // Always broadcast locally first
  const localSent = broadcastToPartyLocal(partyId, event, payload);

  // Publish to Redis for other instances
  if (isRedisPubSubEnabled()) {
    publish(channels.party(partyId), { event, payload }).catch((err) => {
      console.error("[WS] Redis publish error:", err);
    });
  }

  console.log(`[WS] Broadcast to party ${partyId}: event=${event}, localClients=${localSent}, redis=${isRedisPubSubEnabled()}`);
}

// ---------- High-Level Broadcast Functions ----------

/**
 * Broadcast a new message event to relevant parties
 * - Broadcast to tenant (for staff in Communications Hub)
 * - Broadcast to specific parties involved in the thread
 */
export function broadcastNewMessage(
  tenantId: number,
  threadId: number,
  message: {
    id: number;
    body: string;
    senderPartyId: number;
    createdAt: string;
    attachmentFilename?: string | null;
    attachmentMime?: string | null;
    attachmentBytes?: number | null;
  },
  participantPartyIds: number[]
): void {
  const payload = {
    threadId,
    message,
  };

  // Broadcast to tenant staff
  broadcastToTenant(tenantId, "new_message", payload);

  // Broadcast to all participants (including marketplace users)
  for (const partyId of participantPartyIds) {
    broadcastToParty(partyId, "new_message", payload);
  }
}

/**
 * Broadcast thread update (read status, flag, archive)
 */
export function broadcastThreadUpdate(
  tenantId: number,
  threadId: number,
  update: {
    isRead?: boolean;
    flagged?: boolean;
    archived?: boolean;
  }
): void {
  broadcastToTenant(tenantId, "thread_update", { threadId, ...update });
}

/**
 * Broadcast new email sent
 */
export function broadcastNewEmail(
  tenantId: number,
  email: {
    id: string;
    type: "partyEmail" | "unlinkedEmail";
    toEmail: string;
    subject: string;
    preview: string;
    sentAt: string;
  }
): void {
  broadcastToTenant(tenantId, "new_email", email);
}

// ---------- Stats ----------

/**
 * Get connection stats (for debugging)
 */
export function getConnectionStats(): {
  tenants: number;
  totalClients: number;
  redisEnabled: boolean;
} {
  let totalClients = 0;
  for (const clients of tenantClients.values()) {
    totalClients += clients.size;
  }
  return {
    tenants: tenantClients.size,
    totalClients,
    redisEnabled: isRedisPubSubEnabled(),
  };
}
