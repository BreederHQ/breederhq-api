// src/services/breeding-foaling-service.ts
/**
 * Foaling Automation Business Logic
 *
 * Handles foaling timeline calculation, recording foaling outcomes,
 * milestone management, and foaling calendar views.
 */

import prisma from "../prisma.js";

// Date utility functions
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function differenceInDays(dateA: Date, dateB: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((dateA.getTime() - dateB.getTime()) / msPerDay);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
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
  if (!plan.expectedBirthDate) throw new Error("No expected birth date set");

  const today = startOfDay(new Date());
  const expectedBirthStartOfDay = startOfDay(plan.expectedBirthDate);
  const daysUntilFoaling = differenceInDays(expectedBirthStartOfDay, today);

  // Calculate status
  let status: "EXPECTING" | "MONITORING" | "IMMINENT" | "OVERDUE" | "FOALED";
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
    actualBirthDate: plan.birthDateActual,
    daysUntilFoaling,
    status,
    milestones: plan.breedingMilestones.map((m) => ({
      id: m.id,
      type: m.milestoneType,
      scheduledDate: m.scheduledDate,
      completedDate: m.completedDate,
      isCompleted: m.isCompleted,
      daysUntil: differenceInDays(startOfDay(m.scheduledDate), today),
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

  return await prisma.foalingOutcome.upsert({
    where: { breedingPlanId },
    create: {
      tenantId,
      breedingPlanId,
      ...outcomeData,
    },
    update: outcomeData,
  });
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

  const today = startOfDay(new Date());

  return plans.map((plan) => {
    const daysUntil = differenceInDays(
      startOfDay(plan.expectedBirthDate!),
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
 * Auto-generate milestones when breeding plan becomes pregnant
 */
export async function createBreedingMilestones(
  breedingPlanId: number,
  tenantId: number
) {
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: breedingPlanId, tenantId },
  });

  if (!plan || !plan.expectedBirthDate) {
    throw new Error("Breeding plan not found or missing expected birth date");
  }

  // Check if milestones already exist
  const existing = await prisma.breedingMilestone.findFirst({
    where: { breedingPlanId, tenantId },
  });

  if (existing) {
    throw new Error("Milestones already exist for this breeding plan");
  }

  const milestones = [
    {
      milestoneType: "VET_PREGNANCY_CHECK_15D",
      daysFromBirth: -325, // 15 days after breeding (340 - 15)
    },
    {
      milestoneType: "VET_ULTRASOUND_45D",
      daysFromBirth: -295, // 45 days after breeding
    },
    {
      milestoneType: "VET_ULTRASOUND_90D",
      daysFromBirth: -250, // 90 days after breeding
    },
    {
      milestoneType: "BEGIN_MONITORING_300D",
      daysFromBirth: -40, // 300 days after breeding = 40 days before birth
    },
    {
      milestoneType: "PREPARE_FOALING_AREA_320D",
      daysFromBirth: -20,
    },
    {
      milestoneType: "DAILY_CHECKS_330D",
      daysFromBirth: -10,
    },
    {
      milestoneType: "DUE_DATE_340D",
      daysFromBirth: 0,
    },
    {
      milestoneType: "OVERDUE_VET_CALL_350D",
      daysFromBirth: 10,
    },
  ];

  return await Promise.all(
    milestones.map((m) =>
      prisma.breedingMilestone.create({
        data: {
          tenantId,
          breedingPlanId,
          milestoneType: m.milestoneType as any,
          scheduledDate: addDays(plan.expectedBirthDate!, m.daysFromBirth),
        },
      })
    )
  );
}
