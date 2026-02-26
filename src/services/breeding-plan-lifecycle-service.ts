// src/services/breeding-plan-lifecycle-service.ts
/**
 * Breeding Plan Lifecycle Service
 *
 * Manages post-birth lifecycle on BreedingPlan directly:
 *   BIRTHED -> BORN -> WEANED -> PLACEMENT -> PLAN_COMPLETE
 *   Any -> DISSOLVED (all offspring deceased)
 *
 * Note: WEANING is not a valid BreedingPlanStatus enum value in the DB schema.
 * The transition from BORN to WEANED is direct (no intermediate WEANING state).
 */

import type { PrismaClient } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export class LifecycleError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "LifecycleError";
  }
}

/** Plan-level lifecycle statuses (post-birth portion) */
export type PlanLifecycleStatus =
  | "BIRTHED"
  | "BORN"
  | "WEANED"
  | "PLACEMENT"
  | "PLAN_COMPLETE"
  | "DISSOLVED";

/** Ordered post-birth progression on the plan (DISSOLVED is lateral, not in this array) */
const PLAN_STATUS_ORDER: PlanLifecycleStatus[] = [
  "BIRTHED",
  "BORN",
  "WEANED",
  "PLACEMENT",
  "PLAN_COMPLETE",
];

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ─── Species Post-Birth Intervals (days from birth) ────────────────────────

const SPECIES_POST_BIRTH_INTERVALS: Record<
  string,
  { weanDays: number; placementStartDays: number; placementCompletedDays: number }
> = {
  DOG:     { weanDays: 56,  placementStartDays: 63,  placementCompletedDays: 84 },
  CAT:     { weanDays: 56,  placementStartDays: 63,  placementCompletedDays: 84 },
  HORSE:   { weanDays: 180, placementStartDays: 210, placementCompletedDays: 365 },
  RABBIT:  { weanDays: 42,  placementStartDays: 49,  placementCompletedDays: 70 },
  GOAT:    { weanDays: 60,  placementStartDays: 84,  placementCompletedDays: 112 },
  SHEEP:   { weanDays: 60,  placementStartDays: 84,  placementCompletedDays: 112 },
  ALPACA:  { weanDays: 180, placementStartDays: 210, placementCompletedDays: 365 },
  LLAMA:   { weanDays: 180, placementStartDays: 210, placementCompletedDays: 365 },
};

function addDaysUTC(date: Date, days: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
      12, 0, 0, 0,
    ),
  );
}

/**
 * Calculate expected post-birth dates for a breeding plan.
 * Starts at birth date, calculates weaning/placement milestones.
 */
export function calculateGroupExpectedDates(
  birthDate: Date,
  species: string,
): {
  expectedWeanedAt: Date;
  expectedPlacementStartAt: Date;
  expectedPlacementCompletedAt: Date;
} {
  const intervals = SPECIES_POST_BIRTH_INTERVALS[species.toUpperCase()]
    ?? SPECIES_POST_BIRTH_INTERVALS.DOG;

  return {
    expectedWeanedAt: addDaysUTC(birthDate, intervals.weanDays),
    expectedPlacementStartAt: addDaysUTC(birthDate, intervals.placementStartDays),
    expectedPlacementCompletedAt: addDaysUTC(birthDate, intervals.placementCompletedDays),
  };
}

// ─── Lifecycle State Machine ───────────────────────────────────────────────

/**
 * Advance the breeding plan through post-birth lifecycle statuses.
 * Validates preconditions before advancing.
 *
 * If `targetStatus` is provided, advances to that specific status
 * (must be exactly one step forward). Otherwise advances to next.
 */
export async function advancePlanLifecycle(
  prisma: PrismaClient,
  planId: number,
  tenantId: number,
  targetStatus?: PlanLifecycleStatus,
): Promise<any> {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.breedingPlan.findFirst({
      where: { id: planId, tenantId, deletedAt: null },
    });

    if (!plan) {
      throw new LifecycleError("GROUP_NOT_FOUND", "Breeding plan not found");
    }

    const current = plan.status as PlanLifecycleStatus;
    const currentIdx = PLAN_STATUS_ORDER.indexOf(current);

    if (current === "DISSOLVED") {
      throw new LifecycleError("CANNOT_ADVANCE_DISSOLVED", "Cannot advance a dissolved plan");
    }
    if (current === "PLAN_COMPLETE") {
      throw new LifecycleError("ALREADY_COMPLETE", "Plan is already complete");
    }
    if (currentIdx < 0) {
      throw new LifecycleError("INVALID_STATUS", `Current status ${current} is not a post-birth lifecycle status`);
    }

    const nextStatus = targetStatus ?? PLAN_STATUS_ORDER[currentIdx + 1];
    if (!nextStatus) {
      throw new LifecycleError("NO_NEXT_STATUS", "No next status available");
    }

    // Validate target is exactly one step forward
    const nextIdx = PLAN_STATUS_ORDER.indexOf(nextStatus);
    if (nextIdx !== currentIdx + 1) {
      throw new LifecycleError(
        "INVALID_TARGET",
        `Cannot advance from ${current} to ${nextStatus}. Expected ${PLAN_STATUS_ORDER[currentIdx + 1]}.`,
      );
    }

    const offspring = await tx.offspring.findMany({
      where: { breedingPlanId: planId, tenantId, archivedAt: null },
      select: { id: true, lifeState: true, placementState: true, keeperIntent: true },
    });

    validatePlanAdvanceCondition(current, nextStatus, plan, offspring);

    const updated = await tx.breedingPlan.update({
      where: { id: planId },
      data: {
        status: nextStatus as any,
        ...(nextStatus === "PLAN_COMPLETE" ? { completedDateActual: new Date() } : {}),
      },
    });

    return updated;
  });
}

/**
 * Rewind the breeding plan to the previous lifecycle status.
 * Clears relevant date fields as side effects.
 */
export async function rewindPlanLifecycle(
  prisma: PrismaClient,
  planId: number,
  tenantId: number,
): Promise<any> {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.breedingPlan.findFirst({
      where: { id: planId, tenantId, deletedAt: null },
    });

    if (!plan) {
      throw new LifecycleError("GROUP_NOT_FOUND", "Breeding plan not found");
    }

    const current = plan.status as PlanLifecycleStatus;

    if (current === "BIRTHED") {
      const offspringCount = await tx.offspring.count({
        where: { breedingPlanId: planId, tenantId, archivedAt: null },
      });
      if (offspringCount > 0) {
        throw new LifecycleError(
          "CANNOT_REWIND",
          "Cannot rewind past BIRTHED because offspring exist. Remove offspring first.",
        );
      }
      throw new LifecycleError("CANNOT_REWIND_PENDING", "Plan is at BIRTHED — use the plan PATCH endpoint to change pre-birth statuses");
    }
    if (current === "DISSOLVED") {
      throw new LifecycleError("CANNOT_REWIND_DISSOLVED", "Cannot rewind a dissolved plan");
    }

    const currentIdx = PLAN_STATUS_ORDER.indexOf(current);
    if (currentIdx <= 0) {
      throw new LifecycleError("CANNOT_REWIND", `Cannot rewind from ${current}`);
    }

    const previousStatus = PLAN_STATUS_ORDER[currentIdx - 1];

    const planPatch: Record<string, any> = {
      status: previousStatus as any,
    };

    switch (current) {
      case "PLAN_COMPLETE":
        planPatch.completedDateActual = null;
        break;
      case "PLACEMENT":
        planPatch.placementStartDateActual = null;
        break;
      case "WEANED":
        planPatch.weanedDateActual = null;
        break;
      case "BORN":
        planPatch.birthDateActual = null;
        planPatch.expectedWeaned = null;
        planPatch.expectedPlacementStart = null;
        planPatch.expectedPlacementCompleted = null;
        break;
    }

    const updated = await tx.breedingPlan.update({
      where: { id: planId },
      data: planPatch,
    });

    return updated;
  });
}

/**
 * Dissolve a plan (all offspring deceased).
 * Can happen from any post-birth status.
 */
export async function dissolvePlan(
  prisma: PrismaClient,
  planId: number,
  tenantId: number,
): Promise<any> {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.breedingPlan.findFirst({
      where: { id: planId, tenantId, deletedAt: null },
    });

    if (!plan) {
      throw new LifecycleError("GROUP_NOT_FOUND", "Breeding plan not found");
    }

    if (plan.status === "DISSOLVED") {
      return plan;
    }

    const liveCount = await tx.offspring.count({
      where: { breedingPlanId: planId, tenantId, archivedAt: null, lifeState: "ALIVE" },
    });

    if (liveCount > 0) {
      throw new LifecycleError(
        "LIVE_OFFSPRING_EXIST",
        `Cannot dissolve plan: ${liveCount} live offspring remain`,
      );
    }

    const updated = await tx.breedingPlan.update({
      where: { id: planId },
      data: { status: "DISSOLVED" as any },
    });

    return updated;
  });
}

/**
 * Auto-advance the plan status if a date gate is now satisfied.
 * Called after date patches to automatically move the lifecycle forward.
 */
export async function autoAdvancePlanIfReady(
  tx: PrismaTransaction,
  planId: number,
  tenantId: number,
): Promise<string | null> {
  const plan = await tx.breedingPlan.findFirst({
    where: { id: planId, tenantId, deletedAt: null },
  });

  if (!plan) return null;

  const current = plan.status as PlanLifecycleStatus;
  const currentIdx = PLAN_STATUS_ORDER.indexOf(current);
  if (currentIdx < 0) return null;

  // BORN→WEANED requires explicit user action (advance-lifecycle call).
  // Skipping auto-advance here prevents a race where the weanedDate PATCH would
  // auto-advance to WEANED before the frontend's advance-lifecycle call fires.
  if (current === "BORN") return null;

  const nextStatus = PLAN_STATUS_ORDER[currentIdx + 1];
  if (!nextStatus || current === "DISSOLVED" || current === "PLAN_COMPLETE") {
    return null;
  }

  const offspring = await tx.offspring.findMany({
    where: { breedingPlanId: planId, tenantId, archivedAt: null },
    select: { id: true, lifeState: true, placementState: true, keeperIntent: true },
  });

  try {
    validatePlanAdvanceCondition(current, nextStatus, plan, offspring);
  } catch {
    return null;
  }

  await tx.breedingPlan.update({
    where: { id: planId },
    data: {
      status: nextStatus as any,
      ...(nextStatus === "PLAN_COMPLETE" ? { completedDateActual: new Date() } : {}),
    },
  });

  return nextStatus;
}

// ─── Validation Helpers ────────────────────────────────────────────────────

/**
 * Validates that preconditions are met for a plan lifecycle transition.
 * Uses plan fields for date checks and offspring records for count/state checks.
 */
function validatePlanAdvanceCondition(
  from: PlanLifecycleStatus,
  to: PlanLifecycleStatus,
  plan: any,
  offspring: Array<{ id: number; lifeState: string | null; placementState: string | null; keeperIntent: string | null }>,
): void {
  switch (`${from}→${to}`) {
    case "BIRTHED→BORN":
      if (!plan.birthDateActual) {
        throw new LifecycleError(
          "BIRTH_DATE_REQUIRED",
          "birthDateActual must be set to advance to BORN",
        );
      }
      break;

    case "BORN→WEANED": {
      // Requires at least one live offspring registered
      const liveCount = offspring.filter((o) => o.lifeState === "ALIVE").length;
      if (liveCount === 0) {
        throw new LifecycleError(
          "NO_LIVE_OFFSPRING",
          "At least one live offspring is required to advance to WEANED",
        );
      }
      break;
    }

    case "WEANED→PLACEMENT":
      if (!plan.placementStartDateActual) {
        throw new LifecycleError(
          "PLACEMENT_START_REQUIRED",
          "placementStartDateActual must be set to advance to PLACEMENT",
        );
      }
      break;

    case "PLACEMENT→PLAN_COMPLETE": {
      const liveOffspring = offspring.filter((o) => o.lifeState === "ALIVE");
      const placedOrKept = liveOffspring.filter(
        (o) =>
          o.placementState === "PLACED" ||
          o.placementState === "TRANSFERRED" ||
          o.keeperIntent === "KEEP" ||
          o.keeperIntent === "WITHHELD",
      );
      if (liveOffspring.length > 0 && placedOrKept.length < liveOffspring.length) {
        const remaining = liveOffspring.length - placedOrKept.length;
        throw new LifecycleError(
          "OFFSPRING_NOT_PLACED",
          `${remaining} live offspring are not yet placed or marked as keeper`,
        );
      }
      break;
    }

    default:
      throw new LifecycleError(
        "INVALID_TRANSITION",
        `Invalid transition: ${from} → ${to}`,
      );
  }
}
