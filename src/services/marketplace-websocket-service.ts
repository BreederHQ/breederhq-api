// src/services/marketplace-websocket-service.ts
// WebSocket service for marketplace real-time messaging
//
// Multi-instance support:
// - When REDIS_URL is set, messages are published to Redis pub/sub
// - Each instance subscribes and broadcasts to its local WebSocket connections
// - Without Redis, falls back to local-only (single instance)

import type { WebSocket } from "ws";
import {
  isRedisPubSubEnabled,
  publish,
  onMessage,
  channels,
} from "./redis-pubsub.js";

export interface MarketplaceWebSocketClient {
  ws: WebSocket;
  userId: number; // MarketplaceUser ID
  providerId?: number; // MarketplaceProvider ID (if user is a provider)
}

// ---------- Local Client Registry ----------
// Tracks WebSocket connections on THIS instance only

const userClients = new Map<number, Set<MarketplaceWebSocketClient>>();
const providerClients = new Map<number, Set<MarketplaceWebSocketClient>>();

// ---------- Redis Pub/Sub Message Handlers ----------

// Handle messages from other instances via Redis
onMessage((channel: string, message: string) => {
  try {
    const data = JSON.parse(message);

    // Marketplace user channel: ws:mp:user:{userId}
    if (channel.startsWith("mp:user:")) {
      const userId = parseInt(channel.split(":")[2], 10);
      if (!isNaN(userId)) {
        sendToUserLocal(userId, data.event, data.payload);
      }
    }

    // Marketplace provider channel: ws:mp:provider:{providerId}
    if (channel.startsWith("mp:provider:")) {
      const providerId = parseInt(channel.split(":")[2], 10);
      if (!isNaN(providerId)) {
        sendToProviderLocal(providerId, data.event, data.payload);
      }
    }
  } catch (err) {
    console.error("[Marketplace WS] Error handling Redis message:", err);
  }
});

// ---------- Client Registration ----------

/**
 * Register a new marketplace WebSocket client
 */
export function registerMarketplaceClient(client: MarketplaceWebSocketClient): void {
  // Add to user clients
  if (!userClients.has(client.userId)) {
    userClients.set(client.userId, new Set());
  }
  userClients.get(client.userId)!.add(client);

  // Add to provider clients if applicable
  if (client.providerId) {
    if (!providerClients.has(client.providerId)) {
      providerClients.set(client.providerId, new Set());
    }
    providerClients.get(client.providerId)!.add(client);
  }

  console.log(
    `[Marketplace WS] Client registered: userId=${client.userId}, providerId=${client.providerId || "none"}`
  );
}

/**
 * Unregister a marketplace WebSocket client
 */
export function unregisterMarketplaceClient(client: MarketplaceWebSocketClient): void {
  // Remove from user clients
  const userSet = userClients.get(client.userId);
  if (userSet) {
    userSet.delete(client);
    if (userSet.size === 0) {
      userClients.delete(client.userId);
    }
  }

  // Remove from provider clients
  if (client.providerId) {
    const providerSet = providerClients.get(client.providerId);
    if (providerSet) {
      providerSet.delete(client);
      if (providerSet.size === 0) {
        providerClients.delete(client.providerId);
      }
    }
  }

  console.log(`[Marketplace WS] Client unregistered: userId=${client.userId}`);
}

// ---------- Local Send (this instance only) ----------

function sendToUserLocal(userId: number, event: string, payload: unknown): number {
  const clients = userClients.get(userId);
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

function sendToProviderLocal(providerId: number, event: string, payload: unknown): number {
  const clients = providerClients.get(providerId);
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

// ---------- Public Send API (with Redis pub/sub) ----------

/**
 * Send a message to a specific user (all their connected devices, across all instances)
 */
export function sendToUser(userId: number, event: string, payload: unknown): void {
  // Always send locally first
  const localSent = sendToUserLocal(userId, event, payload);

  // Publish to Redis for other instances
  if (isRedisPubSubEnabled()) {
    publish(channels.marketplaceUser(userId), { event, payload }).catch((err) => {
      console.error("[Marketplace WS] Redis publish error:", err);
    });
  }

  if (localSent > 0) {
    console.log(`[Marketplace WS] Sent to user ${userId}: event=${event}, devices=${localSent}, redis=${isRedisPubSubEnabled()}`);
  }
}

/**
 * Send a message to a provider (all their connected devices, across all instances)
 */
export function sendToProvider(providerId: number, event: string, payload: unknown): void {
  // Always send locally first
  const localSent = sendToProviderLocal(providerId, event, payload);

  // Publish to Redis for other instances
  if (isRedisPubSubEnabled()) {
    publish(channels.marketplaceProvider(providerId), { event, payload }).catch((err) => {
      console.error("[Marketplace WS] Redis publish error:", err);
    });
  }

  if (localSent > 0) {
    console.log(`[Marketplace WS] Sent to provider ${providerId}: event=${event}, devices=${localSent}, redis=${isRedisPubSubEnabled()}`);
  }
}

// ---------- High-Level Broadcast Functions ----------

/**
 * Broadcast new message notification to transaction participants
 * - Sends to the client (buyer)
 * - Sends to the provider
 */
export function broadcastNewTransactionMessage(
  clientId: number,
  providerId: number,
  message: {
    id: string;
    threadId: number;
    transactionId: string;
    senderId: number;
    messageText: string;
    createdAt: string;
    sender: {
      id: number;
      firstName: string | null;
      lastName: string | null;
    };
  }
): void {
  const payload = {
    type: "transaction_message",
    ...message,
  };

  // Send to buyer (client)
  sendToUser(clientId, "new_message", payload);

  // Send to provider's user account
  // Note: providerId is the provider record ID, we need to look up the userId
  // This is handled by the caller who has access to the provider's userId
}

/**
 * Broadcast new message to both transaction participants
 * This version takes explicit userIds for both parties
 */
export function broadcastTransactionMessage(
  buyerUserId: number,
  providerUserId: number,
  senderId: number,
  message: {
    id: string;
    threadId: number;
    transactionId: string;
    messageText: string;
    createdAt: string;
    sender: {
      id: number;
      firstName: string | null;
      lastName: string | null;
    };
  }
): void {
  const payload = {
    type: "transaction_message",
    ...message,
  };

  // Send to buyer (if they didn't send the message)
  if (buyerUserId !== senderId) {
    sendToUser(buyerUserId, "new_message", payload);
  }

  // Send to provider (if they didn't send the message)
  if (providerUserId !== senderId) {
    sendToUser(providerUserId, "new_message", payload);
  }
}

/**
 * Broadcast unread count update to a user
 */
export function broadcastUnreadCount(
  userId: number,
  counts: {
    unreadThreads: number;
    totalUnreadMessages: number;
  }
): void {
  sendToUser(userId, "unread_count", counts);
}

/**
 * Broadcast transaction status update
 */
export function broadcastTransactionUpdate(
  buyerUserId: number,
  providerUserId: number,
  transaction: {
    id: string;
    status: string;
    updatedAt: string;
  }
): void {
  const payload = {
    type: "transaction_update",
    ...transaction,
  };

  sendToUser(buyerUserId, "transaction_update", payload);
  sendToUser(providerUserId, "transaction_update", payload);
}

/**
 * Broadcast a breeder message to a marketplace user.
 * Used when a breeder sends a message to a buyer via the platform's Communications Hub.
 * Looks up the MarketplaceUser by email from the Party record.
 *
 * @param marketplaceUserId - The MarketplaceUser.id of the recipient
 * @param threadId - The MessageThread ID (breeder_XX format will be added by frontend)
 * @param message - The message details
 */
export function broadcastBreederMessageToMarketplaceUser(
  marketplaceUserId: number,
  threadId: number,
  message: {
    id: number;
    body: string;
    senderPartyId: number;
    senderParty?: { type: string };
    createdAt: string;
  }
): void {
  const payload = {
    threadId,
    source: "breeder" as const,
    message: {
      id: message.id,
      body: message.body,
      senderPartyId: message.senderPartyId,
      senderParty: message.senderParty,
      createdAt: message.createdAt,
    },
  };

  sendToUser(marketplaceUserId, "new_message", payload);
}

// ---------- Stats ----------

/**
 * Get marketplace connection stats (for debugging)
 */
export function getMarketplaceConnectionStats(): {
  users: number;
  providers: number;
  totalClients: number;
  redisEnabled: boolean;
} {
  let totalClients = 0;
  for (const clients of userClients.values()) {
    totalClients += clients.size;
  }
  return {
    users: userClients.size,
    providers: providerClients.size,
    totalClients,
    redisEnabled: isRedisPubSubEnabled(),
  };
}
