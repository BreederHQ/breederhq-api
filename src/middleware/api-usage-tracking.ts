/**
 * API Usage Tracking Middleware
 *
 * Tracks API calls per tenant for billing and usage analytics.
 * Uses in-memory batching to minimize database writes, then flushes periodically.
 *
 * Design considerations:
 * - Batches writes in memory to avoid DB hit per request
 * - Flushes to DB every 60 seconds or when batch size exceeds threshold
 * - Only tracks authenticated requests with tenant context
 * - Excludes health checks and internal routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { recordUsage } from "../services/subscription/usage-service.js";

// ---------- Configuration ----------

const FLUSH_INTERVAL_MS = 60_000; // Flush every 60 seconds
const MAX_BATCH_SIZE = 100; // Flush if batch exceeds this size
const EXCLUDED_PATH_PREFIXES = [
  "/healthz",
  "/health",
  "/__diag",
  "/api/v1/health",
  "/api/v1/usage", // Don't track usage endpoint itself
];

// ---------- In-Memory Buffer ----------

interface UsageBatch {
  tenantId: number;
  count: number;
  lastUpdated: Date;
}

// Map of tenantId -> accumulated count
const usageBuffer: Map<number, UsageBatch> = new Map();
let flushTimer: ReturnType<typeof setInterval> | null = null;

// ---------- Flush Logic ----------

/**
 * Flush accumulated usage counts to the database.
 * Called periodically and when batch size threshold is reached.
 */
async function flushUsageBuffer(): Promise<void> {
  if (usageBuffer.size === 0) return;

  // Snapshot and clear buffer atomically
  const entries = Array.from(usageBuffer.entries());
  usageBuffer.clear();

  // Write to database in parallel (with concurrency limit)
  const CONCURRENCY = 5;
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ([tenantId, data]) => {
        try {
          await recordUsage(tenantId, "API_CALLS", data.count, {
            additionalData: {
              batchedAt: data.lastUpdated.toISOString(),
              source: "api-usage-tracking",
            },
          });
        } catch (error) {
          // Log but don't throw - usage tracking should not break the app
          console.error(`Failed to record API usage for tenant ${tenantId}:`, error);
          // Re-add to buffer for retry on next flush
          const existing = usageBuffer.get(tenantId);
          usageBuffer.set(tenantId, {
            tenantId,
            count: (existing?.count ?? 0) + data.count,
            lastUpdated: new Date(),
          });
        }
      })
    );
  }
}

/**
 * Check if a path should be excluded from tracking.
 */
function isExcludedPath(path: string): boolean {
  for (const prefix of EXCLUDED_PATH_PREFIXES) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

/**
 * Increment the usage count for a tenant.
 */
function incrementUsage(tenantId: number): void {
  const existing = usageBuffer.get(tenantId);
  usageBuffer.set(tenantId, {
    tenantId,
    count: (existing?.count ?? 0) + 1,
    lastUpdated: new Date(),
  });

  // Check if we need to flush early due to batch size
  let totalCount = 0;
  for (const batch of usageBuffer.values()) {
    totalCount += batch.count;
  }
  if (totalCount >= MAX_BATCH_SIZE) {
    // Flush async, don't block the request
    flushUsageBuffer().catch((err) =>
      console.error("Error during early flush:", err)
    );
  }
}

// ---------- Fastify Plugin ----------

/**
 * Register API usage tracking on a Fastify instance.
 *
 * Usage:
 *   import apiUsageTracking from './middleware/api-usage-tracking.js';
 *   fastify.register(apiUsageTracking);
 */
export default async function apiUsageTracking(app: FastifyInstance): Promise<void> {
  // Start the periodic flush timer
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      flushUsageBuffer().catch((err) =>
        console.error("Error during periodic flush:", err)
      );
    }, FLUSH_INTERVAL_MS);

    // Ensure timer doesn't prevent process exit
    if (flushTimer.unref) {
      flushTimer.unref();
    }
  }

  // Track successful API responses
  app.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
    // Only track authenticated requests with tenant context
    const tenantId = (req as any).tenantId;
    if (!tenantId || typeof tenantId !== "number") {
      return;
    }

    // Exclude health checks and internal routes
    const path = req.url.split("?")[0] || "";
    if (isExcludedPath(path)) {
      return;
    }

    // Only track successful responses (2xx, 3xx)
    // Don't track errors - they're not "usage"
    if (reply.statusCode >= 400) {
      return;
    }

    // Increment usage counter
    incrementUsage(tenantId);
  });

  // Flush on server close
  app.addHook("onClose", async () => {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    // Final flush
    await flushUsageBuffer();
  });
}

/**
 * Manually flush the usage buffer (for testing or graceful shutdown).
 */
export async function forceFlushUsageBuffer(): Promise<void> {
  await flushUsageBuffer();
}

/**
 * Get current buffer stats (for monitoring/debugging).
 */
export function getUsageBufferStats(): { tenantCount: number; totalCalls: number } {
  let totalCalls = 0;
  for (const batch of usageBuffer.values()) {
    totalCalls += batch.count;
  }
  return {
    tenantCount: usageBuffer.size,
    totalCalls,
  };
}
