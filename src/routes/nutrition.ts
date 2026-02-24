// src/routes/nutrition.ts
// Nutrition & Food Tracking API endpoints
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import nutritionService from "../services/nutrition-service.js";
import type { FoodType, Species, LifeStage, FoodChangeReason, SuccessRating } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────────────────────

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseBool(v: unknown): boolean | undefined {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: { code: "missing_tenant", message: "Tenant ID is required" } });
    return null;
  }
  return tenantId;
}

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

const nutritionRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ══════════════════════════════════════════════════════════════════════════
  // FOOD PRODUCTS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/nutrition/products
  // List food products with optional filtering
  app.get("/nutrition/products", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      species?: string;
      foodType?: string;
      brand?: string;
      isActive?: string;
      q?: string;
      page?: string;
      limit?: string;
    };

    const result = await nutritionService.listFoodProducts(tenantId, {
      species: query.species?.toUpperCase() as Species | undefined,
      foodType: query.foodType?.toUpperCase() as FoodType | undefined,
      brand: query.brand,
      isActive: parseBool(query.isActive),
      q: query.q,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // GET /api/v1/nutrition/products/:id
  // Get a single food product
  app.get("/nutrition/products/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const productId = parseIntStrict((req.params as { id: string }).id);
    if (!productId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid product ID" } });
    }

    const product = await nutritionService.getFoodProduct(tenantId, productId);
    if (!product) {
      return reply.code(404).send({ error: { code: "not_found", message: "Food product not found" } });
    }

    return reply.send(product);
  });

  // POST /api/v1/nutrition/products
  // Create a new food product
  app.post("/nutrition/products", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
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
    };

    if (!body.name) {
      return reply.code(400).send({ error: { code: "name_required", message: "Product name is required" } });
    }
    if (!body.foodType) {
      return reply.code(400).send({ error: { code: "food_type_required", message: "Food type is required" } });
    }
    if (!body.species || body.species.length === 0) {
      return reply.code(400).send({ error: { code: "species_required", message: "At least one species is required" } });
    }

    const product = await nutritionService.createFoodProduct(tenantId, body);
    return reply.code(201).send(product);
  });

  // PATCH /api/v1/nutrition/products/:id
  // Update a food product
  app.patch("/nutrition/products/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const productId = parseIntStrict((req.params as { id: string }).id);
    if (!productId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid product ID" } });
    }

    try {
      const product = await nutritionService.updateFoodProduct(tenantId, productId, req.body as any);
      return reply.send(product);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // DELETE /api/v1/nutrition/products/:id
  // Archive (soft delete) a food product
  app.delete("/nutrition/products/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const productId = parseIntStrict((req.params as { id: string }).id);
    if (!productId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid product ID" } });
    }

    try {
      await nutritionService.archiveFoodProduct(tenantId, productId);
      return reply.code(204).send();
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FEEDING PLANS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/nutrition/plans
  // List feeding plans
  app.get("/nutrition/plans", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      animalId?: string;
      foodProductId?: string;
      isActive?: string;
      page?: string;
      limit?: string;
    };

    const result = await nutritionService.listFeedingPlans(tenantId, {
      animalId: query.animalId ? parseInt(query.animalId, 10) : undefined,
      foodProductId: query.foodProductId ? parseInt(query.foodProductId, 10) : undefined,
      isActive: parseBool(query.isActive),
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // POST /api/v1/nutrition/plans
  // Create a new feeding plan for an animal
  app.post("/nutrition/plans", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
      animalId: number;
      foodProductId: number;
      portionOz: number;
      feedingsPerDay?: number;
      feedingTimes?: string[];
      startDate: string;
      autoCreateExpense?: boolean;
      notes?: string;
    };

    if (!body.animalId) {
      return reply.code(400).send({ error: { code: "animal_id_required", message: "animalId is required" } });
    }
    if (!body.foodProductId) {
      return reply.code(400).send({ error: { code: "food_product_id_required", message: "Food product ID is required" } });
    }
    if (!body.portionOz || body.portionOz <= 0) {
      return reply.code(400).send({ error: { code: "portion_required", message: "Portion size is required" } });
    }
    if (!body.startDate) {
      return reply.code(400).send({ error: { code: "start_date_required", message: "Start date is required" } });
    }

    try {
      const plan = await nutritionService.createFeedingPlan(tenantId, body);
      return reply.code(201).send(plan);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // PATCH /api/v1/nutrition/plans/:id
  // Update a feeding plan
  app.patch("/nutrition/plans/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const planId = parseIntStrict((req.params as { id: string }).id);
    if (!planId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid plan ID" } });
    }

    try {
      const plan = await nutritionService.updateFeedingPlan(tenantId, planId, req.body as any);
      return reply.send(plan);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // POST /api/v1/nutrition/plans/:id/end
  // End a feeding plan
  app.post("/nutrition/plans/:id/end", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const planId = parseIntStrict((req.params as { id: string }).id);
    if (!planId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid plan ID" } });
    }

    const body = req.body as { endDate?: string };

    try {
      const plan = await nutritionService.endFeedingPlan(tenantId, planId, body.endDate);
      return reply.send(plan);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // POST /api/v1/nutrition/plans/:id/change-food
  // Change food for an animal (end current plan, start new one)
  app.post("/nutrition/plans/:id/change-food", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const currentPlanId = parseIntStrict((req.params as { id: string }).id);

    const body = req.body as {
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
    };

    if (!body.newFoodProductId) {
      return reply.code(400).send({ error: { code: "food_product_required", message: "New food product ID is required" } });
    }
    if (!body.newPortionOz || body.newPortionOz <= 0) {
      return reply.code(400).send({ error: { code: "portion_required", message: "New portion size is required" } });
    }
    if (!body.startDate) {
      return reply.code(400).send({ error: { code: "start_date_required", message: "Start date is required" } });
    }
    if (!body.changeReason) {
      return reply.code(400).send({ error: { code: "change_reason_required", message: "Change reason is required" } });
    }

    try {
      const result = await nutritionService.changeFoodForAnimal(tenantId, {
        ...body,
        currentPlanId: currentPlanId ?? undefined,
      });
      return reply.code(201).send(result);
    } catch (e: any) {
      if (e.statusCode === 400 || e.statusCode === 404) {
        return reply.code(e.statusCode).send({ error: { code: "error", message: e.message } });
      }
      throw e;
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FEEDING RECORDS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/nutrition/records
  // List feeding records
  app.get("/nutrition/records", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      animalId?: string;
      feedingPlanId?: string;
      dateFrom?: string;
      dateTo?: string;
      skipped?: string;
      page?: string;
      limit?: string;
    };

    const result = await nutritionService.listFeedingRecords(tenantId, {
      animalId: query.animalId ? parseInt(query.animalId, 10) : undefined,
      feedingPlanId: query.feedingPlanId ? parseInt(query.feedingPlanId, 10) : undefined,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      skipped: parseBool(query.skipped),
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // POST /api/v1/nutrition/records
  // Log a feeding for an animal
  app.post("/nutrition/records", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
      animalId: number;
      feedingPlanId?: number;
      foodProductId?: number;
      fedAt: string;
      portionOz?: number;
      skipped?: boolean;
      skipReason?: string;
      appetiteScore?: number;
      notes?: string;
    };

    if (!body.animalId) {
      return reply.code(400).send({ error: { code: "animal_id_required", message: "animalId is required" } });
    }
    if (!body.fedAt) {
      return reply.code(400).send({ error: { code: "fed_at_required", message: "Feeding time is required" } });
    }

    try {
      const record = await nutritionService.logFeeding(tenantId, body);
      return reply.code(201).send(record);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // PATCH /api/v1/nutrition/records/:id
  // Update a feeding record
  app.patch("/nutrition/records/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const recordId = parseIntStrict((req.params as { id: string }).id);
    if (!recordId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid record ID" } });
    }

    try {
      const record = await nutritionService.updateFeedingRecord(tenantId, recordId, req.body as any);
      return reply.send(record);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // DELETE /api/v1/nutrition/records/:id
  // Delete a feeding record
  app.delete("/nutrition/records/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const recordId = parseIntStrict((req.params as { id: string }).id);
    if (!recordId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid record ID" } });
    }

    try {
      await nutritionService.deleteFeedingRecord(tenantId, recordId);
      return reply.code(204).send();
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FOOD CHANGES
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/nutrition/changes
  // List food changes
  app.get("/nutrition/changes", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      animalId?: string;
      changeReason?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: string;
      limit?: string;
    };

    const result = await nutritionService.listFoodChanges(tenantId, {
      animalId: query.animalId ? parseInt(query.animalId, 10) : undefined,
      changeReason: query.changeReason?.toUpperCase() as FoodChangeReason | undefined,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // PATCH /api/v1/nutrition/changes/:id
  // Update a food change (add outcomes after transition)
  app.patch("/nutrition/changes/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const changeId = parseIntStrict((req.params as { id: string }).id);
    if (!changeId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid change ID" } });
    }

    const body = req.body as {
      reactions?: string;
      digestiveNotes?: string;
      overallSuccess?: SuccessRating;
    };

    try {
      const change = await nutritionService.updateFoodChange(tenantId, changeId, body);
      return reply.send(change);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ANIMAL-SPECIFIC ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/animals/:animalId/nutrition/plan
  // Get active feeding plan for an animal
  app.get("/animals/:animalId/nutrition/plan", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid animal ID" } });
    }

    const plan = await nutritionService.getActivePlanForAnimal(tenantId, animalId);
    return reply.send(plan);
  });

  // GET /api/v1/animals/:animalId/nutrition/history
  // Get food change history for an animal
  app.get("/animals/:animalId/nutrition/history", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid animal ID" } });
    }

    const history = await nutritionService.getFoodChangeHistory(tenantId, animalId);
    return reply.send({ changes: history });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/nutrition/analytics/summary
  // Get nutrition summary for current month
  app.get("/nutrition/analytics/summary", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { startDate?: string; endDate?: string };

    let start: Date;
    let end: Date;

    if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      end = new Date(query.endDate);
    } else {
      // Default to current month
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const summary = await nutritionService.getNutritionSummary(tenantId, { start, end });
    return reply.send(summary);
  });

  // GET /api/v1/nutrition/analytics/cost-by-animal
  // Get cost breakdown by animal
  app.get("/nutrition/analytics/cost-by-animal", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { startDate?: string; endDate?: string; limit?: string };

    let start: Date;
    let end: Date;

    if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      end = new Date(query.endDate);
    } else {
      // Default to current month
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const limit = query.limit ? parseInt(query.limit, 10) : 10;
    const result = await nutritionService.getCostByAnimal(tenantId, { start, end }, limit);
    return reply.send({ animals: result });
  });

  // GET /api/v1/nutrition/analytics/cost-trend
  // Get daily cost trend
  app.get("/nutrition/analytics/cost-trend", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { startDate?: string; endDate?: string };

    let start: Date;
    let end: Date;

    if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      end = new Date(query.endDate);
    } else {
      // Default to last 30 days
      const now = new Date();
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 30);
    }

    const trend = await nutritionService.getDailyCostTrend(tenantId, { start, end });
    return reply.send({ trend });
  });
};

export default nutritionRoutes;
