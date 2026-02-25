// src/services/animal-reproductive-history-service.ts
/**
 * Animal Reproductive History Service
 *
 * Aggregates and maintains lifetime reproductive history for female animals
 * based on breeding plans and birth outcomes. Species-adaptive: calculations
 * are parameterized per species (gestation ranges, risk weights, placenta
 * thresholds, post-birth heat tracking).
 *
 * Replaces the former mare-only service (mare-reproductive-history-service.ts).
 */

import prisma from "../prisma.js";

// ─────────────────────────────────────────────────────────────────────────────
// Species Birth Config — parameterizes all species-specific calculations
// ─────────────────────────────────────────────────────────────────────────────

type SpeciesBirthConfig = {
  /** Max days after birth to consider a valid post-birth heat record (0 = not tracked) */
  postBirthHeatMaxDays: number;
  /** Placenta retention threshold in minutes (0 = not tracked) */
  placentaRetentionThresholdMinutes: number;
  /** Whether to track placenta pass/retention */
  trackPlacenta: boolean;
  /** Whether to track post-birth heat cycles */
  trackPostBirthHeat: boolean;
  /** Risk score weights (must sum to ≤ 100) */
  riskWeights: {
    complicationRate: number;
    placentaRetention: number;
    vetInterventions: number;
    vetInterventionsCap: number;
  };
  /** Gestation range for analytics validation (days) */
  gestationMin: number;
  gestationMax: number;
};

const SPECIES_BIRTH_CONFIG: Record<string, SpeciesBirthConfig> = {
  HORSE: {
    postBirthHeatMaxDays: 30,
    placentaRetentionThresholdMinutes: 180, // 3 hours — critical for horses
    trackPlacenta: true,
    trackPostBirthHeat: true,
    riskWeights: { complicationRate: 40, placentaRetention: 30, vetInterventions: 5, vetInterventionsCap: 30 },
    gestationMin: 300,
    gestationMax: 400,
  },
  DOG: {
    postBirthHeatMaxDays: 0,
    placentaRetentionThresholdMinutes: 0,
    trackPlacenta: false,
    trackPostBirthHeat: false,
    riskWeights: { complicationRate: 50, placentaRetention: 0, vetInterventions: 5, vetInterventionsCap: 50 },
    gestationMin: 55,
    gestationMax: 72,
  },
  CAT: {
    postBirthHeatMaxDays: 0,
    placentaRetentionThresholdMinutes: 0,
    trackPlacenta: false,
    trackPostBirthHeat: false,
    riskWeights: { complicationRate: 50, placentaRetention: 0, vetInterventions: 5, vetInterventionsCap: 50 },
    gestationMin: 58,
    gestationMax: 72,
  },
  GOAT: {
    postBirthHeatMaxDays: 60,
    placentaRetentionThresholdMinutes: 720, // 12 hours for goats
    trackPlacenta: true,
    trackPostBirthHeat: false,
    riskWeights: { complicationRate: 40, placentaRetention: 25, vetInterventions: 5, vetInterventionsCap: 35 },
    gestationMin: 140,
    gestationMax: 160,
  },
  SHEEP: {
    postBirthHeatMaxDays: 60,
    placentaRetentionThresholdMinutes: 720,
    trackPlacenta: true,
    trackPostBirthHeat: false,
    riskWeights: { complicationRate: 40, placentaRetention: 25, vetInterventions: 5, vetInterventionsCap: 35 },
    gestationMin: 140,
    gestationMax: 160,
  },
  RABBIT: {
    postBirthHeatMaxDays: 0,
    placentaRetentionThresholdMinutes: 0,
    trackPlacenta: false,
    trackPostBirthHeat: false,
    riskWeights: { complicationRate: 50, placentaRetention: 0, vetInterventions: 5, vetInterventionsCap: 50 },
    gestationMin: 28,
    gestationMax: 35,
  },
};

function getSpeciesConfig(species: string): SpeciesBirthConfig {
  return SPECIES_BIRTH_CONFIG[species.toUpperCase()] || SPECIES_BIRTH_CONFIG.DOG;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core service functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update or create reproductive history after a birth outcome is recorded.
 * Species-aware: uses per-species config for placenta, heat, and risk calculations.
 */
export async function updateAnimalReproductiveHistory(
  animalId: number,
  tenantId: number,
  breedingPlanId: number,
  species: string
) {
  const config = getSpeciesConfig(species);

  // Fetch all completed breeding plans for this dam with birth outcomes
  const completedBreedings = await prisma.breedingPlan.findMany({
    where: {
      tenantId,
      damId: animalId,
      birthDateActual: { not: null },
    },
    include: {
      foalingOutcome: true,
      Offspring: true,
    },
    orderBy: {
      birthDateActual: "desc",
    },
  });

  if (completedBreedings.length === 0) {
    return null;
  }

  // Calculate aggregate statistics
  const totalBirths = completedBreedings.length;
  let totalLiveOffspring = 0;
  let totalComplicatedBirths = 0;
  let totalVeterinaryInterventions = 0;
  let totalRetainedPlacentas = 0;
  const postBirthHeatDays: number[] = [];
  const riskFactors: string[] = [];

  for (const plan of completedBreedings) {
    // Count live offspring
    if (plan.Offspring) {
      totalLiveOffspring += plan.Offspring.filter(
        (o) => o.lifeState === "ALIVE"
      ).length;
    }

    const outcome = plan.foalingOutcome;
    if (outcome) {
      if (outcome.hadComplications) {
        totalComplicatedBirths++;
      }
      if (outcome.veterinarianCalled) {
        totalVeterinaryInterventions++;
      }

      // Placenta tracking (species-dependent)
      if (config.trackPlacenta) {
        if (
          outcome.placentaPassed === false ||
          (outcome.placentaPassed === true &&
            outcome.placentaPassedMinutes &&
            outcome.placentaPassedMinutes > config.placentaRetentionThresholdMinutes)
        ) {
          totalRetainedPlacentas++;
        }
      }

      // Post-birth heat cycle timing (species-dependent)
      if (config.trackPostBirthHeat && outcome.postBirthHeatDate && plan.birthDateActual) {
        const birthDate = new Date(plan.birthDateActual);
        const heatDate = new Date(outcome.postBirthHeatDate);
        const daysDiff = Math.round(
          (heatDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 0 && daysDiff < config.postBirthHeatMaxDays) {
          postBirthHeatDays.push(daysDiff);
        }
      }
    }
  }

  // Calculate risk factors
  const complicationRate = totalBirths > 0 ? totalComplicatedBirths / totalBirths : 0;
  if (complicationRate > 0.3) {
    riskFactors.push("High complication rate");
  }
  if (config.trackPlacenta && totalRetainedPlacentas > 0) {
    riskFactors.push("History of retained placenta");
  }
  if (totalVeterinaryInterventions > totalBirths * 0.5) {
    riskFactors.push("Frequent veterinary interventions");
  }

  // Calculate risk score (0-100) using species-specific weights
  const w = config.riskWeights;
  let riskScore = 0;
  riskScore += complicationRate * w.complicationRate;
  if (config.trackPlacenta && totalBirths > 0) {
    riskScore += (totalRetainedPlacentas / totalBirths) * w.placentaRetention;
  }
  riskScore += Math.min(w.vetInterventionsCap, totalVeterinaryInterventions * w.vetInterventions);
  riskScore = Math.min(100, Math.round(riskScore));

  // Get latest birth details
  const latestBreeding = completedBreedings[0];
  const latestOutcome = latestBreeding.foalingOutcome;

  // Calculate post-birth heat statistics
  const avgPostBirthHeatDays =
    postBirthHeatDays.length > 0
      ? postBirthHeatDays.reduce((sum, days) => sum + days, 0) / postBirthHeatDays.length
      : null;
  const minPostBirthHeatDays =
    postBirthHeatDays.length > 0 ? Math.min(...postBirthHeatDays) : null;
  const maxPostBirthHeatDays =
    postBirthHeatDays.length > 0 ? Math.max(...postBirthHeatDays) : null;

  // Extract breed year from latest breeding
  const lastBreedYear = latestBreeding.breedDateActual
    ? new Date(latestBreeding.breedDateActual).getFullYear()
    : null;

  // Upsert animal reproductive history
  return await prisma.animalReproductiveHistory.upsert({
    where: { animalId },
    create: {
      tenantId,
      animalId,
      updatedAt: new Date(),
      species: species.toUpperCase(),
      totalBirths,
      totalLiveOffspring,
      totalComplicatedBirths,
      totalVeterinaryInterventions,
      totalRetainedPlacentas,
      lastBirthDate: latestBreeding.birthDateActual,
      lastBirthComplications: latestOutcome?.hadComplications ?? null,
      lastDamCondition: latestOutcome?.damCondition ?? null,
      lastPlacentaPassed: config.trackPlacenta ? (latestOutcome?.placentaPassed ?? null) : null,
      lastPlacentaMinutes: config.trackPlacenta ? (latestOutcome?.placentaPassedMinutes ?? null) : null,
      avgPostBirthHeatDays,
      minPostBirthHeatDays,
      maxPostBirthHeatDays,
      lastPostBirthHeatDate: config.trackPostBirthHeat ? (latestOutcome?.postBirthHeatDate ?? null) : null,
      lastReadyForRebreeding: latestOutcome?.readyForRebreeding ?? null,
      lastRebredDate: latestOutcome?.rebredDate ?? null,
      riskScore,
      riskFactors,
      lastUpdatedFromPlanId: breedingPlanId,
      lastUpdatedFromBreedYear: lastBreedYear,
    },
    update: {
      species: species.toUpperCase(),
      totalBirths,
      totalLiveOffspring,
      totalComplicatedBirths,
      totalVeterinaryInterventions,
      totalRetainedPlacentas,
      lastBirthDate: latestBreeding.birthDateActual,
      lastBirthComplications: latestOutcome?.hadComplications ?? null,
      lastDamCondition: latestOutcome?.damCondition ?? null,
      lastPlacentaPassed: config.trackPlacenta ? (latestOutcome?.placentaPassed ?? null) : null,
      lastPlacentaMinutes: config.trackPlacenta ? (latestOutcome?.placentaPassedMinutes ?? null) : null,
      avgPostBirthHeatDays,
      minPostBirthHeatDays,
      maxPostBirthHeatDays,
      lastPostBirthHeatDate: config.trackPostBirthHeat ? (latestOutcome?.postBirthHeatDate ?? null) : null,
      lastReadyForRebreeding: latestOutcome?.readyForRebreeding ?? null,
      lastRebredDate: latestOutcome?.rebredDate ?? null,
      riskScore,
      riskFactors,
      lastUpdatedFromPlanId: breedingPlanId,
      lastUpdatedFromBreedYear: lastBreedYear,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get animal reproductive history
 */
export async function getAnimalReproductiveHistory(animalId: number, tenantId: number) {
  const history = await prisma.animalReproductiveHistory.findUnique({
    where: { animalId },
    include: {
      Animal: {
        select: {
          id: true,
          name: true,
          birthDate: true,
          species: true,
        },
      },
    },
  });

  if (!history || history.tenantId !== tenantId) {
    return null;
  }

  return history;
}

/**
 * Get detailed birth history (list of all birth outcomes for a female animal)
 */
export async function getAnimalDetailedBirthHistory(animalId: number, tenantId: number) {
  const breedingPlans = await prisma.breedingPlan.findMany({
    where: {
      tenantId,
      damId: animalId,
      birthDateActual: { not: null },
    },
    include: {
      foalingOutcome: true,
      sire: {
        select: {
          id: true,
          name: true,
        },
      },
      Offspring: {
        select: {
          id: true,
          sex: true,
          healthStatus: true,
          lifeState: true,
        },
      },
    },
    orderBy: {
      birthDateActual: "desc",
    },
  });

  return breedingPlans.map((plan) => ({
    breedingPlanId: plan.id,
    breedingPlanCode: plan.code,
    breedDate: plan.breedDateActual,
    birthDate: plan.birthDateActual,
    sire: plan.sire,
    offspringCount: plan.Offspring?.length || 0,
    liveOffspringCount:
      plan.Offspring?.filter((o) => o.lifeState === "ALIVE").length || 0,
    outcome: plan.foalingOutcome
      ? {
          hadComplications: plan.foalingOutcome.hadComplications,
          complicationDetails: plan.foalingOutcome.complicationDetails,
          veterinarianCalled: plan.foalingOutcome.veterinarianCalled,
          damCondition: plan.foalingOutcome.damCondition,
          placentaPassed: plan.foalingOutcome.placentaPassed,
          placentaPassedMinutes: plan.foalingOutcome.placentaPassedMinutes,
          postBirthHeatDate: plan.foalingOutcome.postBirthHeatDate,
          readyForRebreeding: plan.foalingOutcome.readyForRebreeding,
          rebredDate: plan.foalingOutcome.rebredDate,
        }
      : null,
  }));
}

/**
 * Recalculate reproductive history from scratch for a given animal.
 * Looks up the animal's species automatically.
 */
export async function recalculateAnimalHistory(animalId: number, tenantId: number) {
  // Look up species from the animal record
  const animal = await prisma.animal.findFirst({
    where: { id: animalId, tenantId },
    select: { species: true },
  });

  if (!animal?.species) {
    return null;
  }

  // Get the most recent breeding plan ID to use as the "trigger"
  const latestPlan = await prisma.breedingPlan.findFirst({
    where: {
      tenantId,
      damId: animalId,
      birthDateActual: { not: null },
    },
    orderBy: {
      birthDateActual: "desc",
    },
    select: {
      id: true,
    },
  });

  if (!latestPlan) {
    return null;
  }

  return await updateAnimalReproductiveHistory(animalId, tenantId, latestPlan.id, animal.species);
}

/**
 * Get aggregate birth analytics for a tenant.
 * Optionally filter by species and/or year.
 */
export async function getBirthAnalytics(
  tenantId: number,
  options?: { year?: number; species?: string }
) {
  const currentYear = new Date().getFullYear();
  const targetYear = options?.year ?? currentYear;
  const speciesFilter = options?.species?.toUpperCase();

  const config = speciesFilter ? getSpeciesConfig(speciesFilter) : null;

  // Get all completed births for the tenant
  const whereClause: any = {
    tenantId,
    birthDateActual: { not: null },
  };
  if (speciesFilter) {
    whereClause.species = speciesFilter;
  }

  const completedBreedings = await prisma.breedingPlan.findMany({
    where: whereClause,
    include: {
      foalingOutcome: true,
      dam: { select: { id: true, name: true } },
      sire: { select: { id: true, name: true } },
      Offspring: { select: { id: true, lifeState: true, sex: true } },
    },
    orderBy: { birthDateActual: "desc" },
  });

  // Filter by year
  const yearlyBreedings = completedBreedings.filter((b) => {
    const birthYear = new Date(b.birthDateActual!).getFullYear();
    return birthYear === targetYear;
  });

  // Calculate overall statistics
  const totalBirths = completedBreedings.length;
  const birthsThisYear = yearlyBreedings.length;

  // Offspring stats
  let totalLiveOffspring = 0;
  let offspringThisYear = 0;
  let malesThisYear = 0;
  let femalesThisYear = 0;

  // Complication stats
  let totalComplications = 0;
  let complicationsThisYear = 0;
  let totalVetCalls = 0;
  let vetCallsThisYear = 0;

  // Gestation stats
  const gestationLengths: number[] = [];

  // Use species config for gestation validation, or wide range if no species filter
  const gestMin = config?.gestationMin ?? 25;
  const gestMax = config?.gestationMax ?? 400;

  // Monthly distribution for current year
  const monthlyDistribution: Record<number, number> = {};
  for (let m = 0; m < 12; m++) monthlyDistribution[m] = 0;

  for (const plan of completedBreedings) {
    const birthYear = new Date(plan.birthDateActual!).getFullYear();
    const birthMonth = new Date(plan.birthDateActual!).getMonth();
    const isThisYear = birthYear === targetYear;

    // Count live offspring
    const liveOffspring = plan.Offspring?.filter((o) => o.lifeState === "ALIVE") ?? [];
    totalLiveOffspring += liveOffspring.length;
    if (isThisYear) {
      offspringThisYear += liveOffspring.length;
      malesThisYear += liveOffspring.filter((o) => o.sex === "MALE").length;
      femalesThisYear += liveOffspring.filter((o) => o.sex === "FEMALE").length;
      monthlyDistribution[birthMonth]++;
    }

    // Complication tracking
    if (plan.foalingOutcome?.hadComplications) {
      totalComplications++;
      if (isThisYear) complicationsThisYear++;
    }
    if (plan.foalingOutcome?.veterinarianCalled) {
      totalVetCalls++;
      if (isThisYear) vetCallsThisYear++;
    }

    // Gestation length calculation
    if (plan.breedDateActual && plan.birthDateActual) {
      const breedDate = new Date(plan.breedDateActual);
      const birthDate = new Date(plan.birthDateActual);
      const gestationDays = Math.round(
        (birthDate.getTime() - breedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (gestationDays > gestMin && gestationDays < gestMax) {
        gestationLengths.push(gestationDays);
      }
    }
  }

  // Calculate averages
  const avgGestationLength =
    gestationLengths.length > 0
      ? Math.round(gestationLengths.reduce((sum, g) => sum + g, 0) / gestationLengths.length)
      : null;
  const minGestationLength =
    gestationLengths.length > 0 ? Math.min(...gestationLengths) : null;
  const maxGestationLength =
    gestationLengths.length > 0 ? Math.max(...gestationLengths) : null;

  // Success rate (live offspring / total births)
  const successRate = totalBirths > 0 ? Math.round((totalLiveOffspring / totalBirths) * 100) : 0;
  const complicationRate = totalBirths > 0 ? Math.round((totalComplications / totalBirths) * 100) : 0;

  // Year-over-year comparison
  const lastYearBreedings = completedBreedings.filter((b) => {
    const birthYear = new Date(b.birthDateActual!).getFullYear();
    return birthYear === targetYear - 1;
  });
  const birthsLastYear = lastYearBreedings.length;
  const yoyChange = birthsLastYear > 0
    ? Math.round(((birthsThisYear - birthsLastYear) / birthsLastYear) * 100)
    : null;

  // Top producing dams (by total births)
  const damStats: Record<number, { id: number; name: string; births: number; liveOffspring: number }> = {};
  for (const plan of completedBreedings) {
    if (!plan.dam) continue;
    if (!damStats[plan.dam.id]) {
      damStats[plan.dam.id] = { id: plan.dam.id, name: plan.dam.name, births: 0, liveOffspring: 0 };
    }
    damStats[plan.dam.id].births++;
    damStats[plan.dam.id].liveOffspring += plan.Offspring?.filter((o) => o.lifeState === "ALIVE").length ?? 0;
  }
  const topDams = Object.values(damStats)
    .sort((a, b) => b.births - a.births)
    .slice(0, 5);

  // Top producing sires
  const sireStats: Record<number, { id: number; name: string; births: number; liveOffspring: number }> = {};
  for (const plan of completedBreedings) {
    if (!plan.sire) continue;
    if (!sireStats[plan.sire.id]) {
      sireStats[plan.sire.id] = { id: plan.sire.id, name: plan.sire.name, births: 0, liveOffspring: 0 };
    }
    sireStats[plan.sire.id].births++;
    sireStats[plan.sire.id].liveOffspring += plan.Offspring?.filter((o) => o.lifeState === "ALIVE").length ?? 0;
  }
  const topSires = Object.values(sireStats)
    .sort((a, b) => b.births - a.births)
    .slice(0, 5);

  return {
    summary: {
      totalBirths,
      birthsThisYear,
      birthsLastYear,
      yoyChange,
      totalLiveOffspring,
      offspringThisYear,
      malesThisYear,
      femalesThisYear,
      successRate,
      complicationRate,
    },
    gestation: {
      avgDays: avgGestationLength,
      minDays: minGestationLength,
      maxDays: maxGestationLength,
      sampleSize: gestationLengths.length,
    },
    complications: {
      total: totalComplications,
      thisYear: complicationsThisYear,
      vetCalls: totalVetCalls,
      vetCallsThisYear,
    },
    seasonality: {
      year: targetYear,
      monthlyDistribution: Object.entries(monthlyDistribution).map(([month, count]) => ({
        month: parseInt(month),
        monthName: new Date(2000, parseInt(month)).toLocaleString("en-US", { month: "short" }),
        count,
      })),
    },
    topProducers: {
      dams: topDams,
      sires: topSires,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compatibility re-exports (remove after all consumers updated)
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use updateAnimalReproductiveHistory */
export const updateMareReproductiveHistory = (
  mareId: number,
  tenantId: number,
  breedingPlanId: number
) => updateAnimalReproductiveHistory(mareId, tenantId, breedingPlanId, "HORSE");

/** @deprecated Use getAnimalReproductiveHistory */
export const getMareReproductiveHistory = getAnimalReproductiveHistory;

/** @deprecated Use getAnimalDetailedBirthHistory */
export const getMareDetailedFoalingHistory = getAnimalDetailedBirthHistory;

/** @deprecated Use recalculateAnimalHistory */
export const recalculateMareHistory = recalculateAnimalHistory;

/** @deprecated Use getBirthAnalytics */
export const getFoalingAnalytics = (tenantId: number, options?: { year?: number }) =>
  getBirthAnalytics(tenantId, { ...options, species: "HORSE" });
