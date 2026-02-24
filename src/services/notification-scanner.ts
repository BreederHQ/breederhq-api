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

interface GuaranteeAlert {
  breedingAttemptId: number;
  damId: number | null;
  damName: string | null;
  sireId: number | null;
  sireName: string | null;
  guaranteeType: string;
  expiresAt: Date;
  daysUntilExpiration: number;
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
        notIn: ["PLAN_COMPLETE", "COMPLETE", "CANCELED", "UNSUCCESSFUL"],
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
// Guarantee Expiration Scanning (P3.3, P3.4 - Horse MVP)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Format guarantee type for display
 */
function formatGuaranteeType(guaranteeType: string): string {
  const labels: Record<string, string> = {
    NO_GUARANTEE: "No Guarantee",
    LIVE_FOAL: "Live Foal",
    STANDS_AND_NURSES: "Stands and Nurses",
    SIXTY_DAY_PREGNANCY: "60-Day Pregnancy",
    CERTIFIED_PREGNANT: "Certified Pregnant",
  };
  return labels[guaranteeType] || guaranteeType.replace(/_/g, " ");
}

/**
 * Determine notification type based on days until expiration
 */
function getGuaranteeNotificationType(
  daysUntil: number
): { type: NotificationType; priority: NotificationPriority } {
  if (daysUntil < 0) {
    return { type: "guarantee_expired", priority: "URGENT" };
  }
  if (daysUntil <= 7) {
    return { type: "guarantee_expiring_7d", priority: "HIGH" };
  }
  if (daysUntil <= 30) {
    return { type: "guarantee_expiring_30d", priority: "MEDIUM" };
  }
  throw new Error(`Invalid days until expiration: ${daysUntil}`);
}

/**
 * Generate notification title for guarantee alerts
 */
function getGuaranteeNotificationTitle(
  alert: GuaranteeAlert,
  type: NotificationType
): string {
  const sireName = alert.sireName || "Unknown Stallion";

  switch (type) {
    case "guarantee_expiring_30d":
      return `Breeding Guarantee Expiring Soon - ${sireName}`;
    case "guarantee_expiring_7d":
      return `Breeding Guarantee Expires in ${alert.daysUntilExpiration} Days`;
    case "guarantee_expired":
      return `Breeding Guarantee Expired - Action Required`;
    default:
      return "Breeding Guarantee Alert";
  }
}

/**
 * Generate notification message for guarantee alerts
 */
function getGuaranteeNotificationMessage(
  alert: GuaranteeAlert,
  type: NotificationType
): string {
  const guaranteeLabel = formatGuaranteeType(alert.guaranteeType);
  const damInfo = alert.damName ? ` (${alert.damName})` : "";
  const expiresDate = alert.expiresAt.toLocaleDateString();

  switch (type) {
    case "guarantee_expiring_30d":
      return `${guaranteeLabel} guarantee for breeding${damInfo} expires on ${expiresDate}. Review breeding outcome and guarantee status.`;
    case "guarantee_expiring_7d":
      return `${guaranteeLabel} guarantee for breeding${damInfo} expires in ${alert.daysUntilExpiration} days. Take action before expiration.`;
    case "guarantee_expired":
      return `${guaranteeLabel} guarantee for breeding${damInfo} has expired. Record outcome or trigger return breeding if applicable.`;
    default:
      return "Review breeding guarantee status.";
  }
}

/**
 * Scan for breeding guarantees expiring within alert windows
 * Alert windows: 30 days, 7 days, expired (no resolution)
 */
export async function scanGuaranteeExpirations(): Promise<GuaranteeAlert[]> {
  const today = startOfDay(new Date());
  const thirtyDaysFromNow = addDays(today, 30);
  const sevenDaysAgo = addDays(today, -7);

  // Find breeding attempts with guarantees that:
  // 1. Have a guarantee type set (not NO_GUARANTEE)
  // 2. Have an expiration date set
  // 3. Are NOT yet resolved (guaranteeResolution is null)
  // 4. Guarantee has not been triggered
  // 5. Expire within alert window OR recently expired
  const attempts = await prisma.breedingAttempt.findMany({
    where: {
      guaranteeType: { notIn: ["NO_GUARANTEE"] },
      guaranteeExpiresAt: { not: null },
      guaranteeTriggered: false,
      guaranteeResolution: null,
      OR: [
        // Expiring within 30 days
        {
          guaranteeExpiresAt: {
            gte: today,
            lte: thirtyDaysFromNow,
          },
        },
        // Expired within last 7 days (needs attention)
        {
          guaranteeExpiresAt: {
            gte: sevenDaysAgo,
            lt: today,
          },
        },
      ],
    },
    include: {
      dam: { select: { id: true, name: true, tenantId: true } },
      sire: { select: { id: true, name: true, tenantId: true } },
    },
  });

  const alerts: GuaranteeAlert[] = [];

  for (const attempt of attempts) {
    if (!attempt.guaranteeExpiresAt || !attempt.guaranteeType) continue;

    const expiresAtStartOfDay = startOfDay(attempt.guaranteeExpiresAt);
    const daysUntilExpiration = differenceInDays(expiresAtStartOfDay, today);

    // Only alert for specific day thresholds: 30, 7, and expired (0 to -7)
    const shouldAlert =
      daysUntilExpiration === 30 ||
      daysUntilExpiration === 7 ||
      (daysUntilExpiration <= 0 && daysUntilExpiration >= -7);

    if (!shouldAlert) continue;

    // Use dam's tenant (mare owner is typically guarantee beneficiary)
    const tenantId = attempt.dam?.tenantId ?? attempt.sire?.tenantId ?? attempt.tenantId;

    alerts.push({
      breedingAttemptId: attempt.id,
      damId: attempt.dam?.id ?? null,
      damName: attempt.dam?.name ?? null,
      sireId: attempt.sire?.id ?? null,
      sireName: attempt.sire?.name ?? null,
      guaranteeType: attempt.guaranteeType,
      expiresAt: attempt.guaranteeExpiresAt,
      daysUntilExpiration,
      tenantId,
    });
  }

  return alerts;
}

/**
 * Create notification records for guarantee alerts
 */
export async function createGuaranteeNotifications(alerts: GuaranteeAlert[]): Promise<number> {
  const today = startOfDay(new Date());
  let created = 0;

  for (const alert of alerts) {
    const { type, priority } = getGuaranteeNotificationType(alert.daysUntilExpiration);
    const title = getGuaranteeNotificationTitle(alert, type);
    const message = getGuaranteeNotificationMessage(alert, type);

    // Generate idempotency key to prevent duplicate notifications
    const idempotencyKey = `${type}:BreedingAttempt:${alert.breedingAttemptId}:${today.toISOString().split("T")[0]}`;

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
        linkUrl: `/breeding/attempts/${alert.breedingAttemptId}`,
        status: "UNREAD",
        idempotencyKey,
        metadata: {
          breedingAttemptId: alert.breedingAttemptId,
          damId: alert.damId,
          damName: alert.damName,
          sireId: alert.sireId,
          sireName: alert.sireName,
          guaranteeType: alert.guaranteeType,
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
// Genetic Test Readiness Scanning
// ────────────────────────────────────────────────────────────────────────────

interface GeneticTestAlert {
  animalId: number;
  animalName: string;
  tenantId: number;
  alertType:
    | "missing"
    | "incomplete"
    | "prebreeding"
    | "carrier_warning"
    | "registration"
    | "recommended";
  // For carrier warnings
  breedingPlanId?: number;
  damId?: number;
  sireId?: number;
  damName?: string;
  sireName?: string;
  gene?: string;
  riskPercentage?: number;
  // For missing/incomplete tests
  missingTests?: string[];
  breed?: string;
}

/**
 * Scans for animals > 30 days old without genetic data
 * Creates genetic_test_missing notifications (LOW priority)
 */
async function scanMissingTests(tenantId?: number): Promise<GeneticTestAlert[]> {
  const alerts: GeneticTestAlert[] = [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Build where clause
  const whereClause: Record<string, unknown> = {
    createdAt: { lt: thirtyDaysAgo },
    status: { notIn: ["SOLD", "DECEASED", "ARCHIVED"] },
    genetics: null, // No AnimalGenetics record at all
  };

  if (tenantId) {
    whereClause.tenantId = tenantId;
  }

  const animalsWithoutGenetics = await prisma.animal.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      species: true,
      breed: true,
      tenantId: true,
    },
  });

  for (const animal of animalsWithoutGenetics) {
    alerts.push({
      animalId: animal.id,
      animalName: animal.name || `Animal #${animal.id}`,
      tenantId: animal.tenantId,
      alertType: "missing",
      breed: animal.breed || undefined,
    });
  }

  // Also check for animals with AnimalGenetics record but empty healthGeneticsData
  const whereClauseIncomplete: Record<string, unknown> = {
    createdAt: { lt: thirtyDaysAgo },
    status: { notIn: ["SOLD", "DECEASED", "ARCHIVED"] },
    genetics: {
      isNot: null,
      healthGeneticsData: { equals: null },
    },
  };

  if (tenantId) {
    whereClauseIncomplete.tenantId = tenantId;
  }

  const animalsWithEmptyGenetics = await prisma.animal.findMany({
    where: whereClauseIncomplete,
    select: {
      id: true,
      name: true,
      species: true,
      breed: true,
      tenantId: true,
    },
  });

  for (const animal of animalsWithEmptyGenetics) {
    // Avoid duplicates if already in alerts
    if (!alerts.some((a) => a.animalId === animal.id)) {
      alerts.push({
        animalId: animal.id,
        animalName: animal.name || `Animal #${animal.id}`,
        tenantId: animal.tenantId,
        alertType: "missing",
        breed: animal.breed || undefined,
      });
    }
  }

  return alerts;
}

/**
 * Scans for breeding plans with breed date within 7 days
 * where dam or sire has no genetic testing
 * Creates genetic_test_prebreeding notifications (HIGH priority)
 */
async function scanPrebreedingTests(tenantId?: number): Promise<GeneticTestAlert[]> {
  const alerts: GeneticTestAlert[] = [];

  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Build where clause for breeding plans with upcoming breed dates
  const whereClause: Record<string, unknown> = {
    status: { in: ["PLANNING", "ACTIVE"] },
    expectedBreedDate: {
      gte: now,
      lte: sevenDaysFromNow,
    },
  };

  if (tenantId) {
    whereClause.tenantId = tenantId;
  }

  const upcomingBreedingPlans = await prisma.breedingPlan.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      tenantId: true,
      damId: true,
      sireId: true,
      dam: {
        select: {
          id: true,
          name: true,
          genetics: {
            select: {
              healthGeneticsData: true,
            },
          },
        },
      },
      sire: {
        select: {
          id: true,
          name: true,
          genetics: {
            select: {
              healthGeneticsData: true,
            },
          },
        },
      },
    },
  });

  for (const plan of upcomingBreedingPlans) {
    const damHasGenetics = plan.dam?.genetics?.healthGeneticsData != null;
    const sireHasGenetics = plan.sire?.genetics?.healthGeneticsData != null;

    // Alert if either dam or sire is missing genetic tests
    if (plan.dam && !damHasGenetics) {
      alerts.push({
        animalId: plan.dam.id,
        animalName: plan.dam.name || `Dam #${plan.dam.id}`,
        tenantId: plan.tenantId,
        alertType: "prebreeding",
        breedingPlanId: plan.id,
        damId: plan.dam.id,
        damName: plan.dam.name,
        sireId: plan.sire?.id,
        sireName: plan.sire?.name,
      });
    }

    if (plan.sire && !sireHasGenetics) {
      // Avoid duplicate if we already added dam alert for same plan
      const existingAlert = alerts.find(
        (a) => a.breedingPlanId === plan.id && a.alertType === "prebreeding"
      );
      if (!existingAlert) {
        alerts.push({
          animalId: plan.sire.id,
          animalName: plan.sire.name || `Sire #${plan.sire.id}`,
          tenantId: plan.tenantId,
          alertType: "prebreeding",
          breedingPlanId: plan.id,
          damId: plan.dam?.id,
          damName: plan.dam?.name,
          sireId: plan.sire.id,
          sireName: plan.sire.name,
        });
      }
    }
  }

  return alerts;
}

// ────────────────────────────────────────────────────────────────────────────
// Genetic Notification Preference Checking
// ────────────────────────────────────────────────────────────────────────────

// Default preferences (used when no record exists)
const DEFAULT_GENETIC_PREFS = {
  inAppMissing: true,
  inAppIncomplete: true,
  inAppCarrier: true, // Cannot be disabled
  inAppPrebreeding: true,
  inAppRegistry: true,
  inAppRecommended: false,
  emailMissing: false,
  emailIncomplete: false,
  emailCarrier: true,
  emailPrebreeding: true,
  emailRegistry: true,
  emailRecommended: false,
};

// Map notification types to preference fields
const GENETIC_PREF_MAP: Record<string, { inApp: keyof typeof DEFAULT_GENETIC_PREFS; email: keyof typeof DEFAULT_GENETIC_PREFS }> = {
  genetic_test_missing: { inApp: "inAppMissing", email: "emailMissing" },
  genetic_test_incomplete: { inApp: "inAppIncomplete", email: "emailIncomplete" },
  genetic_test_carrier_warning: { inApp: "inAppCarrier", email: "emailCarrier" },
  genetic_test_prebreeding: { inApp: "inAppPrebreeding", email: "emailPrebreeding" },
  genetic_test_registration: { inApp: "inAppRegistry", email: "emailRegistry" },
  genetic_test_recommended: { inApp: "inAppRecommended", email: "emailRecommended" },
};

/**
 * Check if a genetic notification should be shown/sent to a specific user
 * Takes into account user preferences and active snoozes.
 *
 * @param userId - User ID to check preferences for
 * @param tenantId - Tenant ID
 * @param notificationType - The genetic notification type (e.g., "genetic_test_missing")
 * @param animalId - Optional animal ID for snooze checking
 * @param testCode - Optional test code for snooze checking (e.g., "HYPP", "OLWS")
 * @returns Object with inApp and email booleans
 */
export async function shouldShowGeneticNotification(
  userId: string,
  tenantId: number,
  notificationType: string,
  animalId?: number,
  testCode?: string
): Promise<{ inApp: boolean; email: boolean }> {
  // Get the preference field names for this notification type
  const prefFields = GENETIC_PREF_MAP[notificationType];
  if (!prefFields) {
    // Unknown notification type - default to showing
    return { inApp: true, email: false };
  }

  // Check for active snoozes
  const snoozeConditions: any[] = [];

  if (animalId) {
    snoozeConditions.push({ snoozeType: "ANIMAL", animalId });
  }
  if (testCode) {
    snoozeConditions.push({ snoozeType: "TEST", testCode });
  }
  if (animalId && testCode) {
    snoozeConditions.push({ snoozeType: "ANIMAL_TEST", animalId, testCode });
  }

  if (snoozeConditions.length > 0) {
    const activeSnoozes = await prisma.geneticNotificationSnooze.findMany({
      where: {
        userId,
        tenantId,
        OR: snoozeConditions,
        // Only check active snoozes (permanent or not yet expired)
        AND: {
          OR: [{ snoozedUntil: null }, { snoozedUntil: { gt: new Date() } }],
        },
      },
    });

    if (activeSnoozes.length > 0) {
      // User has snoozed this notification
      return { inApp: false, email: false };
    }
  }

  // Get user preferences (or use defaults)
  const prefs = await prisma.geneticNotificationPreference.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });

  // CRITICAL: Carrier warnings cannot be disabled for in-app
  if (notificationType === "genetic_test_carrier_warning") {
    return {
      inApp: true, // Always show carrier warnings in-app
      email: prefs?.emailCarrier ?? DEFAULT_GENETIC_PREFS.emailCarrier,
    };
  }

  return {
    inApp: prefs?.[prefFields.inApp] ?? DEFAULT_GENETIC_PREFS[prefFields.inApp],
    email: prefs?.[prefFields.email] ?? DEFAULT_GENETIC_PREFS[prefFields.email],
  };
}

/**
 * Check if a genetic notification should be created at the tenant level
 * This is a simplified check that only looks at tenant-wide defaults.
 * User-specific filtering happens at query/delivery time.
 *
 * Note: This function returns true for most notification types to ensure
 * notifications are created. Individual users can then filter based on
 * their preferences when viewing notifications.
 */
export function shouldCreateGeneticNotificationForTenant(
  alertType: GeneticTestAlert["alertType"]
): boolean {
  // Always create notifications at the tenant level
  // User preferences are checked at display/delivery time
  return true;
}

/**
 * Scans for genetic test-related notifications
 * - Missing tests (animals > 30 days without genetic data)
 * - Pre-breeding reminders (7 days before planned breeding)
 *
 * Note: Carrier × Carrier detection is handled in breeding plan routes
 * (see carrier-detection.ts) for immediate feedback on plan creation/update.
 */
export async function scanGeneticTestReadiness(tenantId?: number): Promise<GeneticTestAlert[]> {
  const alerts: GeneticTestAlert[] = [];

  // Scan for missing tests (Phase 3)
  const missingTestAlerts = await scanMissingTests(tenantId);
  alerts.push(...missingTestAlerts);

  // Scan for pre-breeding tests (Phase 3)
  const prebreedingAlerts = await scanPrebreedingTests(tenantId);
  alerts.push(...prebreedingAlerts);

  const logSuffix = tenantId ? ` for tenant ${tenantId}` : "";
  console.log(
    `[Notification Scanner] Genetic test scan complete${logSuffix}: ${missingTestAlerts.length} missing, ${prebreedingAlerts.length} prebreeding`
  );

  return alerts;
}

/**
 * Create notification records for genetic test alerts
 * Uses idempotency keys to prevent duplicate notifications
 */
export async function createGeneticTestNotifications(alerts: GeneticTestAlert[]): Promise<number> {
  let created = 0;

  for (const alert of alerts) {
    let notificationType: NotificationType;
    let priority: NotificationPriority;
    let title: string;
    let message: string;
    let linkUrl: string;
    let idempotencyKey: string;

    switch (alert.alertType) {
      case "missing":
        notificationType = "genetic_test_missing";
        priority = "LOW";
        title = "No Genetic Panel on File";
        message = `${alert.animalName} has no genetic test results. Genetic testing helps make informed breeding decisions and meets registry requirements.`;
        linkUrl = `/animals/${alert.animalId}/genetics`;
        idempotencyKey = `genetic_test_missing:Animal:${alert.animalId}`;
        break;

      case "incomplete":
        notificationType = "genetic_test_incomplete";
        priority = "LOW";
        title = "Incomplete Genetic Testing";
        message = `${alert.animalName} has partial genetic testing. Consider completing the panel for comprehensive breeding decisions.`;
        linkUrl = `/animals/${alert.animalId}/genetics`;
        idempotencyKey = `genetic_test_incomplete:Animal:${alert.animalId}`;
        break;

      case "prebreeding":
        notificationType = "genetic_test_prebreeding";
        priority = "HIGH";
        title = "Genetic Testing Recommended Before Breeding";
        message = alert.damName && alert.sireName
          ? `Breeding plan for ${alert.damName} × ${alert.sireName} is scheduled within 7 days. ${alert.animalName} has no genetic test results on file.`
          : `${alert.animalName} is scheduled for breeding within 7 days but has no genetic test results on file.`;
        linkUrl = alert.breedingPlanId
          ? `/breeding/plans/${alert.breedingPlanId}`
          : `/animals/${alert.animalId}/genetics`;
        idempotencyKey = `genetic_test_prebreeding:BreedingPlan:${alert.breedingPlanId}:Animal:${alert.animalId}`;
        break;

      case "carrier_warning":
        // Carrier warnings are handled in carrier-detection.ts during plan creation/update
        // This is just a fallback if scanner finds one
        notificationType = "genetic_test_carrier_warning";
        priority = "URGENT";
        title = "Lethal Pairing Risk Detected";
        message = alert.gene
          ? `Both ${alert.damName} and ${alert.sireName} are carriers of ${alert.gene}. Breeding has a ${alert.riskPercentage}% chance of producing affected offspring.`
          : `Carrier × carrier pairing detected for ${alert.damName} × ${alert.sireName}.`;
        linkUrl = `/breeding/plans/${alert.breedingPlanId}`;
        idempotencyKey = `genetic_test_carrier_warning:BreedingPlan:${alert.breedingPlanId}:${alert.gene}`;
        break;

      case "registration":
        notificationType = "genetic_test_registration";
        priority = "MEDIUM";
        title = "Registry Requires Genetic Testing";
        message = `${alert.animalName} needs genetic testing for registry requirements.`;
        linkUrl = `/animals/${alert.animalId}/genetics`;
        idempotencyKey = `genetic_test_registration:Animal:${alert.animalId}`;
        break;

      case "recommended":
        notificationType = "genetic_test_recommended";
        priority = "LOW";
        title = "Genetic Tests Recommended";
        message = `Based on breed and discipline, genetic testing is recommended for ${alert.animalName}.`;
        linkUrl = `/animals/${alert.animalId}/genetics`;
        idempotencyKey = `genetic_test_recommended:Animal:${alert.animalId}`;
        break;

      default:
        continue;
    }

    // Check if notification already exists (idempotency)
    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      continue;
    }

    // Create notification
    await prisma.notification.create({
      data: {
        tenantId: alert.tenantId,
        type: notificationType,
        priority,
        title,
        message,
        linkUrl,
        status: "UNREAD",
        idempotencyKey,
        metadata: {
          animalId: alert.animalId,
          animalName: alert.animalName,
          alertType: alert.alertType,
          breed: alert.breed,
          breedingPlanId: alert.breedingPlanId,
          damId: alert.damId,
          damName: alert.damName,
          sireId: alert.sireId,
          sireName: alert.sireName,
          gene: alert.gene,
          riskPercentage: alert.riskPercentage,
          missingTests: alert.missingTests,
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
export async function runNotificationScan(): Promise<{
  vaccinations: number;
  breeding: number;
  guarantees: number;
  geneticTests: number;
  total: number;
}> {
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

  // Scan guarantee expirations (P3.4 - Horse MVP)
  const guaranteeAlerts = await scanGuaranteeExpirations();
  console.log(`[notification-scanner] Found ${guaranteeAlerts.length} guarantee alerts`);

  const guaranteesCreated = await createGuaranteeNotifications(guaranteeAlerts);
  console.log(`[notification-scanner] Created ${guaranteesCreated} guarantee notifications`);

  // Scan genetic test readiness (Phase 1 - skeleton only)
  const geneticTestAlerts = await scanGeneticTestReadiness();
  console.log(`[notification-scanner] Found ${geneticTestAlerts.length} genetic test alerts`);

  const geneticTestsCreated = await createGeneticTestNotifications(geneticTestAlerts);
  console.log(`[notification-scanner] Created ${geneticTestsCreated} genetic test notifications`);

  const total = vaccinationsCreated + breedingCreated + guaranteesCreated + geneticTestsCreated;
  console.log(`[notification-scanner] Scan complete. Created ${total} total notifications`);

  return {
    vaccinations: vaccinationsCreated,
    breeding: breedingCreated,
    guarantees: guaranteesCreated,
    geneticTests: geneticTestsCreated,
    total,
  };
}
