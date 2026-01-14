// src/jobs/notification-scan.ts
/**
 * Notification Scan Cron Job
 *
 * Runs daily at 6:00 AM to scan for health and breeding timeline events
 * Creates persistent notifications and delivers via email
 *
 * Architecture: Hybrid Notification System
 * - This job creates PERSISTENT notifications (health/breeding)
 * - Does NOT affect ephemeral notifications (messages, invoices, etc.)
 */

import cron from "node-cron";
import { runNotificationScan } from "../services/notification-scanner.js";
import { deliverPendingNotifications } from "../services/notification-delivery.js";

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

// Run daily at 6:00 AM
// Cron format: "minute hour day month weekday"
// "0 6 * * *" = 6:00 AM every day
const CRON_SCHEDULE = process.env.NOTIFICATION_SCAN_CRON || "0 6 * * *";

// Enable/disable via environment variable
const CRON_ENABLED = process.env.NOTIFICATION_SCAN_ENABLED !== "false"; // Default: enabled

// ────────────────────────────────────────────────────────────────────────────
// Job Function
// ────────────────────────────────────────────────────────────────────────────

export async function runNotificationScanJob(): Promise<void> {
  const startTime = new Date();
  console.log(`[notification-scan-job] Starting scan at ${startTime.toISOString()}`);

  try {
    // Step 1: Scan for vaccination and breeding events
    const scanResults = await runNotificationScan();
    console.log(`[notification-scan-job] Scan complete:`, scanResults);

    // Step 2: Deliver all pending notifications via email
    const deliveryResults = await deliverPendingNotifications();
    console.log(`[notification-scan-job] Delivery complete:`, deliveryResults);

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    console.log(`[notification-scan-job] Job complete in ${durationMs}ms`);
    console.log(`[notification-scan-job] Summary:
  - Notifications created: ${scanResults.total}
    - Vaccinations: ${scanResults.vaccinations}
    - Breeding: ${scanResults.breeding}
  - Emails sent: ${deliveryResults.sent}
  - Emails failed: ${deliveryResults.failed}
    `);
  } catch (err: any) {
    console.error(`[notification-scan-job] Job failed:`, err.message || err);
    console.error(err.stack);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Cron Scheduler
// ────────────────────────────────────────────────────────────────────────────

let cronJob: cron.ScheduledTask | null = null;

/**
 * Start the notification scan cron job
 */
export function startNotificationScanJob(): void {
  if (!CRON_ENABLED) {
    console.log(`[notification-scan-job] Cron job disabled via NOTIFICATION_SCAN_ENABLED=false`);
    return;
  }

  if (cronJob) {
    console.warn(`[notification-scan-job] Cron job already running, skipping start`);
    return;
  }

  // Validate cron schedule
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`[notification-scan-job] Invalid cron schedule: "${CRON_SCHEDULE}"`);
    console.error(`[notification-scan-job] Using default schedule: "0 6 * * *"`);
    cronJob = cron.schedule("0 6 * * *", runNotificationScanJob);
  } else {
    cronJob = cron.schedule(CRON_SCHEDULE, runNotificationScanJob);
  }

  console.log(`[notification-scan-job] Cron job started with schedule: "${CRON_SCHEDULE}"`);

  // Optional: Run immediately on startup for testing (uncomment if needed)
  // console.log(`[notification-scan-job] Running initial scan on startup...`);
  // runNotificationScanJob().catch(err => console.error('[notification-scan-job] Initial scan failed:', err));
}

/**
 * Stop the notification scan cron job
 */
export function stopNotificationScanJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log(`[notification-scan-job] Cron job stopped`);
  }
}

/**
 * Get cron job status
 */
export function getNotificationScanJobStatus(): {
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
