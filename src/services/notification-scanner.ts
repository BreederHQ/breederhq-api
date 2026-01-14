// src/services/notification-scanner.ts
/**
 * Notification Scanner Service
 *
 * Scans VaccinationRecord and BreedingPlan tables for upcoming events
 * Creates persistent Notification records (health/breeding alerts only)
 * Works with existing ephemeral notification system (messages, invoices, etc.)
 *
 * Architecture: Hybrid Notification System
 * - Ephemeral: Messages, invoices, placements (derived at render time)
 * - Persistent: Vaccinations, breeding timelines (stored in Notification table)
 */

import prisma from "../prisma.js";
import type { NotificationType, NotificationPriority } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface VaccinationAlert {
  vaccinationRecordId: number;
  animalId: number;
  animalName: string;
  protocolKey: string;
  expiresAt: Date;
  daysUntilExpiration: number;
  tenantId: number;
}

interface BreedingAlert {
  breedingPlanId: number;
  damId: number | null;
  damName: string | null;
  sireId: number | null;
  sireName: string | null;
  eventType: "heat_cycle" | "hormone_testing" | "breed_date" | "pregnancy_check" | "foaling" | "foaling_overdue";
  eventDate: Date;
  daysUntilEvent: number;
  tenantId: number;
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
// Vaccination Scanning
// ────────────────────────────────────────────────────────────────────────────

/**
 * Scan for vaccinations expiring within the next 7 days
 * Alert windows: 7 days, 3 days, 1 day, expired, 7 days overdue
 */
export async function scanVaccinationExpirations(): Promise<VaccinationAlert[]> {
  const today = startOfDay(new Date());
  const sevenDaysFromNow = addDays(today, 7);
  const sevenDaysAgo = addDays(today, -7);

  // Find vaccinations that:
  // 1. Expire within next 7 days (for upcoming alerts)
  // 2. Expired within last 7 days (for overdue alerts)
  const vaccinations = await prisma.vaccinationRecord.findMany({
    where: {
      OR: [
        // Upcoming expirations (0-7 days from now)
        {
          expiresAt: {
            gte: today,
            lte: sevenDaysFromNow,
          },
        },
        // Recent expirations (expired up to 7 days ago)
        {
          expiresAt: {
            gte: sevenDaysAgo,
            lt: today,
          },
        },
      ],
    },
    include: {
      animal: {
        select: {
          id: true,
          name: true,
          tenantId: true,
          status: true,
        },
      },
    },
  });

  const alerts: VaccinationAlert[] = [];

  for (const vax of vaccinations) {
    // Skip if animal is deceased or removed
    if (vax.animal.status === "DECEASED") continue;

    // Skip if expiresAt is null (shouldn't happen based on query, but type safety)
    if (!vax.expiresAt) continue;

    // Normalize expiresAt to start of day for accurate day difference calculation
    const expiresAtStartOfDay = startOfDay(vax.expiresAt);
    const daysUntilExpiration = differenceInDays(expiresAtStartOfDay, today);

    // Only alert for specific day thresholds: 7, 3, 1, 0 (expired), -7 (overdue)
    const shouldAlert =
      daysUntilExpiration === 7 ||
      daysUntilExpiration === 3 ||
      daysUntilExpiration === 1 ||
      daysUntilExpiration === 0 ||
      daysUntilExpiration === -7;

    if (shouldAlert) {
      alerts.push({
        vaccinationRecordId: vax.id,
        animalId: vax.animalId,
        animalName: vax.animal.name,
        protocolKey: vax.protocolKey,
        expiresAt: vax.expiresAt,
        daysUntilExpiration,
        tenantId: vax.animal.tenantId,
      });
    }
  }

  return alerts;
}

/**
 * Map days until expiration to notification type and priority
 */
function getVaccinationNotificationType(
  daysUntilExpiration: number
): { type: NotificationType; priority: NotificationPriority } {
  if (daysUntilExpiration === 7) {
    return { type: "vaccination_expiring_7d", priority: "LOW" };
  } else if (daysUntilExpiration === 3) {
    return { type: "vaccination_expiring_3d", priority: "MEDIUM" };
  } else if (daysUntilExpiration === 1) {
    return { type: "vaccination_expiring_1d", priority: "HIGH" };
  } else if (daysUntilExpiration <= 0) {
    return { type: "vaccination_overdue", priority: "URGENT" };
  }
  // Default
  return { type: "vaccination_expiring_7d", priority: "LOW" };
}

/**
 * Create notification records for vaccination alerts
 */
export async function createVaccinationNotifications(alerts: VaccinationAlert[]): Promise<number> {
  const today = startOfDay(new Date());
  let created = 0;

  for (const alert of alerts) {
    const { type, priority } = getVaccinationNotificationType(alert.daysUntilExpiration);

    // Generate idempotency key to prevent duplicate notifications
    // Format: type:entityId:date
    const idempotencyKey = `${type}:VaccinationRecord:${alert.vaccinationRecordId}:${today.toISOString().split("T")[0]}`;

    // Check if notification already exists for today
    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      // Already notified today - skip
      continue;
    }

    // Format protocol key for display (e.g., "horse.rabies" -> "Rabies")
    const vaccineName = alert.protocolKey.split(".").pop()?.replace(/_/g, " ") || alert.protocolKey;
    const vaccineDisplayName = vaccineName.charAt(0).toUpperCase() + vaccineName.slice(1);

    // Generate notification content
    let title: string;
    let message: string;

    if (alert.daysUntilExpiration > 0) {
      title = `Vaccination Due ${alert.daysUntilExpiration === 1 ? "Tomorrow" : `in ${alert.daysUntilExpiration} Days`}`;
      message = `${alert.animalName}'s ${vaccineDisplayName} vaccination expires in ${alert.daysUntilExpiration} day${alert.daysUntilExpiration === 1 ? "" : "s"} (${alert.expiresAt.toLocaleDateString()}). Schedule a vet appointment soon.`;
    } else if (alert.daysUntilExpiration === 0) {
      title = "Vaccination Expired Today";
      message = `${alert.animalName}'s ${vaccineDisplayName} vaccination expired today. This animal may not be eligible for shows/competitions. Schedule a vet visit ASAP.`;
    } else {
      const daysOverdue = Math.abs(alert.daysUntilExpiration);
      title = "Vaccination Overdue";
      message = `${alert.animalName}'s ${vaccineDisplayName} vaccination is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue. Contact your vet immediately.`;
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
        linkUrl: `/animals/${alert.animalId}/health`, // Deep link to animal health tab
        status: "UNREAD",
        idempotencyKey,
        metadata: {
          vaccinationRecordId: alert.vaccinationRecordId,
          animalId: alert.animalId,
          animalName: alert.animalName,
          protocolKey: alert.protocolKey,
          expiresAt: alert.expiresAt.toISOString(),
          daysUntilExpiration: alert.daysUntilExpiration,
        },
      },
    });

    created++;
  }

  return created;
}

// ────────────────────────────────────────────────────────────────────────────
// Breeding Timeline Scanning
// ────────────────────────────────────────────────────────────────────────────

/**
 * Scan for breeding timeline events within the next 30 days
 * Events: heat cycle expected, hormone testing, breed date, foaling
 */
export async function scanBreedingTimeline(): Promise<BreedingAlert[]> {
  const today = startOfDay(new Date());
  const thirtyDaysFromNow = addDays(today, 30);

  // Find active breeding plans with upcoming events
  const plans = await prisma.breedingPlan.findMany({
    where: {
      archived: false,
      deletedAt: null,
      status: {
        notIn: ["COMPLETE", "CANCELED"],
      },
      OR: [
        // Heat cycle expected
        {
          expectedCycleStart: {
            gte: today,
            lte: addDays(today, 3), // 3 days notice
          },
        },
        // Hormone testing
        {
          expectedHormoneTestingStart: {
            gte: today,
            lte: addDays(today, 1), // 1 day notice
          },
        },
        // Breed date approaching
        {
          expectedBreedDate: {
            gte: today,
            lte: addDays(today, 2), // 2 days notice
          },
        },
        // Foaling approaching (multiple windows: 270d, 300d, 320d, 330d, 340d, 30d, 14d, 7d, 3d, 1d)
        // Also check overdue (past expected date but no actual birth recorded)
        {
          expectedBirthDate: {
            gte: addDays(today, -7), // Include up to 7 days overdue
            lte: addDays(today, 340), // Include up to 340 days ahead (full range)
          },
        },
      ],
    },
    select: {
      id: true,
      tenantId: true,
      damId: true,
      sireId: true,
      expectedCycleStart: true,
      expectedHormoneTestingStart: true,
      expectedBreedDate: true,
      expectedBirthDate: true,
      birthDateActual: true,
      dam: {
        select: {
          id: true,
          name: true,
        },
      },
      sire: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const alerts: BreedingAlert[] = [];

  for (const plan of plans) {
    // Heat cycle expected (3 days before)
    if (plan.expectedCycleStart) {
      const eventDateStartOfDay = startOfDay(plan.expectedCycleStart);
      const daysUntil = differenceInDays(eventDateStartOfDay, today);
      if (daysUntil === 3) {
        alerts.push({
          breedingPlanId: plan.id,
          damId: plan.damId,
          damName: plan.dam?.name || "Unknown dam",
          sireId: plan.sireId,
          sireName: plan.sire?.name || "Unknown sire",
          eventType: "heat_cycle",
          eventDate: plan.expectedCycleStart,
          daysUntilEvent: daysUntil,
          tenantId: plan.tenantId,
        });
      }
    }

    // Hormone testing (1 day before)
    if (plan.expectedHormoneTestingStart) {
      const eventDateStartOfDay = startOfDay(plan.expectedHormoneTestingStart);
      const daysUntil = differenceInDays(eventDateStartOfDay, today);
      if (daysUntil === 1) {
        alerts.push({
          breedingPlanId: plan.id,
          damId: plan.damId,
          damName: plan.dam?.name || "Unknown dam",
          sireId: plan.sireId,
          sireName: plan.sire?.name || "Unknown sire",
          eventType: "hormone_testing",
          eventDate: plan.expectedHormoneTestingStart,
          daysUntilEvent: daysUntil,
          tenantId: plan.tenantId,
        });
      }
    }

    // Breed date (2 days before)
    if (plan.expectedBreedDate) {
      const eventDateStartOfDay = startOfDay(plan.expectedBreedDate);
      const daysUntil = differenceInDays(eventDateStartOfDay, today);
      if (daysUntil === 2) {
        alerts.push({
          breedingPlanId: plan.id,
          damId: plan.damId,
          damName: plan.dam?.name || "Unknown dam",
          sireId: plan.sireId,
          sireName: plan.sire?.name || "Unknown sire",
          eventType: "breed_date",
          eventDate: plan.expectedBreedDate,
          daysUntilEvent: daysUntil,
          tenantId: plan.tenantId,
        });
      }
    }

    // Foaling approaching (270d, 300d, 320d, 330d, 340d, 30d, 14d, 7d, 3d, 1d)
    if (plan.expectedBirthDate) {
      const eventDateStartOfDay = startOfDay(plan.expectedBirthDate);
      const daysUntil = differenceInDays(eventDateStartOfDay, today);
      if ([270, 300, 320, 330, 340, 30, 14, 7, 3, 1].includes(daysUntil)) {
        alerts.push({
          breedingPlanId: plan.id,
          damId: plan.damId,
          damName: plan.dam?.name || "Unknown dam",
          sireId: plan.sireId,
          sireName: plan.sire?.name || "Unknown sire",
          eventType: "foaling",
          eventDate: plan.expectedBirthDate,
          daysUntilEvent: daysUntil,
          tenantId: plan.tenantId,
        });
      }

      // Overdue foaling detection (birth date passed, no actual birth recorded)
      if (daysUntil < 0 && !plan.birthDateActual) {
        const daysOverdue = Math.abs(daysUntil);
        // Alert at 1, 3, 7 days overdue
        if ([1, 3, 7].includes(daysOverdue)) {
          alerts.push({
            breedingPlanId: plan.id,
            damId: plan.damId,
            damName: plan.dam?.name || "Unknown dam",
            sireId: plan.sireId,
            sireName: plan.sire?.name || "Unknown sire",
            eventType: "foaling_overdue",
            eventDate: plan.expectedBirthDate,
            daysUntilEvent: daysUntil, // negative value
            tenantId: plan.tenantId,
          });
        }
      }
    }
  }

  return alerts;
}

/**
 * Create notification records for breeding alerts
 */
export async function createBreedingNotifications(alerts: BreedingAlert[]): Promise<number> {
  const today = startOfDay(new Date());
  let created = 0;

  for (const alert of alerts) {
    // Determine notification type and priority based on event type and timing
    let type: NotificationType;
    let priority: NotificationPriority;
    let title: string;
    let message: string;

    switch (alert.eventType) {
      case "heat_cycle":
        type = "breeding_heat_cycle_expected";
        priority = "MEDIUM";
        title = "Heat Cycle Expected Soon";
        message = `${alert.damName} is expected to start her heat cycle in ${alert.daysUntilEvent} days (${alert.eventDate.toLocaleDateString()}). Prepare for hormone testing and breeding.`;
        break;

      case "hormone_testing":
        type = "breeding_hormone_testing_due";
        priority = "HIGH";
        title = "Hormone Testing Tomorrow";
        message = `${alert.damName} is scheduled for hormone testing tomorrow (${alert.eventDate.toLocaleDateString()}). Ensure vet appointment is confirmed.`;
        break;

      case "breed_date":
        type = "breeding_window_approaching";
        priority = "HIGH";
        title = "Breeding Window Approaching";
        message = `${alert.damName} breeding date is in ${alert.daysUntilEvent} days (${alert.eventDate.toLocaleDateString()}). Coordinate with stud owner/vet.`;
        break;

      case "foaling":
        if (alert.daysUntilEvent === 270) {
          type = "foaling_270d";
          priority = "MEDIUM";
          title = `Schedule vet check for ${alert.damName}`;
          message = `${alert.damName} is 9 months pregnant (${alert.eventDate.toLocaleDateString()}). Schedule veterinary pregnancy check.`;
        } else if (alert.daysUntilEvent === 300) {
          type = "foaling_300d";
          priority = "MEDIUM";
          title = `Begin monitoring ${alert.damName}`;
          message = `${alert.damName} is 10 months pregnant. Begin regular monitoring. Expected foaling: ${alert.eventDate.toLocaleDateString()}.`;
        } else if (alert.daysUntilEvent === 320) {
          type = "foaling_320d";
          priority = "HIGH";
          title = `Prepare foaling area for ${alert.damName}`;
          message = `${alert.damName} is due in 20 days (${alert.eventDate.toLocaleDateString()}). Prepare foaling stall and supplies.`;
        } else if (alert.daysUntilEvent === 330) {
          type = "foaling_330d";
          priority = "HIGH";
          title = `Daily checks for ${alert.damName}`;
          message = `${alert.damName} is due in 10 days (${alert.eventDate.toLocaleDateString()}). Begin daily monitoring.`;
        } else if (alert.daysUntilEvent === 340) {
          type = "foaling_approaching";
          priority = "URGENT";
          title = `${alert.damName} due TODAY`;
          message = `Expected foaling date for ${alert.damName} (${alert.eventDate.toLocaleDateString()}). Monitor closely.`;
        } else if (alert.daysUntilEvent === 30) {
          type = "foaling_30d";
          priority = "MEDIUM";
          title = "Foaling in 30 Days";
          message = `${alert.damName} is expected to foal in 30 days (${alert.eventDate.toLocaleDateString()}). Begin preparing foaling area and supplies.`;
        } else if (alert.daysUntilEvent === 14) {
          type = "foaling_14d";
          priority = "HIGH";
          title = "Foaling in 2 Weeks";
          message = `${alert.damName} is expected to foal in 14 days (${alert.eventDate.toLocaleDateString()}). Prepare foaling kit and monitor closely.`;
        } else if (alert.daysUntilEvent === 7) {
          type = "foaling_7d";
          priority = "HIGH";
          title = "Foaling in 1 Week";
          message = `${alert.damName} is expected to foal in 7 days (${alert.eventDate.toLocaleDateString()}). Have vet on standby and monitor 24/7.`;
        } else if (alert.daysUntilEvent === 3) {
          type = "foaling_approaching";
          priority = "URGENT";
          title = "Foaling in 3 Days";
          message = `${alert.damName} is expected to foal in 3 days (${alert.eventDate.toLocaleDateString()}). Monitor constantly. Ensure foaling kit ready.`;
        } else {
          type = "foaling_approaching";
          priority = "URGENT";
          title = "Foaling Expected Tomorrow";
          message = `${alert.damName} is expected to foal TOMORROW (${alert.eventDate.toLocaleDateString()}). Monitor 24/7. Have vet on call.`;
        }
        break;

      case "foaling_overdue":
        type = "foaling_overdue";
        priority = "URGENT";
        const daysOverdue = Math.abs(alert.daysUntilEvent);
        title = `${alert.damName} is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue`;
        message = `${alert.damName} has not foaled yet. Expected date was ${alert.eventDate.toLocaleDateString()}. Contact veterinarian if signs of distress.`;
        break;

      default:
        continue; // Skip unknown event types
    }

    // Generate idempotency key
    const idempotencyKey = `${type}:BreedingPlan:${alert.breedingPlanId}:${today.toISOString().split("T")[0]}`;

    // Check if notification already exists for today
    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      continue; // Already notified today
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
        linkUrl: `/breeding/plans/${alert.breedingPlanId}`, // Deep link to breeding plan
        status: "UNREAD",
        idempotencyKey,
        metadata: {
          breedingPlanId: alert.breedingPlanId,
          damId: alert.damId,
          damName: alert.damName,
          sireId: alert.sireId,
          sireName: alert.sireName,
          eventType: alert.eventType,
          eventDate: alert.eventDate.toISOString(),
          daysUntilEvent: alert.daysUntilEvent,
        },
      },
    });

    created++;
  }

  return created;
}

// ────────────────────────────────────────────────────────────────────────────
// Main Scanner Function
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run all notification scans
 * Returns total number of notifications created
 */
export async function runNotificationScan(): Promise<{ vaccinations: number; breeding: number; total: number }> {
  console.log("[notification-scanner] Starting notification scan...");

  // Scan vaccinations
  const vaccinationAlerts = await scanVaccinationExpirations();
  console.log(`[notification-scanner] Found ${vaccinationAlerts.length} vaccination alerts`);

  const vaccinationsCreated = await createVaccinationNotifications(vaccinationAlerts);
  console.log(`[notification-scanner] Created ${vaccinationsCreated} vaccination notifications`);

  // Scan breeding timeline
  const breedingAlerts = await scanBreedingTimeline();
  console.log(`[notification-scanner] Found ${breedingAlerts.length} breeding alerts`);

  const breedingCreated = await createBreedingNotifications(breedingAlerts);
  console.log(`[notification-scanner] Created ${breedingCreated} breeding notifications`);

  const total = vaccinationsCreated + breedingCreated;
  console.log(`[notification-scanner] Scan complete. Created ${total} total notifications`);

  return {
    vaccinations: vaccinationsCreated,
    breeding: breedingCreated,
    total,
  };
}
