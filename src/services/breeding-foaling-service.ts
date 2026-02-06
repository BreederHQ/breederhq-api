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
      // Log the error but don't fail the outcome save
      console.error("[Foaling] Failed to update mare reproductive history:", err);
      // Note: History will be auto-generated when user views the mare's breeding history tab
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
    status: { in: ["CYCLE", "COMMITTED", "CYCLE_EXPECTED", "HORMONE_TESTING", "BRED", "PREGNANT", "BIRTHED"] },
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
 * Get the anchor date for milestone calculation.
 * Priority: ovulationConfirmed (highest accuracy) > breedDateActual (standard)
 *
 * Returns: { anchorDate, anchorMode, gestationDays }
 * - OVULATION anchor: 340 days gestation (±3 days accuracy)
 * - BREEDING_DATE anchor: 340 days gestation (±5-7 days accuracy)
 */
function getAnchorDateForMilestones(plan: {
  breedDateActual: Date | null;
  ovulationConfirmed?: Date | null;
  reproAnchorMode?: string | null;
}): { anchorDate: Date; anchorMode: "OVULATION" | "BREEDING_DATE"; gestationDays: number } | null {
  // Priority 1: Confirmed ovulation (highest accuracy)
  if (plan.ovulationConfirmed) {
    return {
      anchorDate: plan.ovulationConfirmed,
      anchorMode: "OVULATION",
      gestationDays: 340, // Horse gestation from ovulation
    };
  }

  // Priority 2: Actual breed date (standard accuracy)
  if (plan.breedDateActual) {
    return {
      anchorDate: plan.breedDateActual,
      anchorMode: "BREEDING_DATE",
      gestationDays: 340, // Horse gestation from breeding
    };
  }

  return null;
}

/**
 * Auto-generate milestones when breeding is confirmed (breedDateActual is set)
 *
 * Anchor Mode Priority:
 * 1. ovulationConfirmed - Use confirmed ovulation date for highest accuracy (±3 days)
 * 2. breedDateActual - Use breeding date as anchor (±5-7 days accuracy)
 *
 * Horse gestation is approximately 340 days from either anchor.
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

  // Get anchor date using priority logic
  const anchor = getAnchorDateForMilestones(plan as any);

  if (!anchor) {
    throw new Error("Cannot create milestones: the actual breeding date or ovulation date must be recorded first. Milestones are calculated from the confirmed anchor date.");
  }

  // Check if milestones already exist
  const existing = await prisma.breedingMilestone.findFirst({
    where: { breedingPlanId, tenantId },
  });

  if (existing) {
    throw new Error("Milestones already exist for this breeding plan");
  }

  // Horse gestation - days are from the anchor date
  const GESTATION_DAYS = anchor.gestationDays;

  // Milestones are defined as days AFTER the anchor date (ovulation or breeding)
  const milestones = [
    {
      milestoneType: "VET_PREGNANCY_CHECK_15D",
      daysAfterAnchor: 15,
    },
    {
      milestoneType: "VET_ULTRASOUND_45D",
      daysAfterAnchor: 45,
    },
    {
      milestoneType: "VET_ULTRASOUND_90D",
      daysAfterAnchor: 90,
    },
    {
      milestoneType: "BEGIN_MONITORING_300D",
      daysAfterAnchor: 300,
    },
    {
      milestoneType: "PREPARE_FOALING_AREA_320D",
      daysAfterAnchor: 320,
    },
    {
      milestoneType: "DAILY_CHECKS_330D",
      daysAfterAnchor: 330,
    },
    {
      milestoneType: "DUE_DATE_340D",
      daysAfterAnchor: GESTATION_DAYS,
    },
    {
      milestoneType: "OVERDUE_VET_CALL_350D",
      daysAfterAnchor: 350,
    },
  ];

  return await Promise.all(
    milestones.map((m) =>
      prisma.breedingMilestone.create({
        data: {
          tenantId,
          breedingPlanId,
          milestoneType: m.milestoneType as any,
          scheduledDate: addDays(anchor.anchorDate, m.daysAfterAnchor),
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
 * Recalculate milestone dates based on anchor date (ovulation or breed date)
 * This updates existing milestones rather than deleting and recreating
 *
 * Uses anchor date priority: ovulationConfirmed > breedDateActual
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

  // Get anchor date using priority logic
  const anchor = getAnchorDateForMilestones(plan as any);

  if (!anchor) {
    throw new Error("Cannot recalculate milestones: no actual breeding date or ovulation date recorded");
  }

  // Milestone days after anchor (same as createBreedingMilestones)
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
      const daysAfterAnchor = MILESTONE_DAYS[m.milestoneType];
      if (daysAfterAnchor === undefined) return m; // Unknown type, skip

      const newScheduledDate = addDays(anchor.anchorDate, daysAfterAnchor);

      return prisma.breedingMilestone.update({
        where: { id: m.id },
        data: { scheduledDate: newScheduledDate },
      });
    })
  );

  return updates;
}

// ==============================================================================
// SPECIES-GENERIC BIRTH MILESTONE FUNCTIONS
// ==============================================================================

/**
 * Gestation periods by species (in days)
 */
const SPECIES_GESTATION_DAYS: Record<string, number> = {
  DOG: 63,
  CAT: 65,
  HORSE: 340,
  RABBIT: 31,
  GOAT: 150,
  SHEEP: 147,
  PIG: 114,
  CATTLE: 283,
  CHICKEN: 21,
  ALPACA: 345,
  LLAMA: 350,
};

/**
 * Pre-birth sign types by species
 */
const SPECIES_PRE_BIRTH_SIGNS: Record<string, string[]> = {
  DOG: ["TEMPERATURE_DROP", "NESTING_BEHAVIOR", "LOSS_OF_APPETITE", "VULVAR_CHANGES", "MILK_PRESENT"],
  CAT: ["TEMPERATURE_DROP", "NESTING_BEHAVIOR", "RESTLESSNESS", "LOSS_OF_APPETITE", "MILK_PRESENT"],
  HORSE: ["UDDER_DEVELOPMENT", "UDDER_FULL", "WAX_APPEARANCE", "VULVAR_RELAXATION", "TAILHEAD_RELAXATION", "MILK_CALCIUM_TEST"],
  RABBIT: ["FUR_PULLING", "NEST_BUILDING", "RESTLESSNESS"],
  GOAT: ["UDDER_TIGHT", "LIGAMENT_SOFTENING", "VULVAR_CHANGES", "NESTING_BEHAVIOR", "LOSS_OF_APPETITE"],
  SHEEP: ["UDDER_TIGHT", "LIGAMENT_SOFTENING", "VULVAR_CHANGES", "RESTLESSNESS"],
  PIG: ["NESTING_BEHAVIOR", "MILK_PRESENT", "VULVAR_CHANGES", "RESTLESSNESS"],
  CATTLE: ["UDDER_TIGHT", "LIGAMENT_SOFTENING", "VULVAR_CHANGES", "RESTLESSNESS"],
  CHICKEN: ["NESTING_BEHAVIOR"],
  ALPACA: ["UDDER_TIGHT", "VULVAR_CHANGES", "RESTLESSNESS"],
  LLAMA: ["UDDER_TIGHT", "VULVAR_CHANGES", "RESTLESSNESS"],
};

/**
 * Get scheduled milestones configuration for a species
 */
function getScheduledMilestonesConfig(species: string): Array<{ type: string; daysFromBreeding: number }> {
  const gestation = SPECIES_GESTATION_DAYS[species.toUpperCase()] || 63;
  const speciesUpper = species.toUpperCase();

  switch (speciesUpper) {
    case "DOG":
      return [
        { type: "PREGNANCY_CONFIRMATION", daysFromBreeding: 28 },
        { type: "ULTRASOUND_HEARTBEAT", daysFromBreeding: 35 },
        { type: "XRAY_COUNT", daysFromBreeding: 55 },
        { type: "BEGIN_MONITORING", daysFromBreeding: 58 },
        { type: "PREPARE_BIRTH_AREA", daysFromBreeding: 60 },
        { type: "DUE_DATE", daysFromBreeding: gestation },
        { type: "OVERDUE_VET_CALL", daysFromBreeding: gestation + 2 },
      ];

    case "CAT":
      return [
        { type: "PREGNANCY_CONFIRMATION", daysFromBreeding: 21 },
        { type: "ULTRASOUND_COUNT", daysFromBreeding: 35 },
        { type: "PREPARE_BIRTH_AREA", daysFromBreeding: 58 },
        { type: "DUE_DATE", daysFromBreeding: gestation },
        { type: "OVERDUE_VET_CALL", daysFromBreeding: gestation + 3 },
      ];

    case "RABBIT":
      return [
        { type: "PREGNANCY_CONFIRMATION", daysFromBreeding: 14 },
        { type: "PREPARE_BIRTH_AREA", daysFromBreeding: 28 },
        { type: "DUE_DATE", daysFromBreeding: gestation },
        { type: "OVERDUE_VET_CALL", daysFromBreeding: gestation + 4 },
      ];

    case "GOAT":
      return [
        { type: "ULTRASOUND_COUNT", daysFromBreeding: 45 },
        { type: "BEGIN_MONITORING", daysFromBreeding: 140 },
        { type: "PREPARE_BIRTH_AREA", daysFromBreeding: 145 },
        { type: "DUE_DATE", daysFromBreeding: gestation },
        { type: "OVERDUE_VET_CALL", daysFromBreeding: gestation + 5 },
      ];

    case "SHEEP":
      return [
        { type: "ULTRASOUND_COUNT", daysFromBreeding: 45 },
        { type: "BEGIN_MONITORING", daysFromBreeding: 137 },
        { type: "PREPARE_BIRTH_AREA", daysFromBreeding: 142 },
        { type: "DUE_DATE", daysFromBreeding: gestation },
        { type: "OVERDUE_VET_CALL", daysFromBreeding: gestation + 5 },
      ];

    case "PIG":
      return [
        { type: "ULTRASOUND_COUNT", daysFromBreeding: 28 },
        { type: "BEGIN_MONITORING", daysFromBreeding: 110 },
        { type: "PREPARE_BIRTH_AREA", daysFromBreeding: 111 },
        { type: "DUE_DATE", daysFromBreeding: gestation },
        { type: "OVERDUE_VET_CALL", daysFromBreeding: gestation + 3 },
      ];

    case "CATTLE":
      return [
        { type: "PREGNANCY_CONFIRMATION", daysFromBreeding: 30 },
        { type: "BEGIN_MONITORING", daysFromBreeding: 270 },
        { type: "PREPARE_BIRTH_AREA", daysFromBreeding: 275 },
        { type: "DUE_DATE", daysFromBreeding: gestation },
        { type: "OVERDUE_VET_CALL", daysFromBreeding: gestation + 7 },
      ];

    case "CHICKEN":
      return [
        { type: "BEGIN_MONITORING", daysFromBreeding: 7 },
        { type: "DAILY_CHECKS", daysFromBreeding: 14 },
        { type: "PREPARE_BIRTH_AREA", daysFromBreeding: 18 },
        { type: "DUE_DATE", daysFromBreeding: gestation },
      ];

    case "ALPACA":
      return [
        { type: "PREGNANCY_CONFIRMATION", daysFromBreeding: 30 },
        { type: "BEGIN_MONITORING", daysFromBreeding: 330 },
        { type: "DUE_DATE", daysFromBreeding: gestation },
        { type: "OVERDUE_VET_CALL", daysFromBreeding: gestation + 15 },
      ];

    case "LLAMA":
      return [
        { type: "PREGNANCY_CONFIRMATION", daysFromBreeding: 30 },
        { type: "BEGIN_MONITORING", daysFromBreeding: 340 },
        { type: "DUE_DATE", daysFromBreeding: gestation },
        { type: "OVERDUE_VET_CALL", daysFromBreeding: gestation + 15 },
      ];

    default:
      // Fallback to dog-like schedule
      return [
        { type: "PREGNANCY_CONFIRMATION", daysFromBreeding: Math.round(gestation * 0.4) },
        { type: "PREPARE_BIRTH_AREA", daysFromBreeding: Math.round(gestation * 0.9) },
        { type: "DUE_DATE", daysFromBreeding: gestation },
      ];
  }
}

/**
 * Get anchor date for species-generic milestones
 */
function getSpeciesAnchorDate(plan: {
  species: string | null;
  breedDateActual: Date | null;
  ovulationConfirmed?: Date | null;
}): { anchorDate: Date; anchorMode: "OVULATION" | "BREEDING_DATE"; gestationDays: number } | null {
  const species = (plan.species || "DOG").toUpperCase();
  const gestationDays = SPECIES_GESTATION_DAYS[species] || 63;

  // Priority 1: Confirmed ovulation (highest accuracy)
  if (plan.ovulationConfirmed) {
    return {
      anchorDate: plan.ovulationConfirmed,
      anchorMode: "OVULATION",
      gestationDays,
    };
  }

  // Priority 2: Actual breed date (standard accuracy)
  if (plan.breedDateActual) {
    return {
      anchorDate: plan.breedDateActual,
      anchorMode: "BREEDING_DATE",
      gestationDays,
    };
  }

  return null;
}

/**
 * Create species-generic birth milestones for a breeding plan
 * This is the species-aware version of createBreedingMilestones
 */
export async function createSpeciesBirthMilestones(
  breedingPlanId: number,
  tenantId: number
): Promise<any[]> {
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: breedingPlanId, tenantId },
  });

  if (!plan) {
    throw new Error("Breeding plan not found");
  }

  const species = (plan.species || "DOG").toUpperCase();

  // For horses, use the existing horse-specific milestones
  if (species === "HORSE") {
    return createBreedingMilestones(breedingPlanId, tenantId);
  }

  // Get anchor date using species-aware priority logic
  const anchor = getSpeciesAnchorDate(plan as any);

  if (!anchor) {
    throw new Error("Cannot create milestones: the actual breeding date or ovulation date must be recorded first.");
  }

  // Check if milestones already exist
  const existing = await prisma.breedingMilestone.findFirst({
    where: { breedingPlanId, tenantId },
  });

  if (existing) {
    throw new Error("Milestones already exist for this breeding plan. Delete existing milestones first.");
  }

  // Get species-specific milestone schedule
  const scheduledMilestones = getScheduledMilestonesConfig(species);
  const preBirthSigns = SPECIES_PRE_BIRTH_SIGNS[species] || [];

  // Create scheduled milestones
  const createdScheduled = await Promise.all(
    scheduledMilestones.map((m) =>
      prisma.breedingMilestone.create({
        data: {
          tenantId,
          breedingPlanId,
          milestoneType: m.type as any,
          scheduledDate: addDays(anchor.anchorDate, m.daysFromBreeding),
        },
      })
    )
  );

  // Create pre-birth sign milestones (scheduled 7 days before due date)
  const dueDate = addDays(anchor.anchorDate, anchor.gestationDays);
  const preBirthDate = addDays(dueDate, -7);

  const createdSigns = await Promise.all(
    preBirthSigns.map((type) =>
      prisma.breedingMilestone.create({
        data: {
          tenantId,
          breedingPlanId,
          milestoneType: type as any,
          scheduledDate: preBirthDate,
        },
      })
    )
  );

  return [...createdScheduled, ...createdSigns];
}

/**
 * Get birth timeline for any species (species-aware version of getFoalingTimeline)
 */
export async function getBirthTimeline(breedingPlanId: number, tenantId: number) {
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

  const species = (plan.species || "DOG").toUpperCase();
  const today = startOfDayUTC(new Date());

  // If horse, use the existing foaling timeline for backwards compatibility
  if (species === "HORSE") {
    return getFoalingTimeline(breedingPlanId, tenantId);
  }

  const gestationDays = SPECIES_GESTATION_DAYS[species] || 63;

  // Handle case when no expected birth date is set
  if (!plan.expectedBirthDate) {
    return {
      breedingPlanId: plan.id,
      species,
      dam: plan.dam ? { id: plan.dam.id, name: plan.dam.name } : null,
      sire: plan.sire ? { id: plan.sire.id, name: plan.sire.name } : null,
      expectedBirthDate: null,
      actualBreedDate: plan.breedDateActual,
      actualBirthDate: plan.birthDateActual,
      daysUntilBirth: null,
      gestationDays,
      status: plan.birthDateActual ? "BIRTHED" : "PLANNING",
      milestones: plan.breedingMilestones.map((m) => ({
        id: m.id,
        type: m.milestoneType,
        scheduledDate: m.scheduledDate,
        completedDate: m.completedDate,
        isCompleted: m.isCompleted,
        notes: m.notes,
        daysUntil: differenceInDays(startOfDayUTC(m.scheduledDate), today),
      })),
      offspring: plan.offspringGroup?.Offspring || [],
      outcome: plan.foalingOutcome || null,
    };
  }

  const expectedBirthStartOfDay = startOfDayUTC(plan.expectedBirthDate);
  const daysUntilBirth = differenceInDays(expectedBirthStartOfDay, today);

  // Calculate status
  let status: "PLANNING" | "EXPECTING" | "MONITORING" | "IMMINENT" | "OVERDUE" | "BIRTHED";
  if (plan.birthDateActual) {
    status = "BIRTHED";
  } else if (daysUntilBirth < 0) {
    status = "OVERDUE";
  } else if (daysUntilBirth <= 7) {
    status = "IMMINENT";
  } else if (daysUntilBirth <= Math.round(gestationDays * 0.1)) {
    status = "MONITORING";
  } else {
    status = "EXPECTING";
  }

  return {
    breedingPlanId: plan.id,
    species,
    dam: plan.dam ? { id: plan.dam.id, name: plan.dam.name } : null,
    sire: plan.sire ? { id: plan.sire.id, name: plan.sire.name } : null,
    expectedBirthDate: plan.expectedBirthDate,
    actualBreedDate: plan.breedDateActual,
    actualBirthDate: plan.birthDateActual,
    daysUntilBirth,
    gestationDays,
    status,
    milestones: plan.breedingMilestones.map((m) => ({
      id: m.id,
      type: m.milestoneType,
      scheduledDate: m.scheduledDate,
      completedDate: m.completedDate,
      isCompleted: m.isCompleted,
      notes: m.notes,
      daysUntil: differenceInDays(startOfDayUTC(m.scheduledDate), today),
    })),
    offspring: plan.offspringGroup?.Offspring || [],
    outcome: plan.foalingOutcome || null,
  };
}

/**
 * Delete all milestones for a breeding plan
 */
export async function deleteBirthMilestones(
  breedingPlanId: number,
  tenantId: number
): Promise<{ count: number }> {
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: breedingPlanId, tenantId },
  });

  if (!plan) {
    throw new Error("Breeding plan not found");
  }

  const result = await prisma.breedingMilestone.deleteMany({
    where: { breedingPlanId, tenantId },
  });

  return { count: result.count };
}
