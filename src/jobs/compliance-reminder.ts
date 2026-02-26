// src/jobs/compliance-reminder.ts
/**
 * Compliance Reminder Cron Job
 *
 * Daily job (8 AM UTC): Scans ComplianceRequirement records for upcoming/overdue
 * deadlines and sends tiered email reminders (30d, 7d, 1d, overdue).
 *
 * Weekly digest (Monday 8 AM UTC): Sends breeders a summary of all overdue
 * compliance requirements across their placed offspring.
 *
 * Follows patterns from invoice-overdue-reminder.ts:
 * - Deduplication via EmailSendLog (metadata JSON path)
 * - Portal notification creation for buyer visibility
 * - Breeder summary aggregation
 */

import cron from "node-cron";
import prisma from "../prisma.js";
import { sendEmail } from "../services/email-service.js";
import {
  renderComplianceReminderEmail,
  renderComplianceUrgentEmail,
  renderComplianceFinalEmail,
  renderComplianceOverdueEmail,
  renderBreederComplianceDigestEmail,
} from "../services/email-templates.js";
import { captureException } from "../lib/sentry.js";
import type { NotificationType, NotificationPriority } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_CRON = "0 8 * * *"; // Daily at 8:00 AM UTC
const CRON_SCHEDULE = process.env.COMPLIANCE_REMINDER_CRON || DEFAULT_CRON;
const CRON_ENABLED = process.env.COMPLIANCE_REMINDER_ENABLED !== "false";

const DIGEST_DEFAULT_CRON = "0 8 * * 1"; // Monday at 8:00 AM UTC
const DIGEST_CRON = process.env.COMPLIANCE_DIGEST_CRON || DIGEST_DEFAULT_CRON;
const DIGEST_ENABLED = process.env.COMPLIANCE_DIGEST_ENABLED !== "false";

const DEDUP_HOURS = 24;
const DIGEST_DEDUP_DAYS = 7;
const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL || "https://portal.breederhq.com";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface ComplianceReminderResult {
  requirementsFound: number;
  remindersSent: number;
  notificationsCreated: number;
  skippedDedup: number;
  skippedNoEmail: number;
  skippedNoMatch: number;
  errors: number;
}

interface DigestResult {
  tenantsWithOverdue: number;
  digestsSent: number;
  skippedDedup: number;
  errors: number;
}

interface UrgencyLevel {
  templateKey: string;
  notificationType: NotificationType;
  priority: NotificationPriority;
  render: typeof renderComplianceReminderEmail;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function differenceInDays(dateA: Date, dateB: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((dateA.getTime() - dateB.getTime()) / msPerDay);
}

function formatRequirementType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getUrgencyLevel(daysUntilDue: number, reminderDays: number[]): UrgencyLevel | null {
  // Check if days match any reminder threshold
  if (reminderDays.includes(daysUntilDue)) {
    if (daysUntilDue >= 14) {
      return {
        templateKey: "compliance_reminder",
        notificationType: "compliance_reminder_30d",
        priority: "LOW",
        render: renderComplianceReminderEmail,
      };
    } else if (daysUntilDue >= 3) {
      return {
        templateKey: "compliance_urgent",
        notificationType: "compliance_reminder_7d",
        priority: "MEDIUM",
        render: renderComplianceUrgentEmail,
      };
    } else {
      return {
        templateKey: "compliance_final",
        notificationType: "compliance_reminder_1d",
        priority: "HIGH",
        render: renderComplianceFinalEmail,
      };
    }
  }

  // Overdue: send daily
  if (daysUntilDue < 0) {
    return {
      templateKey: "compliance_overdue",
      notificationType: "compliance_overdue",
      priority: "URGENT",
      render: renderComplianceOverdueEmail,
    };
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Daily Compliance Reminder Job
// ────────────────────────────────────────────────────────────────────────────

export async function runComplianceReminderJob(): Promise<ComplianceReminderResult> {
  const startTime = Date.now();
  const result: ComplianceReminderResult = {
    requirementsFound: 0,
    remindersSent: 0,
    notificationsCreated: 0,
    skippedDedup: 0,
    skippedNoEmail: 0,
    skippedNoMatch: 0,
    errors: 0,
  };

  try {
    const today = startOfDay(new Date());
    const dedupCutoff = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000);

    // Find all pending compliance requirements with a due date
    const requirements = await prisma.complianceRequirement.findMany({
      where: {
        status: "pending",
        dueBy: { not: null },
      },
      include: {
        Offspring: {
          select: {
            id: true,
            name: true,
            damId: true,
            sireId: true,
            promotedAnimalId: true,
            buyerPartyId: true,
            buyerParty: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        Tenant: {
          select: { id: true, name: true, primaryEmail: true, slug: true },
        },
      },
      take: 500, // Cap to avoid runaway processing
    });

    result.requirementsFound = requirements.length;

    if (requirements.length === 0) {
      console.log(`[compliance-reminder] No pending requirements found`);
      return result;
    }

    console.log(`[compliance-reminder] Found ${requirements.length} pending requirements`);

    // Batch dedup check: find recent compliance emails via metadata JSON path
    const recentComplianceEmails = await prisma.$queryRaw<
      Array<{ metadata: Record<string, unknown> }>
    >`
      SELECT metadata FROM "public"."EmailSendLog"
      WHERE "templateKey" IN ('compliance_reminder', 'compliance_urgent', 'compliance_final', 'compliance_overdue')
        AND status = 'sent'
        AND "createdAt" >= ${dedupCutoff}
        AND metadata IS NOT NULL
    `;

    const recentlyRemindedIds = new Set<number>();
    for (const row of recentComplianceEmails) {
      const reqId = row.metadata?.complianceRequirementId;
      if (typeof reqId === "number") {
        recentlyRemindedIds.add(reqId);
      }
    }

    for (const req of requirements) {
      const offspring = req.Offspring;
      const tenant = req.Tenant;
      const buyerEmail = offspring.buyerParty?.email;

      if (!buyerEmail) {
        result.skippedNoEmail++;
        continue;
      }

      // Calculate days until due
      const dueByStartOfDay = startOfDay(req.dueBy!);
      const daysUntilDue = differenceInDays(dueByStartOfDay, today);

      // Determine urgency level
      const urgency = getUrgencyLevel(daysUntilDue, req.reminderDays);
      if (!urgency) {
        result.skippedNoMatch++;
        continue;
      }

      // Dedup check
      if (recentlyRemindedIds.has(req.id)) {
        result.skippedDedup++;
        continue;
      }

      const dueDate = req.dueBy!.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const portalUrl = tenant.slug
        ? `${PORTAL_BASE_URL}/t/${tenant.slug}/offspring/${offspring.id}`
        : `${PORTAL_BASE_URL}/offspring/${offspring.id}`;

      try {
        // Render and send email
        const email = urgency.render({
          clientName: offspring.buyerParty?.name || "Client",
          offspringName: offspring.name || "Your pet",
          requirementType: formatRequirementType(req.type),
          requirementDescription: req.description,
          dueDate,
          daysRemaining: daysUntilDue,
          tenantName: tenant.name,
          portalUrl,
        });

        await sendEmail({
          tenantId: tenant.id,
          to: buyerEmail,
          subject: email.subject,
          html: email.html,
          text: email.text,
          templateKey: urgency.templateKey,
          partyId: offspring.buyerParty?.id,
          metadata: {
            complianceRequirementId: req.id,
            offspringId: offspring.id,
            offspringName: offspring.name,
            requirementType: req.type,
          },
          category: "transactional",
        });

        result.remindersSent++;

        // Update lastReminderSentAt
        await prisma.complianceRequirement.update({
          where: { id: req.id },
          data: { lastReminderSentAt: new Date() },
        });

        // Create portal notification
        const idempotencyKey = `${urgency.notificationType}:ComplianceRequirement:${req.id}:${today.toISOString().split("T")[0]}`;
        const existingNotif = await prisma.notification.findUnique({
          where: { idempotencyKey },
        });

        if (!existingNotif) {
          const animalId = offspring.damId || offspring.sireId || offspring.promotedAnimalId;

          await prisma.notification.create({
            data: {
              tenantId: tenant.id,
              userId: null,
              type: urgency.notificationType,
              priority: urgency.priority,
              title:
                daysUntilDue < 0
                  ? `Compliance Overdue: ${formatRequirementType(req.type)}`
                  : daysUntilDue <= 1
                    ? `Compliance Due Tomorrow: ${formatRequirementType(req.type)}`
                    : `Compliance Due in ${daysUntilDue} Days: ${formatRequirementType(req.type)}`,
              message:
                daysUntilDue < 0
                  ? `${offspring.name || "Offspring"}'s ${formatRequirementType(req.type)} requirement is ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? "s" : ""} overdue.`
                  : `${offspring.name || "Offspring"}'s ${formatRequirementType(req.type)} requirement is due ${daysUntilDue <= 1 ? "tomorrow" : `in ${daysUntilDue} days`} (${dueDate}).`,
              linkUrl: `/offspring/${offspring.id}/health`,
              status: "UNREAD",
              idempotencyKey,
              metadata: {
                animalId,
                damId: offspring.damId,
                sireId: offspring.sireId,
                offspringId: offspring.id,
                complianceRequirementId: req.id,
                requirementType: req.type,
              },
            },
          });

          result.notificationsCreated++;
        }
      } catch (err: any) {
        result.errors++;
        console.error(
          `[compliance-reminder] Failed for requirement ${req.id}: ${err.message}`
        );
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[compliance-reminder] Complete in ${duration}ms`);
    console.log(`[compliance-reminder] Summary:`);
    console.log(`  - Found: ${result.requirementsFound}`);
    console.log(`  - Reminders sent: ${result.remindersSent}`);
    console.log(`  - Notifications created: ${result.notificationsCreated}`);
    console.log(`  - Dedup skipped: ${result.skippedDedup}`);
    console.log(`  - No email: ${result.skippedNoEmail}`);
    console.log(`  - No match (not due yet): ${result.skippedNoMatch}`);
    console.log(`  - Errors: ${result.errors}`);
  } catch (err: any) {
    result.errors++;
    console.error(`[compliance-reminder] Job error:`, err.message);
    captureException(err, { job: "compliance-reminder" });
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Weekly Breeder Compliance Digest Job
// ────────────────────────────────────────────────────────────────────────────

export async function runBreederComplianceDigestJob(): Promise<DigestResult> {
  const startTime = Date.now();
  const result: DigestResult = {
    tenantsWithOverdue: 0,
    digestsSent: 0,
    skippedDedup: 0,
    errors: 0,
  };

  try {
    const now = new Date();
    const dedupCutoff = new Date(now.getTime() - DIGEST_DEDUP_DAYS * 24 * 60 * 60 * 1000);
    const today = startOfDay(now);

    // Find all overdue compliance requirements
    const overdueRequirements = await prisma.complianceRequirement.findMany({
      where: {
        status: "pending",
        dueBy: { lt: now, not: null },
      },
      include: {
        Offspring: {
          select: {
            id: true,
            name: true,
            buyerParty: { select: { name: true } },
          },
        },
        Tenant: {
          select: { id: true, name: true, primaryEmail: true, slug: true },
        },
      },
      take: 1000,
    });

    if (overdueRequirements.length === 0) {
      console.log(`[compliance-digest] No overdue requirements found`);
      return result;
    }

    // Group by tenant
    const tenantMap = new Map<
      number,
      {
        tenant: { id: number; name: string; primaryEmail: string | null; slug: string | null };
        items: Array<{
          offspringName: string;
          requirementType: string;
          dueDate: string;
          daysOverdue: number;
          clientName: string;
        }>;
      }
    >();

    for (const req of overdueRequirements) {
      const tenant = req.Tenant;
      const daysOverdue = differenceInDays(today, startOfDay(req.dueBy!));

      const item = {
        offspringName: req.Offspring.name || `Offspring #${req.Offspring.id}`,
        requirementType: formatRequirementType(req.type),
        dueDate: req.dueBy!.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        daysOverdue,
        clientName: req.Offspring.buyerParty?.name || "Unknown",
      };

      const existing = tenantMap.get(tenant.id);
      if (existing) {
        existing.items.push(item);
      } else {
        tenantMap.set(tenant.id, { tenant, items: [item] });
      }
    }

    result.tenantsWithOverdue = tenantMap.size;

    // Dedup: check recent digest emails per tenant
    const recentDigests = await prisma.emailSendLog.findMany({
      where: {
        templateKey: "breeder_compliance_digest",
        status: "sent",
        createdAt: { gte: dedupCutoff },
      },
      select: { tenantId: true },
    });

    const recentDigestTenantIds = new Set(
      recentDigests.map((d) => d.tenantId).filter(Boolean)
    );

    for (const [tenantId, { tenant, items }] of tenantMap) {
      if (!tenant.primaryEmail) continue;

      if (recentDigestTenantIds.has(tenantId)) {
        result.skippedDedup++;
        continue;
      }

      const portalUrl = tenant.slug
        ? `${PORTAL_BASE_URL}/t/${tenant.slug}/offspring`
        : `${PORTAL_BASE_URL}/offspring`;

      try {
        const email = renderBreederComplianceDigestEmail({
          tenantName: tenant.name,
          overdueItems: items,
          portalUrl,
        });

        await sendEmail({
          tenantId,
          to: tenant.primaryEmail,
          subject: email.subject,
          html: email.html,
          text: email.text,
          templateKey: "breeder_compliance_digest",
          category: "transactional",
        });

        result.digestsSent++;
      } catch (err: any) {
        result.errors++;
        console.error(
          `[compliance-digest] Failed for tenant ${tenantId}: ${err.message}`
        );
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[compliance-digest] Complete in ${duration}ms`);
    console.log(`[compliance-digest] Summary:`);
    console.log(`  - Tenants with overdue: ${result.tenantsWithOverdue}`);
    console.log(`  - Digests sent: ${result.digestsSent}`);
    console.log(`  - Dedup skipped: ${result.skippedDedup}`);
    console.log(`  - Errors: ${result.errors}`);
  } catch (err: any) {
    result.errors++;
    console.error(`[compliance-digest] Job error:`, err.message);
    captureException(err, { job: "compliance-digest" });
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Cron Schedulers
// ────────────────────────────────────────────────────────────────────────────

let reminderCronJob: cron.ScheduledTask | null = null;
let digestCronJob: cron.ScheduledTask | null = null;

export function startComplianceReminderJob(): void {
  if (!CRON_ENABLED) {
    console.log(`[compliance-reminder] Cron job disabled via COMPLIANCE_REMINDER_ENABLED=false`);
    return;
  }

  if (reminderCronJob) {
    console.warn(`[compliance-reminder] Cron job already running, skipping start`);
    return;
  }

  const schedule = cron.validate(CRON_SCHEDULE) ? CRON_SCHEDULE : DEFAULT_CRON;

  reminderCronJob = cron.schedule(schedule, async () => {
    console.log(`[compliance-reminder] Starting job at ${new Date().toISOString()}`);
    await runComplianceReminderJob();
  });

  console.log(`[compliance-reminder] Cron job started with schedule: "${schedule}"`);
}

export function stopComplianceReminderJob(): void {
  if (reminderCronJob) {
    reminderCronJob.stop();
    reminderCronJob = null;
    console.log(`[compliance-reminder] Cron job stopped`);
  }
}

export function startComplianceDigestJob(): void {
  if (!DIGEST_ENABLED) {
    console.log(`[compliance-digest] Cron job disabled via COMPLIANCE_DIGEST_ENABLED=false`);
    return;
  }

  if (digestCronJob) {
    console.warn(`[compliance-digest] Cron job already running, skipping start`);
    return;
  }

  const schedule = cron.validate(DIGEST_CRON) ? DIGEST_CRON : DIGEST_DEFAULT_CRON;

  digestCronJob = cron.schedule(schedule, async () => {
    console.log(`[compliance-digest] Starting job at ${new Date().toISOString()}`);
    await runBreederComplianceDigestJob();
  });

  console.log(`[compliance-digest] Cron job started with schedule: "${schedule}"`);
}

export function stopComplianceDigestJob(): void {
  if (digestCronJob) {
    digestCronJob.stop();
    digestCronJob = null;
    console.log(`[compliance-digest] Cron job stopped`);
  }
}

export function getComplianceReminderJobStatus(): {
  reminderEnabled: boolean;
  reminderRunning: boolean;
  reminderSchedule: string;
  digestEnabled: boolean;
  digestRunning: boolean;
  digestSchedule: string;
} {
  return {
    reminderEnabled: CRON_ENABLED,
    reminderRunning: reminderCronJob !== null,
    reminderSchedule: CRON_SCHEDULE,
    digestEnabled: DIGEST_ENABLED,
    digestRunning: digestCronJob !== null,
    digestSchedule: DIGEST_CRON,
  };
}
