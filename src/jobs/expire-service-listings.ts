// src/jobs/expire-service-listings.ts
/**
 * Service Listing Expiration Cron Job
 *
 * Runs daily at 1:00 AM UTC to:
 * 1. Pause LIVE listings whose expiresAt has passed (no active subscription)
 * 2. Pause founding-provider listings after foundingFreeUntil date
 * 3. Send expiry warning emails (7, 3, 1 days before expiry)
 * 4. Send founding period transition warnings (30, 7 days before end)
 *
 * Idempotent — safe to run multiple times without side effects.
 */

import cron from "node-cron";
import prisma from "../prisma.js";
import { getListingPaymentSettings } from "../services/listing-payment-service.js";
import {
  sendListingExpiryWarningEmail,
  sendListingExpiredEmail,
  sendFoundingPeriodEndingEmail,
} from "../services/listing-payment-emails.js";

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_CRON = "0 1 * * *"; // Daily at 1:00 AM UTC
const CRON_SCHEDULE =
  process.env.SERVICE_LISTING_EXPIRATION_CRON || DEFAULT_CRON;
const CRON_ENABLED =
  process.env.SERVICE_LISTING_EXPIRATION_ENABLED !== "false"; // Default: enabled

// ────────────────────────────────────────────────────────────────────────────
// Result type
// ────────────────────────────────────────────────────────────────────────────

interface ServiceListingExpirationResult {
  expiredCount: number;
  foundingExpiredCount: number;
  warningsSent: number;
  foundingWarningsSent: number;
  expiredEmailsSent: number;
  errors: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Resolve the email and display name for a listing's owner.
 * Works for both provider-sourced and tenant-sourced listings.
 */
async function resolveListingOwnerEmail(listing: {
  providerId: number | null;
  tenantId: number | null;
  provider?: { user?: { email?: string; firstName?: string | null } | null; businessName?: string } | null;
  tenant?: { name?: string | null; organizations?: Array<{ party?: { email?: string | null } | null }> } | null;
}): Promise<{ email: string; name: string } | null> {
  // Provider path
  if (listing.providerId) {
    if (listing.provider?.user?.email) {
      return {
        email: listing.provider.user.email,
        name: listing.provider.user.firstName || listing.provider.businessName || "there",
      };
    }
    // Fallback: query directly
    const provider = await prisma.marketplaceProvider.findUnique({
      where: { id: listing.providerId },
      include: { user: { select: { email: true, firstName: true } } },
    });
    if (provider?.user?.email) {
      return {
        email: provider.user.email,
        name: provider.user.firstName || provider.businessName || "there",
      };
    }
  }

  // Tenant path
  if (listing.tenantId) {
    if ((listing.tenant as any)?.organizations?.[0]?.party?.email) {
      return {
        email: (listing.tenant as any).organizations[0].party.email,
        name: listing.tenant?.name || "there",
      };
    }
    // Fallback: query directly
    const tenant = await prisma.tenant.findUnique({
      where: { id: listing.tenantId },
      select: {
        name: true,
        organizations: {
          take: 1,
          select: { party: { select: { email: true } } },
        },
      } as any,
    }) as any;
    const email = tenant?.organizations?.[0]?.party?.email;
    if (email) {
      return { email, name: tenant.name || "there" };
    }
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Core Job Logic
// ────────────────────────────────────────────────────────────────────────────

/**
 * Main job entry point — runs all sub-tasks in sequence.
 */
export async function processServiceListingExpirations(): Promise<ServiceListingExpirationResult> {
  const result: ServiceListingExpirationResult = {
    expiredCount: 0,
    foundingExpiredCount: 0,
    warningsSent: 0,
    foundingWarningsSent: 0,
    expiredEmailsSent: 0,
    errors: 0,
  };

  const settings = await getListingPaymentSettings();

  // Only run if payments are enabled
  if (!settings.enabled) {
    return result;
  }

  const now = new Date();

  // ── 1. Expire LIVE listings past expiresAt with no active subscription ──
  try {
    const expired = await prisma.mktListingBreederService.updateMany({
      where: {
        status: "LIVE",
        expiresAt: { lt: now },
        stripeSubscriptionStatus: { notIn: ["active", "trialing"] },
        isFounding: false,
      } as any,
      data: {
        status: "PAUSED",
        pausedAt: now,
      },
    });
    result.expiredCount = expired.count;
  } catch (err: any) {
    console.error("[expire-service-listings] Error expiring listings:", err.message);
    result.errors++;
  }

  // ── 2. Handle founding provider transition ──
  if (settings.foundingFreeUntil && new Date(settings.foundingFreeUntil) < now) {
    try {
      const foundingExpired = await prisma.mktListingBreederService.updateMany({
        where: {
          status: "LIVE",
          isFounding: true,
          stripeSubscriptionId: null,
        } as any,
        data: {
          status: "PAUSED",
          pausedAt: now,
        },
      });
      result.foundingExpiredCount = foundingExpired.count;
    } catch (err: any) {
      console.error("[expire-service-listings] Error expiring founding listings:", err.message);
      result.errors++;
    }
  }

  // ── 3. Send expired emails for newly paused listings ──
  try {
    // Find listings paused today that haven't been notified yet
    const todayStart = startOfDay(now);
    const pausedToday = await prisma.mktListingBreederService.findMany({
      where: {
        status: "PAUSED",
        pausedAt: { gte: todayStart },
        // Only listings that had a payment relationship (not manually paused)
        OR: [
          { expiresAt: { not: null } },
          { isFounding: true },
        ],
      } as any,
      select: {
        id: true,
        title: true,
        providerId: true,
        tenantId: true,
        listingFeeCents: true,
      } as any,
    }) as any[];

    for (const listing of pausedToday) {
      try {
        const owner = await resolveListingOwnerEmail(listing);
        if (owner) {
          await sendListingExpiredEmail({
            email: owner.email,
            recipientName: owner.name,
            listingTitle: listing.title,
            listingId: listing.id,
            feeCents: listing.listingFeeCents ?? settings.listingFeeCents,
          });
          result.expiredEmailsSent++;
        }
      } catch (err: any) {
        console.error(
          `[expire-service-listings] Error sending expired email for listing ${listing.id}:`,
          err.message
        );
        result.errors++;
      }
    }
  } catch (err: any) {
    console.error("[expire-service-listings] Error querying paused listings:", err.message);
    result.errors++;
  }

  // ── 4. Send expiry warning emails (7, 3, 1 days) ──
  for (const daysAhead of [7, 3, 1]) {
    try {
      const windowStart = startOfDay(addDays(now, daysAhead));
      const windowEnd = endOfDay(addDays(now, daysAhead));

      const listings = await prisma.mktListingBreederService.findMany({
        where: {
          status: "LIVE",
          expiresAt: { gte: windowStart, lte: windowEnd },
          // Only warn if not auto-renewing (canceled or no subscription)
          stripeSubscriptionStatus: { in: ["canceling", "canceled"] },
        } as any,
        select: {
          id: true,
          title: true,
          providerId: true,
          tenantId: true,
          expiresAt: true,
          listingFeeCents: true,
        } as any,
      }) as any[];

      for (const listing of listings) {
        try {
          const owner = await resolveListingOwnerEmail(listing);
          if (owner) {
            await sendListingExpiryWarningEmail({
              email: owner.email,
              recipientName: owner.name,
              listingTitle: listing.title,
              listingId: listing.id,
              daysRemaining: daysAhead,
              expiresAt: listing.expiresAt,
              feeCents: listing.listingFeeCents ?? settings.listingFeeCents,
            });
            result.warningsSent++;
          }
        } catch (err: any) {
          console.error(
            `[expire-service-listings] Error sending ${daysAhead}-day warning for listing ${listing.id}:`,
            err.message
          );
          result.errors++;
        }
      }
    } catch (err: any) {
      console.error(
        `[expire-service-listings] Error querying ${daysAhead}-day expiry listings:`,
        err.message
      );
      result.errors++;
    }
  }

  // ── 5. Send founding transition warnings (30 and 7 days before end) ──
  if (settings.foundingFreeUntil) {
    const freeUntil = new Date(settings.foundingFreeUntil);
    const daysUntilEnd = Math.ceil(
      (freeUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilEnd === 30 || daysUntilEnd === 7) {
      try {
        const foundingListings = await prisma.mktListingBreederService.findMany({
          where: {
            status: "LIVE",
            isFounding: true,
            stripeSubscriptionId: null,
          } as any,
          select: {
            id: true,
            title: true,
            providerId: true,
            tenantId: true,
            listingFeeCents: true,
          } as any,
        }) as any[];

        for (const listing of foundingListings) {
          try {
            const owner = await resolveListingOwnerEmail(listing);
            if (owner) {
              await sendFoundingPeriodEndingEmail({
                email: owner.email,
                recipientName: owner.name,
                listingTitle: listing.title,
                listingId: listing.id,
                daysRemaining: daysUntilEnd,
                foundingFreeUntil: freeUntil,
                feeCents: listing.listingFeeCents ?? settings.listingFeeCents,
              });
              result.foundingWarningsSent++;
            }
          } catch (err: any) {
            console.error(
              `[expire-service-listings] Error sending founding warning for listing ${listing.id}:`,
              err.message
            );
            result.errors++;
          }
        }
      } catch (err: any) {
        console.error(
          "[expire-service-listings] Error querying founding listings:",
          err.message
        );
        result.errors++;
      }
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Cron Scheduler
// ────────────────────────────────────────────────────────────────────────────

let cronJob: cron.ScheduledTask | null = null;

/**
 * Start the service listing expiration cron job.
 */
export function startServiceListingExpirationJob(): void {
  if (!CRON_ENABLED) {
    console.log(
      `[expire-service-listings] Cron job disabled via SERVICE_LISTING_EXPIRATION_ENABLED=false`
    );
    return;
  }

  if (cronJob) {
    console.warn(
      `[expire-service-listings] Cron job already running, skipping start`
    );
    return;
  }

  const schedule = cron.validate(CRON_SCHEDULE)
    ? CRON_SCHEDULE
    : DEFAULT_CRON;

  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(
      `[expire-service-listings] Invalid cron schedule: "${CRON_SCHEDULE}", using default: "${DEFAULT_CRON}"`
    );
  }

  cronJob = cron.schedule(schedule, async () => {
    console.log(
      `[expire-service-listings] Starting job at ${new Date().toISOString()}`
    );
    const startTime = Date.now();

    const result = await processServiceListingExpirations();

    const duration = Date.now() - startTime;
    console.log(`[expire-service-listings] Complete in ${duration}ms`);
    console.log(`[expire-service-listings] Summary:`);
    console.log(`  - Expired (subscription): ${result.expiredCount}`);
    console.log(`  - Expired (founding): ${result.foundingExpiredCount}`);
    console.log(`  - Expiry warnings sent: ${result.warningsSent}`);
    console.log(`  - Founding warnings sent: ${result.foundingWarningsSent}`);
    console.log(`  - Expired emails sent: ${result.expiredEmailsSent}`);
    if (result.errors > 0) {
      console.warn(`  - Errors: ${result.errors}`);
    }
  });

  console.log(
    `[expire-service-listings] Cron job started with schedule: "${schedule}"`
  );
}

/**
 * Stop the service listing expiration cron job.
 */
export function stopServiceListingExpirationJob(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log(`[expire-service-listings] Cron job stopped`);
  }
}

/**
 * Get cron job status.
 */
export function getServiceListingExpirationJobStatus(): {
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
