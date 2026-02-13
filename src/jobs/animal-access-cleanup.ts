// src/jobs/animal-access-cleanup.ts
/**
 * Animal Access Cleanup Cron Job
 *
 * Runs daily at 3:00 AM to hard-delete AnimalAccess records in OWNER_DELETED
 * status that are older than the retention period (default: 30 days).
 * Also cascading-deletes associated AnimalAccessConversation records.
 *
 * See: docs/codebase/architecture/NETWORK-BREEDING-DISCOVERY-JOBS.md
 */

import cron from "node-cron";
import prisma from "../prisma.js";

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

// Run daily at 3:00 AM
// Cron format: "minute hour day month weekday"
// "0 3 * * *" = 3:00 AM every day
const DEFAULT_CRON = "0 3 * * *";
const CRON_SCHEDULE = process.env.ANIMAL_ACCESS_CLEANUP_CRON || DEFAULT_CRON;

// Enable/disable via environment variable
const CRON_ENABLED = process.env.ANIMAL_ACCESS_CLEANUP_ENABLED !== "false"; // Default: enabled

// How many days to retain OWNER_DELETED records before hard-deleting
const DEFAULT_RETENTION_DAYS = 30;

// ────────────────────────────────────────────────────────────────────────────
// Result type
// ────────────────────────────────────────────────────────────────────────────

interface AnimalAccessCleanupResult {
  conversationsDeleted: number;
  accessRecordsDeleted: number;
  errors: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Job Function
// ────────────────────────────────────────────────────────────────────────────

export async function runAnimalAccessCleanupJob(): Promise<AnimalAccessCleanupResult> {
  const startTime = new Date();
  console.log(`[animal-access-cleanup-job] Starting cleanup at ${startTime.toISOString()}`);

  const retentionDays = parseInt(
    process.env.ANIMAL_ACCESS_CLEANUP_RETENTION_DAYS || String(DEFAULT_RETENTION_DAYS),
    10,
  );

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result: AnimalAccessCleanupResult = {
    conversationsDeleted: 0,
    accessRecordsDeleted: 0,
    errors: 0,
  };

  try {
    // Find OWNER_DELETED records older than retention period
    const recordsToDelete = await prisma.animalAccess.findMany({
      where: {
        status: "OWNER_DELETED",
        deletedAt: { lt: cutoffDate },
      },
      select: { id: true },
    });

    if (recordsToDelete.length === 0) {
      console.log(`[animal-access-cleanup-job] No records to clean up`);
      return result;
    }

    const idsToDelete = recordsToDelete.map((r) => r.id);

    // Delete in transaction: conversations first (FK), then access records
    await prisma.$transaction(async (tx) => {
      // 1. Delete associated conversations (cascading)
      const convResult = await tx.animalAccessConversation.deleteMany({
        where: { animalAccessId: { in: idsToDelete } },
      });
      result.conversationsDeleted = convResult.count;

      // 2. Delete the access records themselves
      const accessResult = await tx.animalAccess.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      result.accessRecordsDeleted = accessResult.count;
    });

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    console.log(`[animal-access-cleanup-job] Job complete in ${durationMs}ms`);
    console.log(`[animal-access-cleanup-job] Summary:
  - Retention period: ${retentionDays} days
  - Cutoff date: ${cutoffDate.toISOString()}
  - Access records deleted: ${result.accessRecordsDeleted}
  - Conversations deleted: ${result.conversationsDeleted}`);
  } catch (err: any) {
    result.errors++;
    console.error(`[animal-access-cleanup-job] Job failed:`, err.message || err);
    console.error(err.stack);
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Cron Scheduler
// ────────────────────────────────────────────────────────────────────────────

let cronJob: cron.ScheduledTask | null = null;

/**
 * Start the animal access cleanup cron job
 */
export function startAnimalAccessCleanupJob(): void {
  if (!CRON_ENABLED) {
    console.log(`[animal-access-cleanup-job] Cron job disabled via ANIMAL_ACCESS_CLEANUP_ENABLED=false`);
    return;
  }

  if (cronJob) {
    console.warn(`[animal-access-cleanup-job] Cron job already running, skipping start`);
    return;
  }

  // Validate cron schedule
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`[animal-access-cleanup-job] Invalid cron schedule: "${CRON_SCHEDULE}"`);
    console.error(`[animal-access-cleanup-job] Using default schedule: "${DEFAULT_CRON}"`);
    cronJob = cron.schedule(DEFAULT_CRON, runAnimalAccessCleanupJob);
  } else {
    cronJob = cron.schedule(CRON_SCHEDULE, runAnimalAccessCleanupJob);
  }

  console.log(`[animal-access-cleanup-job] Cron job started with schedule: "${CRON_SCHEDULE}"`);
}

/**
 * Stop the animal access cleanup cron job
 */
export function stopAnimalAccessCleanupJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log(`[animal-access-cleanup-job] Cron job stopped`);
  }
}

/**
 * Get cron job status
 */
export function getAnimalAccessCleanupJobStatus(): {
  enabled: boolean;
  running: boolean;
  schedule: string;
  retentionDays: number;
} {
  return {
    enabled: CRON_ENABLED,
    running: cronJob !== null,
    schedule: CRON_SCHEDULE,
    retentionDays: parseInt(
      process.env.ANIMAL_ACCESS_CLEANUP_RETENTION_DAYS || String(DEFAULT_RETENTION_DAYS),
      10,
    ),
  };
}
