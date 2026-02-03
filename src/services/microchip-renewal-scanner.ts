// src/services/microchip-renewal-scanner.ts
/**
 * Microchip Renewal Scanner Service
 *
 * Scans AnimalMicrochipRegistration table for expiring/expired registrations
 * Creates persistent Notification records for renewal reminders
 *
 * Alert windows: 30 days, 14 days, 7 days, 3 days, expired
 * Skips registrations with LIFETIME renewal type
 */

import prisma from "../prisma.js";
import type { NotificationType, NotificationPriority } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface MicrochipRenewalAlert {
  registrationId: number;
  microchipNumber: string;
  registryName: string;
  registryWebsite: string | null;
  animalId: number | null;
  animalName: string | null;
  offspringId: number | null;
  offspringName: string | null;
  expirationDate: Date;
  daysUntilExpiration: number;
  tenantId: number;
}

interface ScanResult {
  scannedCount: number;
  alertsFound: number;
  notificationsCreated: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Date Utilities
// ────────────────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function differenceInDays(dateA: Date, dateB: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((dateA.getTime() - dateB.getTime()) / msPerDay);
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Scanning
// ────────────────────────────────────────────────────────────────────────────

/**
 * Scan for microchip registrations expiring within the next 30 days
 * Alert windows: 30 days, 14 days, 7 days, 3 days, expired (up to 30 days ago)
 */
export async function scanMicrochipRenewals(): Promise<MicrochipRenewalAlert[]> {
  const today = startOfDay(new Date());
  const thirtyDaysFromNow = addDays(today, 30);
  const thirtyDaysAgo = addDays(today, -30);

  // Find registrations that:
  // 1. Have an expiration date (not lifetime)
  // 2. Expire within next 30 days OR expired within last 30 days
  // 3. Registry has ANNUAL or UNKNOWN renewal type (not LIFETIME)
  const registrations = await prisma.animalMicrochipRegistration.findMany({
    where: {
      expirationDate: {
        not: null,
        gte: thirtyDaysAgo,
        lte: thirtyDaysFromNow,
      },
      registry: {
        renewalType: {
          in: ["ANNUAL", "UNKNOWN"],
        },
      },
    },
    include: {
      registry: {
        select: {
          name: true,
          website: true,
          renewalType: true,
        },
      },
      animal: {
        select: {
          id: true,
          name: true,
          tenantId: true,
          status: true,
        },
      },
      offspring: {
        select: {
          id: true,
          name: true,
          tenantId: true,
          status: true,
        },
      },
    },
  });

  const alerts: MicrochipRenewalAlert[] = [];

  for (const reg of registrations) {
    // Skip if no expiration date (shouldn't happen based on query, but type safety)
    if (!reg.expirationDate) continue;

    // Skip if animal is deceased
    if (reg.animal && reg.animal.status === "DECEASED") continue;
    if (reg.offspring && reg.offspring.status === "DECEASED") continue;

    // Determine tenant ID from animal or offspring
    const tenantId = reg.animal?.tenantId ?? reg.offspring?.tenantId ?? reg.tenantId;

    // Normalize expirationDate to start of day for accurate day difference
    const expirationStartOfDay = startOfDay(reg.expirationDate);
    const daysUntilExpiration = differenceInDays(expirationStartOfDay, today);

    // Only alert for specific day thresholds: 30, 14, 7, 3, 0 (expired), -7, -14, -30
    const shouldAlert =
      daysUntilExpiration === 30 ||
      daysUntilExpiration === 14 ||
      daysUntilExpiration === 7 ||
      daysUntilExpiration === 3 ||
      daysUntilExpiration === 0 ||
      daysUntilExpiration === -7 ||
      daysUntilExpiration === -14 ||
      daysUntilExpiration === -30;

    if (shouldAlert) {
      alerts.push({
        registrationId: reg.id,
        microchipNumber: reg.microchipNumber,
        registryName: reg.registry.name,
        registryWebsite: reg.registry.website,
        animalId: reg.animalId,
        animalName: reg.animal?.name ?? null,
        offspringId: reg.offspringId,
        offspringName: reg.offspring?.name ?? null,
        expirationDate: reg.expirationDate,
        daysUntilExpiration,
        tenantId,
      });
    }
  }

  return alerts;
}

/**
 * Map days until expiration to notification type and priority
 */
function getMicrochipRenewalNotificationType(
  daysUntilExpiration: number
): { type: NotificationType; priority: NotificationPriority } {
  if (daysUntilExpiration >= 30) {
    return { type: "microchip_renewal_30d", priority: "LOW" };
  } else if (daysUntilExpiration >= 14) {
    return { type: "microchip_renewal_14d", priority: "LOW" };
  } else if (daysUntilExpiration >= 7) {
    return { type: "microchip_renewal_7d", priority: "MEDIUM" };
  } else if (daysUntilExpiration >= 3) {
    return { type: "microchip_renewal_3d", priority: "HIGH" };
  } else {
    // Expired (0 or negative days)
    return { type: "microchip_expired", priority: "URGENT" };
  }
}

/**
 * Get the entity name and type for display
 */
function getEntityInfo(alert: MicrochipRenewalAlert): { name: string; type: "animal" | "offspring"; id: number; linkUrl: string } {
  if (alert.animalId && alert.animalName) {
    return {
      name: alert.animalName,
      type: "animal",
      id: alert.animalId,
      linkUrl: `/animals/${alert.animalId}`,
    };
  } else if (alert.offspringId && alert.offspringName) {
    return {
      name: alert.offspringName,
      type: "offspring",
      id: alert.offspringId,
      linkUrl: `/offspring/${alert.offspringId}`,
    };
  }
  // Fallback - shouldn't happen
  return {
    name: `Microchip ${alert.microchipNumber}`,
    type: "animal",
    id: 0,
    linkUrl: "/animals",
  };
}

/**
 * Create notification records for microchip renewal alerts
 */
export async function createMicrochipRenewalNotifications(alerts: MicrochipRenewalAlert[]): Promise<number> {
  const today = startOfDay(new Date());
  let created = 0;

  for (const alert of alerts) {
    const { type, priority } = getMicrochipRenewalNotificationType(alert.daysUntilExpiration);
    const entity = getEntityInfo(alert);

    // Generate idempotency key to prevent duplicate notifications
    // Format: type:entityType:entityId:registrationId:date
    const idempotencyKey = `${type}:MicrochipRegistration:${alert.registrationId}:${today.toISOString().split("T")[0]}`;

    // Check if notification already exists for today
    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      // Already notified today - skip
      continue;
    }

    // Generate notification content
    let title: string;
    let message: string;

    if (alert.daysUntilExpiration > 0) {
      const daysText = alert.daysUntilExpiration === 1 ? "Tomorrow" : `in ${alert.daysUntilExpiration} Days`;
      title = `Microchip Registration Expires ${daysText}`;
      message = `${entity.name}'s microchip registration with ${alert.registryName} expires ${
        alert.daysUntilExpiration === 1 ? "tomorrow" : `in ${alert.daysUntilExpiration} days`
      } (${alert.expirationDate.toLocaleDateString()}). Renew to keep the registration active.`;
    } else if (alert.daysUntilExpiration === 0) {
      title = "Microchip Registration Expired Today";
      message = `${entity.name}'s microchip registration with ${alert.registryName} has expired today. Renew immediately to maintain microchip database records.`;
    } else {
      const daysOverdue = Math.abs(alert.daysUntilExpiration);
      title = "Microchip Registration Overdue";
      message = `${entity.name}'s microchip registration with ${alert.registryName} is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue. Renew to restore your registration.`;
    }

    // Create notification record
    await prisma.notification.create({
      data: {
        tenantId: alert.tenantId,
        userId: null, // Null = notify all tenant users
        type,
        priority,
        title,
        message,
        linkUrl: entity.linkUrl,
        status: "UNREAD",
        idempotencyKey,
        metadata: {
          microchipRegistrationId: alert.registrationId,
          microchipNumber: alert.microchipNumber,
          registryName: alert.registryName,
          registryWebsite: alert.registryWebsite,
          entityType: entity.type,
          entityId: entity.id,
          entityName: entity.name,
          expirationDate: alert.expirationDate.toISOString(),
          daysUntilExpiration: alert.daysUntilExpiration,
        },
      },
    });

    created++;
  }

  return created;
}

// ────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run the microchip renewal scan
 * Returns scan statistics
 */
export async function runMicrochipRenewalScan(): Promise<ScanResult> {
  console.log("[MicrochipRenewalScanner] Starting scan...");

  // Count total registrations with expiration dates
  const totalWithExpiration = await prisma.animalMicrochipRegistration.count({
    where: {
      expirationDate: {
        not: null,
      },
      registry: {
        renewalType: {
          in: ["ANNUAL", "UNKNOWN"],
        },
      },
    },
  });

  // Scan for alerts
  const alerts = await scanMicrochipRenewals();
  console.log(`[MicrochipRenewalScanner] Found ${alerts.length} renewal alerts`);

  // Create notifications
  const created = await createMicrochipRenewalNotifications(alerts);
  console.log(`[MicrochipRenewalScanner] Created ${created} new notifications`);

  return {
    scannedCount: totalWithExpiration,
    alertsFound: alerts.length,
    notificationsCreated: created,
  };
}
