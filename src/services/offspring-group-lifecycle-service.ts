// src/services/offspring-group-lifecycle-service.ts
/**
 * Offspring Group Lifecycle State Machine
 *
 * Manages the post-birth lifecycle of offspring groups:
 *   PENDING → BORN → WEANING → WEANED → PLACEMENT → GROUP_COMPLETE
 *   Any → DISSOLVED (all offspring deceased)
 *
 * Also provides date cascade calculations that start at birth
 * (complementing plan calculator that stops at birth).
 */

import type { PrismaClient, Prisma } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export type GroupLifecycleStatus =
  | "PENDING"
  | "BORN"
  | "WEANING"
  | "WEANED"
  | "PLACEMENT"
  | "GROUP_COMPLETE"
  | "DISSOLVED";

/** Ordered progression (DISSOLVED is a lateral transition, not in this array) */
const STATUS_ORDER: GroupLifecycleStatus[] = [
  "PENDING",
  "BORN",
  "WEANING",
  "WEANED",
  "PLACEMENT",
  "GROUP_COMPLETE",
];

// ─── Species Post-Birth Intervals (days from birth) ────────────────────────

/**
 * Species-specific post-birth intervals used to calculate expected dates
 * on the offspring group once birth is recorded.
 *
 * Sources: Standard veterinary weaning/placement practices.
 */
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

// ─── Date Utilities (UTC) ──────────────────────────────────────────────────

function addDaysUTC(date: Date, days: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
      12, 0, 0, 0, // noon UTC to avoid edge cases
    ),
  );
}

// ─── Date Cascade: Group Calculator ────────────────────────────────────────

/**
 * Calculate expected post-birth dates for an offspring group.
 * This is the "group calculator" — it starts at birth.
 * (The "plan calculator" stops at birth.)
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
    ?? SPECIES_POST_BIRTH_INTERVALS.DOG; // Fallback to dog intervals

  return {
    expectedWeanedAt: addDaysUTC(birthDate, intervals.weanDays),
    expectedPlacementStartAt: addDaysUTC(birthDate, intervals.placementStartDays),
    expectedPlacementCompletedAt: addDaysUTC(birthDate, intervals.placementCompletedDays),
  };
}

/**
 * Return species post-birth intervals (useful for frontend display).
 */
export function getSpeciesPostBirthIntervals(species: string) {
  return SPECIES_POST_BIRTH_INTERVALS[species.toUpperCase()]
    ?? SPECIES_POST_BIRTH_INTERVALS.DOG;
}

// ─── Lifecycle State Machine ───────────────────────────────────────────────

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Advance the offspring group to the next lifecycle status.
 * Validates that the required condition is met before advancing.
 *
 * If `targetStatus` is provided, advances to that specific status
 * (must be exactly one step forward). Otherwise advances to next.
 */
export async function advanceGroupStatus(
  prisma: PrismaClient,
  groupId: number,
  tenantId: number,
  targetStatus?: GroupLifecycleStatus,
): Promise<any> {
  return prisma.$transaction(async (tx) => {
    const group = await tx.offspringGroup.findFirst({
      where: { id: groupId, tenantId, deletedAt: null },
      include: {
        Offspring: {
          where: { archivedAt: null },
          select: { id: true, lifeState: true, placementState: true, keeperIntent: true },
        },
      },
    });

    if (!group) {
      throw new LifecycleError("GROUP_NOT_FOUND", "Offspring group not found");
    }

    const current = group.lifecycleStatus as GroupLifecycleStatus;
    const currentIdx = STATUS_ORDER.indexOf(current);

    if (current === "DISSOLVED") {
      throw new LifecycleError("CANNOT_ADVANCE_DISSOLVED", "Cannot advance a dissolved group");
    }
    if (current === "GROUP_COMPLETE") {
      throw new LifecycleError("ALREADY_COMPLETE", "Group is already complete");
    }
    if (currentIdx < 0) {
      throw new LifecycleError("INVALID_STATUS", `Unknown current status: ${current}`);
    }

    const nextStatus = targetStatus ?? STATUS_ORDER[currentIdx + 1];
    if (!nextStatus) {
      throw new LifecycleError("NO_NEXT_STATUS", "No next status available");
    }

    // Validate target is exactly one step forward (unless it's the next natural one)
    const nextIdx = STATUS_ORDER.indexOf(nextStatus);
    if (nextIdx !== currentIdx + 1) {
      throw new LifecycleError(
        "INVALID_TARGET",
        `Cannot advance from ${current} to ${nextStatus}. Expected ${STATUS_ORDER[currentIdx + 1]}.`,
      );
    }

    // Validate transition conditions
    validateAdvanceCondition(current, nextStatus, group);

    // Apply the transition
    const updated = await tx.offspringGroup.update({
      where: { id: group.id },
      data: {
        lifecycleStatus: nextStatus,
        ...(nextStatus === "GROUP_COMPLETE" ? { completedAt: new Date() } : {}),
      },
    });

    // Log event
    await tx.offspringGroupEvent.create({
      data: {
        tenantId,
        offspringGroupId: group.id,
        type: "STATUS_OVERRIDE",
        field: "lifecycleStatus",
        occurredAt: new Date(),
        before: current,
        after: nextStatus,
        notes: `Lifecycle advanced: ${current} → ${nextStatus}`,
      },
    });

    return updated;
  });
}

/**
 * Rewind the offspring group to the previous lifecycle status.
 * Clears relevant date fields as side effects.
 */
export async function rewindGroupStatus(
  prisma: PrismaClient,
  groupId: number,
  tenantId: number,
): Promise<any> {
  return prisma.$transaction(async (tx) => {
    const group = await tx.offspringGroup.findFirst({
      where: { id: groupId, tenantId, deletedAt: null },
    });

    if (!group) {
      throw new LifecycleError("GROUP_NOT_FOUND", "Offspring group not found");
    }

    const current = group.lifecycleStatus as GroupLifecycleStatus;

    if (current === "PENDING") {
      throw new LifecycleError("CANNOT_REWIND_PENDING", "Group is already in PENDING status");
    }
    if (current === "DISSOLVED") {
      throw new LifecycleError("CANNOT_REWIND_DISSOLVED", "Cannot rewind a dissolved group");
    }

    const currentIdx = STATUS_ORDER.indexOf(current);
    if (currentIdx <= 0) {
      throw new LifecycleError("CANNOT_REWIND", `Cannot rewind from ${current}`);
    }

    const previousStatus = STATUS_ORDER[currentIdx - 1];

    // Build data patch with side effects
    const patch: Prisma.OffspringGroupUncheckedUpdateInput = {
      lifecycleStatus: previousStatus,
    };

    // Rewind side effects: clear date fields
    switch (current) {
      case "GROUP_COMPLETE":
        patch.completedAt = null;
        break;
      case "PLACEMENT":
        patch.placementStartAt = null;
        break;
      case "WEANED":
        patch.weanedAt = null;
        break;
      case "WEANING":
        // No date clearing when rewinding from WEANING to BORN
        break;
      case "BORN":
        // WARNING: rewinding from BORN to PENDING clears actualBirthOn
        // This may also need to rewind the linked plan
        patch.actualBirthOn = null;
        patch.expectedWeanedAt = null;
        patch.expectedPlacementStartAt = null;
        patch.expectedPlacementCompletedAt = null;
        break;
    }

    const updated = await tx.offspringGroup.update({
      where: { id: group.id },
      data: patch,
    });

    // Log event
    await tx.offspringGroupEvent.create({
      data: {
        tenantId,
        offspringGroupId: group.id,
        type: "STATUS_OVERRIDE",
        field: "lifecycleStatus",
        occurredAt: new Date(),
        before: current,
        after: previousStatus,
        notes: `Lifecycle rewound: ${current} → ${previousStatus}`,
      },
    });

    return updated;
  });
}

/**
 * Dissolve a group (all offspring deceased).
 * Can happen from any status.
 */
export async function dissolveGroup(
  prisma: PrismaClient,
  groupId: number,
  tenantId: number,
): Promise<any> {
  return prisma.$transaction(async (tx) => {
    const group = await tx.offspringGroup.findFirst({
      where: { id: groupId, tenantId, deletedAt: null },
      include: {
        Offspring: {
          where: { archivedAt: null },
          select: { id: true, lifeState: true },
        },
      },
    });

    if (!group) {
      throw new LifecycleError("GROUP_NOT_FOUND", "Offspring group not found");
    }

    if (group.lifecycleStatus === "DISSOLVED") {
      return group; // Idempotent
    }

    // Validate: countLive must be 0
    const liveCount =
      group.countLive ?? group.Offspring.filter((o) => o.lifeState === "ALIVE").length;

    if (liveCount > 0) {
      throw new LifecycleError(
        "LIVE_OFFSPRING_EXIST",
        `Cannot dissolve group: ${liveCount} live offspring remain`,
      );
    }

    const previousStatus = group.lifecycleStatus;

    const updated = await tx.offspringGroup.update({
      where: { id: group.id },
      data: { lifecycleStatus: "DISSOLVED" },
    });

    await tx.offspringGroupEvent.create({
      data: {
        tenantId,
        offspringGroupId: group.id,
        type: "STATUS_OVERRIDE",
        field: "lifecycleStatus",
        occurredAt: new Date(),
        before: previousStatus,
        after: "DISSOLVED",
        notes: `Group dissolved: all offspring deceased`,
      },
    });

    return updated;
  });
}

/**
 * Auto-advance the group status if a date gate is now satisfied.
 * Called after date patches to automatically move the lifecycle forward.
 */
export async function autoAdvanceIfReady(
  tx: PrismaTransaction,
  groupId: number,
  tenantId: number,
): Promise<string | null> {
  const group = await tx.offspringGroup.findFirst({
    where: { id: groupId, tenantId, deletedAt: null },
    include: {
      Offspring: {
        where: { archivedAt: null },
        select: { id: true, lifeState: true, placementState: true, keeperIntent: true },
      },
    },
  });

  if (!group) return null;

  const current = group.lifecycleStatus as GroupLifecycleStatus;
  const nextIdx = STATUS_ORDER.indexOf(current) + 1;
  const nextStatus = STATUS_ORDER[nextIdx];

  if (!nextStatus || current === "DISSOLVED" || current === "GROUP_COMPLETE") {
    return null;
  }

  try {
    validateAdvanceCondition(current, nextStatus, group);
  } catch {
    return null; // Condition not met yet
  }

  // Condition met — advance
  await tx.offspringGroup.update({
    where: { id: group.id },
    data: {
      lifecycleStatus: nextStatus,
      ...(nextStatus === "GROUP_COMPLETE" ? { completedAt: new Date() } : {}),
    },
  });

  await tx.offspringGroupEvent.create({
    data: {
      tenantId,
      offspringGroupId: group.id,
      type: "STATUS_OVERRIDE",
      field: "lifecycleStatus",
      occurredAt: new Date(),
      before: current,
      after: nextStatus,
      notes: `Lifecycle auto-advanced: ${current} → ${nextStatus} (date gate satisfied)`,
    },
  });

  return nextStatus;
}

// ─── Validation Helpers ────────────────────────────────────────────────────

function validateAdvanceCondition(
  from: GroupLifecycleStatus,
  to: GroupLifecycleStatus,
  group: any,
): void {
  switch (`${from}→${to}`) {
    case "PENDING→BORN":
      if (!group.actualBirthOn) {
        throw new LifecycleError(
          "BIRTH_DATE_REQUIRED",
          "actualBirthOn must be set to advance to BORN",
        );
      }
      break;

    case "BORN→WEANING": {
      const liveCount =
        group.countLive ?? group.Offspring?.filter((o: any) => o.lifeState === "ALIVE").length ?? 0;
      if (liveCount === 0) {
        throw new LifecycleError(
          "NO_LIVE_OFFSPRING",
          "At least one live offspring is required to advance to WEANING",
        );
      }
      break;
    }

    case "WEANING→WEANED":
      if (!group.weanedAt) {
        throw new LifecycleError(
          "WEANED_DATE_REQUIRED",
          "weanedAt must be set to advance to WEANED",
        );
      }
      break;

    case "WEANED→PLACEMENT":
      if (!group.placementStartAt) {
        throw new LifecycleError(
          "PLACEMENT_START_REQUIRED",
          "placementStartAt must be set to advance to PLACEMENT",
        );
      }
      break;

    case "PLACEMENT→GROUP_COMPLETE": {
      const offspring = group.Offspring ?? [];
      const liveOffspring = offspring.filter((o: any) => o.lifeState === "ALIVE");
      const placedOrKept = liveOffspring.filter(
        (o: any) =>
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

// ─── Error Class ───────────────────────────────────────────────────────────

export class LifecycleError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "LifecycleError";
    this.code = code;
  }
}
