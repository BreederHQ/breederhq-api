// src/jobs/copilot-quality-report.ts
/**
 * AI Copilot Quality Report Cron Job
 *
 * Runs nightly to:
 *   1. Sample the previous day's low-rated + unrated Copilot queries
 *   2. Ask Claude to identify failure patterns and produce a narrative analysis
 *   3. Upsert the result into CopilotQualityReport (idempotent by reportDate)
 *
 * Configuration (env vars):
 *   COPILOT_QUALITY_REPORT_ENABLED  - "true"|"false" (default: true)
 *   COPILOT_QUALITY_REPORT_CRON     - Cron schedule (default: "0 3 * * *" = 3 AM UTC daily)
 *   COPILOT_ANALYSIS_MODEL          - Claude model for analysis (default: claude-haiku-4-5-20251001)
 *   COPILOT_QUALITY_SAMPLE_SIZE     - Max queries to sample (default: 50)
 */

import cron from "node-cron";
import { generateDailyCopilotQualityReport } from "../services/copilot/copilot-analytics-service.js";

// ── Config ────────────────────────────────────────────────────────────────

const CRON_SCHEDULE = process.env.COPILOT_QUALITY_REPORT_CRON || "0 3 * * *";
const CRON_ENABLED = process.env.COPILOT_QUALITY_REPORT_ENABLED !== "false";

// ── Job Function ──────────────────────────────────────────────────────────

export async function runCopilotQualityReportJob(): Promise<void> {
  const startTime = new Date();
  console.log(`[copilot-quality-report] Starting nightly run at ${startTime.toISOString()}`);

  try {
    const report = await generateDailyCopilotQualityReport();

    const durationMs = Date.now() - startTime.getTime();
    console.log(
      `[copilot-quality-report] Complete in ${durationMs}ms — ` +
      `${report.totalQueries} queries, satisfaction: ${
        report.satisfactionRate != null
          ? `${Math.round(report.satisfactionRate * 100)}%`
          : "N/A"
      }, ${report.failurePatterns.length} failure pattern(s)`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[copilot-quality-report] Job failed:`, msg);
    if (err instanceof Error) console.error(err.stack);
  }
}

// ── Cron Scheduler ────────────────────────────────────────────────────────

let cronJob: cron.ScheduledTask | null = null;

export function startCopilotQualityReportJob(): void {
  if (!CRON_ENABLED) {
    console.log(`[copilot-quality-report] Disabled via COPILOT_QUALITY_REPORT_ENABLED=false`);
    return;
  }

  if (cronJob) {
    console.warn(`[copilot-quality-report] Already running, skipping start`);
    return;
  }

  const schedule = cron.validate(CRON_SCHEDULE) ? CRON_SCHEDULE : "0 3 * * *";
  cronJob = cron.schedule(schedule, runCopilotQualityReportJob);

  console.log(`[copilot-quality-report] Started with schedule: "${schedule}"`);
}

export function stopCopilotQualityReportJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log(`[copilot-quality-report] Stopped`);
  }
}
