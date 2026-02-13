// src/jobs/animal-access-expiration.ts
/**
 * Animal Access Expiration Cron Job
 *
 * Runs hourly to mark AnimalAccess records as EXPIRED
 * when their expiresAt timestamp has passed.
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
  process.env.ANIMAL_ACCESS_EXPIRATION_CRON || DEFAULT_CRON;
const CRON_ENABLED =
  process.env.ANIMAL_ACCESS_EXPIRATION_ENABLED !== "false"; // Default: enabled

// ────────────────────────────────────────────────────────────────────────────
// Result type
// ────────────────────────────────────────────────────────────────────────────

interface AnimalAccessExpirationResult {
  expiredCount: number;
  errors: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Job Function
// ────────────────────────────────────────────────────────────────────────────

export async function runAnimalAccessExpiration(): Promise<AnimalAccessExpirationResult> {
  const startTime = Date.now();
  const result: AnimalAccessExpirationResult = {
    expiredCount: 0,
    errors: 0,
  };

  try {
    // Mark expired access records
    const expiredResult = await prisma.animalAccess.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: {
          not: null,
          lt: new Date(),
        },
      },
      data: {
        status: "EXPIRED",
        updatedAt: new Date(),
      },
    });
    result.expiredCount = expiredResult.count;

    const duration = Date.now() - startTime;
    console.log(`[animal-access-expiration] Complete in ${duration}ms`);
    console.log(
      `[animal-access-expiration] Expired: ${result.expiredCount}`
    );
  } catch (err: any) {
    result.errors++;
    console.error(`[animal-access-expiration] Error:`, err.message);
    console.error(err.stack);
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Cron Scheduler
// ────────────────────────────────────────────────────────────────────────────

let cronJob: cron.ScheduledTask | null = null;

/**
 * Start the animal access expiration cron job
 */
export function startAnimalAccessExpirationJob(): void {
  if (!CRON_ENABLED) {
    console.log(
      `[animal-access-expiration] Cron job disabled via ANIMAL_ACCESS_EXPIRATION_ENABLED=false`
    );
    return;
  }

  if (cronJob) {
    console.warn(
      `[animal-access-expiration] Cron job already running, skipping start`
    );
    return;
  }

  // Validate cron schedule
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(
      `[animal-access-expiration] Invalid cron schedule: "${CRON_SCHEDULE}"`
    );
    console.error(
      `[animal-access-expiration] Using default schedule: "${DEFAULT_CRON}"`
    );
    cronJob = cron.schedule(DEFAULT_CRON, async () => {
      console.log(
        `[animal-access-expiration] Starting job at ${new Date().toISOString()}`
      );
      await runAnimalAccessExpiration();
    });
  } else {
    cronJob = cron.schedule(CRON_SCHEDULE, async () => {
      console.log(
        `[animal-access-expiration] Starting job at ${new Date().toISOString()}`
      );
      await runAnimalAccessExpiration();
    });
  }

  console.log(
    `[animal-access-expiration] Cron job started with schedule: "${CRON_SCHEDULE}"`
  );
}

/**
 * Stop the animal access expiration cron job
 */
export function stopAnimalAccessExpirationJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log(`[animal-access-expiration] Cron job stopped`);
  }
}

/**
 * Get cron job status
 */
export function getAnimalAccessExpirationJobStatus(): {
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
