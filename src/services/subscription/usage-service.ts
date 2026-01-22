/**
 * Usage Tracking Service
 *
 * Tracks tenant usage of quota-limited resources (animals, contacts, storage, etc.)
 * Maintains both time-series records (UsageRecord) and fast-read snapshots (UsageSnapshot).
 */

import type { UsageMetricKey, EntitlementKey, Prisma } from "@prisma/client";
import prisma from "../../prisma.js";
import { getQuotaLimit } from "./entitlement-service.js";
import {
  sendQuotaWarningEmail,
  sendQuotaCriticalEmail,
  sendQuotaExceededEmail,
} from "../email-service.js";

export type UsageStatus = {
  metricKey: UsageMetricKey;
  currentValue: number;
  limit: number | null; // null = unlimited
  percentUsed: number | null; // null if unlimited
  isOverLimit: boolean;
};

/**
 * Map usage metric key to entitlement quota key
 */
function metricToQuotaKey(metricKey: UsageMetricKey): Extract<
  EntitlementKey,
  | "ANIMAL_QUOTA"
  | "CONTACT_QUOTA"
  | "PORTAL_USER_QUOTA"
  | "BREEDING_PLAN_QUOTA"
  | "MARKETPLACE_LISTING_QUOTA"
  | "STORAGE_QUOTA_GB"
  | "SMS_QUOTA"
> | null {
  switch (metricKey) {
    case "ANIMAL_COUNT":
      return "ANIMAL_QUOTA";
    case "CONTACT_COUNT":
      return "CONTACT_QUOTA";
    case "PORTAL_USER_COUNT":
      return "PORTAL_USER_QUOTA";
    case "BREEDING_PLAN_COUNT":
      return "BREEDING_PLAN_QUOTA";
    case "MARKETPLACE_LISTING_COUNT":
      return "MARKETPLACE_LISTING_QUOTA";
    case "STORAGE_BYTES":
      return "STORAGE_QUOTA_GB";
    case "SMS_SENT":
      return "SMS_QUOTA";
    default:
      return null;
  }
}

/**
 * Get human-readable label for a metric
 */
function getMetricLabel(metricKey: UsageMetricKey): string {
  switch (metricKey) {
    case "ANIMAL_COUNT":
      return "Animals";
    case "CONTACT_COUNT":
      return "Contacts";
    case "PORTAL_USER_COUNT":
      return "Portal Users";
    case "BREEDING_PLAN_COUNT":
      return "Breeding Plans";
    case "MARKETPLACE_LISTING_COUNT":
      return "Marketplace Listings";
    case "STORAGE_BYTES":
      return "Storage";
    case "SMS_SENT":
      return "SMS Messages";
    case "API_CALLS":
      return "API Calls";
    default:
      return metricKey;
  }
}

/**
 * Get current usage for a specific metric
 *
 * @param tenantId - The tenant to check
 * @param metricKey - The metric to check
 * @returns Current usage value
 */
export async function getCurrentUsage(
  tenantId: number,
  metricKey: UsageMetricKey
): Promise<number> {
  // Try snapshot first (fast read)
  const snapshot = await prisma.usageSnapshot.findUnique({
    where: {
      tenantId_metricKey: {
        tenantId,
        metricKey,
      },
    },
  });

  if (snapshot) {
    return snapshot.currentValue;
  }

  // Fallback: Calculate from actual data
  return await calculateActualUsage(tenantId, metricKey);
}

/**
 * Calculate actual usage by counting records in database
 * Used to refresh snapshots and for initial reads
 *
 * @param tenantId - The tenant to check
 * @param metricKey - The metric to calculate
 * @returns Actual count from database
 */
export async function calculateActualUsage(
  tenantId: number,
  metricKey: UsageMetricKey
): Promise<number> {
  switch (metricKey) {
    case "ANIMAL_COUNT":
      return await prisma.animal.count({
        where: { tenantId, archived: false },
      });

    case "CONTACT_COUNT":
      return await prisma.party.count({
        where: {
          tenantId,
          archived: false,
          type: "CONTACT",
        },
      });

    case "PORTAL_USER_COUNT":
      return await prisma.tenantMembership.count({
        where: {
          tenantId,
          membershipRole: "CLIENT",
          membershipStatus: "ACTIVE",
        },
      });

    case "BREEDING_PLAN_COUNT":
      return await prisma.breedingPlan.count({
        where: { tenantId, archived: false },
      });

    case "MARKETPLACE_LISTING_COUNT":
      return await prisma.mktListingBreederService.count({
        where: {
          tenantId,
          status: { in: ["DRAFT", "LIVE", "PAUSED"] },
        },
      });

    case "STORAGE_BYTES":
      // TODO: Implement storage calculation (sum of all uploaded files)
      // For now, return 0 - will need to track file sizes on upload
      return 0;

    case "SMS_SENT":
      // TODO: Implement SMS tracking
      // Count SMS sent this billing period
      return 0;

    case "API_CALLS":
      // TODO: Implement API call tracking
      // Count API calls this billing period
      return 0;

    default:
      return 0;
  }
}

/**
 * Update usage snapshot for a metric (call this after creating/deleting resources)
 *
 * @param tenantId - The tenant to update
 * @param metricKey - The metric to update
 */
export async function updateUsageSnapshot(
  tenantId: number,
  metricKey: UsageMetricKey
): Promise<void> {
  const currentValue = await calculateActualUsage(tenantId, metricKey);

  // Map metric key to quota key
  const quotaKey = metricToQuotaKey(metricKey);
  const limit = quotaKey ? await getQuotaLimit(tenantId, quotaKey) : null;

  // Get previous snapshot to detect threshold crossings
  const previousSnapshot = await prisma.usageSnapshot.findUnique({
    where: {
      tenantId_metricKey: {
        tenantId,
        metricKey,
      },
    },
  });

  // Update the snapshot
  await prisma.usageSnapshot.upsert({
    where: {
      tenantId_metricKey: {
        tenantId,
        metricKey,
      },
    },
    create: {
      tenantId,
      metricKey,
      currentValue,
      limit,
      lastUpdatedAt: new Date(),
    },
    update: {
      currentValue,
      limit,
      lastUpdatedAt: new Date(),
    },
  });

  // Check for quota threshold crossings and send emails
  if (limit !== null && limit > 0) {
    const previousValue = previousSnapshot?.currentValue ?? 0;
    const previousPercent = (previousValue / limit) * 100;
    const currentPercent = (currentValue / limit) * 100;

    const metricLabel = getMetricLabel(metricKey);

    // Check if we crossed 100% threshold (exceeded)
    if (previousPercent < 100 && currentPercent >= 100) {
      try {
        await sendQuotaExceededEmail(tenantId, metricLabel, limit);
      } catch (error) {
        console.error("Failed to send quota exceeded email:", error);
      }
    }
    // Check if we crossed 95% threshold (critical)
    else if (previousPercent < 95 && currentPercent >= 95) {
      try {
        await sendQuotaCriticalEmail(
          tenantId,
          metricLabel,
          currentValue,
          limit,
          currentPercent
        );
      } catch (error) {
        console.error("Failed to send quota critical email:", error);
      }
    }
    // Check if we crossed 80% threshold (warning)
    else if (previousPercent < 80 && currentPercent >= 80) {
      try {
        await sendQuotaWarningEmail(
          tenantId,
          metricLabel,
          currentValue,
          limit,
          currentPercent
        );
      } catch (error) {
        console.error("Failed to send quota warning email:", error);
      }
    }
  }
}

/**
 * Record a usage event (for time-series tracking and analytics)
 *
 * @param tenantId - The tenant
 * @param metricKey - The metric
 * @param value - The value to record (usually 1 for increment)
 * @param metadata - Optional metadata about the event
 */
export async function recordUsage(
  tenantId: number,
  metricKey: UsageMetricKey,
  value: number,
  metadata?: {
    userId?: string;
    resourceId?: number;
    additionalData?: Record<string, any>;
  }
): Promise<void> {
  await prisma.usageRecord.create({
    data: {
      tenantId,
      metricKey,
      value,
      userId: metadata?.userId,
      resourceId: metadata?.resourceId,
      metadata: metadata?.additionalData,
      recordedAt: new Date(),
    },
  });
}

/**
 * Get usage status for a specific metric (value, limit, percentage)
 *
 * @param tenantId - The tenant to check
 * @param metricKey - The metric to check
 * @returns UsageStatus with current value, limit, and percentage
 */
export async function getUsageStatus(
  tenantId: number,
  metricKey: UsageMetricKey
): Promise<UsageStatus> {
  const currentValue = await getCurrentUsage(tenantId, metricKey);

  // Map metric key to quota key
  const quotaKey = metricToQuotaKey(metricKey);
  const limit = quotaKey ? await getQuotaLimit(tenantId, quotaKey) : null;

  const percentUsed = limit !== null ? (currentValue / limit) * 100 : null;
  const isOverLimit = limit !== null && currentValue >= limit;

  return {
    metricKey,
    currentValue,
    limit,
    percentUsed,
    isOverLimit,
  };
}

/**
 * Get all usage statuses for a tenant
 *
 * @param tenantId - The tenant to check
 * @returns Array of UsageStatus for all quota metrics
 */
export async function getAllUsageStatuses(
  tenantId: number
): Promise<UsageStatus[]> {
  const quotaMetrics: UsageMetricKey[] = [
    "ANIMAL_COUNT",
    "CONTACT_COUNT",
    "PORTAL_USER_COUNT",
    "BREEDING_PLAN_COUNT",
    "MARKETPLACE_LISTING_COUNT",
    "STORAGE_BYTES",
    "SMS_SENT",
  ];

  const statuses = await Promise.all(
    quotaMetrics.map((metric) => getUsageStatus(tenantId, metric))
  );

  return statuses;
}

/**
 * Check if tenant has room to add more of a resource
 *
 * @param tenantId - The tenant to check
 * @param metricKey - The metric to check
 * @param countToAdd - How many to add (default 1)
 * @returns boolean - true if can add, false if would exceed limit
 */
export async function canAddResource(
  tenantId: number,
  metricKey: UsageMetricKey,
  countToAdd: number = 1
): Promise<boolean> {
  const status = await getUsageStatus(tenantId, metricKey);

  // Unlimited
  if (status.limit === null) {
    return true;
  }

  // Check if adding would exceed limit
  return status.currentValue + countToAdd <= status.limit;
}

/**
 * Refresh all usage snapshots for a tenant (use sparingly, expensive operation)
 *
 * @param tenantId - The tenant to refresh
 */
export async function refreshAllSnapshots(tenantId: number): Promise<void> {
  const metrics: UsageMetricKey[] = [
    "ANIMAL_COUNT",
    "CONTACT_COUNT",
    "PORTAL_USER_COUNT",
    "BREEDING_PLAN_COUNT",
    "MARKETPLACE_LISTING_COUNT",
    "STORAGE_BYTES",
  ];

  await Promise.all(
    metrics.map((metric) => updateUsageSnapshot(tenantId, metric))
  );
}

/**
 * Get usage trend for a metric over time
 *
 * @param tenantId - The tenant
 * @param metricKey - The metric
 * @param startDate - Start date for trend
 * @param endDate - End date for trend
 * @returns Array of usage records
 */
export async function getUsageTrend(
  tenantId: number,
  metricKey: UsageMetricKey,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: Date; value: number }>> {
  const records = await prisma.usageRecord.findMany({
    where: {
      tenantId,
      metricKey,
      recordedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      recordedAt: "asc",
    },
    select: {
      recordedAt: true,
      value: true,
    },
  });

  return records.map((r) => ({
    date: r.recordedAt,
    value: r.value,
  }));
}
