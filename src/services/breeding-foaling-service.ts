// src/services/breeding-foaling-service.ts
/**
 * Foaling Automation Business Logic
 *
 * Handles foaling timeline calculation, recording foaling outcomes,
 * milestone management, and foaling calendar views.
 */

import prisma from "../prisma.js";
import { updateMareReproductiveHistory } from "./mare-reproductive-history-service.js";

// Date utility functions - use UTC to avoid timezone shift issues
function startOfDayUTC(date: Date): Date {
  const result = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
  return result;
}

function differenceInDays(dateA: Date, dateB: Date): number {
  // Normalize both dates to start of day UTC to get accurate day difference
  const a = startOfDayUTC(dateA);
  const b = startOfDayUTC(dateB);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((a.getTime() - b.getTime()) / msPerDay);
}

function addDays(date: Date, days: number): Date {
  // Use UTC methods to avoid timezone shifts
  const result = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + days,
    12, 0, 0, 0  // Set to noon UTC to avoid edge cases
  ));
  return result;
}

/**
 * Get comprehensive foaling timeline for a breeding plan
 */
export async function getFoalingTimeline(breedingPlanId: number, tenantId: number) {
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: breedingPlanId, tenantId },
    include: {
      dam: true,
      sire: true,
      offspringGroup: {
        include: {
          Offspring: true,
        },
      },
      foalingOutcome: true,
      breedingMilestones: {
        orderBy: { scheduledDate: "asc" },
      },
    },
  });

  if (!plan) throw new Error("Breeding plan not found");

  const today = startOfDayUTC(new Date());

  // Handle case when no expected birth date is set
  if (!plan.expectedBirthDate) {
    return {
      breedingPlanId: plan.id,
      dam: plan.dam ? { id: plan.dam.id, name: plan.dam.name } : null,
      sire: plan.sire ? { id: plan.sire.id, name: plan.sire.name } : null,
      expectedBirthDate: null,
      actualBreedDate: plan.breedDateActual,
      actualBirthDate: plan.birthDateActual,
      daysUntilFoaling: null,
      status: plan.birthDateActual ? "FOALED" : "PLANNING",
      milestones: plan.breedingMilestones.map((m) => ({
        id: m.id,
        type: m.milestoneType,
        scheduledDate: m.scheduledDate,
        completedDate: m.completedDate,
        isCompleted: m.isCompleted,
        daysUntil: differenceInDays(startOfDayUTC(m.scheduledDate), today),
      })),
      offspring: plan.offspringGroup?.Offspring || [],
      outcome: plan.foalingOutcome || null,
    };
  }

  const expectedBirthStartOfDay = startOfDayUTC(plan.expectedBirthDate);
  const daysUntilFoaling = differenceInDays(expectedBirthStartOfDay, today);

  // Calculate status
  let status: "PLANNING" | "EXPECTING" | "MONITORING" | "IMMINENT" | "OVERDUE" | "FOALED";
  if (plan.birthDateActual) {
    status = "FOALED";
  } else if (daysUntilFoaling < 0) {
    status = "OVERDUE";
  } else if (daysUntilFoaling <= 10) {
    status = "IMMINENT";
  } else if (daysUntilFoaling <= 30) {
    status = "MONITORING";
  } else {
    status = "EXPECTING";
  }

  return {
    breedingPlanId: plan.id,
    dam: plan.dam ? { id: plan.dam.id, name: plan.dam.name } : null,
    sire: plan.sire ? { id: plan.sire.id, name: plan.sire.name } : null,
    expectedBirthDate: plan.expectedBirthDate,
    actualBreedDate: plan.breedDateActual,
    actualBirthDate: plan.birthDateActual,
    daysUntilFoaling,
    status,
    milestones: plan.breedingMilestones.map((m) => ({
      id: m.id,
      type: m.milestoneType,
      scheduledDate: m.scheduledDate,
      completedDate: m.completedDate,
      isCompleted: m.isCompleted,
      daysUntil: differenceInDays(startOfDayUTC(m.scheduledDate), today),
    })),
    offspring: plan.offspringGroup?.Offspring || [],
    outcome: plan.foalingOutcome || null,
  };
}

/**
 * Record actual foaling date and create offspring
 */
export async function recordFoaling(params: {
  breedingPlanId: number;
  tenantId: number;
  actualBirthDate: Date;
  foals: Array<{
    sex: "MALE" | "FEMALE";
    color?: string;
    healthStatus?: string;
    birthWeight?: number;
  }>;
  userId: string;
}) {
  const { breedingPlanId, tenantId, actualBirthDate, foals, userId } = params;

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch breeding plan with dam info
    const plan = await tx.breedingPlan.findFirst({
      where: { id: breedingPlanId, tenantId },
      include: { dam: true },
    });

    if (!plan) throw new Error("Breeding plan not found");

    // Validate: breedDateActual must be set before recording birth
    if (!plan.breedDateActual) {
      throw new Error("Cannot record birth date: the breeding date (breedDateActual) must be recorded first.");
    }

    // 2. Update breeding plan
    await tx.breedingPlan.update({
      where: { id: breedingPlanId },
      data: {
        birthDateActual: actualBirthDate,
        status: "BIRTHED",
      },
    });

    // 3. Create or update offspring group
    let offspringGroup = await tx.offspringGroup.findFirst({
      where: { planId: breedingPlanId },
    });

    if (offspringGroup) {
      offspringGroup = await tx.offspringGroup.update({
        where: { id: offspringGroup.id },
        data: { actualBirthOn: actualBirthDate },
      });
    } else {
      const year = new Date().getFullYear();
      const damName = plan.dam?.name || "Mare";
      offspringGroup = await tx.offspringGroup.create({
        data: {
          tenantId,
          planId: breedingPlanId,
          species: plan.species,
          damId: plan.damId,
          sireId: plan.sireId,
          name: `${damName} ${year}`,
          expectedBirthOn: plan.expectedBirthDate,
          actualBirthOn: actualBirthDate,
        },
      });
    }

    // 4. Create offspring records
    const offspring = await Promise.all(
      foals.map((foal) =>
        tx.offspring.create({
          data: {
            tenantId,
            groupId: offspringGroup!.id,
            species: plan.species,
            sex: foal.sex,
            color: foal.color,
            bornAt: actualBirthDate,
            healthStatus: (foal.healthStatus || "HEALTHY") as any,
            birthWeight: foal.birthWeight,
            status: "NEWBORN",
            lifeState: "ALIVE",
          },
        })
      )
    );

    // 5. Create event log
    await tx.breedingPlanEvent.create({
      data: {
        tenantId,
        planId: breedingPlanId,
        type: "foaling_recorded",
        occurredAt: actualBirthDate,
        label: "Foaling Recorded",
        notes: `${foals.length} foal(s) born`,
        recordedByUserId: userId,
      },
    });

    return { plan, offspringGroup, offspring };
  });
}

/**
 * Add foaling outcome details (complications, vet notes, etc.)
 */
export async function addFoalingOutcome(params: {
  breedingPlanId: number;
  tenantId: number;
  hadComplications: boolean;
  complicationDetails?: string;
  veterinarianCalled: boolean;
  veterinarianName?: string;
  veterinarianNotes?: string;
  placentaPassed?: boolean;
  placentaPassedMinutes?: number;
  mareCondition?: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "VETERINARY_CARE_REQUIRED";
  userId: string;
}) {
  const { breedingPlanId, tenantId, ...outcomeData } = params;

  // Verify breeding plan exists and belongs to tenant
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: breedingPlanId, tenantId },
  });

  if (!plan) throw new Error("Breeding plan not found");

  const outcome = await prisma.foalingOutcome.upsert({
    where: { breedingPlanId },
    create: {
      tenantId,
      breedingPlanId,
      ...outcomeData,
    },
    update: outcomeData,
  });

  // Update mare reproductive history if this is a horse breeding with a dam
  if (plan.species === "HORSE" && plan.damId) {
    try {
      await updateMareReproductiveHistory(plan.damId, tenantId, breedingPlanId);
    } catch (err) {
      console.error("[Foaling] Failed to update mare reproductive history:", err);
      // Don't fail the outcome save if history update fails
    }
  }

  return outcome;
}

/**
 * Get foaling calendar (all expected births in date range)
 */
export async function getFoalingCalendar(params: {
  tenantId: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const { tenantId, startDate, endDate } = params;

  const where: any = {
    tenantId,
    expectedBirthDate: { not: null },
    status: { in: ["COMMITTED", "CYCLE_EXPECTED", "HORMONE_TESTING", "BRED", "PREGNANT", "BIRTHED"] },
  };

  if (startDate) {
    where.expectedBirthDate = { ...where.expectedBirthDate, gte: startDate };
  }
  if (endDate) {
    where.expectedBirthDate = { ...where.expectedBirthDate, lte: endDate };
  }

  const plans = await prisma.breedingPlan.findMany({
    where,
    include: {
      dam: true,
      sire: true,
    },
    orderBy: { expectedBirthDate: "asc" },
  });

  const today = startOfDayUTC(new Date());

  return plans.map((plan) => {
    const daysUntil = differenceInDays(
      startOfDayUTC(plan.expectedBirthDate!),
      today
    );

    return {
      id: plan.id,
      damName: plan.dam?.name || "Unknown",
      sireName: plan.sire?.name || "Unknown",
      expectedBirthDate: plan.expectedBirthDate,
      actualBirthDate: plan.birthDateActual,
      daysUntil,
      status: plan.status,
    };
  });
}

/**
 * Auto-generate milestones when breeding is confirmed (breedDateActual is set)
 *
 * Milestones are calculated from the actual breed date, not expected dates.
 * Horse gestation is approximately 340 days.
 */
export async function createBreedingMilestones(
  breedingPlanId: number,
  tenantId: number
) {
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: breedingPlanId, tenantId },
  });

  if (!plan) {
    throw new Error("Breeding plan not found");
  }

  // Milestones require actual breed date - they should not be created from speculative expected dates
  if (!plan.breedDateActual) {
    throw new Error("Cannot create milestones: the actual breeding date must be recorded first. Milestones are calculated from the confirmed breeding date.");
  }

  // Check if milestones already exist
  const existing = await prisma.breedingMilestone.findFirst({
    where: { breedingPlanId, tenantId },
  });

  if (existing) {
    throw new Error("Milestones already exist for this breeding plan");
  }

  // Horse gestation is ~340 days from breeding
  const GESTATION_DAYS = 340;

  // Milestones are defined as days AFTER breeding
  const milestones = [
    {
      milestoneType: "VET_PREGNANCY_CHECK_15D",
      daysAfterBreeding: 15,
    },
    {
      milestoneType: "VET_ULTRASOUND_45D",
      daysAfterBreeding: 45,
    },
    {
      milestoneType: "VET_ULTRASOUND_90D",
      daysAfterBreeding: 90,
    },
    {
      milestoneType: "BEGIN_MONITORING_300D",
      daysAfterBreeding: 300,
    },
    {
      milestoneType: "PREPARE_FOALING_AREA_320D",
      daysAfterBreeding: 320,
    },
    {
      milestoneType: "DAILY_CHECKS_330D",
      daysAfterBreeding: 330,
    },
    {
      milestoneType: "DUE_DATE_340D",
      daysAfterBreeding: GESTATION_DAYS,
    },
    {
      milestoneType: "OVERDUE_VET_CALL_350D",
      daysAfterBreeding: 350,
    },
  ];

  return await Promise.all(
    milestones.map((m) =>
      prisma.breedingMilestone.create({
        data: {
          tenantId,
          breedingPlanId,
          milestoneType: m.milestoneType as any,
          scheduledDate: addDays(plan.breedDateActual!, m.daysAfterBreeding),
        },
      })
    )
  );
}

/**
 * Delete all milestones for a breeding plan (to allow regeneration)
 */
export async function deleteBreedingMilestones(
  breedingPlanId: number,
  tenantId: number
) {
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: breedingPlanId, tenantId },
  });

  if (!plan) {
    throw new Error("Breeding plan not found");
  }

  const deleted = await prisma.breedingMilestone.deleteMany({
    where: { breedingPlanId, tenantId },
  });

  return { deletedCount: deleted.count };
}

/**
 * Recalculate milestone dates based on actual breed date
 * This updates existing milestones rather than deleting and recreating
 */
export async function recalculateMilestones(
  breedingPlanId: number,
  tenantId: number
) {
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: breedingPlanId, tenantId },
    include: {
      breedingMilestones: true,
    },
  });

  if (!plan) {
    throw new Error("Breeding plan not found");
  }

  if (!plan.breedDateActual) {
    throw new Error("Cannot recalculate milestones: no actual breeding date recorded");
  }

  // Milestone days after breeding (same as createBreedingMilestones)
  const MILESTONE_DAYS: Record<string, number> = {
    VET_PREGNANCY_CHECK_15D: 15,
    VET_ULTRASOUND_45D: 45,
    VET_ULTRASOUND_90D: 90,
    BEGIN_MONITORING_300D: 300,
    PREPARE_FOALING_AREA_320D: 320,
    DAILY_CHECKS_330D: 330,
    DUE_DATE_340D: 340,
    OVERDUE_VET_CALL_350D: 350,
  };

  const updates = await Promise.all(
    plan.breedingMilestones.map((m) => {
      const daysAfterBreeding = MILESTONE_DAYS[m.milestoneType];
      if (daysAfterBreeding === undefined) return m; // Unknown type, skip

      const newScheduledDate = addDays(plan.breedDateActual!, daysAfterBreeding);

      return prisma.breedingMilestone.update({
        where: { id: m.id },
        data: { scheduledDate: newScheduledDate },
      });
    })
  );

  return updates;
}
