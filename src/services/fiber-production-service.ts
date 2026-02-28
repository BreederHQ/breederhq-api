// src/services/fiber-production-service.ts
/**
 * Fiber/Wool Production Service
 *
 * Handles all fiber production operations:
 * - Shearing record management
 * - Lab test recording (micron analysis, yield tests)
 * - Quality trend analysis
 * - Lifetime fiber production history
 */

import prisma from "../prisma.js";
import type {
  ShearingRecord,
  FiberLabTest,
  FiberProductionHistory,
  ShearingType,
  FleeceGrade,
  FiberLabTestType,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ShearingFilters {
  animalId?: number;
  grade?: FleeceGrade;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface LabTestFilters {
  animalId?: number;
  shearingRecordId?: number;
  testType?: FiberLabTestType;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface RecordShearingInput {
  animalId: number;
  shearingDate: string;
  shearingType?: ShearingType;
  grossWeightLbs: number;
  cleanWeightLbs?: number;
  stapleLengthIn?: number;
  grade?: FleeceGrade;
  handleQuality?: string;
  crimpPerInch?: number;
  vegetableMatter?: string;
  weathering?: string;
  cotting?: boolean;
  tenderness?: string;
  soldTo?: string;
  salePriceCents?: number;
  fiberBuyer?: string;
  notes?: string;
}

export interface UpdateShearingInput {
  shearingType?: ShearingType;
  grossWeightLbs?: number;
  cleanWeightLbs?: number;
  stapleLengthIn?: number;
  grade?: FleeceGrade;
  handleQuality?: string;
  crimpPerInch?: number;
  vegetableMatter?: string;
  weathering?: string;
  cotting?: boolean;
  tenderness?: string;
  soldTo?: string;
  salePriceCents?: number;
  fiberBuyer?: string;
  notes?: string;
}

export interface RecordLabTestInput {
  animalId: number;
  shearingRecordId?: number;
  testDate: string;
  testType?: FiberLabTestType;
  labName?: string;
  avgFiberDiameter?: number;
  standardDeviation?: number;
  coefficientOfVariation?: number;
  comfortFactor?: number;
  spinningFineness?: number;
  curvature?: number;
  stapleStrengthNKtex?: number;
  positionOfBreak?: string;
  cleanFleeceYieldPct?: number;
  histogramData?: Record<string, any>;
  certificateNumber?: string;
  certificateUrl?: string;
  notes?: string;
}

export interface FiberSummary {
  totalAnimals: number;
  totalShearings: number;
  avgFleeceWeightLbs: number;
  avgMicron: number;
  gradeDistribution: Record<string, number>;
  topProducers: Array<{
    animalId: number;
    animalName: string;
    avgFleeceWeightLbs: number;
  }>;
}

export interface QualityTrendPoint {
  date: string;
  avgMicron: number;
  avgFleeceWeight: number;
  shearingsCount: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate yield percentage from gross and clean weights
 */
function calculateYieldPct(grossLbs: number, cleanLbs: number | null): number | null {
  if (!cleanLbs || grossLbs <= 0) return null;
  return (cleanLbs / grossLbs) * 100;
}

/**
 * Calculate days since last shearing
 */
async function calculateDaysSinceLastShearing(
  tenantId: number,
  animalId: number,
  shearingDate: Date
): Promise<number | null> {
  const lastShearing = await prisma.shearingRecord.findFirst({
    where: {
      tenantId,
      animalId,
      shearingDate: { lt: shearingDate },
    },
    orderBy: { shearingDate: "desc" },
  });

  if (!lastShearing) return null;

  const diffMs = shearingDate.getTime() - lastShearing.shearingDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine micron trend based on lab tests
 * IMPROVING = decreasing micron (finer fiber)
 * COARSENING = increasing micron
 * STABLE = within 1 micron variance
 */
function calculateMicronTrend(tests: Array<{ avgFiberDiameter: Decimal | null }>): string | null {
  const validTests = tests.filter((t) => t.avgFiberDiameter !== null);
  if (validTests.length < 3) return null;

  // Sort by date (assuming array is already sorted desc)
  const microns = validTests.slice(0, 5).map((t) => Number(t.avgFiberDiameter));
  const oldest = microns[microns.length - 1];
  const newest = microns[0];
  const diff = newest - oldest;

  if (Math.abs(diff) < 1) return "STABLE";
  return diff < 0 ? "IMPROVING" : "COARSENING";
}

// ────────────────────────────────────────────────────────────────────────────
// Service Implementation
// ────────────────────────────────────────────────────────────────────────────

class FiberProductionService {
  // ══════════════════════════════════════════════════════════════════════════
  // SHEARING RECORDS
  // ══════════════════════════════════════════════════════════════════════════

  async listShearings(
    tenantId: number,
    filters: ShearingFilters
  ): Promise<PaginatedResult<ShearingRecord>> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters.animalId) where.animalId = filters.animalId;
    if (filters.grade) where.grade = filters.grade;
    if (filters.startDate || filters.endDate) {
      where.shearingDate = {};
      if (filters.startDate) where.shearingDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.shearingDate.lte = new Date(filters.endDate);
    }

    const [items, total] = await Promise.all([
      prisma.shearingRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { shearingDate: "desc" },
        include: {
          animal: { select: { id: true, name: true } },
          labTests: true,
        },
      }),
      prisma.shearingRecord.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getShearing(tenantId: number, id: number): Promise<ShearingRecord | null> {
    return prisma.shearingRecord.findFirst({
      where: { id, tenantId },
      include: {
        animal: { select: { id: true, name: true } },
        labTests: true,
      },
    });
  }

  async getLatestShearing(tenantId: number, animalId: number): Promise<ShearingRecord | null> {
    return prisma.shearingRecord.findFirst({
      where: { tenantId, animalId },
      orderBy: { shearingDate: "desc" },
      include: {
        labTests: true,
      },
    });
  }

  async recordShearing(tenantId: number, input: RecordShearingInput): Promise<ShearingRecord> {
    const shearingDate = new Date(input.shearingDate);

    // Calculate days since last shearing
    const daysSinceLastShearing = await calculateDaysSinceLastShearing(
      tenantId,
      input.animalId,
      shearingDate
    );

    // Calculate yield percentage
    const yieldPct = calculateYieldPct(input.grossWeightLbs, input.cleanWeightLbs ?? null);

    const record = await prisma.shearingRecord.create({
      data: {
        tenantId,
        animalId: input.animalId,
        shearingDate,
        shearingType: input.shearingType ?? "FULL_BODY",
        daysSinceLastShearing,
        grossWeightLbs: new Decimal(input.grossWeightLbs),
        cleanWeightLbs: input.cleanWeightLbs ? new Decimal(input.cleanWeightLbs) : null,
        yieldPct: yieldPct ? new Decimal(yieldPct) : null,
        stapleLengthIn: input.stapleLengthIn ? new Decimal(input.stapleLengthIn) : null,
        grade: input.grade,
        handleQuality: input.handleQuality,
        crimpPerInch: input.crimpPerInch ? new Decimal(input.crimpPerInch) : null,
        vegetableMatter: input.vegetableMatter,
        weathering: input.weathering,
        cotting: input.cotting,
        tenderness: input.tenderness,
        soldTo: input.soldTo,
        salePriceCents: input.salePriceCents,
        fiberBuyer: input.fiberBuyer,
        notes: input.notes,
      },
    });

    // Update lifetime fiber production history
    await this.updateFiberProductionHistory(input.animalId, tenantId);

    return record;
  }

  async updateShearing(
    tenantId: number,
    id: number,
    input: UpdateShearingInput
  ): Promise<ShearingRecord> {
    const existing = await prisma.shearingRecord.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      const err = new Error("Shearing record not found");
      (err as any).statusCode = 404;
      throw err;
    }

    // Recalculate yield if weights changed
    let yieldPct = existing.yieldPct;
    if (input.grossWeightLbs !== undefined || input.cleanWeightLbs !== undefined) {
      const gross = input.grossWeightLbs ?? Number(existing.grossWeightLbs);
      const clean = input.cleanWeightLbs ?? (existing.cleanWeightLbs ? Number(existing.cleanWeightLbs) : null);
      const newYield = calculateYieldPct(gross, clean);
      yieldPct = newYield ? new Decimal(newYield) : null;
    }

    const record = await prisma.shearingRecord.update({
      where: { id },
      data: {
        shearingType: input.shearingType,
        grossWeightLbs: input.grossWeightLbs ? new Decimal(input.grossWeightLbs) : undefined,
        cleanWeightLbs: input.cleanWeightLbs ? new Decimal(input.cleanWeightLbs) : undefined,
        yieldPct,
        stapleLengthIn: input.stapleLengthIn ? new Decimal(input.stapleLengthIn) : undefined,
        grade: input.grade,
        handleQuality: input.handleQuality,
        crimpPerInch: input.crimpPerInch ? new Decimal(input.crimpPerInch) : undefined,
        vegetableMatter: input.vegetableMatter,
        weathering: input.weathering,
        cotting: input.cotting,
        tenderness: input.tenderness,
        soldTo: input.soldTo,
        salePriceCents: input.salePriceCents,
        fiberBuyer: input.fiberBuyer,
        notes: input.notes,
      },
    });

    // Update lifetime fiber production history
    await this.updateFiberProductionHistory(existing.animalId, tenantId);

    return record;
  }

  async deleteShearing(tenantId: number, id: number): Promise<void> {
    const existing = await prisma.shearingRecord.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      const err = new Error("Shearing record not found");
      (err as any).statusCode = 404;
      throw err;
    }

    await prisma.shearingRecord.delete({ where: { id } });

    // Update lifetime fiber production history
    await this.updateFiberProductionHistory(existing.animalId, tenantId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LAB TESTS
  // ══════════════════════════════════════════════════════════════════════════

  async listLabTests(
    tenantId: number,
    filters: LabTestFilters
  ): Promise<PaginatedResult<FiberLabTest>> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters.animalId) where.animalId = filters.animalId;
    if (filters.shearingRecordId) where.shearingRecordId = filters.shearingRecordId;
    if (filters.testType) where.testType = filters.testType;
    if (filters.startDate || filters.endDate) {
      where.testDate = {};
      if (filters.startDate) where.testDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.testDate.lte = new Date(filters.endDate);
    }

    const [items, total] = await Promise.all([
      prisma.fiberLabTest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { testDate: "desc" },
        include: {
          animal: { select: { id: true, name: true } },
          shearingRecord: { select: { id: true, shearingDate: true, grade: true } },
        },
      }),
      prisma.fiberLabTest.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async recordLabTest(tenantId: number, input: RecordLabTestInput): Promise<FiberLabTest> {
    const record = await prisma.fiberLabTest.create({
      data: {
        tenantId,
        animalId: input.animalId,
        shearingRecordId: input.shearingRecordId,
        testDate: new Date(input.testDate),
        testType: input.testType ?? "MICRON_ANALYSIS",
        labName: input.labName,
        avgFiberDiameter: input.avgFiberDiameter ? new Decimal(input.avgFiberDiameter) : null,
        standardDeviation: input.standardDeviation ? new Decimal(input.standardDeviation) : null,
        coefficientOfVariation: input.coefficientOfVariation
          ? new Decimal(input.coefficientOfVariation)
          : null,
        comfortFactor: input.comfortFactor ? new Decimal(input.comfortFactor) : null,
        spinningFineness: input.spinningFineness ? new Decimal(input.spinningFineness) : null,
        curvature: input.curvature ? new Decimal(input.curvature) : null,
        stapleStrengthNKtex: input.stapleStrengthNKtex
          ? new Decimal(input.stapleStrengthNKtex)
          : null,
        positionOfBreak: input.positionOfBreak,
        cleanFleeceYieldPct: input.cleanFleeceYieldPct
          ? new Decimal(input.cleanFleeceYieldPct)
          : null,
        histogramData: input.histogramData ?? undefined,
        certificateNumber: input.certificateNumber,
        certificateUrl: input.certificateUrl,
        notes: input.notes,
      },
    });

    // Update lifetime fiber production history with micron trend
    await this.updateFiberProductionHistory(input.animalId, tenantId);

    return record;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRODUCTION HISTORY
  // ══════════════════════════════════════════════════════════════════════════

  async updateFiberProductionHistory(animalId: number, tenantId: number): Promise<void> {
    // Get all shearings
    const shearings = await prisma.shearingRecord.findMany({
      where: { animalId, tenantId },
      orderBy: { shearingDate: "desc" },
    });

    // Get all lab tests for micron stats
    const labTests = await prisma.fiberLabTest.findMany({
      where: { animalId, tenantId },
      orderBy: { testDate: "desc" },
    });

    const totalShearings = shearings.length;
    if (totalShearings === 0) {
      // Remove history if no shearings
      await prisma.fiberProductionHistory.deleteMany({ where: { animalId, tenantId } });
      return;
    }

    // Calculate aggregates
    let totalGrossWeight = 0;
    let totalCleanWeight = 0;
    let totalYield = 0;
    let totalStapleLength = 0;
    let cleanCount = 0;
    let yieldCount = 0;
    let stapleCount = 0;
    let bestFleeceWeight = 0;
    let bestGrade: FleeceGrade | null = null;

    const gradeRank: Record<FleeceGrade, number> = {
      PRIME: 5,
      CHOICE: 4,
      STANDARD: 3,
      UTILITY: 2,
      REJECT: 1,
    };

    for (const shearing of shearings) {
      const gross = Number(shearing.grossWeightLbs);
      totalGrossWeight += gross;
      if (gross > bestFleeceWeight) bestFleeceWeight = gross;

      if (shearing.cleanWeightLbs) {
        totalCleanWeight += Number(shearing.cleanWeightLbs);
        cleanCount++;
      }
      if (shearing.yieldPct) {
        totalYield += Number(shearing.yieldPct);
        yieldCount++;
      }
      if (shearing.stapleLengthIn) {
        totalStapleLength += Number(shearing.stapleLengthIn);
        stapleCount++;
      }
      if (shearing.grade) {
        if (!bestGrade || gradeRank[shearing.grade] > gradeRank[bestGrade]) {
          bestGrade = shearing.grade;
        }
      }
    }

    // Calculate micron stats from lab tests
    let totalMicron = 0;
    let micronCount = 0;
    let bestMicron: number | null = null;

    for (const test of labTests) {
      if (test.avgFiberDiameter) {
        const micron = Number(test.avgFiberDiameter);
        totalMicron += micron;
        micronCount++;
        if (bestMicron === null || micron < bestMicron) {
          bestMicron = micron;
        }
      }
    }

    const micronTrend = calculateMicronTrend(labTests);

    const data = {
      tenantId,
      animalId,
      totalShearings,
      totalGrossWeightLbs: new Decimal(totalGrossWeight),
      totalCleanWeightLbs: cleanCount > 0 ? new Decimal(totalCleanWeight) : null,
      avgGrossWeightLbs: new Decimal(totalGrossWeight / totalShearings),
      avgCleanWeightLbs: cleanCount > 0 ? new Decimal(totalCleanWeight / cleanCount) : null,
      avgYieldPct: yieldCount > 0 ? new Decimal(totalYield / yieldCount) : null,
      avgStapleLengthIn: stapleCount > 0 ? new Decimal(totalStapleLength / stapleCount) : null,
      avgMicron: micronCount > 0 ? new Decimal(totalMicron / micronCount) : null,
      micronTrend,
      bestMicron: bestMicron ? new Decimal(bestMicron) : null,
      bestFleeceWeightLbs: new Decimal(bestFleeceWeight),
      bestGradeAchieved: bestGrade,
    };

    await prisma.fiberProductionHistory.upsert({
      where: { animalId },
      create: data,
      update: data,
    });
  }

  async getAnimalFiberHistory(
    tenantId: number,
    animalId: number
  ): Promise<FiberProductionHistory | null> {
    return prisma.fiberProductionHistory.findFirst({
      where: { tenantId, animalId },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════

  async getFiberSummary(tenantId: number): Promise<FiberSummary> {
    // Get shearing stats
    const shearings = await prisma.shearingRecord.findMany({
      where: { tenantId },
      include: {
        animal: { select: { id: true, name: true } },
      },
    });

    // Get lab tests for micron average
    const labTests = await prisma.fiberLabTest.findMany({
      where: { tenantId },
    });

    // Calculate averages
    let totalWeight = 0;
    let totalMicron = 0;
    let micronCount = 0;
    const gradeDistribution: Record<string, number> = {};
    const animalWeights = new Map<number, { name: string; total: number; count: number }>();

    for (const shearing of shearings) {
      const weight = Number(shearing.grossWeightLbs);
      totalWeight += weight;

      if (shearing.grade) {
        gradeDistribution[shearing.grade] = (gradeDistribution[shearing.grade] ?? 0) + 1;
      }

      const existing = animalWeights.get(shearing.animalId) ?? {
        name: shearing.animal.name,
        total: 0,
        count: 0,
      };
      existing.total += weight;
      existing.count++;
      animalWeights.set(shearing.animalId, existing);
    }

    for (const test of labTests) {
      if (test.avgFiberDiameter) {
        totalMicron += Number(test.avgFiberDiameter);
        micronCount++;
      }
    }

    // Get unique animals
    const uniqueAnimals = new Set(shearings.map((s) => s.animalId));

    // Get top producers
    const topProducers = Array.from(animalWeights.entries())
      .map(([animalId, data]) => ({
        animalId,
        animalName: data.name,
        avgFleeceWeightLbs: data.total / data.count,
      }))
      .sort((a, b) => b.avgFleeceWeightLbs - a.avgFleeceWeightLbs)
      .slice(0, 5);

    return {
      totalAnimals: uniqueAnimals.size,
      totalShearings: shearings.length,
      avgFleeceWeightLbs: shearings.length > 0 ? totalWeight / shearings.length : 0,
      avgMicron: micronCount > 0 ? totalMicron / micronCount : 0,
      gradeDistribution,
      topProducers,
    };
  }

  async getQualityTrend(
    tenantId: number,
    startDate: Date,
    endDate: Date
  ): Promise<QualityTrendPoint[]> {
    const shearings = await prisma.shearingRecord.findMany({
      where: {
        tenantId,
        shearingDate: { gte: startDate, lte: endDate },
      },
      include: {
        labTests: true,
      },
      orderBy: { shearingDate: "asc" },
    });

    // Group by month
    const monthlyData = new Map<
      string,
      { totalWeight: number; totalMicron: number; micronCount: number; shearingsCount: number }
    >();

    for (const shearing of shearings) {
      const monthKey = shearing.shearingDate.toISOString().slice(0, 7); // YYYY-MM
      const existing = monthlyData.get(monthKey) ?? {
        totalWeight: 0,
        totalMicron: 0,
        micronCount: 0,
        shearingsCount: 0,
      };

      existing.totalWeight += Number(shearing.grossWeightLbs);
      existing.shearingsCount++;

      for (const test of shearing.labTests) {
        if (test.avgFiberDiameter) {
          existing.totalMicron += Number(test.avgFiberDiameter);
          existing.micronCount++;
        }
      }

      monthlyData.set(monthKey, existing);
    }

    return Array.from(monthlyData.entries()).map(([date, data]) => ({
      date,
      avgMicron: data.micronCount > 0 ? data.totalMicron / data.micronCount : 0,
      avgFleeceWeight: data.shearingsCount > 0 ? data.totalWeight / data.shearingsCount : 0,
      shearingsCount: data.shearingsCount,
    }));
  }

  async getTopProducers(
    tenantId: number,
    limit: number = 10,
    sortBy: "weight" | "micron" = "weight"
  ): Promise<Array<{ animalId: number; animalName: string; value: number }>> {
    if (sortBy === "weight") {
      const histories = await prisma.fiberProductionHistory.findMany({
        where: {
          tenantId,
          avgGrossWeightLbs: { not: null },
        },
        orderBy: { avgGrossWeightLbs: "desc" },
        take: limit,
        include: {
          animal: { select: { id: true, name: true } },
        },
      });

      return histories.map((h) => ({
        animalId: h.animalId,
        animalName: h.animal.name,
        value: Number(h.avgGrossWeightLbs),
      }));
    } else {
      // For micron, lower is better (finer fiber)
      const histories = await prisma.fiberProductionHistory.findMany({
        where: {
          tenantId,
          avgMicron: { not: null },
        },
        orderBy: { avgMicron: "asc" },
        take: limit,
        include: {
          animal: { select: { id: true, name: true } },
        },
      });

      return histories.map((h) => ({
        animalId: h.animalId,
        animalName: h.animal.name,
        value: Number(h.avgMicron),
      }));
    }
  }
}

export default new FiberProductionService();
