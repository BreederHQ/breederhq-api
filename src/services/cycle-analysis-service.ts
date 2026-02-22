// src/services/cycle-analysis-service.ts
/**
 * Cycle Analysis Service
 *
 * Calculates ovulation patterns, cycle history with enriched data,
 * and next cycle projections for individual females.
 */

import prisma from "../prisma.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type DataSource = "HORMONE_TEST" | "BIRTH_CALCULATED" | "ESTIMATED";
export type OvulationClassification = "Early Ovulator" | "Average" | "Late Ovulator" | "Insufficient Data";

export type CycleHistoryEntry = {
  id: number;
  cycleStart: string; // ISO date
  ovulation: string | null;
  ovulationMethod: string | null;
  offsetDays: number | null;
  variance: number | null;
  confidence: ConfidenceLevel;
  source: DataSource;
  breedingPlanId: number | null;
  birthDate: string | null;
  notes: string | null;
};

export type OvulationPattern = {
  sampleSize: number;
  confirmedCycles: number;
  avgOffsetDays: number | null;
  stdDeviation: number | null;
  minOffset: number | null;
  maxOffset: number | null;
  classification: OvulationClassification;
  confidence: ConfidenceLevel;
  guidance: string;
};

export type NextCycleProjection = {
  projectedHeatStart: string | null;
  projectedOvulationWindow: {
    earliest: string;
    latest: string;
    mostLikely: string;
  } | null;
  recommendedTestingStart: string | null;
  confidence: ConfidenceLevel;
} | null;

export type CycleAnalysisResult = {
  animalId: number;
  species: string;
  cycleHistory: CycleHistoryEntry[];
  ovulationPattern: OvulationPattern;
  nextCycleProjection: NextCycleProjection;
  cycleLengthDays: number;
  cycleLengthSource: "OVERRIDE" | "HISTORY" | "BIOLOGY";
};

// ─────────────────────────────────────────────────────────────────────────────
// Species Defaults
// ─────────────────────────────────────────────────────────────────────────────

type SpeciesConfig = {
  ovulationOffsetDays: number;
  gestationDays: number;
  cycleLenDays: number;
  isInducedOvulator: boolean;
};

const SPECIES_DEFAULTS: Record<string, SpeciesConfig> = {
  DOG: {
    ovulationOffsetDays: 12,
    gestationDays: 63,
    cycleLenDays: 180,
    isInducedOvulator: false,
  },
  CAT: {
    ovulationOffsetDays: 0, // Induced ovulator
    gestationDays: 63,
    cycleLenDays: 21,
    isInducedOvulator: true,
  },
  HORSE: {
    ovulationOffsetDays: 5,
    gestationDays: 340,
    cycleLenDays: 21,
    isInducedOvulator: false,
  },
  GOAT: {
    ovulationOffsetDays: 2,
    gestationDays: 150,
    cycleLenDays: 21,
    isInducedOvulator: false,
  },
  RABBIT: {
    ovulationOffsetDays: 0, // Induced ovulator
    gestationDays: 31,
    cycleLenDays: 15,
    isInducedOvulator: true,
  },
  SHEEP: {
    ovulationOffsetDays: 2,
    gestationDays: 147,
    cycleLenDays: 17,
    isInducedOvulator: false,
  },
  ALPACA: {
    ovulationOffsetDays: 0, // Induced ovulator
    gestationDays: 345,
    cycleLenDays: 14,
    isInducedOvulator: true,
  },
  LLAMA: {
    ovulationOffsetDays: 0, // Induced ovulator
    gestationDays: 350,
    cycleLenDays: 14,
    isInducedOvulator: true,
  },
};

function getSpeciesDefaults(species: string): SpeciesConfig {
  return SPECIES_DEFAULTS[species] || SPECIES_DEFAULTS.DOG;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date Utilities (UTC-safe)
// ─────────────────────────────────────────────────────────────────────────────

function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + days,
    12, 0, 0, 0 // Set to noon to avoid edge cases
  ));
  return result;
}

function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

function daysBetween(dateA: Date, dateB: Date): number {
  const a = startOfDayUTC(dateA);
  const b = startOfDayUTC(dateB);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((a.getTime() - b.getTime()) / msPerDay);
}

function toISODate(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistical Utilities
// ─────────────────────────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squaredDiffs));
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern Classification
// ─────────────────────────────────────────────────────────────────────────────

function classifyOvulationPattern(
  avgOffset: number,
  speciesDefault: number,
  stdDev: number,
  sampleSize: number
): { label: OvulationClassification; confidence: ConfidenceLevel; guidance: string } {
  if (sampleSize < 2) {
    return {
      label: "Insufficient Data",
      confidence: "LOW",
      guidance: "Need at least 2 breeding cycles with confirmed or calculated ovulation to detect pattern.",
    };
  }

  const variance = avgOffset - speciesDefault;
  const isConsistent = stdDev <= 1.5;

  let label: OvulationClassification;
  if (variance <= -2) {
    label = "Early Ovulator";
  } else if (variance >= 2) {
    label = "Late Ovulator";
  } else {
    label = "Average";
  }

  const confidence: ConfidenceLevel =
    sampleSize >= 3 && isConsistent ? "HIGH" :
    sampleSize >= 2 && isConsistent ? "MEDIUM" : "LOW";

  return { label, confidence, guidance: generateGuidance(label, avgOffset, speciesDefault) };
}

function generateGuidance(
  classification: OvulationClassification,
  avgOffset: number,
  speciesDefault: number
): string {
  if (classification === "Insufficient Data") {
    return "Record more breeding cycles with confirmed ovulation to unlock personalized predictions.";
  }

  const variance = Math.round(avgOffset - speciesDefault);
  const testStartDay = Math.round(Math.max(avgOffset - 4, 1));
  const roundedAvgOffset = Math.round(avgOffset);

  if (classification === "Early Ovulator") {
    return `This female typically ovulates on Day ${roundedAvgOffset}, which is ${Math.abs(variance)} day${Math.abs(variance) !== 1 ? 's' : ''} earlier than the breed average. Start progesterone testing on Day ${testStartDay} to catch the rise.`;
  }

  if (classification === "Late Ovulator") {
    return `This female typically ovulates on Day ${roundedAvgOffset}, which is ${variance} day${variance !== 1 ? 's' : ''} later than the breed average. Start progesterone testing on Day ${testStartDay} - don't rush into breeding too early.`;
  }

  // Average
  return `This female follows the breed average ovulation pattern (Day ${speciesDefault}). Start progesterone testing on Day ${speciesDefault - 2} and continue daily until confirmed.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cycle Length Calculation
// ─────────────────────────────────────────────────────────────────────────────

function calculateCycleLengthFromHistory(
  cycles: Array<{ cycleStart: Date }>,
  speciesDefault: number
): { days: number; source: "OVERRIDE" | "HISTORY" | "BIOLOGY" } {
  if (cycles.length < 2) {
    return { days: speciesDefault, source: "BIOLOGY" };
  }

  // Sort by date ascending
  const sorted = [...cycles].sort((a, b) =>
    a.cycleStart.getTime() - b.cycleStart.getTime()
  );

  // Calculate intervals between consecutive cycles
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = daysBetween(sorted[i].cycleStart, sorted[i - 1].cycleStart);
    if (days > 0 && days < 400) {
      intervals.push(days);
    }
  }

  if (intervals.length === 0) {
    return { days: speciesDefault, source: "BIOLOGY" };
  }

  // Use last 3 intervals (most recent) and weighted average with species default.
  // This matches the frontend effectiveCycleLen.ts algorithm so both UI
  // ("Current cycle length") and backend predictions agree.
  //   n >= 3 → 100% observed
  //   n == 2 →  67% observed, 33% species default
  //   n == 1 →  50% observed, 50% species default
  const recent = intervals.slice(-3);
  const n = recent.length;
  const observed = Math.round(recent.reduce((sum, v) => sum + v, 0) / n);
  const wObs = n >= 3 ? 1 : n === 2 ? 0.67 : 0.50;
  const weighted = Math.round(observed * wObs + speciesDefault * (1 - wObs));

  return { days: weighted, source: "HISTORY" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Calculation
// ─────────────────────────────────────────────────────────────────────────────

export async function calculateCycleAnalysis(
  animalId: number,
  tenantId: number
): Promise<CycleAnalysisResult> {
  // 1. Get the animal to determine species and any overrides
  const animal = await prisma.animal.findFirst({
    where: { id: animalId, tenantId },
    select: {
      id: true,
      species: true,
      femaleCycleLenOverrideDays: true,
    },
  });

  if (!animal) {
    throw new Error("Animal not found");
  }

  const species = animal.species || "DOG";
  const speciesConfig = getSpeciesDefaults(species);

  // 2. Get all ReproductiveCycle records for this female
  const cycles = await prisma.reproductiveCycle.findMany({
    where: { femaleId: animalId, tenantId },
    orderBy: { cycleStart: "asc" },
  });

  // 3. Get all BreedingPlans for this female to extract ovulation data
  const breedingPlans = await prisma.breedingPlan.findMany({
    where: { damId: animalId, tenantId },
    select: {
      id: true,
      cycleStartObserved: true,
      ovulationConfirmed: true,
      ovulationConfirmedMethod: true,
      birthDateActual: true,
      varianceFromExpected: true,
      species: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // 4. Merge data: ReproductiveCycle + BreedingPlan ovulation data
  const enrichedCycles: CycleHistoryEntry[] = cycles.map((cycle) => {
    // Find breeding plan that matches this cycle start (within ±3 days)
    const matchingPlan = breedingPlans.find((plan) => {
      if (!plan.cycleStartObserved) return false;
      const daysDiff = Math.abs(daysBetween(plan.cycleStartObserved, cycle.cycleStart));
      return daysDiff <= 3;
    });

    let ovulation: Date | null = cycle.ovulation;
    let ovulationMethod: string | null = null;
    let confidence: ConfidenceLevel = "LOW";
    let source: DataSource = "ESTIMATED";

    if (matchingPlan?.ovulationConfirmed) {
      // High confidence: Hormone-tested ovulation
      ovulation = matchingPlan.ovulationConfirmed;
      ovulationMethod = matchingPlan.ovulationConfirmedMethod || null;
      confidence = "HIGH";
      source = "HORMONE_TEST";
    } else if (matchingPlan?.birthDateActual && matchingPlan?.cycleStartObserved) {
      // Medium confidence: Back-calculate from birth
      const gestationDays = speciesConfig.gestationDays;
      ovulation = subtractDays(matchingPlan.birthDateActual, gestationDays);
      ovulationMethod = "CALCULATED";
      confidence = "MEDIUM";
      source = "BIRTH_CALCULATED";
    } else if (!ovulation && cycle.cycleStart) {
      // Low confidence: Estimate based on species average
      ovulation = addDays(cycle.cycleStart, speciesConfig.ovulationOffsetDays);
      ovulationMethod = "ESTIMATED";
      confidence = "LOW";
      source = "ESTIMATED";
    }

    const offsetDays = ovulation
      ? daysBetween(ovulation, cycle.cycleStart)
      : null;
    const variance = offsetDays !== null
      ? offsetDays - speciesConfig.ovulationOffsetDays
      : null;

    return {
      id: cycle.id,
      cycleStart: toISODate(cycle.cycleStart)!,
      ovulation: toISODate(ovulation),
      ovulationMethod,
      offsetDays,
      variance,
      confidence,
      source,
      breedingPlanId: matchingPlan?.id || null,
      birthDate: matchingPlan?.birthDateActual
        ? toISODate(matchingPlan.birthDateActual)
        : null,
      notes: cycle.notes,
    };
  });

  // Sort by date descending (most recent first) for UI display
  enrichedCycles.sort((a, b) =>
    new Date(b.cycleStart).getTime() - new Date(a.cycleStart).getTime()
  );

  // 5. Calculate pattern metrics (use only HIGH/MEDIUM confidence cycles)
  const reliableCycles = enrichedCycles.filter(
    (c) => c.confidence === "HIGH" || c.confidence === "MEDIUM"
  );

  let ovulationPattern: OvulationPattern;

  if (reliableCycles.length < 2) {
    ovulationPattern = {
      sampleSize: enrichedCycles.length,
      confirmedCycles: reliableCycles.length,
      avgOffsetDays: null,
      stdDeviation: null,
      minOffset: null,
      maxOffset: null,
      classification: "Insufficient Data",
      confidence: "LOW",
      guidance: "Need at least 2 breeding cycles with confirmed or calculated ovulation to detect pattern.",
    };
  } else {
    const offsets = reliableCycles
      .map((c) => c.offsetDays)
      .filter((o): o is number => o !== null);

    const avgOffsetDays = mean(offsets);
    const stdDev = standardDeviation(offsets);

    const pattern = classifyOvulationPattern(
      avgOffsetDays,
      speciesConfig.ovulationOffsetDays,
      stdDev,
      reliableCycles.length
    );

    ovulationPattern = {
      sampleSize: enrichedCycles.length,
      confirmedCycles: reliableCycles.length,
      avgOffsetDays: Math.round(avgOffsetDays * 10) / 10,
      stdDeviation: Math.round(stdDev * 10) / 10,
      minOffset: Math.min(...offsets),
      maxOffset: Math.max(...offsets),
      classification: pattern.label,
      confidence: pattern.confidence,
      guidance: pattern.guidance,
    };
  }

  // 6. Calculate cycle length
  let cycleLengthDays: number;
  let cycleLengthSource: "OVERRIDE" | "HISTORY" | "BIOLOGY";

  if (animal.femaleCycleLenOverrideDays) {
    cycleLengthDays = animal.femaleCycleLenOverrideDays;
    cycleLengthSource = "OVERRIDE";
  } else {
    const calculated = calculateCycleLengthFromHistory(
      cycles.map((c) => ({ cycleStart: c.cycleStart })),
      speciesConfig.cycleLenDays
    );
    cycleLengthDays = calculated.days;
    cycleLengthSource = calculated.source;
  }

  // 7. Project next cycle
  let nextCycleProjection: NextCycleProjection = null;

  if (enrichedCycles.length > 0) {
    // Most recent cycle (first after sorting desc)
    const lastCycle = enrichedCycles[0];
    const lastCycleStart = new Date(lastCycle.cycleStart);

    const projectedHeatStart = addDays(lastCycleStart, cycleLengthDays);

    // Use average offset if we have pattern data, otherwise species default
    const avgOffset = ovulationPattern.avgOffsetDays ?? speciesConfig.ovulationOffsetDays;
    const varianceWindow = ovulationPattern.stdDeviation
      ? Math.ceil(ovulationPattern.stdDeviation)
      : 2; // Default to ±2 days if no data

    const projectedOvulationMostLikely = addDays(projectedHeatStart, avgOffset);

    nextCycleProjection = {
      projectedHeatStart: toISODate(projectedHeatStart),
      projectedOvulationWindow: {
        earliest: toISODate(addDays(projectedHeatStart, avgOffset - varianceWindow))!,
        latest: toISODate(addDays(projectedHeatStart, avgOffset + varianceWindow))!,
        mostLikely: toISODate(projectedOvulationMostLikely)!,
      },
      recommendedTestingStart: toISODate(addDays(projectedHeatStart, avgOffset - 4)),
      confidence: ovulationPattern.confidence,
    };
  }

  return {
    animalId,
    species,
    cycleHistory: enrichedCycles,
    ovulationPattern,
    nextCycleProjection,
    cycleLengthDays,
    cycleLengthSource,
  };
}
