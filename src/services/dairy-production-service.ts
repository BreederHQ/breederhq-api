// src/services/dairy-production-service.ts
/**
 * Dairy Production Service
 *
 * Handles all dairy production operations:
 * - Lactation cycle management (start, dry-off, status)
 * - Milking record logging and tracking
 * - DHIA test data recording
 * - Linear appraisal scores
 * - 305-day standardized calculations
 * - Production analytics
 */

import prisma from "../prisma.js";
import type {
  LactationCycle,
  MilkingRecord,
  DHIATestRecord,
  LinearAppraisal,
  DairyProductionHistory,
  LactationStatus,
  MilkingFrequency,
  DHIATestType,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface LactationFilters {
  animalId?: number;
  status?: LactationStatus;
  page?: number;
  limit?: number;
}

export interface MilkingRecordFilters {
  animalId?: number;
  lactationCycleId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface DHIATestFilters {
  animalId?: number;
  lactationCycleId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AppraisalFilters {
  animalId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateLactationInput {
  animalId: number;
  freshenDate: string;
  lactationNumber: number;
  milkingFrequency?: MilkingFrequency;
  notes?: string;
}

export interface UpdateLactationInput {
  status?: LactationStatus;
  milkingFrequency?: MilkingFrequency;
  notes?: string;
}

export interface DryOffInput {
  dryOffDate: string;
}

export interface LogMilkingInput {
  animalId: number;
  lactationCycleId?: number;
  milkedAt: string;
  sessionNumber?: number;
  milkLbs: number;
  butterfatPct?: number;
  proteinPct?: number;
  somaticCellCount?: number;
  lactose?: number;
  conductivity?: number;
  notes?: string;
}

export interface BulkMilkingInput {
  records: LogMilkingInput[];
}

export interface RecordDHIATestInput {
  animalId: number;
  lactationCycleId?: number;
  testDate: string;
  testType?: DHIATestType;
  daysInMilk?: number;
  testDayMilkLbs: number;
  butterfatPct?: number;
  proteinPct?: number;
  lactose?: number;
  somaticCellCount?: number;
  milkUreaNitrogen?: number;
  labName?: string;
  labTestNumber?: string;
  certificateUrl?: string;
  documentId?: number;
}

export interface RecordAppraisalInput {
  animalId: number;
  appraisalDate: string;
  appraiserName?: string;
  appraiserId?: string;
  finalScore: number;
  classification?: string;
  generalAppearance?: number;
  dairyCharacter?: number;
  bodyCapacity?: number;
  mammarySystem?: number;
  allScores?: Record<string, number>;
  notes?: string;
}

export interface DairySummary {
  totalAnimalsInMilk: number;
  totalLactations: number;
  avgDailyProduction: number;
  avgButterfatPct: number;
  avgProteinPct: number;
  topProducers: Array<{
    animalId: number;
    animalName: string;
    days305MilkLbs: number;
  }>;
}

export interface ProductionTrendPoint {
  date: string;
  totalMilkLbs: number;
  avgMilkLbs: number;
  animalsCount: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ────────────────────────────────────────────────────────────────────────────
// 305-Day Calculation Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate days in milk from freshen date to reference date
 */
function calculateDaysInMilk(freshenDate: Date, referenceDate: Date = new Date()): number {
  const diffMs = referenceDate.getTime() - freshenDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate 305-day standardized production using ADGA formula
 * Formula: (actual production / days in milk) * 305
 * Note: This is a simplified version. Full ADGA formula includes age adjustment factors.
 */
function calculate305DayProjection(actualProduction: number, daysInMilk: number): number {
  if (daysInMilk <= 0) return 0;
  // Cap at 305 days for completed lactations
  const effectiveDays = Math.min(daysInMilk, 305);
  return (actualProduction / effectiveDays) * 305;
}

// ────────────────────────────────────────────────────────────────────────────
// Service Implementation
// ────────────────────────────────────────────────────────────────────────────

class DairyProductionService {
  // ══════════════════════════════════════════════════════════════════════════
  // LACTATION CYCLES
  // ══════════════════════════════════════════════════════════════════════════

  async listLactations(
    tenantId: number,
    filters: LactationFilters
  ): Promise<PaginatedResult<LactationCycle>> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters.animalId) where.animalId = filters.animalId;
    if (filters.status) where.status = filters.status;

    const [items, total] = await Promise.all([
      prisma.lactationCycle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { freshenDate: "desc" },
        include: {
          animal: { select: { id: true, name: true } },
        },
      }),
      prisma.lactationCycle.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getLactation(tenantId: number, id: number): Promise<LactationCycle | null> {
    return prisma.lactationCycle.findFirst({
      where: { id, tenantId },
      include: {
        animal: { select: { id: true, name: true } },
        milkingRecords: { orderBy: { milkedAt: "desc" }, take: 10 },
        dhiaTestRecords: { orderBy: { testDate: "desc" }, take: 5 },
      },
    });
  }

  async getCurrentLactation(tenantId: number, animalId: number): Promise<LactationCycle | null> {
    return prisma.lactationCycle.findFirst({
      where: {
        tenantId,
        animalId,
        status: { in: ["FRESH", "MILKING", "TRANSITION"] },
      },
      orderBy: { freshenDate: "desc" },
      include: {
        milkingRecords: { orderBy: { milkedAt: "desc" }, take: 10 },
        dhiaTestRecords: { orderBy: { testDate: "desc" }, take: 5 },
      },
    });
  }

  async startLactation(tenantId: number, input: CreateLactationInput): Promise<LactationCycle> {
    // Check for existing active lactation
    const existing = await prisma.lactationCycle.findFirst({
      where: {
        tenantId,
        animalId: input.animalId,
        status: { in: ["FRESH", "MILKING", "TRANSITION"] },
      },
    });

    if (existing) {
      const err = new Error("Animal already has an active lactation. Dry off first.");
      (err as any).statusCode = 400;
      throw err;
    }

    return prisma.lactationCycle.create({
      data: {
        tenantId,
        animalId: input.animalId,
        lactationNumber: input.lactationNumber,
        freshenDate: new Date(input.freshenDate),
        status: "FRESH",
        milkingFrequency: input.milkingFrequency ?? "TWICE_DAILY",
        notes: input.notes,
      },
    });
  }

  async updateLactation(
    tenantId: number,
    id: number,
    input: UpdateLactationInput
  ): Promise<LactationCycle> {
    const existing = await prisma.lactationCycle.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      const err = new Error("Lactation not found");
      (err as any).statusCode = 404;
      throw err;
    }

    return prisma.lactationCycle.update({
      where: { id },
      data: {
        status: input.status,
        milkingFrequency: input.milkingFrequency,
        notes: input.notes,
      },
    });
  }

  async dryOff(tenantId: number, id: number, input: DryOffInput): Promise<LactationCycle> {
    const lactation = await prisma.lactationCycle.findFirst({
      where: { id, tenantId },
    });

    if (!lactation) {
      const err = new Error("Lactation not found");
      (err as any).statusCode = 404;
      throw err;
    }

    // Calculate final 305-day totals
    const updatedLactation = await prisma.lactationCycle.update({
      where: { id },
      data: {
        status: "DRY",
        dryOffDate: new Date(input.dryOffDate),
      },
    });

    // Recalculate 305-day totals
    await this.updateLactation305DayTotals(id, tenantId);

    // Update lifetime production history
    await this.updateDairyProductionHistory(lactation.animalId, tenantId);

    return this.getLactation(tenantId, id) as Promise<LactationCycle>;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MILKING RECORDS
  // ══════════════════════════════════════════════════════════════════════════

  async listMilkingRecords(
    tenantId: number,
    filters: MilkingRecordFilters
  ): Promise<PaginatedResult<MilkingRecord>> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters.animalId) where.animalId = filters.animalId;
    if (filters.lactationCycleId) where.lactationCycleId = filters.lactationCycleId;
    if (filters.startDate || filters.endDate) {
      where.milkedAt = {};
      if (filters.startDate) where.milkedAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.milkedAt.lte = new Date(filters.endDate);
    }

    const [items, total] = await Promise.all([
      prisma.milkingRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { milkedAt: "desc" },
        include: {
          animal: { select: { id: true, name: true } },
        },
      }),
      prisma.milkingRecord.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async logMilking(tenantId: number, input: LogMilkingInput): Promise<MilkingRecord> {
    // Find active lactation if not provided
    let lactationCycleId = input.lactationCycleId;
    if (!lactationCycleId) {
      const activeLactation = await this.getCurrentLactation(tenantId, input.animalId);
      lactationCycleId = activeLactation?.id;
    }

    // Calculate days in milk if we have a lactation
    let daysInMilk: number | undefined;
    if (lactationCycleId) {
      const lactation = await prisma.lactationCycle.findUnique({
        where: { id: lactationCycleId },
      });
      if (lactation) {
        daysInMilk = calculateDaysInMilk(lactation.freshenDate, new Date(input.milkedAt));
      }
    }

    const record = await prisma.milkingRecord.create({
      data: {
        tenantId,
        animalId: input.animalId,
        lactationCycleId,
        milkedAt: new Date(input.milkedAt),
        sessionNumber: input.sessionNumber,
        daysInMilk,
        milkLbs: new Decimal(input.milkLbs),
        butterfatPct: input.butterfatPct ? new Decimal(input.butterfatPct) : null,
        proteinPct: input.proteinPct ? new Decimal(input.proteinPct) : null,
        somaticCellCount: input.somaticCellCount,
        lactose: input.lactose ? new Decimal(input.lactose) : null,
        conductivity: input.conductivity ? new Decimal(input.conductivity) : null,
        notes: input.notes,
      },
    });

    // Update lactation stats if linked
    if (lactationCycleId) {
      await this.updateLactation305DayTotals(lactationCycleId, tenantId);
      await this.calculatePeakProduction(lactationCycleId, tenantId);
    }

    return record;
  }

  async logBulkMilking(tenantId: number, input: BulkMilkingInput): Promise<{ count: number }> {
    let count = 0;
    for (const record of input.records) {
      await this.logMilking(tenantId, record);
      count++;
    }
    return { count };
  }

  async updateMilkingRecord(
    tenantId: number,
    id: number,
    input: Partial<LogMilkingInput>
  ): Promise<MilkingRecord> {
    const existing = await prisma.milkingRecord.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      const err = new Error("Milking record not found");
      (err as any).statusCode = 404;
      throw err;
    }

    const record = await prisma.milkingRecord.update({
      where: { id },
      data: {
        milkedAt: input.milkedAt ? new Date(input.milkedAt) : undefined,
        sessionNumber: input.sessionNumber,
        milkLbs: input.milkLbs ? new Decimal(input.milkLbs) : undefined,
        butterfatPct: input.butterfatPct ? new Decimal(input.butterfatPct) : undefined,
        proteinPct: input.proteinPct ? new Decimal(input.proteinPct) : undefined,
        somaticCellCount: input.somaticCellCount,
        lactose: input.lactose ? new Decimal(input.lactose) : undefined,
        conductivity: input.conductivity ? new Decimal(input.conductivity) : undefined,
        notes: input.notes,
      },
    });

    // Update lactation stats if linked
    if (existing.lactationCycleId) {
      await this.updateLactation305DayTotals(existing.lactationCycleId, tenantId);
      await this.calculatePeakProduction(existing.lactationCycleId, tenantId);
    }

    return record;
  }

  async deleteMilkingRecord(tenantId: number, id: number): Promise<void> {
    const existing = await prisma.milkingRecord.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      const err = new Error("Milking record not found");
      (err as any).statusCode = 404;
      throw err;
    }

    await prisma.milkingRecord.delete({ where: { id } });

    // Update lactation stats if linked
    if (existing.lactationCycleId) {
      await this.updateLactation305DayTotals(existing.lactationCycleId, tenantId);
      await this.calculatePeakProduction(existing.lactationCycleId, tenantId);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DHIA TESTS
  // ══════════════════════════════════════════════════════════════════════════

  async listDHIATests(
    tenantId: number,
    filters: DHIATestFilters
  ): Promise<PaginatedResult<DHIATestRecord>> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters.animalId) where.animalId = filters.animalId;
    if (filters.lactationCycleId) where.lactationCycleId = filters.lactationCycleId;
    if (filters.startDate || filters.endDate) {
      where.testDate = {};
      if (filters.startDate) where.testDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.testDate.lte = new Date(filters.endDate);
    }

    const [items, total] = await Promise.all([
      prisma.dHIATestRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { testDate: "desc" },
        include: {
          animal: { select: { id: true, name: true } },
        },
      }),
      prisma.dHIATestRecord.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async recordDHIATest(tenantId: number, input: RecordDHIATestInput): Promise<DHIATestRecord> {
    // Calculate fat and protein in lbs if percentages provided
    const fatLbs =
      input.butterfatPct && input.testDayMilkLbs
        ? (input.testDayMilkLbs * input.butterfatPct) / 100
        : null;
    const proteinLbs =
      input.proteinPct && input.testDayMilkLbs
        ? (input.testDayMilkLbs * input.proteinPct) / 100
        : null;

    const record = await prisma.dHIATestRecord.create({
      data: {
        tenantId,
        animalId: input.animalId,
        lactationCycleId: input.lactationCycleId,
        testDate: new Date(input.testDate),
        testType: input.testType ?? "STANDARD",
        daysInMilk: input.daysInMilk,
        testDayMilkLbs: new Decimal(input.testDayMilkLbs),
        butterfatPct: input.butterfatPct ? new Decimal(input.butterfatPct) : null,
        proteinPct: input.proteinPct ? new Decimal(input.proteinPct) : null,
        lactose: input.lactose ? new Decimal(input.lactose) : null,
        fatLbs: fatLbs ? new Decimal(fatLbs) : null,
        proteinLbs: proteinLbs ? new Decimal(proteinLbs) : null,
        somaticCellCount: input.somaticCellCount,
        milkUreaNitrogen: input.milkUreaNitrogen ? new Decimal(input.milkUreaNitrogen) : null,
        labName: input.labName,
        labTestNumber: input.labTestNumber,
        certificateUrl: input.certificateUrl,
        documentId: input.documentId,
      },
    });

    // Update lactation averages if linked
    if (input.lactationCycleId) {
      await this.updateLactationAverages(input.lactationCycleId, tenantId);
    }

    return record;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LINEAR APPRAISALS
  // ══════════════════════════════════════════════════════════════════════════

  async listAppraisals(
    tenantId: number,
    filters: AppraisalFilters
  ): Promise<PaginatedResult<LinearAppraisal>> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters.animalId) where.animalId = filters.animalId;
    if (filters.startDate || filters.endDate) {
      where.appraisalDate = {};
      if (filters.startDate) where.appraisalDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.appraisalDate.lte = new Date(filters.endDate);
    }

    const [items, total] = await Promise.all([
      prisma.linearAppraisal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { appraisalDate: "desc" },
        include: {
          animal: { select: { id: true, name: true } },
        },
      }),
      prisma.linearAppraisal.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async recordAppraisal(tenantId: number, input: RecordAppraisalInput): Promise<LinearAppraisal> {
    const appraisal = await prisma.linearAppraisal.create({
      data: {
        tenantId,
        animalId: input.animalId,
        appraisalDate: new Date(input.appraisalDate),
        appraiserName: input.appraiserName,
        appraiserId: input.appraiserId,
        finalScore: input.finalScore,
        classification: input.classification,
        generalAppearance: input.generalAppearance,
        dairyCharacter: input.dairyCharacter,
        bodyCapacity: input.bodyCapacity,
        mammarySystem: input.mammarySystem,
        allScores: input.allScores ?? undefined,
        notes: input.notes,
      },
    });

    // Update production history with best appraisal
    await this.updateDairyProductionHistory(input.animalId, tenantId);

    return appraisal;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CALCULATIONS & AGGREGATIONS
  // ══════════════════════════════════════════════════════════════════════════

  async updateLactation305DayTotals(lactationId: number, tenantId: number): Promise<void> {
    const lactation = await prisma.lactationCycle.findFirst({
      where: { id: lactationId, tenantId },
    });

    if (!lactation) return;

    // Get all milking records for this lactation
    const records = await prisma.milkingRecord.findMany({
      where: { lactationCycleId: lactationId, tenantId },
    });

    if (records.length === 0) return;

    // Calculate totals
    let totalMilkLbs = 0;
    let totalFatLbs = 0;
    let totalProteinLbs = 0;

    for (const record of records) {
      const milkLbs = Number(record.milkLbs);
      totalMilkLbs += milkLbs;
      if (record.butterfatPct) {
        totalFatLbs += milkLbs * (Number(record.butterfatPct) / 100);
      }
      if (record.proteinPct) {
        totalProteinLbs += milkLbs * (Number(record.proteinPct) / 100);
      }
    }

    // Calculate days in milk
    const referenceDate = lactation.dryOffDate ?? new Date();
    const daysInMilk = calculateDaysInMilk(lactation.freshenDate, referenceDate);

    // Calculate 305-day projections
    const days305MilkLbs = calculate305DayProjection(totalMilkLbs, daysInMilk);
    const days305FatLbs = calculate305DayProjection(totalFatLbs, daysInMilk);
    const days305ProteinLbs = calculate305DayProjection(totalProteinLbs, daysInMilk);

    await prisma.lactationCycle.update({
      where: { id: lactationId },
      data: {
        days305MilkLbs: new Decimal(days305MilkLbs),
        days305FatLbs: new Decimal(days305FatLbs),
        days305ProteinLbs: new Decimal(days305ProteinLbs),
      },
    });
  }

  async calculatePeakProduction(lactationId: number, tenantId: number): Promise<void> {
    const lactation = await prisma.lactationCycle.findFirst({
      where: { id: lactationId, tenantId },
    });

    if (!lactation) return;

    // Find peak daily production (sum of all sessions in a day)
    const records = await prisma.milkingRecord.findMany({
      where: { lactationCycleId: lactationId, tenantId },
      orderBy: { milkedAt: "asc" },
    });

    if (records.length === 0) return;

    // Group by date and sum
    const dailyTotals = new Map<string, { total: number; date: Date }>();
    for (const record of records) {
      const dateKey = record.milkedAt.toISOString().split("T")[0];
      const existing = dailyTotals.get(dateKey) ?? { total: 0, date: record.milkedAt };
      existing.total += Number(record.milkLbs);
      dailyTotals.set(dateKey, existing);
    }

    // Find peak
    let peakMilkLbs = 0;
    let peakMilkDate: Date | null = null;
    for (const [, value] of dailyTotals) {
      if (value.total > peakMilkLbs) {
        peakMilkLbs = value.total;
        peakMilkDate = value.date;
      }
    }

    if (peakMilkDate) {
      const daysToReachPeak = calculateDaysInMilk(lactation.freshenDate, peakMilkDate);
      await prisma.lactationCycle.update({
        where: { id: lactationId },
        data: {
          peakMilkLbs: new Decimal(peakMilkLbs),
          peakMilkDate,
          daysToReachPeak,
        },
      });
    }
  }

  async updateLactationAverages(lactationId: number, tenantId: number): Promise<void> {
    // Get DHIA tests for averaging
    const tests = await prisma.dHIATestRecord.findMany({
      where: { lactationCycleId: lactationId, tenantId },
    });

    if (tests.length === 0) return;

    let totalButterfat = 0;
    let totalProtein = 0;
    let totalSCC = 0;
    let bfCount = 0;
    let protCount = 0;
    let sccCount = 0;

    for (const test of tests) {
      if (test.butterfatPct) {
        totalButterfat += Number(test.butterfatPct);
        bfCount++;
      }
      if (test.proteinPct) {
        totalProtein += Number(test.proteinPct);
        protCount++;
      }
      if (test.somaticCellCount) {
        totalSCC += test.somaticCellCount;
        sccCount++;
      }
    }

    await prisma.lactationCycle.update({
      where: { id: lactationId },
      data: {
        avgButterfatPct: bfCount > 0 ? new Decimal(totalButterfat / bfCount) : null,
        avgProteinPct: protCount > 0 ? new Decimal(totalProtein / protCount) : null,
        avgSCC: sccCount > 0 ? Math.round(totalSCC / sccCount) : null,
      },
    });
  }

  async updateDairyProductionHistory(animalId: number, tenantId: number): Promise<void> {
    // Get all completed lactations
    const lactations = await prisma.lactationCycle.findMany({
      where: { animalId, tenantId },
    });

    // Get best appraisal
    const bestAppraisal = await prisma.linearAppraisal.findFirst({
      where: { animalId, tenantId },
      orderBy: { finalScore: "desc" },
    });

    const completedLactations = lactations.filter((l) => l.dryOffDate);
    const totalLactations = lactations.length;
    const completedCount = completedLactations.length;

    // Calculate aggregates from completed lactations
    let best305Milk = 0;
    let best305Fat = 0;
    let best305Protein = 0;
    let total305Milk = 0;
    let totalPeak = 0;
    let totalDaysToReachPeak = 0;
    let peakCount = 0;

    for (const lactation of completedLactations) {
      const milk305 = Number(lactation.days305MilkLbs ?? 0);
      const fat305 = Number(lactation.days305FatLbs ?? 0);
      const protein305 = Number(lactation.days305ProteinLbs ?? 0);
      const peak = Number(lactation.peakMilkLbs ?? 0);

      if (milk305 > best305Milk) best305Milk = milk305;
      if (fat305 > best305Fat) best305Fat = fat305;
      if (protein305 > best305Protein) best305Protein = protein305;

      total305Milk += milk305;
      if (peak > 0) {
        totalPeak += peak;
        peakCount++;
      }
      if (lactation.daysToReachPeak) {
        totalDaysToReachPeak += lactation.daysToReachPeak;
      }
    }

    const data = {
      tenantId,
      animalId,
      totalLactations,
      completedLactations: completedCount,
      best305DayMilkLbs: best305Milk > 0 ? new Decimal(best305Milk) : null,
      best305DayFatLbs: best305Fat > 0 ? new Decimal(best305Fat) : null,
      best305DayProteinLbs: best305Protein > 0 ? new Decimal(best305Protein) : null,
      avg305DayMilkLbs: completedCount > 0 ? new Decimal(total305Milk / completedCount) : null,
      avgPeakMilkLbs: peakCount > 0 ? new Decimal(totalPeak / peakCount) : null,
      avgDaysToReachPeak: peakCount > 0 ? Math.round(totalDaysToReachPeak / peakCount) : null,
      bestAppraisalScore: bestAppraisal?.finalScore ?? null,
      bestAppraisalDate: bestAppraisal?.appraisalDate ?? null,
    };

    await prisma.dairyProductionHistory.upsert({
      where: { animalId },
      create: data,
      update: data,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════

  async getDairySummary(tenantId: number): Promise<DairySummary> {
    // Count animals currently in milk
    const animalsInMilk = await prisma.lactationCycle.findMany({
      where: {
        tenantId,
        status: { in: ["FRESH", "MILKING"] },
      },
      include: {
        animal: { select: { id: true, name: true } },
      },
    });

    // Get recent milking records (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRecords = await prisma.milkingRecord.findMany({
      where: {
        tenantId,
        milkedAt: { gte: sevenDaysAgo },
      },
    });

    // Calculate averages
    let totalMilk = 0;
    let totalButterfat = 0;
    let totalProtein = 0;
    let bfCount = 0;
    let protCount = 0;

    for (const record of recentRecords) {
      totalMilk += Number(record.milkLbs);
      if (record.butterfatPct) {
        totalButterfat += Number(record.butterfatPct);
        bfCount++;
      }
      if (record.proteinPct) {
        totalProtein += Number(record.proteinPct);
        protCount++;
      }
    }

    // Get top producers by 305-day milk
    const topProducers = await prisma.lactationCycle.findMany({
      where: {
        tenantId,
        days305MilkLbs: { not: null },
      },
      orderBy: { days305MilkLbs: "desc" },
      take: 5,
      include: {
        animal: { select: { id: true, name: true } },
      },
    });

    return {
      totalAnimalsInMilk: animalsInMilk.length,
      totalLactations: await prisma.lactationCycle.count({ where: { tenantId } }),
      avgDailyProduction:
        recentRecords.length > 0 ? totalMilk / (recentRecords.length / 7) : 0,
      avgButterfatPct: bfCount > 0 ? totalButterfat / bfCount : 0,
      avgProteinPct: protCount > 0 ? totalProtein / protCount : 0,
      topProducers: topProducers.map((l) => ({
        animalId: l.animalId,
        animalName: l.animal.name,
        days305MilkLbs: Number(l.days305MilkLbs),
      })),
    };
  }

  async getProductionTrend(
    tenantId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ProductionTrendPoint[]> {
    const records = await prisma.milkingRecord.findMany({
      where: {
        tenantId,
        milkedAt: { gte: startDate, lte: endDate },
      },
      orderBy: { milkedAt: "asc" },
    });

    // Group by date
    const dailyData = new Map<string, { total: number; count: number; animals: Set<number> }>();
    for (const record of records) {
      const dateKey = record.milkedAt.toISOString().split("T")[0];
      const existing = dailyData.get(dateKey) ?? { total: 0, count: 0, animals: new Set() };
      existing.total += Number(record.milkLbs);
      existing.count++;
      existing.animals.add(record.animalId);
      dailyData.set(dateKey, existing);
    }

    return Array.from(dailyData.entries()).map(([date, data]) => ({
      date,
      totalMilkLbs: data.total,
      avgMilkLbs: data.count > 0 ? data.total / data.count : 0,
      animalsCount: data.animals.size,
    }));
  }

  async getTopProducers(
    tenantId: number,
    limit: number = 10
  ): Promise<Array<{ animalId: number; animalName: string; days305MilkLbs: number }>> {
    const lactations = await prisma.lactationCycle.findMany({
      where: {
        tenantId,
        days305MilkLbs: { not: null },
      },
      orderBy: { days305MilkLbs: "desc" },
      take: limit,
      include: {
        animal: { select: { id: true, name: true } },
      },
    });

    return lactations.map((l) => ({
      animalId: l.animalId,
      animalName: l.animal.name,
      days305MilkLbs: Number(l.days305MilkLbs),
    }));
  }

  async getAnimalDairyHistory(
    tenantId: number,
    animalId: number
  ): Promise<DairyProductionHistory | null> {
    return prisma.dairyProductionHistory.findFirst({
      where: { tenantId, animalId },
    });
  }
}

export default new DairyProductionService();
