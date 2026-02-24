// src/services/mare-reproductive-history-service.ts
/**
 * Mare Reproductive History Service
 *
 * Aggregates and maintains lifetime reproductive history for mares based on
 * breeding plans and foaling outcomes. This provides quick access to patterns,
 * risk factors, and historical data when planning future breedings.
 */

import prisma from "../prisma.js";

/**
 * Update or create mare reproductive history after a foaling outcome is recorded
 */
export async function updateMareReproductiveHistory(
  mareId: number,
  tenantId: number,
  breedingPlanId: number
) {
  // Fetch all completed breeding plans for this mare with foaling outcomes
  const completedBreedings = await prisma.breedingPlan.findMany({
    where: {
      tenantId,
      damId: mareId,
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
    // No foaling history yet
    return null;
  }

  // Calculate aggregate statistics
  const totalFoalings = completedBreedings.length;
  let totalLiveFoals = 0;
  let totalComplicatedFoalings = 0;
  let totalVeterinaryInterventions = 0;
  let totalRetainedPlacentas = 0;
  const postFoalingHeatDays: number[] = [];
  const riskFactors: string[] = [];

  for (const plan of completedBreedings) {
    // Count live foals
    if (plan.Offspring) {
      totalLiveFoals += plan.Offspring.filter(
        (o) => o.lifeState === "ALIVE"
      ).length;
    }

    // Check foaling outcome for complications
    const outcome = plan.foalingOutcome;
    if (outcome) {
      if (outcome.hadComplications) {
        totalComplicatedFoalings++;
      }
      if (outcome.veterinarianCalled) {
        totalVeterinaryInterventions++;
      }
      if (outcome.placentaPassed === false || (outcome.placentaPassed === true && outcome.placentaPassedMinutes && outcome.placentaPassedMinutes > 180)) {
        totalRetainedPlacentas++;
      }

      // Calculate post-foaling heat cycle timing
      if (outcome.postFoalingHeatDate && plan.birthDateActual) {
        const birthDate = new Date(plan.birthDateActual);
        const heatDate = new Date(outcome.postFoalingHeatDate);
        const daysDiff = Math.round(
          (heatDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 0 && daysDiff < 30) {
          // Reasonable range for foal heat
          postFoalingHeatDays.push(daysDiff);
        }
      }
    }
  }

  // Calculate risk factors
  const complicationRate = totalFoalings > 0 ? totalComplicatedFoalings / totalFoalings : 0;
  if (complicationRate > 0.3) {
    riskFactors.push("High complication rate");
  }
  if (totalRetainedPlacentas > 0) {
    riskFactors.push("History of retained placenta");
  }
  if (totalVeterinaryInterventions > totalFoalings * 0.5) {
    riskFactors.push("Frequent veterinary interventions");
  }

  // Calculate risk score (0-100)
  let riskScore = 0;
  riskScore += complicationRate * 40; // Up to 40 points for complication rate
  riskScore += (totalRetainedPlacentas / totalFoalings) * 30; // Up to 30 points for placenta issues
  riskScore += Math.min(30, totalVeterinaryInterventions * 5); // Up to 30 points for vet calls
  riskScore = Math.min(100, Math.round(riskScore));

  // Get latest foaling details
  const latestBreeding = completedBreedings[0];
  const latestOutcome = latestBreeding.foalingOutcome;

  // Calculate post-foaling heat statistics
  const avgPostFoalingHeatDays =
    postFoalingHeatDays.length > 0
      ? postFoalingHeatDays.reduce((sum, days) => sum + days, 0) / postFoalingHeatDays.length
      : null;
  const minPostFoalingHeatDays =
    postFoalingHeatDays.length > 0 ? Math.min(...postFoalingHeatDays) : null;
  const maxPostFoalingHeatDays =
    postFoalingHeatDays.length > 0 ? Math.max(...postFoalingHeatDays) : null;

  // Extract breed year from latest breeding
  const lastBreedYear = latestBreeding.breedDateActual
    ? new Date(latestBreeding.breedDateActual).getFullYear()
    : null;

  // Upsert mare reproductive history
  return await prisma.mareReproductiveHistory.upsert({
    where: { mareId },
    create: {
      tenantId,
      mareId,
      totalFoalings,
      totalLiveFoals,
      totalComplicatedFoalings,
      totalVeterinaryInterventions,
      totalRetainedPlacentas,
      lastFoalingDate: latestBreeding.birthDateActual,
      lastFoalingComplications: latestOutcome?.hadComplications ?? null,
      lastMareCondition: latestOutcome?.mareCondition ?? null,
      lastPlacentaPassed: latestOutcome?.placentaPassed ?? null,
      lastPlacentaMinutes: latestOutcome?.placentaPassedMinutes ?? null,
      avgPostFoalingHeatDays,
      minPostFoalingHeatDays,
      maxPostFoalingHeatDays,
      lastPostFoalingHeatDate: latestOutcome?.postFoalingHeatDate ?? null,
      lastReadyForRebreeding: latestOutcome?.readyForRebreeding ?? null,
      lastRebredDate: latestOutcome?.rebredDate ?? null,
      riskScore,
      riskFactors,
      lastUpdatedFromPlanId: breedingPlanId,
      lastUpdatedFromBreedYear: lastBreedYear,
    },
    update: {
      totalFoalings,
      totalLiveFoals,
      totalComplicatedFoalings,
      totalVeterinaryInterventions,
      totalRetainedPlacentas,
      lastFoalingDate: latestBreeding.birthDateActual,
      lastFoalingComplications: latestOutcome?.hadComplications ?? null,
      lastMareCondition: latestOutcome?.mareCondition ?? null,
      lastPlacentaPassed: latestOutcome?.placentaPassed ?? null,
      lastPlacentaMinutes: latestOutcome?.placentaPassedMinutes ?? null,
      avgPostFoalingHeatDays,
      minPostFoalingHeatDays,
      maxPostFoalingHeatDays,
      lastPostFoalingHeatDate: latestOutcome?.postFoalingHeatDate ?? null,
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
 * Get mare reproductive history
 */
export async function getMareReproductiveHistory(mareId: number, tenantId: number) {
  const history = await prisma.mareReproductiveHistory.findUnique({
    where: { mareId },
    include: {
      mare: {
        select: {
          id: true,
          name: true,
          birthDate: true,
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
 * Get detailed foaling history (list of all foaling outcomes for a mare)
 */
export async function getMareDetailedFoalingHistory(mareId: number, tenantId: number) {
  const breedingPlans = await prisma.breedingPlan.findMany({
    where: {
      tenantId,
      damId: mareId,
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
    foalCount: plan.Offspring?.length || 0,
    liveFoalCount:
      plan.Offspring?.filter((o) => o.lifeState === "ALIVE").length || 0,
    outcome: plan.foalingOutcome
      ? {
          hadComplications: plan.foalingOutcome.hadComplications,
          complicationDetails: plan.foalingOutcome.complicationDetails,
          veterinarianCalled: plan.foalingOutcome.veterinarianCalled,
          mareCondition: plan.foalingOutcome.mareCondition,
          placentaPassed: plan.foalingOutcome.placentaPassed,
          placentaPassedMinutes: plan.foalingOutcome.placentaPassedMinutes,
          postFoalingHeatDate: plan.foalingOutcome.postFoalingHeatDate,
          readyForRebreeding: plan.foalingOutcome.readyForRebreeding,
          rebredDate: plan.foalingOutcome.rebredDate,
        }
      : null,
  }));
}

/**
 * Recalculate mare reproductive history from scratch for a given mare
 * Useful for backfilling or correcting data
 */
export async function recalculateMareHistory(mareId: number, tenantId: number) {
  // Get the most recent breeding plan ID to use as the "trigger"
  const latestPlan = await prisma.breedingPlan.findFirst({
    where: {
      tenantId,
      damId: mareId,
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

  return await updateMareReproductiveHistory(mareId, tenantId, latestPlan.id);
}

/**
 * Get aggregate foaling analytics for a tenant
 * Returns overall statistics, trends, and success rates
 */
export async function getFoalingAnalytics(tenantId: number, options?: { year?: number }) {
  const currentYear = new Date().getFullYear();
  const targetYear = options?.year ?? currentYear;

  // Get all completed foalings for the tenant
  const completedBreedings = await prisma.breedingPlan.findMany({
    where: {
      tenantId,
      species: "HORSE",
      birthDateActual: { not: null },
    },
    include: {
      foalingOutcome: true,
      dam: { select: { id: true, name: true } },
      sire: { select: { id: true, name: true } },
      Offspring: { select: { id: true, lifeState: true, sex: true } },
    },
    orderBy: { birthDateActual: "desc" },
  });

  // Filter by year if specified
  const yearlyBreedings = completedBreedings.filter((b) => {
    const birthYear = new Date(b.birthDateActual!).getFullYear();
    return birthYear === targetYear;
  });

  // Calculate overall statistics
  const totalFoalings = completedBreedings.length;
  const foalingsThisYear = yearlyBreedings.length;

  // Live foal stats
  let totalLiveFoals = 0;
  let totalFoalsThisYear = 0;
  let coltsThisYear = 0;
  let filliesThisYear = 0;

  // Complication stats
  let totalComplications = 0;
  let complicationsThisYear = 0;
  let totalVetCalls = 0;
  let vetCallsThisYear = 0;

  // Gestation stats
  const gestationLengths: number[] = [];

  // Monthly distribution for current year
  const monthlyDistribution: Record<number, number> = {};
  for (let m = 0; m < 12; m++) monthlyDistribution[m] = 0;

  for (const plan of completedBreedings) {
    const birthYear = new Date(plan.birthDateActual!).getFullYear();
    const birthMonth = new Date(plan.birthDateActual!).getMonth();
    const isThisYear = birthYear === targetYear;

    // Count live foals
    const liveFoals = plan.Offspring?.filter((o) => o.lifeState === "ALIVE") ?? [];
    totalLiveFoals += liveFoals.length;
    if (isThisYear) {
      totalFoalsThisYear += liveFoals.length;
      coltsThisYear += liveFoals.filter((o) => o.sex === "MALE").length;
      filliesThisYear += liveFoals.filter((o) => o.sex === "FEMALE").length;
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
      if (gestationDays > 300 && gestationDays < 400) {
        // Reasonable horse gestation range
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

  // Success rate (live foals / total foalings)
  const successRate = totalFoalings > 0 ? Math.round((totalLiveFoals / totalFoalings) * 100) : 0;
  const complicationRate = totalFoalings > 0 ? Math.round((totalComplications / totalFoalings) * 100) : 0;

  // Year-over-year comparison
  const lastYearBreedings = completedBreedings.filter((b) => {
    const birthYear = new Date(b.birthDateActual!).getFullYear();
    return birthYear === targetYear - 1;
  });
  const foalingsLastYear = lastYearBreedings.length;
  const yoyChange = foalingsLastYear > 0
    ? Math.round(((foalingsThisYear - foalingsLastYear) / foalingsLastYear) * 100)
    : null;

  // Top producing mares (by total foalings)
  const mareStats: Record<number, { id: number; name: string; foalings: number; liveFoals: number }> = {};
  for (const plan of completedBreedings) {
    if (!plan.dam) continue;
    if (!mareStats[plan.dam.id]) {
      mareStats[plan.dam.id] = { id: plan.dam.id, name: plan.dam.name, foalings: 0, liveFoals: 0 };
    }
    mareStats[plan.dam.id].foalings++;
    mareStats[plan.dam.id].liveFoals += plan.Offspring?.filter((o) => o.lifeState === "ALIVE").length ?? 0;
  }
  const topMares = Object.values(mareStats)
    .sort((a, b) => b.foalings - a.foalings)
    .slice(0, 5);

  // Top producing sires
  const sireStats: Record<number, { id: number; name: string; foalings: number; liveFoals: number }> = {};
  for (const plan of completedBreedings) {
    if (!plan.sire) continue;
    if (!sireStats[plan.sire.id]) {
      sireStats[plan.sire.id] = { id: plan.sire.id, name: plan.sire.name, foalings: 0, liveFoals: 0 };
    }
    sireStats[plan.sire.id].foalings++;
    sireStats[plan.sire.id].liveFoals += plan.Offspring?.filter((o) => o.lifeState === "ALIVE").length ?? 0;
  }
  const topSires = Object.values(sireStats)
    .sort((a, b) => b.foalings - a.foalings)
    .slice(0, 5);

  return {
    summary: {
      totalFoalings,
      foalingsThisYear,
      foalingsLastYear,
      yoyChange,
      totalLiveFoals,
      totalFoalsThisYear,
      coltsThisYear,
      filliesThisYear,
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
      mares: topMares,
      sires: topSires,
    },
  };
}
