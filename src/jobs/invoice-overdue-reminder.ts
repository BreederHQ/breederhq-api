// src/jobs/invoice-overdue-reminder.ts
/**
 * Invoice Overdue Reminder Cron Job
 *
 * Runs daily at 9:00 AM UTC to send payment reminders for overdue invoices.
 * - Finds invoices with dueAt < now AND dueAt > now - 90 days
 * - Deduplicates: skips invoices that received a reminder in the last 7 days
 * - Sends reminder to client, daily summary to breeder
 */

import cron from "node-cron";
import prisma from "../prisma.js";
import { sendEmail } from "../services/email-service.js";
import { renderOverdueReminderEmail, renderBreederOverdueSummary } from "../services/email-templates.js";
import { captureException } from "../lib/sentry.js";

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_CRON = "0 9 * * *"; // Daily at 9:00 AM UTC
const CRON_SCHEDULE = process.env.OVERDUE_REMINDER_CRON || DEFAULT_CRON;
const CRON_ENABLED = process.env.OVERDUE_REMINDER_ENABLED !== "false";

const MAX_AGE_DAYS = 90; // Don't remind for invoices older than 90 days
const DEDUP_DAYS = 7; // Don't send another reminder within 7 days
const TEMPLATE_KEY = "invoice_overdue_reminder";
const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL || "https://portal.breederhq.com";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface ReminderResult {
  invoicesFound: number;
  remindersSent: number;
  skippedDedup: number;
  skippedNoEmail: number;
  errors: number;
  breederSummariesSent: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Job Function
// ────────────────────────────────────────────────────────────────────────────

export async function runOverdueReminderJob(): Promise<ReminderResult> {
  const startTime = Date.now();
  const result: ReminderResult = {
    invoicesFound: 0,
    remindersSent: 0,
    skippedDedup: 0,
    skippedNoEmail: 0,
    errors: 0,
    breederSummariesSent: 0,
  };

  try {
    const now = new Date();
    const maxAge = new Date(now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    const dedupCutoff = new Date(now.getTime() - DEDUP_DAYS * 24 * 60 * 60 * 1000);

    // Find overdue invoices
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["issued", "partially_paid"] },
        dueAt: { lt: now, gt: maxAge },
        deletedAt: null,
        balanceCents: { gt: 0 },
      },
      include: {
        clientParty: { select: { name: true, email: true } },
        tenant: {
          select: {
            id: true,
            name: true,
            primaryEmail: true,
            slug: true,
            invoicingMode: true,
            paymentInstructions: true,
            stripeConnectAccountId: true,
            stripeConnectPayoutsEnabled: true,
          },
        },
      },
      orderBy: { dueAt: "asc" },
      take: 500, // Cap to avoid runaway processing
    });

    result.invoicesFound = overdueInvoices.length;

    if (overdueInvoices.length === 0) {
      console.log(`[overdue-reminder] No overdue invoices found`);
      return result;
    }

    console.log(`[overdue-reminder] Found ${overdueInvoices.length} overdue invoices`);

    // Check which invoices already received a recent reminder
    const invoiceIds = overdueInvoices.map((inv) => inv.id);
    const recentReminders = await prisma.emailSendLog.findMany({
      where: {
        templateKey: TEMPLATE_KEY,
        relatedInvoiceId: { in: invoiceIds },
        status: "sent",
        createdAt: { gte: dedupCutoff },
      },
      select: { relatedInvoiceId: true },
    });

    const recentlyRemindedIds = new Set(
      recentReminders.map((r) => r.relatedInvoiceId).filter(Boolean)
    );

    // Group by tenant for summary emails
    const tenantSummary = new Map<number, { name: string; email: string | null; count: number; totalCents: number }>();

    for (const invoice of overdueInvoices) {
      // Dedup check
      if (recentlyRemindedIds.has(invoice.id)) {
        result.skippedDedup++;
        continue;
      }

      // Need client email
      if (!invoice.clientParty?.email) {
        result.skippedNoEmail++;
        continue;
      }

      const tenant = invoice.tenant;
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(invoice.dueAt!).getTime()) / (24 * 60 * 60 * 1000)
      );

      const isStripeMode = tenant.invoicingMode === "stripe" &&
        tenant.stripeConnectAccountId &&
        tenant.stripeConnectPayoutsEnabled;

      const portalUrl = tenant.slug
        ? `${PORTAL_BASE_URL}/t/${tenant.slug}/financials`
        : undefined;

      try {
        const email = renderOverdueReminderEmail({
          invoiceNumber: invoice.invoiceNumber,
          amountCents: Number(invoice.amountCents),
          balanceCents: Number(invoice.balanceCents),
          dueAt: invoice.dueAt!,
          daysOverdue,
          clientName: invoice.clientParty.name || "Client",
          tenantName: tenant.name,
          paymentMode: isStripeMode ? "stripe" : "manual",
          portalUrl,
          paymentInstructions: tenant.paymentInstructions ?? null,
        });

        await sendEmail({
          tenantId: tenant.id,
          to: invoice.clientParty.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          templateKey: TEMPLATE_KEY,
          relatedInvoiceId: invoice.id,
          category: "transactional",
        });

        result.remindersSent++;

        // Track for breeder summary
        const existing = tenantSummary.get(tenant.id);
        if (existing) {
          existing.count++;
          existing.totalCents += Number(invoice.balanceCents);
        } else {
          tenantSummary.set(tenant.id, {
            name: tenant.name,
            email: tenant.primaryEmail,
            count: 1,
            totalCents: Number(invoice.balanceCents),
          });
        }
      } catch (err: any) {
        result.errors++;
        console.error(
          `[overdue-reminder] Failed to send reminder for invoice ${invoice.id}: ${err.message}`
        );
      }
    }

    // Send breeder summaries
    for (const [tenantId, summary] of tenantSummary) {
      if (!summary.email) continue;

      try {
        const email = renderBreederOverdueSummary({
          tenantName: summary.name,
          overdueCount: summary.count,
          totalOverdueCents: summary.totalCents,
        });

        await sendEmail({
          tenantId,
          to: summary.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          templateKey: "breeder_overdue_summary",
          category: "transactional",
        });

        result.breederSummariesSent++;
      } catch (err: any) {
        console.error(
          `[overdue-reminder] Failed to send breeder summary for tenant ${tenantId}: ${err.message}`
        );
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[overdue-reminder] Complete in ${duration}ms`);
    console.log(`[overdue-reminder] Summary:`);
    console.log(`  - Found: ${result.invoicesFound}`);
    console.log(`  - Sent: ${result.remindersSent}`);
    console.log(`  - Dedup skipped: ${result.skippedDedup}`);
    console.log(`  - No email: ${result.skippedNoEmail}`);
    console.log(`  - Errors: ${result.errors}`);
    console.log(`  - Breeder summaries: ${result.breederSummariesSent}`);
  } catch (err: any) {
    result.errors++;
    console.error(`[overdue-reminder] Job error:`, err.message);
    captureException(err, { job: "invoice-overdue-reminder" });
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Cron Scheduler
// ────────────────────────────────────────────────────────────────────────────

let cronJob: cron.ScheduledTask | null = null;

export function startOverdueReminderJob(): void {
  if (!CRON_ENABLED) {
    console.log(`[overdue-reminder] Cron job disabled via OVERDUE_REMINDER_ENABLED=false`);
    return;
  }

  if (cronJob) {
    console.warn(`[overdue-reminder] Cron job already running, skipping start`);
    return;
  }

  const schedule = cron.validate(CRON_SCHEDULE) ? CRON_SCHEDULE : DEFAULT_CRON;

  cronJob = cron.schedule(schedule, async () => {
    console.log(`[overdue-reminder] Starting job at ${new Date().toISOString()}`);
    await runOverdueReminderJob();
  });

  console.log(`[overdue-reminder] Cron job started with schedule: "${schedule}"`);
}

export function stopOverdueReminderJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log(`[overdue-reminder] Cron job stopped`);
  }
}

export function getOverdueReminderJobStatus(): {
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
