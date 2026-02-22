// src/jobs/db-health-monitor.ts
/**
 * Database Health Monitor Cron Job
 *
 * Runs daily to:
 *   1. Capture a monitoring snapshot (_monitoring.table_stats)
 *   2. Check health thresholds
 *   3. Send email alert if any warnings/criticals detected
 *   4. Purge old monitoring snapshots (>90 days)
 *
 * Configuration (env vars):
 *   DB_HEALTH_MONITOR_ENABLED  - "true"|"false" (default: true)
 *   DB_HEALTH_MONITOR_CRON     - Cron schedule (default: "0 7 * * *" = 7 AM daily)
 *   DB_HEALTH_ALERT_EMAIL      - Recipient email for alerts (skips email if not set)
 */

import cron from "node-cron";
import {
  captureHealthReport,
  captureSnapshot,
  purgeOldSnapshots,
  type Alert,
  type DbHealthReport,
} from "../services/db-health-service.js";
import { sendEmail } from "../services/email-service.js";
import {
  wrapEmailLayout,
  emailParagraph,
  emailHeading,
  emailDetailRows,
} from "../services/email-layout.js";

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

const CRON_SCHEDULE = process.env.DB_HEALTH_MONITOR_CRON || "0 7 * * *";
const CRON_ENABLED = process.env.DB_HEALTH_MONITOR_ENABLED !== "false";
const ALERT_EMAIL = process.env.DB_HEALTH_ALERT_EMAIL || "";

// ────────────────────────────────────────────────────────────────────────────
// Job Function
// ────────────────────────────────────────────────────────────────────────────

export async function runDbHealthMonitorJob(): Promise<void> {
  const startTime = new Date();
  console.log(
    `[db-health-monitor] Starting check at ${startTime.toISOString()}`
  );

  try {
    // Step 1: Capture monitoring snapshot (if schema exists)
    const snapshotCount = await captureSnapshot();
    if (snapshotCount !== null) {
      console.log(
        `[db-health-monitor] Snapshot captured: ${snapshotCount} tables`
      );
    }

    // Step 2: Run health check
    const report = await captureHealthReport();
    const criticals = report.alerts.filter((a) => a.severity === "critical");
    const warnings = report.alerts.filter((a) => a.severity === "warning");

    console.log(`[db-health-monitor] Health check complete:`);
    console.log(`  Database size: ${report.totalSizeHuman}`);
    console.log(`  Tables: ${report.tableCount}`);
    console.log(`  Alerts: ${criticals.length} critical, ${warnings.length} warning`);

    // Step 3: Send email if alerts found
    if (report.alerts.length > 0 && ALERT_EMAIL) {
      await sendAlertEmail(report);
      console.log(`[db-health-monitor] Alert email sent to ${ALERT_EMAIL}`);
    } else if (report.alerts.length > 0 && !ALERT_EMAIL) {
      console.log(
        `[db-health-monitor] ${report.alerts.length} alerts detected but DB_HEALTH_ALERT_EMAIL not set — skipping email`
      );
    }

    // Step 4: Purge old snapshots
    const purged = await purgeOldSnapshots(90);
    if (purged > 0) {
      console.log(
        `[db-health-monitor] Purged ${purged} monitoring snapshots older than 90 days`
      );
    }

    const durationMs = Date.now() - startTime.getTime();
    console.log(`[db-health-monitor] Job complete in ${durationMs}ms`);
  } catch (err: any) {
    console.error(
      `[db-health-monitor] Job failed:`,
      err.message || err
    );
    console.error(err.stack);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Email
// ────────────────────────────────────────────────────────────────────────────

function alertIcon(a: Alert): string {
  return a.severity === "critical" ? "&#x1F534;" : "&#x1F7E1;";
}

async function sendAlertEmail(report: DbHealthReport): Promise<void> {
  const criticals = report.alerts.filter((a) => a.severity === "critical");
  const warnings = report.alerts.filter((a) => a.severity === "warning");

  const alertRows = report.alerts.map((a) => ({
    label: `${alertIcon(a)} ${a.table}`,
    value: a.message,
  }));

  const summaryRows = [
    { label: "Database Size", value: report.totalSizeHuman },
    { label: "Tables Scanned", value: String(report.tableCount) },
    { label: "Critical Alerts", value: String(criticals.length) },
    { label: "Warnings", value: String(warnings.length) },
    {
      label: "Missing Indexes",
      value: String(report.missingIndexes.length),
    },
    {
      label: "Active Connections",
      value: String(report.connections.total),
    },
  ];

  const body = [
    emailParagraph(
      `The daily database health check detected <strong>${report.alerts.length} issue${report.alerts.length === 1 ? "" : "s"}</strong> that may need attention.`
    ),
    emailHeading("Alerts"),
    emailDetailRows(alertRows),
    emailHeading("Summary"),
    emailDetailRows(summaryRows),
    emailParagraph(
      `<em style="color: #737373;">View details in the Admin panel → Database Health tab, or run <code>npm run db:dev:health</code> for the full report.</em>`
    ),
  ].join("");

  const subject = criticals.length > 0
    ? `[CRITICAL] DB Health Alert — ${criticals.length} critical, ${warnings.length} warning`
    : `[WARNING] DB Health Alert — ${warnings.length} issue${warnings.length === 1 ? "" : "s"} detected`;

  const html = wrapEmailLayout({
    title: "Database Health Alert",
    body,
    footerOrgName: "BreederHQ Platform",
  });

  await sendEmail({
    tenantId: null,
    to: ALERT_EMAIL,
    subject,
    html,
    text: `DB Health Alert: ${report.alerts.length} issues. Size: ${report.totalSizeHuman}. Run npm run db:dev:health for details.`,
    templateKey: "db_health_alert",
    category: "transactional",
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Cron Scheduler
// ────────────────────────────────────────────────────────────────────────────

let cronJob: cron.ScheduledTask | null = null;

export function startDbHealthMonitorJob(): void {
  if (!CRON_ENABLED) {
    console.log(
      `[db-health-monitor] Cron job disabled via DB_HEALTH_MONITOR_ENABLED=false`
    );
    return;
  }

  if (cronJob) {
    console.warn(
      `[db-health-monitor] Cron job already running, skipping start`
    );
    return;
  }

  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(
      `[db-health-monitor] Invalid cron schedule: "${CRON_SCHEDULE}"`
    );
    cronJob = cron.schedule("0 7 * * *", runDbHealthMonitorJob);
  } else {
    cronJob = cron.schedule(CRON_SCHEDULE, runDbHealthMonitorJob);
  }

  console.log(
    `[db-health-monitor] Cron job started with schedule: "${CRON_SCHEDULE}"` +
      (ALERT_EMAIL
        ? ` (alerts → ${ALERT_EMAIL})`
        : " (no alert email configured)")
  );
}

export function stopDbHealthMonitorJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log(`[db-health-monitor] Cron job stopped`);
  }
}

export function getDbHealthMonitorStatus(): {
  enabled: boolean;
  running: boolean;
  schedule: string;
  alertEmail: string;
} {
  return {
    enabled: CRON_ENABLED,
    running: cronJob !== null,
    schedule: CRON_SCHEDULE,
    alertEmail: ALERT_EMAIL || "(not set)",
  };
}
