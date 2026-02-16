// src/jobs/share-code-expiration.ts
/**
 * Share Code Expiration Cron Job
 *
 * Runs hourly to:
 * 1. Mark share codes as EXPIRED when their expiresAt timestamp has passed
 * 2. Mark share codes as MAX_USES_REACHED when useCount >= maxUses
 *
 * See: docs/codebase/architecture/NETWORK-BREEDING-DISCOVERY-JOBS.md
 */

import cron from "node-cron";
import prisma from "../prisma.js";

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_CRON = "0 * * * *"; // Every hour
const CRON_SCHEDULE =
  process.env.SHARE_CODE_EXPIRATION_CRON || DEFAULT_CRON;
const CRON_ENABLED =
  process.env.SHARE_CODE_EXPIRATION_ENABLED !== "false"; // Default: enabled

// ────────────────────────────────────────────────────────────────────────────
// Result type
// ────────────────────────────────────────────────────────────────────────────

interface ShareCodeExpirationResult {
  expiredCount: number;
  maxUsesCount: number;
  errors: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Job Function
// ────────────────────────────────────────────────────────────────────────────

export async function runShareCodeExpiration(): Promise<ShareCodeExpirationResult> {
  const startTime = Date.now();
  const result: ShareCodeExpirationResult = {
    expiredCount: 0,
    maxUsesCount: 0,
    errors: 0,
  };

  try {
    // 1. Mark expired codes (past expiresAt)
    const expiredResult = await prisma.shareCode.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: {
          not: null,
          lt: new Date(),
        },
      },
      data: {
        status: "EXPIRED",
      },
    });
    result.expiredCount = expiredResult.count;

    // 2. Mark max-uses-reached codes
    const maxUsesResult = await prisma.$executeRaw`
      UPDATE "ShareCode"
      SET status = 'MAX_USES_REACHED'
      WHERE status = 'ACTIVE'
        AND "maxUses" IS NOT NULL
        AND "useCount" >= "maxUses"
    `;
    result.maxUsesCount = maxUsesResult;

    const duration = Date.now() - startTime;
    console.log(`[share-code-expiration] Complete in ${duration}ms`);
    console.log(`[share-code-expiration] Summary:`);
    console.log(`  - Expired: ${result.expiredCount}`);
    console.log(`  - Max uses reached: ${result.maxUsesCount}`);
  } catch (err: any) {
    result.errors++;
    console.error(`[share-code-expiration] Error:`, err.message);
    console.error(err.stack);
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Cron Scheduler
// ────────────────────────────────────────────────────────────────────────────

let cronJob: cron.ScheduledTask | null = null;

/**
 * Start the share code expiration cron job
 */
export function startShareCodeExpirationJob(): void {
  if (!CRON_ENABLED) {
    console.log(
      `[share-code-expiration] Cron job disabled via SHARE_CODE_EXPIRATION_ENABLED=false`
    );
    return;
  }

  if (cronJob) {
    console.warn(
      `[share-code-expiration] Cron job already running, skipping start`
    );
    return;
  }

  // Validate cron schedule
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(
      `[share-code-expiration] Invalid cron schedule: "${CRON_SCHEDULE}"`
    );
    console.error(
      `[share-code-expiration] Using default schedule: "${DEFAULT_CRON}"`
    );
    cronJob = cron.schedule(DEFAULT_CRON, async () => {
      console.log(
        `[share-code-expiration] Starting job at ${new Date().toISOString()}`
      );
      await runShareCodeExpiration();
    });
  } else {
    cronJob = cron.schedule(CRON_SCHEDULE, async () => {
      console.log(
        `[share-code-expiration] Starting job at ${new Date().toISOString()}`
      );
      await runShareCodeExpiration();
    });
  }

  console.log(
    `[share-code-expiration] Cron job started with schedule: "${CRON_SCHEDULE}"`
  );
}

/**
 * Stop the share code expiration cron job
 */
export function stopShareCodeExpirationJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log(`[share-code-expiration] Cron job stopped`);
  }
}

/**
 * Get cron job status
 */
export function getShareCodeExpirationJobStatus(): {
  enabled: boolean;
  running: boolean;
  schedule: string;
} {
  return {
    enabled: CRON_ENABLED,
    running: cronJob !== null,
    schedule: CRON_SCHEDULE,
  };
}
