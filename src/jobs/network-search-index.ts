// src/jobs/network-search-index.ts
/**
 * Network Search Index Rebuild Cron Job
 *
 * Runs daily at 4:00 AM to rebuild the privacy-preserving search index.
 * The index stores aggregated traits per tenant/species/sex — never animal IDs.
 *
 * See: docs/codebase/architecture/NETWORK-BREEDING-DISCOVERY-SEARCH-INDEX.md
 */

import cron from "node-cron";
import { rebuildFullIndex } from "../services/network-search-index.js";

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

// Run daily at 4:00 AM
// Cron format: "minute hour day month weekday"
// "0 4 * * *" = 4:00 AM every day
const DEFAULT_CRON = "0 4 * * *";
const CRON_SCHEDULE = process.env.NETWORK_SEARCH_INDEX_CRON || DEFAULT_CRON;

// Enable/disable via environment variable
const CRON_ENABLED = process.env.NETWORK_SEARCH_INDEX_ENABLED !== "false"; // Default: enabled

// ────────────────────────────────────────────────────────────────────────────
// Job Function
// ────────────────────────────────────────────────────────────────────────────

export async function runNetworkSearchIndexJob(): Promise<void> {
  const startTime = new Date();
  console.log(`[network-search-index-job] Starting rebuild at ${startTime.toISOString()}`);

  try {
    await rebuildFullIndex();

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    console.log(`[network-search-index-job] Job complete in ${durationMs}ms`);
  } catch (err: any) {
    console.error(`[network-search-index-job] Job failed:`, err.message || err);
    console.error(err.stack);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Cron Scheduler
// ────────────────────────────────────────────────────────────────────────────

let cronJob: cron.ScheduledTask | null = null;

/**
 * Start the network search index rebuild cron job
 */
export function startNetworkSearchIndexJob(): void {
  if (!CRON_ENABLED) {
    console.log(`[network-search-index-job] Cron job disabled via NETWORK_SEARCH_INDEX_ENABLED=false`);
    return;
  }

  if (cronJob) {
    console.warn(`[network-search-index-job] Cron job already running, skipping start`);
    return;
  }

  // Validate cron schedule
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`[network-search-index-job] Invalid cron schedule: "${CRON_SCHEDULE}"`);
    console.error(`[network-search-index-job] Using default schedule: "${DEFAULT_CRON}"`);
    cronJob = cron.schedule(DEFAULT_CRON, runNetworkSearchIndexJob);
  } else {
    cronJob = cron.schedule(CRON_SCHEDULE, runNetworkSearchIndexJob);
  }

  console.log(`[network-search-index-job] Cron job started with schedule: "${CRON_SCHEDULE}"`);

  // Run initial rebuild on startup (30s delay to let server fully initialize)
  const STARTUP_REBUILD = process.env.NETWORK_SEARCH_INDEX_REBUILD_ON_START !== "false";
  if (STARTUP_REBUILD) {
    setTimeout(async () => {
      console.log(`[network-search-index-job] Running initial index build on startup...`);
      await runNetworkSearchIndexJob();
    }, 30_000);
  }
}

/**
 * Stop the network search index rebuild cron job
 */
export function stopNetworkSearchIndexJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log(`[network-search-index-job] Cron job stopped`);
  }
}

/**
 * Get cron job status
 */
export function getNetworkSearchIndexJobStatus(): {
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
