// src/jobs/listing-boost-expiration.ts
/**
 * Listing Boost Expiration Cron Job
 *
 * Runs hourly to:
 * 1. Expire active boosts past their expiresAt
 * 2. Expire paused boosts past their expiresAt
 * 3. Send 3-day expiry warning emails
 * 4. Process auto-renewals (send payment link email)
 *
 * This job is idempotent — safe to run multiple times without side effects.
 */

import cron from "node-cron";
import { processBoostExpirations } from "../services/listing-boost-service.js";

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_CRON = "0 * * * *"; // Every hour
const CRON_SCHEDULE =
  process.env.LISTING_BOOST_EXPIRATION_CRON || DEFAULT_CRON;
const CRON_ENABLED =
  process.env.LISTING_BOOST_EXPIRATION_ENABLED !== "false"; // Default: enabled

// ────────────────────────────────────────────────────────────────────────────
// Cron Scheduler
// ────────────────────────────────────────────────────────────────────────────

let cronJob: cron.ScheduledTask | null = null;

/**
 * Start the listing boost expiration cron job
 */
export function startListingBoostExpirationJob(): void {
  if (!CRON_ENABLED) {
    console.log(
      `[listing-boost-expiration] Cron job disabled via LISTING_BOOST_EXPIRATION_ENABLED=false`
    );
    return;
  }

  if (cronJob) {
    console.warn(
      `[listing-boost-expiration] Cron job already running, skipping start`
    );
    return;
  }

  const schedule = cron.validate(CRON_SCHEDULE)
    ? CRON_SCHEDULE
    : DEFAULT_CRON;

  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(
      `[listing-boost-expiration] Invalid cron schedule: "${CRON_SCHEDULE}", using default: "${DEFAULT_CRON}"`
    );
  }

  cronJob = cron.schedule(schedule, async () => {
    console.log(
      `[listing-boost-expiration] Starting job at ${new Date().toISOString()}`
    );
    const startTime = Date.now();

    const result = await processBoostExpirations();

    const duration = Date.now() - startTime;
    console.log(
      `[listing-boost-expiration] Complete in ${duration}ms`
    );
    console.log(`[listing-boost-expiration] Summary:`);
    console.log(`  - Expired: ${result.expiredCount}`);
    console.log(`  - Warnings sent: ${result.warningsSent}`);
    console.log(`  - Auto-renewals created: ${result.autoRenewalsCreated}`);
    if (result.errors > 0) {
      console.warn(`  - Errors: ${result.errors}`);
    }
  });

  console.log(
    `[listing-boost-expiration] Cron job started with schedule: "${schedule}"`
  );
}

/**
 * Stop the listing boost expiration cron job
 */
export function stopListingBoostExpirationJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log(`[listing-boost-expiration] Cron job stopped`);
  }
}

/**
 * Get cron job status
 */
export function getListingBoostExpirationJobStatus(): {
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
