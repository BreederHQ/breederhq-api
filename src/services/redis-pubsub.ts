// src/services/redis-pubsub.ts
// Shared Redis Pub/Sub for WebSocket cross-instance messaging
//
// When REDIS_URL is set, enables real-time messaging across multiple API instances.
// Each instance:
// - Subscribes to Redis channels for incoming messages
// - Publishes outgoing messages to Redis (other instances receive them)
// - Maintains local WebSocket connections and broadcasts to them
//
// Without Redis, falls back to local-only broadcasting (single instance).

import { Redis } from "ioredis";

// ---------- Configuration ----------
const REDIS_URL = process.env.REDIS_URL;
const CHANNEL_PREFIX = "ws:";

// ---------- Redis Clients ----------
// Pub/Sub requires separate connections for subscribe vs publish
let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let isInitialized = false;

// Message handlers registered by WebSocket services
type MessageHandler = (channel: string, message: string) => void;
const messageHandlers: Set<MessageHandler> = new Set();

// ---------- Initialization ----------

/**
 * Initialize Redis pub/sub connections.
 * Call this once at server startup.
 */
export function initRedisPubSub(): boolean {
  if (!REDIS_URL) {
    console.log("[Redis PubSub] No REDIS_URL configured - using local-only WebSocket messaging");
    return false;
  }

  if (isInitialized) {
    return true;
  }

  try {
    // Publisher client
    pubClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    // Subscriber client (separate connection required for subscribe mode)
    subClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    pubClient.on("error", (err: Error) => {
      console.error("[Redis PubSub] Publisher error:", err.message);
    });

    subClient.on("error", (err: Error) => {
      console.error("[Redis PubSub] Subscriber error:", err.message);
    });

    // Handle incoming messages from Redis
    subClient.on("pmessage", (_pattern: string, channel: string, message: string) => {
      for (const handler of messageHandlers) {
        try {
          handler(channel, message);
        } catch (err) {
          console.error("[Redis PubSub] Handler error:", err);
        }
      }
    });

    // Subscribe to all WebSocket channels using pattern
    subClient.psubscribe(`${CHANNEL_PREFIX}*`).then(() => {
      console.log("[Redis PubSub] Subscribed to WebSocket channels");
    }).catch((err: Error) => {
      console.error("[Redis PubSub] Subscribe error:", err.message);
    });

    isInitialized = true;
    console.log("[Redis PubSub] Initialized - WebSocket messages will be shared across instances");
    return true;
  } catch (err) {
    console.error("[Redis PubSub] Initialization failed:", err);
    return false;
  }
}

/**
 * Check if Redis pub/sub is available.
 */
export function isRedisPubSubEnabled(): boolean {
  return isInitialized && pubClient !== null && subClient !== null;
}

// ---------- Pub/Sub Operations ----------

/**
 * Publish a message to a Redis channel.
 * Other instances subscribed to this channel will receive it.
 */
export async function publish(channel: string, data: object): Promise<boolean> {
  if (!pubClient) {
    return false;
  }

  try {
    const fullChannel = CHANNEL_PREFIX + channel;
    const message = JSON.stringify(data);
    await pubClient.publish(fullChannel, message);
    return true;
  } catch (err) {
    console.error("[Redis PubSub] Publish error:", err);
    return false;
  }
}

/**
 * Register a handler for incoming Redis messages.
 * The handler receives the channel name (without prefix) and parsed message.
 */
export function onMessage(handler: MessageHandler): () => void {
  // Wrap handler to strip channel prefix
  const wrappedHandler: MessageHandler = (channel, message) => {
    const strippedChannel = channel.startsWith(CHANNEL_PREFIX)
      ? channel.slice(CHANNEL_PREFIX.length)
      : channel;
    handler(strippedChannel, message);
  };

  messageHandlers.add(wrappedHandler);

  // Return unsubscribe function
  return () => {
    messageHandlers.delete(wrappedHandler);
  };
}

// ---------- Channel Naming Conventions ----------

export const channels = {
  /** Channel for tenant-scoped broadcasts */
  tenant: (tenantId: number) => `tenant:${tenantId}`,

  /** Channel for party-scoped broadcasts (marketplace users linked to tenants) */
  party: (partyId: number) => `party:${partyId}`,

  /** Channel for marketplace user broadcasts */
  marketplaceUser: (userId: number) => `mp:user:${userId}`,

  /** Channel for marketplace provider broadcasts */
  marketplaceProvider: (providerId: number) => `mp:provider:${providerId}`,
};

// ---------- Cleanup ----------

/**
 * Close Redis connections (call on server shutdown).
 */
export async function closeRedisPubSub(): Promise<void> {
  if (subClient) {
    await subClient.punsubscribe();
    subClient.disconnect();
    subClient = null;
  }
  if (pubClient) {
    pubClient.disconnect();
    pubClient = null;
  }
  isInitialized = false;
  messageHandlers.clear();
}
