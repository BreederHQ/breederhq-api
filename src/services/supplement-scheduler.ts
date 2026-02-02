// src/services/supplement-scheduler.ts
/**
 * Supplement Scheduler Service
 *
 * Handles date calculations for supplement schedules:
 * - Breeding-relative dates (anchor event + offset)
 * - Age-based triggers
 * - Next due date calculations
 * - Recalculation when breeding plan dates change
 */

import type {
  SupplementProtocol,
  BreedingPlan,
  SupplementSchedule,
  SupplementAdministration,
  SupplementFrequency,
  BreedingCycleAnchorEvent,
} from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface CalculatedSchedule {
  calculatedStartDate: Date;
  calculatedEndDate: Date | null;
  totalDoses: number | null;
  nextDueDate: Date | null;
}

export interface ScheduleCalculationError {
  code: "MISSING_ANCHOR_DATE" | "MISSING_BREEDING_PLAN" | "MISSING_START_DATE" | "MISSING_BIRTH_DATE";
  message: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Date Utilities
// ────────────────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Anchor Date Resolution
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get the anchor date from a breeding plan based on the anchor event type.
 * Prefers actual dates over expected dates when available.
 */
export function getAnchorDate(
  event: BreedingCycleAnchorEvent,
  plan: Pick<
    BreedingPlan,
    | "expectedCycleStart"
    | "cycleStartDateActual"
    | "expectedBreedDate"
    | "breedDateActual"
    | "expectedBirthDate"
    | "birthDateActual"
    | "expectedWeaned"
    | "weanedDateActual"
  >
): Date | null {
  switch (event) {
    case "CYCLE_START":
      return plan.cycleStartDateActual ?? plan.expectedCycleStart ?? null;
    case "BREED_DATE":
      return plan.breedDateActual ?? plan.expectedBreedDate ?? null;
    case "BIRTH_DATE":
      return plan.birthDateActual ?? plan.expectedBirthDate ?? null;
    case "WEANED_DATE":
      return plan.weanedDateActual ?? plan.expectedWeaned ?? null;
    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Dose Calculations
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate total number of doses based on duration and frequency.
 * Returns null for ONGOING supplements (no fixed end).
 */
export function calculateTotalDoses(
  durationDays: number | null,
  frequency: SupplementFrequency
): number | null {
  if (!durationDays) return null; // ONGOING
  if (frequency === "ONCE") return 1;
  if (frequency === "ONGOING") return null;

  const frequencyDays: Record<string, number> = {
    DAILY: 1,
    EVERY_OTHER_DAY: 2,
    EVERY_3_DAYS: 3,
    WEEKLY: 7,
  };

  const interval = frequencyDays[frequency] || 1;
  return Math.ceil(durationDays / interval);
}

/**
 * Get the interval in days between doses for a given frequency.
 */
export function getFrequencyIntervalDays(frequency: SupplementFrequency): number {
  const intervals: Record<SupplementFrequency, number> = {
    ONCE: 0,
    DAILY: 1,
    EVERY_OTHER_DAY: 2,
    EVERY_3_DAYS: 3,
    WEEKLY: 7,
    ONGOING: 1, // Default to daily for ongoing
  };
  return intervals[frequency] ?? 1;
}

// ────────────────────────────────────────────────────────────────────────────
// Schedule Date Calculation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate schedule dates from protocol and breeding plan.
 *
 * @param protocol - The supplement protocol with trigger configuration
 * @param breedingPlan - The breeding plan (required for BREEDING_CYCLE_RELATIVE)
 * @param manualStartDate - User-provided start date (required for MANUAL)
 * @param animalBirthDate - Animal's birth date (required for AGE_BASED)
 */
export function calculateScheduleDates(
  protocol: Pick<
    SupplementProtocol,
    "triggerType" | "anchorEvent" | "offsetDays" | "ageTriggerWeeks" | "durationDays" | "frequency"
  >,
  breedingPlan?: Pick<
    BreedingPlan,
    | "expectedCycleStart"
    | "cycleStartDateActual"
    | "expectedBreedDate"
    | "breedDateActual"
    | "expectedBirthDate"
    | "birthDateActual"
    | "expectedWeaned"
    | "weanedDateActual"
  > | null,
  manualStartDate?: Date | null,
  animalBirthDate?: Date | null
): CalculatedSchedule | ScheduleCalculationError {
  let startDate: Date;

  if (protocol.triggerType === "MANUAL") {
    if (!manualStartDate) {
      return {
        code: "MISSING_START_DATE",
        message: "Manual start date is required for MANUAL trigger type",
      };
    }
    startDate = startOfDay(manualStartDate);
  } else if (protocol.triggerType === "BREEDING_CYCLE_RELATIVE") {
    if (!breedingPlan) {
      return {
        code: "MISSING_BREEDING_PLAN",
        message: "Breeding plan is required for BREEDING_CYCLE_RELATIVE trigger type",
      };
    }
    if (!protocol.anchorEvent) {
      return {
        code: "MISSING_ANCHOR_DATE",
        message: "Protocol anchor event is not configured",
      };
    }
    const anchorDate = getAnchorDate(protocol.anchorEvent, breedingPlan);
    if (!anchorDate) {
      return {
        code: "MISSING_ANCHOR_DATE",
        message: `Anchor date not available for event: ${protocol.anchorEvent}`,
      };
    }
    startDate = startOfDay(addDays(anchorDate, protocol.offsetDays || 0));
  } else if (protocol.triggerType === "AGE_BASED") {
    if (!animalBirthDate) {
      return {
        code: "MISSING_BIRTH_DATE",
        message: "Animal birth date is required for AGE_BASED trigger type",
      };
    }
    if (!protocol.ageTriggerWeeks) {
      return {
        code: "MISSING_ANCHOR_DATE",
        message: "Protocol age trigger weeks is not configured",
      };
    }
    // Convert weeks to days
    startDate = startOfDay(addDays(animalBirthDate, protocol.ageTriggerWeeks * 7));
  } else {
    return {
      code: "MISSING_ANCHOR_DATE",
      message: `Unknown trigger type: ${protocol.triggerType}`,
    };
  }

  const endDate = protocol.durationDays ? addDays(startDate, protocol.durationDays - 1) : null;

  const totalDoses = calculateTotalDoses(protocol.durationDays, protocol.frequency);

  return {
    calculatedStartDate: startDate,
    calculatedEndDate: endDate,
    totalDoses,
    nextDueDate: startDate, // Initially, next due is start date
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Next Due Date Calculation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the next due date based on last administration and frequency.
 *
 * @param schedule - The supplement schedule
 * @param protocol - The protocol with frequency info
 * @param lastAdministration - The most recent administration (optional)
 */
export function calculateNextDueDate(
  schedule: Pick<
    SupplementSchedule,
    "status" | "calculatedStartDate" | "startDateOverride" | "calculatedEndDate"
  >,
  protocol: Pick<SupplementProtocol, "frequency">,
  lastAdministration?: Pick<SupplementAdministration, "administeredAt"> | null
): Date | null {
  // No next due date for terminal statuses
  if (schedule.status === "COMPLETED" || schedule.status === "CANCELLED" || schedule.status === "SKIPPED") {
    return null;
  }

  // If no administrations yet, next due is start date
  if (!lastAdministration) {
    return schedule.startDateOverride ?? schedule.calculatedStartDate;
  }

  // For ONCE frequency, there's no "next" dose
  if (protocol.frequency === "ONCE") {
    return null;
  }

  // Calculate next based on frequency interval
  const interval = getFrequencyIntervalDays(protocol.frequency);
  const nextDue = addDays(lastAdministration.administeredAt, interval);

  // If we've passed the end date, return null
  if (schedule.calculatedEndDate && nextDue > schedule.calculatedEndDate) {
    return null;
  }

  return nextDue;
}

// ────────────────────────────────────────────────────────────────────────────
// Recalculation on Plan Change
// ────────────────────────────────────────────────────────────────────────────

/**
 * Recalculate a schedule's dates when the breeding plan dates change.
 * Only affects BREEDING_LINKED schedules.
 *
 * @param schedule - The existing schedule
 * @param protocol - The protocol with trigger configuration
 * @param breedingPlan - The updated breeding plan
 */
export function recalculateScheduleFromPlan(
  schedule: Pick<SupplementSchedule, "mode" | "status" | "completedDoses">,
  protocol: Pick<
    SupplementProtocol,
    "triggerType" | "anchorEvent" | "offsetDays" | "ageTriggerWeeks" | "durationDays" | "frequency"
  >,
  breedingPlan: Pick<
    BreedingPlan,
    | "expectedCycleStart"
    | "cycleStartDateActual"
    | "expectedBreedDate"
    | "breedDateActual"
    | "expectedBirthDate"
    | "birthDateActual"
    | "expectedWeaned"
    | "weanedDateActual"
  >
): CalculatedSchedule | ScheduleCalculationError | null {
  // Only recalculate for breeding-linked schedules
  if (schedule.mode !== "BREEDING_LINKED") {
    return null;
  }

  // Don't recalculate completed or cancelled schedules
  if (schedule.status === "COMPLETED" || schedule.status === "CANCELLED") {
    return null;
  }

  // Recalculate dates
  const result = calculateScheduleDates(protocol, breedingPlan);

  if ("code" in result) {
    return result; // Return error
  }

  // Adjust for already completed doses
  if (schedule.completedDoses > 0 && result.totalDoses !== null) {
    // If some doses were already administered, don't reset nextDueDate to start
    // The caller should recalculate nextDueDate based on last administration
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Utility: Check if schedule is overdue
// ────────────────────────────────────────────────────────────────────────────

/**
 * Check if a schedule's next dose is overdue.
 */
export function isScheduleOverdue(
  schedule: Pick<SupplementSchedule, "nextDueDate" | "status">
): boolean {
  if (!schedule.nextDueDate) return false;
  if (schedule.status === "COMPLETED" || schedule.status === "CANCELLED") return false;

  const today = startOfDay(new Date());
  const dueDate = startOfDay(schedule.nextDueDate);

  return dueDate < today;
}

/**
 * Get the number of days until/since the next due date.
 * Positive = days until due, Negative = days overdue.
 */
export function getDaysUntilDue(nextDueDate: Date | null): number | null {
  if (!nextDueDate) return null;

  const today = startOfDay(new Date());
  const dueDate = startOfDay(nextDueDate);

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((dueDate.getTime() - today.getTime()) / msPerDay);
}
