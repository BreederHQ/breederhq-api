// src/services/nutrition-service.ts
/**
 * Nutrition & Food Tracking Service
 *
 * Handles all nutrition-related operations:
 * - Food product management (CRUD, filtering)
 * - Feeding plan creation and management
 * - Feeding record logging
 * - Food change tracking with transition protocols
 * - Cost analytics and summaries
 */

import prisma from "../prisma.js";
import type {
  FoodProduct,
  FeedingPlan,
  FeedingRecord,
  FoodChange,
  FoodType,
  Species,
  LifeStage,
  FoodChangeReason,
  SuccessRating,
} from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface FoodProductFilters {
  species?: Species;
  foodType?: FoodType;
  brand?: string;
  isActive?: boolean;
  q?: string; // Search query
  page?: number;
  limit?: number;
}

export interface FeedingPlanFilters {
  animalId?: number;
  breedingPlanId?: number;
  foodProductId?: number;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface FeedingRecordFilters {
  animalId?: number;
  breedingPlanId?: number;
  feedingPlanId?: number;
  dateFrom?: string;
  dateTo?: string;
  skipped?: boolean;
  page?: number;
  limit?: number;
}

export interface FoodChangeFilters {
  animalId?: number;
  breedingPlanId?: number;
  changeReason?: FoodChangeReason;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface CreateFoodProductInput {
  name: string;
  brand?: string;
  sku?: string;
  foodType: FoodType;
  species: Species[];
  lifeStage?: LifeStage;
  photoUrl?: string;
  bagSizeOz?: number;
  costCents?: number;
  servingSizeOz?: number;
  proteinPct?: number;
  fatPct?: number;
  fiberPct?: number;
  caloriesPerCup?: number;
  notes?: string;
}

export interface UpdateFoodProductInput {
  name?: string;
  brand?: string;
  sku?: string;
  foodType?: FoodType;
  species?: Species[];
  lifeStage?: LifeStage;
  photoUrl?: string;
  bagSizeOz?: number;
  costCents?: number;
  servingSizeOz?: number;
  proteinPct?: number;
  fatPct?: number;
  fiberPct?: number;
  caloriesPerCup?: number;
  isActive?: boolean;
  notes?: string;
}

export interface CreateFeedingPlanInput {
  animalId?: number;
  breedingPlanId?: number;
  foodProductId: number;
  portionOz: number;
  feedingsPerDay?: number;
  feedingTimes?: string[];
  startDate: string;
  autoCreateExpense?: boolean;
  notes?: string;
}

export interface LogFeedingInput {
  animalId?: number;
  breedingPlanId?: number;
  feedingPlanId?: number;
  foodProductId?: number;
  fedAt: string;
  portionOz?: number;
  skipped?: boolean;
  skipReason?: string;
  appetiteScore?: number;
  notes?: string;
}

export interface ChangeFoodInput {
  currentPlanId?: number;
  animalId?: number;
  breedingPlanId?: number;
  newFoodProductId: number;
  newPortionOz: number;
  newFeedingsPerDay?: number;
  newFeedingTimes?: string[];
  startDate: string;
  changeReason: FoodChangeReason;
  reasonDetails?: string;
  transitionDays?: number;
  transitionNotes?: string;
  autoCreateExpense?: boolean;
}

export interface UpdateFoodChangeInput {
  reactions?: string;
  digestiveNotes?: string;
  overallSuccess?: SuccessRating;
}

export interface NutritionSummary {
  period: {
    start: string;
    end: string;
  };
  costs: {
    totalCents: number;
    previousPeriodCents: number;
    changePercent: number;
    averagePerFeedingCents: number;
  };
  adherence: {
    loggedFeedings: number;
    skippedFeedings: number;
    plannedFeedings: number;
    adherencePercent: number;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Cost Calculation Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate cost per ounce from total cost and bag size.
 * Returns null if either value is missing or invalid.
 */
export function calculateCostPerOz(
  costCents: number | null | undefined,
  bagSizeOz: number | null | undefined
): number | null {
  if (!costCents || !bagSizeOz || bagSizeOz === 0) return null;
  return Math.round(costCents / bagSizeOz);
}

/**
 * Calculate feeding cost from portion size and cost per ounce.
 * Returns null if cost per ounce is not available.
 */
export function calculateFeedingCost(
  portionOz: number,
  costPerOzCents: number | null | undefined
): number | null {
  if (!costPerOzCents) return null;
  return Math.round(portionOz * costPerOzCents);
}

// ────────────────────────────────────────────────────────────────────────────
// Food Products
// ────────────────────────────────────────────────────────────────────────────

/**
 * List food products for a tenant with optional filtering.
 */
export async function listFoodProducts(
  tenantId: number,
  filters: FoodProductFilters = {}
): Promise<PaginatedResult<FoodProduct>> {
  const { species, foodType, brand, isActive, q, page = 1, limit = 50 } = filters;

  const where: any = {
    tenantId,
    isArchived: false,
  };

  if (species) {
    where.species = { has: species };
  }
  if (foodType) {
    where.foodType = foodType;
  }
  if (typeof isActive === "boolean") {
    where.isActive = isActive;
  }
  if (brand) {
    where.brand = { contains: brand, mode: "insensitive" };
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.foodProduct.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ name: "asc" }],
    }),
    prisma.foodProduct.count({ where }),
  ]);

  return { items, total, page, limit };
}

/**
 * Get a single food product by ID.
 */
export async function getFoodProduct(
  tenantId: number,
  id: number
): Promise<FoodProduct | null> {
  return prisma.foodProduct.findFirst({
    where: { id, tenantId, isArchived: false },
  });
}

/**
 * Create a new food product.
 */
export async function createFoodProduct(
  tenantId: number,
  input: CreateFoodProductInput
): Promise<FoodProduct> {
  const costPerOzCents = calculateCostPerOz(input.costCents, input.bagSizeOz);

  return prisma.foodProduct.create({
    data: {
      tenantId,
      name: input.name,
      brand: input.brand,
      sku: input.sku,
      foodType: input.foodType,
      species: input.species,
      lifeStage: input.lifeStage,
      photoUrl: input.photoUrl,
      bagSizeOz: input.bagSizeOz,
      costCents: input.costCents,
      costPerOzCents,
      servingSizeOz: input.servingSizeOz,
      proteinPct: input.proteinPct,
      fatPct: input.fatPct,
      fiberPct: input.fiberPct,
      caloriesPerCup: input.caloriesPerCup,
      notes: input.notes,
    },
  });
}

/**
 * Update an existing food product.
 */
export async function updateFoodProduct(
  tenantId: number,
  id: number,
  input: UpdateFoodProductInput
): Promise<FoodProduct> {
  // Verify product exists and belongs to tenant
  const existing = await prisma.foodProduct.findFirst({
    where: { id, tenantId },
  });
  if (!existing) {
    throw Object.assign(new Error("Food product not found"), { statusCode: 404 });
  }

  // Recalculate cost per oz if either cost or bag size changed
  const costCents = input.costCents ?? existing.costCents;
  const bagSizeOz = input.bagSizeOz ?? existing.bagSizeOz;
  const costPerOzCents = calculateCostPerOz(costCents, bagSizeOz);

  return prisma.foodProduct.update({
    where: { id },
    data: {
      ...input,
      costPerOzCents,
    },
  });
}

/**
 * Archive (soft delete) a food product.
 */
export async function archiveFoodProduct(
  tenantId: number,
  id: number
): Promise<FoodProduct> {
  const existing = await prisma.foodProduct.findFirst({
    where: { id, tenantId },
  });
  if (!existing) {
    throw Object.assign(new Error("Food product not found"), { statusCode: 404 });
  }

  return prisma.foodProduct.update({
    where: { id },
    data: { isArchived: true, isActive: false },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Feeding Plans
// ────────────────────────────────────────────────────────────────────────────

/**
 * List feeding plans for a tenant with optional filtering.
 */
export async function listFeedingPlans(
  tenantId: number,
  filters: FeedingPlanFilters = {}
): Promise<PaginatedResult<FeedingPlan & { foodProduct: FoodProduct }>> {
  const { animalId, breedingPlanId, foodProductId, isActive, page = 1, limit = 50 } = filters;

  const where: any = { tenantId };
  if (animalId) where.animalId = animalId;
  if (breedingPlanId) where.breedingPlanId = breedingPlanId;
  if (foodProductId) where.foodProductId = foodProductId;
  if (typeof isActive === "boolean") where.isActive = isActive;

  const [items, total] = await Promise.all([
    prisma.feedingPlan.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ startDate: "desc" }],
      include: { foodProduct: true },
    }),
    prisma.feedingPlan.count({ where }),
  ]);

  return { items, total, page, limit };
}

/**
 * Get the active feeding plan for an animal.
 */
export async function getActivePlanForAnimal(
  tenantId: number,
  animalId: number
): Promise<(FeedingPlan & { foodProduct: FoodProduct }) | null> {
  return prisma.feedingPlan.findFirst({
    where: {
      tenantId,
      animalId,
      isActive: true,
      endDate: null,
    },
    include: { foodProduct: true },
  });
}

/**
 * Get the active feeding plan for a breeding plan.
 */
export async function getActivePlanForBreedingPlan(
  tenantId: number,
  breedingPlanId: number
): Promise<(FeedingPlan & { foodProduct: FoodProduct }) | null> {
  return prisma.feedingPlan.findFirst({
    where: {
      tenantId,
      breedingPlanId,
      isActive: true,
      endDate: null,
    },
    include: { foodProduct: true },
  });
}

/**
 * Create a new feeding plan for an animal or breeding plan.
 * Automatically ends any existing active plan.
 */
export async function createFeedingPlan(
  tenantId: number,
  input: CreateFeedingPlanInput
): Promise<FeedingPlan & { foodProduct: FoodProduct }> {
  // Verify target (animal OR breeding plan) belongs to tenant
  if (input.animalId) {
    const animal = await prisma.animal.findFirst({
      where: { id: input.animalId, tenantId },
    });
    if (!animal) {
      throw Object.assign(new Error("Animal not found"), { statusCode: 404 });
    }
  } else if (input.breedingPlanId) {
    const plan = await prisma.breedingPlan.findFirst({
      where: { id: input.breedingPlanId, tenantId },
    });
    if (!plan) {
      throw Object.assign(new Error("Breeding plan not found"), { statusCode: 404 });
    }
  } else {
    throw Object.assign(new Error("Either animalId or breedingPlanId is required"), { statusCode: 400 });
  }

  // Verify food product exists and belongs to tenant
  const product = await prisma.foodProduct.findFirst({
    where: { id: input.foodProductId, tenantId, isArchived: false },
  });
  if (!product) {
    throw Object.assign(new Error("Food product not found"), { statusCode: 404 });
  }

  // End any existing active plans for this target
  const endWhere: any = { tenantId, isActive: true };
  if (input.animalId) {
    endWhere.animalId = input.animalId;
  } else {
    endWhere.breedingPlanId = input.breedingPlanId;
  }
  await prisma.feedingPlan.updateMany({
    where: endWhere,
    data: { isActive: false, endDate: new Date(input.startDate) },
  });

  // Create the new plan
  return prisma.feedingPlan.create({
    data: {
      tenantId,
      animalId: input.animalId ?? null,
      breedingPlanId: input.breedingPlanId ?? null,
      foodProductId: input.foodProductId,
      portionOz: input.portionOz,
      feedingsPerDay: input.feedingsPerDay ?? 2,
      feedingTimes: input.feedingTimes ?? [],
      startDate: new Date(input.startDate),
      autoCreateExpense: input.autoCreateExpense ?? false,
      isActive: true,
      notes: input.notes,
    },
    include: { foodProduct: true },
  });
}

/**
 * Update a feeding plan.
 */
export async function updateFeedingPlan(
  tenantId: number,
  id: number,
  input: Partial<CreateFeedingPlanInput>
): Promise<FeedingPlan & { foodProduct: FoodProduct }> {
  const existing = await prisma.feedingPlan.findFirst({
    where: { id, tenantId },
  });
  if (!existing) {
    throw Object.assign(new Error("Feeding plan not found"), { statusCode: 404 });
  }

  return prisma.feedingPlan.update({
    where: { id },
    data: {
      portionOz: input.portionOz,
      feedingsPerDay: input.feedingsPerDay,
      feedingTimes: input.feedingTimes,
      autoCreateExpense: input.autoCreateExpense,
      notes: input.notes,
    },
    include: { foodProduct: true },
  });
}

/**
 * End a feeding plan.
 */
export async function endFeedingPlan(
  tenantId: number,
  id: number,
  endDate?: string
): Promise<FeedingPlan> {
  const existing = await prisma.feedingPlan.findFirst({
    where: { id, tenantId },
  });
  if (!existing) {
    throw Object.assign(new Error("Feeding plan not found"), { statusCode: 404 });
  }

  return prisma.feedingPlan.update({
    where: { id },
    data: {
      isActive: false,
      endDate: endDate ? new Date(endDate) : new Date(),
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Feeding Records
// ────────────────────────────────────────────────────────────────────────────

/**
 * List feeding records with optional filtering.
 */
export async function listFeedingRecords(
  tenantId: number,
  filters: FeedingRecordFilters = {}
): Promise<PaginatedResult<FeedingRecord & { foodProduct: FoodProduct | null }>> {
  const { animalId, breedingPlanId, feedingPlanId, dateFrom, dateTo, skipped, page = 1, limit = 50 } = filters;

  const where: any = { tenantId };
  if (animalId) where.animalId = animalId;
  if (breedingPlanId) where.breedingPlanId = breedingPlanId;
  if (feedingPlanId) where.feedingPlanId = feedingPlanId;
  if (typeof skipped === "boolean") where.skipped = skipped;

  if (dateFrom || dateTo) {
    where.fedAt = {};
    if (dateFrom) where.fedAt.gte = new Date(dateFrom);
    if (dateTo) where.fedAt.lte = new Date(dateTo);
  }

  const [items, total] = await Promise.all([
    prisma.feedingRecord.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ fedAt: "desc" }],
      include: { foodProduct: true },
    }),
    prisma.feedingRecord.count({ where }),
  ]);

  return { items, total, page, limit };
}

/**
 * Log a feeding event.
 */
export async function logFeeding(
  tenantId: number,
  input: LogFeedingInput
): Promise<FeedingRecord> {
  // Verify target (animal OR breeding plan) belongs to tenant
  if (input.animalId) {
    const animal = await prisma.animal.findFirst({
      where: { id: input.animalId, tenantId },
    });
    if (!animal) {
      throw Object.assign(new Error("Animal not found"), { statusCode: 404 });
    }
  } else if (input.breedingPlanId) {
    const plan = await prisma.breedingPlan.findFirst({
      where: { id: input.breedingPlanId, tenantId },
    });
    if (!plan) {
      throw Object.assign(new Error("Breeding plan not found"), { statusCode: 404 });
    }
  } else {
    throw Object.assign(new Error("Either animalId or breedingPlanId is required"), { statusCode: 400 });
  }

  // Get plan info for food product reference
  let foodProductId: number | null = input.foodProductId ?? null;

  if (input.feedingPlanId) {
    const plan = await prisma.feedingPlan.findFirst({
      where: { id: input.feedingPlanId, tenantId },
    });
    if (plan) {
      foodProductId = plan.foodProductId;
    }
  }

  // Note: costCents is no longer calculated here. Costs are derived from
  // actual Expense records linked to FoodProducts, not from feeding logs.
  return prisma.feedingRecord.create({
    data: {
      tenantId,
      animalId: input.animalId ?? null,
      breedingPlanId: input.breedingPlanId ?? null,
      feedingPlanId: input.feedingPlanId,
      foodProductId,
      fedAt: new Date(input.fedAt),
      portionOz: input.portionOz,
      costCents: null, // Deprecated - costs come from expenses now
      skipped: input.skipped ?? false,
      skipReason: input.skipReason,
      appetiteScore: input.appetiteScore,
      notes: input.notes,
    },
  });
}

/**
 * Update a feeding record.
 */
export async function updateFeedingRecord(
  tenantId: number,
  id: number,
  input: Partial<LogFeedingInput>
): Promise<FeedingRecord> {
  const existing = await prisma.feedingRecord.findFirst({
    where: { id, tenantId },
  });
  if (!existing) {
    throw Object.assign(new Error("Feeding record not found"), { statusCode: 404 });
  }

  return prisma.feedingRecord.update({
    where: { id },
    data: {
      fedAt: input.fedAt ? new Date(input.fedAt) : undefined,
      portionOz: input.portionOz,
      skipped: input.skipped,
      skipReason: input.skipReason,
      appetiteScore: input.appetiteScore,
      notes: input.notes,
    },
  });
}

/**
 * Delete a feeding record.
 */
export async function deleteFeedingRecord(
  tenantId: number,
  id: number
): Promise<void> {
  const existing = await prisma.feedingRecord.findFirst({
    where: { id, tenantId },
  });
  if (!existing) {
    throw Object.assign(new Error("Feeding record not found"), { statusCode: 404 });
  }

  await prisma.feedingRecord.delete({ where: { id } });
}

// ────────────────────────────────────────────────────────────────────────────
// Food Changes
// ────────────────────────────────────────────────────────────────────────────

/**
 * List food changes with optional filtering.
 */
export async function listFoodChanges(
  tenantId: number,
  filters: FoodChangeFilters = {}
): Promise<PaginatedResult<FoodChange>> {
  const { animalId, breedingPlanId, changeReason, dateFrom, dateTo, page = 1, limit = 50 } = filters;

  const where: any = { tenantId };
  if (animalId) where.animalId = animalId;
  if (breedingPlanId) where.breedingPlanId = breedingPlanId;
  if (changeReason) where.changeReason = changeReason;

  if (dateFrom || dateTo) {
    where.changeDate = {};
    if (dateFrom) where.changeDate.gte = new Date(dateFrom);
    if (dateTo) where.changeDate.lte = new Date(dateTo);
  }

  const [items, total] = await Promise.all([
    prisma.foodChange.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ changeDate: "desc" }],
      include: {
        previousPlan: { include: { foodProduct: true } },
        newPlan: { include: { foodProduct: true } },
      },
    }),
    prisma.foodChange.count({ where }),
  ]);

  return { items, total, page, limit };
}

/**
 * Get food change history for an animal.
 */
export async function getFoodChangeHistory(
  tenantId: number,
  animalId: number
): Promise<FoodChange[]> {
  return prisma.foodChange.findMany({
    where: { tenantId, animalId },
    orderBy: [{ changeDate: "desc" }],
    include: {
      previousPlan: { include: { foodProduct: true } },
      newPlan: { include: { foodProduct: true } },
    },
  });
}

/**
 * Get food change history for a breeding plan.
 */
export async function getFoodChangeHistoryForBreedingPlan(
  tenantId: number,
  breedingPlanId: number
): Promise<FoodChange[]> {
  return prisma.foodChange.findMany({
    where: { tenantId, breedingPlanId },
    orderBy: [{ changeDate: "desc" }],
    include: {
      previousPlan: { include: { foodProduct: true } },
      newPlan: { include: { foodProduct: true } },
    },
  });
}

/**
 * Change food for an animal or breeding plan - creates new plan and records the change.
 */
export async function changeFoodForAnimal(
  tenantId: number,
  input: ChangeFoodInput
): Promise<{ plan: FeedingPlan & { foodProduct: FoodProduct }; change: FoodChange }> {
  // Get current plan if provided
  let currentPlan: FeedingPlan | null = null;
  let animalId = input.animalId ?? undefined;
  let breedingPlanId = input.breedingPlanId ?? undefined;

  if (input.currentPlanId) {
    currentPlan = await prisma.feedingPlan.findFirst({
      where: { id: input.currentPlanId, tenantId },
    });
    if (currentPlan) {
      animalId = currentPlan.animalId ?? undefined;
      breedingPlanId = currentPlan.breedingPlanId ?? undefined;
    }
  }

  // Require either animalId or breedingPlanId
  if (!animalId && !breedingPlanId) {
    throw Object.assign(new Error("Either animalId or breedingPlanId is required"), { statusCode: 400 });
  }

  // End current plan if exists
  if (currentPlan) {
    await prisma.feedingPlan.update({
      where: { id: currentPlan.id },
      data: { isActive: false, endDate: new Date(input.startDate) },
    });
  }

  // Create new plan
  const newPlan = await prisma.feedingPlan.create({
    data: {
      tenantId,
      animalId: animalId ?? null,
      breedingPlanId: breedingPlanId ?? null,
      foodProductId: input.newFoodProductId,
      portionOz: input.newPortionOz,
      feedingsPerDay: input.newFeedingsPerDay ?? 2,
      feedingTimes: input.newFeedingTimes ?? [],
      startDate: new Date(input.startDate),
      autoCreateExpense: input.autoCreateExpense ?? false,
      isActive: true,
    },
    include: { foodProduct: true },
  });

  // Create food change record
  const change = await prisma.foodChange.create({
    data: {
      tenantId,
      animalId: animalId ?? null,
      breedingPlanId: breedingPlanId ?? null,
      previousPlanId: currentPlan?.id ?? null,
      newPlanId: newPlan.id,
      changeDate: new Date(input.startDate),
      changeReason: input.changeReason,
      reasonDetails: input.reasonDetails,
      transitionDays: input.transitionDays,
      transitionNotes: input.transitionNotes,
    },
  });

  return { plan: newPlan, change };
}

/**
 * Update a food change record (typically to add outcomes after transition).
 */
export async function updateFoodChange(
  tenantId: number,
  id: number,
  input: UpdateFoodChangeInput
): Promise<FoodChange> {
  const existing = await prisma.foodChange.findFirst({
    where: { id, tenantId },
  });
  if (!existing) {
    throw Object.assign(new Error("Food change record not found"), { statusCode: 404 });
  }

  return prisma.foodChange.update({
    where: { id },
    data: {
      reactions: input.reactions,
      digestiveNotes: input.digestiveNotes,
      overallSuccess: input.overallSuccess,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Analytics
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get nutrition summary for a tenant within a period.
 */
export async function getNutritionSummary(
  tenantId: number,
  period: { start: Date; end: Date }
): Promise<NutritionSummary> {
  // Get records for current period
  const records = await prisma.feedingRecord.findMany({
    where: {
      tenantId,
      fedAt: { gte: period.start, lte: period.end },
    },
  });

  const totalCostCents = records.reduce((sum, r) => sum + (r.costCents || 0), 0);
  const loggedFeedings = records.filter((r) => !r.skipped).length;
  const skippedFeedings = records.filter((r) => r.skipped).length;
  const plannedFeedings = loggedFeedings + skippedFeedings;

  // Calculate previous period for comparison
  const periodDuration = period.end.getTime() - period.start.getTime();
  const prevStart = new Date(period.start.getTime() - periodDuration);
  const prevEnd = new Date(period.start.getTime() - 1);

  const prevRecords = await prisma.feedingRecord.findMany({
    where: {
      tenantId,
      fedAt: { gte: prevStart, lte: prevEnd },
    },
  });
  const prevTotalCents = prevRecords.reduce((sum, r) => sum + (r.costCents || 0), 0);

  const changePercent =
    prevTotalCents > 0
      ? Math.round(((totalCostCents - prevTotalCents) / prevTotalCents) * 100)
      : 0;

  return {
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    costs: {
      totalCents: totalCostCents,
      previousPeriodCents: prevTotalCents,
      changePercent,
      averagePerFeedingCents:
        loggedFeedings > 0 ? Math.round(totalCostCents / loggedFeedings) : 0,
    },
    adherence: {
      loggedFeedings,
      skippedFeedings,
      plannedFeedings,
      adherencePercent:
        plannedFeedings > 0 ? Math.round((loggedFeedings / plannedFeedings) * 100) : 0,
    },
  };
}

/**
 * Get cost breakdown by animal for a period.
 * Note: Only includes records linked to animals, not breeding plans.
 */
export async function getCostByAnimal(
  tenantId: number,
  period: { start: Date; end: Date },
  limit: number = 10
): Promise<Array<{ animalId: number; animalName: string; totalCostCents: number }>> {
  const records = await prisma.feedingRecord.findMany({
    where: {
      tenantId,
      animalId: { not: null }, // Only animal records, not litters
      fedAt: { gte: period.start, lte: period.end },
      costCents: { not: null },
    },
    include: {
      animal: { select: { id: true, name: true } },
    },
  });

  // Aggregate by animal
  const costByAnimal = new Map<number, { name: string; total: number }>();
  for (const record of records) {
    // Skip records without animalId (shouldn't happen with filter, but TypeScript safety)
    if (!record.animalId || !record.animal) continue;

    const existing = costByAnimal.get(record.animalId);
    if (existing) {
      existing.total += record.costCents || 0;
    } else {
      costByAnimal.set(record.animalId, {
        name: record.animal.name ?? `Animal #${record.animalId}`,
        total: record.costCents || 0,
      });
    }
  }

  // Sort and limit
  return Array.from(costByAnimal.entries())
    .map(([animalId, data]) => ({
      animalId,
      animalName: data.name,
      totalCostCents: data.total,
    }))
    .sort((a, b) => b.totalCostCents - a.totalCostCents)
    .slice(0, limit);
}

/**
 * Get daily cost trend for a period.
 */
export async function getDailyCostTrend(
  tenantId: number,
  period: { start: Date; end: Date }
): Promise<Array<{ date: string; totalCents: number; feedingCount: number }>> {
  const records = await prisma.feedingRecord.findMany({
    where: {
      tenantId,
      fedAt: { gte: period.start, lte: period.end },
      skipped: false,
    },
    orderBy: { fedAt: "asc" },
  });

  // Aggregate by date
  const costByDate = new Map<string, { totalCents: number; count: number }>();
  for (const record of records) {
    const dateKey = record.fedAt.toISOString().split("T")[0];
    const existing = costByDate.get(dateKey);
    if (existing) {
      existing.totalCents += record.costCents || 0;
      existing.count += 1;
    } else {
      costByDate.set(dateKey, {
        totalCents: record.costCents || 0,
        count: 1,
      });
    }
  }

  return Array.from(costByDate.entries())
    .map(([date, data]) => ({
      date,
      totalCents: data.totalCents,
      feedingCount: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ────────────────────────────────────────────────────────────────────────────
// Export
// ────────────────────────────────────────────────────────────────────────────

export default {
  // Food Products
  listFoodProducts,
  getFoodProduct,
  createFoodProduct,
  updateFoodProduct,
  archiveFoodProduct,

  // Feeding Plans
  listFeedingPlans,
  getActivePlanForAnimal,
  getActivePlanForBreedingPlan,
  createFeedingPlan,
  updateFeedingPlan,
  endFeedingPlan,

  // Feeding Records
  listFeedingRecords,
  logFeeding,
  updateFeedingRecord,
  deleteFeedingRecord,

  // Food Changes
  listFoodChanges,
  getFoodChangeHistory,
  getFoodChangeHistoryForBreedingPlan,
  changeFoodForAnimal,
  updateFoodChange,

  // Analytics
  getNutritionSummary,
  getCostByAnimal,
  getDailyCostTrend,

  // Helpers
  calculateCostPerOz,
  calculateFeedingCost,
};
