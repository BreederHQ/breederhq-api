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
      offspringGroup: {
        include: {
          Offspring: true,
        },
      },
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
    if (plan.offspringGroup?.Offspring) {
      totalLiveFoals += plan.offspringGroup.Offspring.filter(
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
      offspringGroup: {
        include: {
          Offspring: {
            select: {
              id: true,
              sex: true,
              healthStatus: true,
              lifeState: true,
            },
          },
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
    foalCount: plan.offspringGroup?.Offspring.length || 0,
    liveFoalCount:
      plan.offspringGroup?.Offspring.filter((o) => o.lifeState === "ALIVE").length || 0,
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
