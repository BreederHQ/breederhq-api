// src/jobs/email-retry.ts
/**
 * Email Retry Cron Job
 *
 * Runs every 5 minutes to retry failed email sends.
 * - Picks up EmailSendLog entries with status='failed' and nextRetryAt <= now
 * - Skips entries older than 48 hours
 * - Max 5 cron retries per email (after inline retries exhausted)
 * - Exponential backoff: 5min, 30min, 2hr, 12hr, 24hr
 * - Sentry alert if failure rate exceeds threshold
 */

import cron from "node-cron";
import prisma from "../prisma.js";
import { getResendClient, calculateNextRetryAt } from "../services/email-service.js";
import { captureMessage, captureException } from "../lib/sentry.js";

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_CRON = "*/5 * * * *"; // Every 5 minutes
const CRON_SCHEDULE = process.env.EMAIL_RETRY_CRON || DEFAULT_CRON;
const CRON_ENABLED = process.env.EMAIL_RETRY_ENABLED !== "false"; // Default: enabled

const MAX_CRON_RETRIES = 5;
const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours
const BATCH_SIZE = 10; // Process 10 at a time to avoid overloading Resend
const INTER_SEND_DELAY_MS = 200; // Small delay between sends to avoid rate limiting
const FAILURE_ALERT_THRESHOLD = 10; // Alert if >10 failures in last hour

// ────────────────────────────────────────────────────────────────────────────
// Result type
// ────────────────────────────────────────────────────────────────────────────

interface EmailRetryResult {
  processed: number;
  succeeded: number;
  failedAgain: number;
  abandoned: number;
  errors: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Job Function
// ────────────────────────────────────────────────────────────────────────────

export async function runEmailRetryJob(): Promise<EmailRetryResult> {
  const startTime = Date.now();
  const result: EmailRetryResult = {
    processed: 0,
    succeeded: 0,
    failedAgain: 0,
    abandoned: 0,
    errors: 0,
  };

  const cutoffDate = new Date(Date.now() - MAX_AGE_MS);

  try {
    // 1. Abandon stale entries (too old or max retries exceeded)
    const abandoned = await prisma.emailSendLog.updateMany({
      where: {
        status: "failed",
        nextRetryAt: { not: null },
        OR: [
          { createdAt: { lt: cutoffDate } },
          { retryCount: { gte: MAX_CRON_RETRIES } },
        ],
      },
      data: {
        nextRetryAt: null,
      },
    });
    result.abandoned = abandoned.count;

    if (abandoned.count > 0) {
      console.warn(`[email-retry] Abandoned ${abandoned.count} stale/max-retry emails`);
      captureMessage(
        `Email retry: abandoned ${abandoned.count} emails (too old or max retries)`,
        "warning",
        { abandonedCount: abandoned.count }
      );
    }

    // 2. Find retriable failed emails
    const retriable = await prisma.emailSendLog.findMany({
      where: {
        status: "failed",
        nextRetryAt: { lte: new Date() },
        createdAt: { gte: cutoffDate },
        retryCount: { lt: MAX_CRON_RETRIES },
      },
      take: BATCH_SIZE,
      orderBy: { nextRetryAt: "asc" },
    });

    if (retriable.length === 0) {
      const duration = Date.now() - startTime;
      console.log(`[email-retry] Complete in ${duration}ms — no retriable emails found`);
      await checkFailureRateAlert();
      return result;
    }

    console.log(`[email-retry] Found ${retriable.length} retriable emails`);

    // 3. Process each retriable email
    const resendClient = getResendClient();

    for (const log of retriable) {
      result.processed++;
      const attemptNum = log.retryCount + 1;

      try {
        console.log(
          `[email-retry] Retrying email #${log.id} (attempt ${attemptNum}/${MAX_CRON_RETRIES}) to ${log.to}`
        );

        // Reconstruct email body from metadata or use empty fallback
        const meta = (log.metadata as Record<string, any>) || {};
        const htmlBody = meta.retryHtml || "";
        const textBody = meta.retryText || "";

        const { data, error } = await resendClient.emails.send({
          from: log.from,
          to: log.to,
          subject: log.subject,
          html: htmlBody || textBody || "",
          text: textBody || undefined,
          ...(meta.replyTo && { reply_to: meta.replyTo }),
        });

        if (error) {
          // Resend returned an error
          const newRetryCount = log.retryCount + 1;
          const nextRetryAt = calculateNextRetryAt(newRetryCount);

          const existingError = (log.error as Record<string, any>) || {};
          await prisma.emailSendLog.update({
            where: { id: log.id },
            data: {
              retryCount: newRetryCount,
              nextRetryAt,
              error: {
                ...existingError,
                [`cronRetry_${newRetryCount}`]: {
                  resendError: error,
                  at: new Date().toISOString(),
                },
              },
            },
          });

          result.failedAgain++;
          console.warn(
            `[email-retry] Email #${log.id} retry failed (attempt ${attemptNum}/${MAX_CRON_RETRIES}): ${error.message}` +
            (nextRetryAt ? ` — next retry at ${nextRetryAt.toISOString()}` : " — no more retries")
          );
        } else {
          // Success!
          const messageId = (data as any)?.id || null;
          await prisma.emailSendLog.update({
            where: { id: log.id },
            data: {
              status: "sent",
              providerMessageId: messageId,
              retryCount: log.retryCount + 1,
              nextRetryAt: null,
            },
          });

          result.succeeded++;
          console.log(
            `[email-retry] Email #${log.id} retry succeeded (providerMessageId: ${messageId})`
          );
        }

        // Small delay between sends
        if (result.processed < retriable.length) {
          await new Promise((r) => setTimeout(r, INTER_SEND_DELAY_MS));
        }
      } catch (err: any) {
        // Exception during retry
        const newRetryCount = log.retryCount + 1;
        const nextRetryAt = calculateNextRetryAt(newRetryCount);

        const existingError = (log.error as Record<string, any>) || {};
        await prisma.emailSendLog.update({
          where: { id: log.id },
          data: {
            retryCount: newRetryCount,
            nextRetryAt,
            error: {
              ...existingError,
              [`cronRetry_${newRetryCount}`]: {
                exception: err.message,
                at: new Date().toISOString(),
              },
            },
          },
        });

        result.failedAgain++;
        console.error(
          `[email-retry] Email #${log.id} retry exception (attempt ${attemptNum}/${MAX_CRON_RETRIES}): ${err.message}`
        );
      }
    }

    // 4. Check aggregate failure rate
    await checkFailureRateAlert();

    const duration = Date.now() - startTime;
    console.log(`[email-retry] Complete in ${duration}ms`);
    console.log(`[email-retry] Summary:`);
    console.log(`  - Processed: ${result.processed}`);
    console.log(`  - Succeeded: ${result.succeeded}`);
    console.log(`  - Failed again: ${result.failedAgain}`);
    console.log(`  - Abandoned: ${result.abandoned}`);
  } catch (err: any) {
    result.errors++;
    console.error(`[email-retry] Job error:`, err.message);
    captureException(err, { job: "email-retry" });
  }

  return result;
}

/**
 * Check if email failure rate exceeds threshold and alert via Sentry
 */
async function checkFailureRateAlert(): Promise<void> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentFailures = await prisma.emailSendLog.count({
      where: {
        status: "failed",
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentFailures > FAILURE_ALERT_THRESHOLD) {
      captureMessage(
        `High email failure rate: ${recentFailures} failures in the last hour`,
        "error",
        { failureCount: recentFailures, threshold: FAILURE_ALERT_THRESHOLD, period: "1h" }
      );
      console.error(
        `[email-retry] ALERT: ${recentFailures} email failures in the last hour (threshold: ${FAILURE_ALERT_THRESHOLD})`
      );
    }
  } catch (err: any) {
    console.error(`[email-retry] Failed to check failure rate:`, err.message);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Cron Scheduler
// ────────────────────────────────────────────────────────────────────────────

let cronJob: cron.ScheduledTask | null = null;

/**
 * Start the email retry cron job
 */
export function startEmailRetryJob(): void {
  if (!CRON_ENABLED) {
    console.log(
      `[email-retry] Cron job disabled via EMAIL_RETRY_ENABLED=false`
    );
    return;
  }

  if (cronJob) {
    console.warn(
      `[email-retry] Cron job already running, skipping start`
    );
    return;
  }

  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(
      `[email-retry] Invalid cron schedule: "${CRON_SCHEDULE}"`
    );
    console.error(
      `[email-retry] Using default schedule: "${DEFAULT_CRON}"`
    );
    cronJob = cron.schedule(DEFAULT_CRON, async () => {
      console.log(
        `[email-retry] Starting job at ${new Date().toISOString()}`
      );
      await runEmailRetryJob();
    });
  } else {
    cronJob = cron.schedule(CRON_SCHEDULE, async () => {
      console.log(
        `[email-retry] Starting job at ${new Date().toISOString()}`
      );
      await runEmailRetryJob();
    });
  }

  console.log(
    `[email-retry] Cron job started with schedule: "${CRON_SCHEDULE}"`
  );
}

/**
 * Stop the email retry cron job
 */
export function stopEmailRetryJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log(`[email-retry] Cron job stopped`);
  }
}

/**
 * Get cron job status
 */
export function getEmailRetryJobStatus(): {
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
