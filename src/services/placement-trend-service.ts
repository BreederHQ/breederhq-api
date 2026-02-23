/**
 * Placement Trend Service
 *
 * Computes per-species placement duration trends from a breeder's completed
 * plans.  The primary metric is the 75th-percentile of days-from-birth-to-
 * placement-completed.  When a species has >= `threshold` data points the
 * frontend can use the trend value instead of the static species default for
 * the extended-placement hatched band on the Gantt chart.
 *
 * Data sources (both queried, deduplicated):
 *   1. OffspringGroup  – current system (actively written)
 *   2. BreedingPlan    – legacy (no longer written, but may contain historical data)
 */

import prisma from "../prisma.js";

/* ---------- public types ---------- */

export type PlacementTrendBySpecies = {
  species: string;
  sampleSize: number;
  p75Days: number;
  medianDays: number;
  minDays: number;
  maxDays: number;
};

export type PlacementTrendsResult = {
  trends: PlacementTrendBySpecies[];
  /** species → p75Days, only entries with sampleSize >= threshold */
  qualified: Record<string, number>;
};

/* ---------- helpers ---------- */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Nearest-rank percentile (no interpolation). */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/* ---------- main ---------- */

export async function getPlacementTrends(
  tenantId: number,
  threshold = 5,
): Promise<PlacementTrendsResult> {
  // --- Source 1: OffspringGroup (current) ---
  const groups = await prisma.offspringGroup.findMany({
    where: {
      tenantId,
      actualBirthOn: { not: null },
      placementCompletedAt: { not: null },
      deletedAt: null,
    },
    select: {
      species: true,
      actualBirthOn: true,
      placementCompletedAt: true,
      planId: true,
    },
  });

  // --- Source 2: BreedingPlan (legacy fallback) ---
  // Exclude plans already represented by an OffspringGroup to avoid
  // double-counting.
  const linkedPlanIds = groups
    .filter((g) => g.planId != null)
    .map((g) => g.planId!);

  const legacyPlans = await prisma.breedingPlan.findMany({
    where: {
      tenantId,
      birthDateActual: { not: null },
      placementCompletedDateActual: { not: null },
      deletedAt: null,
      ...(linkedPlanIds.length > 0 ? { id: { notIn: linkedPlanIds } } : {}),
    },
    select: {
      species: true,
      birthDateActual: true,
      placementCompletedDateActual: true,
    },
  });

  // --- Aggregate by species ---
  const daysBySpecies: Record<string, number[]> = {};

  for (const g of groups) {
    const birth = new Date(g.actualBirthOn!);
    const placed = new Date(g.placementCompletedAt!);
    const days = Math.round(
      (placed.getTime() - birth.getTime()) / MS_PER_DAY,
    );
    // Sanity: exclude impossible values (negative or > 2 years)
    if (days > 0 && days < 730) {
      const sp = String(g.species);
      (daysBySpecies[sp] ??= []).push(days);
    }
  }

  for (const p of legacyPlans) {
    const birth = new Date(p.birthDateActual!);
    const placed = new Date(p.placementCompletedDateActual!);
    const days = Math.round(
      (placed.getTime() - birth.getTime()) / MS_PER_DAY,
    );
    if (days > 0 && days < 730) {
      const sp = String(p.species);
      (daysBySpecies[sp] ??= []).push(days);
    }
  }

  // --- Compute statistics ---
  const trends: PlacementTrendBySpecies[] = [];
  const qualified: Record<string, number> = {};

  for (const [species, daysArr] of Object.entries(daysBySpecies)) {
    const sorted = [...daysArr].sort((a, b) => a - b);
    const result: PlacementTrendBySpecies = {
      species,
      sampleSize: sorted.length,
      p75Days: percentile(sorted, 75),
      medianDays: percentile(sorted, 50),
      minDays: sorted[0],
      maxDays: sorted[sorted.length - 1],
    };
    trends.push(result);

    if (sorted.length >= threshold) {
      qualified[species] = result.p75Days;
    }
  }

  return { trends, qualified };
}
