// src/routes/dairy.ts
// Dairy Production Tracking API endpoints
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import dairyService from "../services/dairy-production-service.js";
import type { LactationStatus, MilkingFrequency, DHIATestType } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────────────────────

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
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

const dairyRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ══════════════════════════════════════════════════════════════════════════
  // LACTATION CYCLES
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/dairy/lactations
  app.get("/dairy/lactations", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      animalId?: string;
      status?: string;
      page?: string;
      limit?: string;
    };

    const result = await dairyService.listLactations(tenantId, {
      animalId: query.animalId ? parseInt(query.animalId, 10) : undefined,
      status: query.status?.toUpperCase() as LactationStatus | undefined,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // GET /api/v1/dairy/lactations/:id
  app.get("/dairy/lactations/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid lactation ID" } });
    }

    const lactation = await dairyService.getLactation(tenantId, id);
    if (!lactation) {
      return reply.code(404).send({ error: { code: "not_found", message: "Lactation not found" } });
    }

    return reply.send(lactation);
  });

  // POST /api/v1/dairy/lactations
  app.post("/dairy/lactations", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
      animalId: number;
      freshenDate: string;
      lactationNumber: number;
      milkingFrequency?: MilkingFrequency;
      notes?: string;
    };

    if (!body.animalId) {
      return reply.code(400).send({ error: { code: "animal_id_required", message: "Animal ID is required" } });
    }
    if (!body.freshenDate) {
      return reply.code(400).send({ error: { code: "freshen_date_required", message: "Freshen date is required" } });
    }
    if (!body.lactationNumber || body.lactationNumber < 1) {
      return reply.code(400).send({ error: { code: "lactation_number_required", message: "Lactation number is required" } });
    }

    try {
      const lactation = await dairyService.startLactation(tenantId, body);
      return reply.code(201).send(lactation);
    } catch (e: any) {
      if (e.statusCode === 400) {
        return reply.code(400).send({ error: { code: "error", message: e.message } });
      }
      throw e;
    }
  });

  // PATCH /api/v1/dairy/lactations/:id
  app.patch("/dairy/lactations/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid lactation ID" } });
    }

    try {
      const lactation = await dairyService.updateLactation(tenantId, id, req.body as any);
      return reply.send(lactation);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // POST /api/v1/dairy/lactations/:id/dry-off
  app.post("/dairy/lactations/:id/dry-off", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid lactation ID" } });
    }

    const body = req.body as { dryOffDate: string };
    if (!body.dryOffDate) {
      return reply.code(400).send({ error: { code: "dry_off_date_required", message: "Dry off date is required" } });
    }

    try {
      const lactation = await dairyService.dryOff(tenantId, id, body);
      return reply.send(lactation);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // GET /api/v1/animals/:animalId/dairy/current-lactation
  app.get("/animals/:animalId/dairy/current-lactation", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid animal ID" } });
    }

    const lactation = await dairyService.getCurrentLactation(tenantId, animalId);
    return reply.send(lactation);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // MILKING RECORDS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/dairy/records
  app.get("/dairy/records", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      animalId?: string;
      lactationCycleId?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    };

    const result = await dairyService.listMilkingRecords(tenantId, {
      animalId: query.animalId ? parseInt(query.animalId, 10) : undefined,
      lactationCycleId: query.lactationCycleId ? parseInt(query.lactationCycleId, 10) : undefined,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // POST /api/v1/dairy/records
  app.post("/dairy/records", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
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
    };

    if (!body.animalId) {
      return reply.code(400).send({ error: { code: "animal_id_required", message: "Animal ID is required" } });
    }
    if (!body.milkedAt) {
      return reply.code(400).send({ error: { code: "milked_at_required", message: "Milked at time is required" } });
    }
    if (!body.milkLbs || body.milkLbs <= 0) {
      return reply.code(400).send({ error: { code: "milk_lbs_required", message: "Milk weight is required" } });
    }

    try {
      const record = await dairyService.logMilking(tenantId, body);
      return reply.code(201).send(record);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // POST /api/v1/dairy/records/bulk
  app.post("/dairy/records/bulk", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as { records: any[] };
    if (!body.records || !Array.isArray(body.records) || body.records.length === 0) {
      return reply.code(400).send({ error: { code: "records_required", message: "Records array is required" } });
    }

    try {
      const result = await dairyService.logBulkMilking(tenantId, body);
      return reply.code(201).send(result);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // PATCH /api/v1/dairy/records/:id
  app.patch("/dairy/records/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid record ID" } });
    }

    try {
      const record = await dairyService.updateMilkingRecord(tenantId, id, req.body as any);
      return reply.send(record);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // DELETE /api/v1/dairy/records/:id
  app.delete("/dairy/records/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid record ID" } });
    }

    try {
      await dairyService.deleteMilkingRecord(tenantId, id);
      return reply.code(204).send();
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // GET /api/v1/animals/:animalId/dairy/records
  app.get("/animals/:animalId/dairy/records", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid animal ID" } });
    }

    const query = req.query as {
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    };

    const result = await dairyService.listMilkingRecords(tenantId, {
      animalId,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DHIA TESTS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/dairy/dhia-tests
  app.get("/dairy/dhia-tests", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      animalId?: string;
      lactationCycleId?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    };

    const result = await dairyService.listDHIATests(tenantId, {
      animalId: query.animalId ? parseInt(query.animalId, 10) : undefined,
      lactationCycleId: query.lactationCycleId ? parseInt(query.lactationCycleId, 10) : undefined,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // POST /api/v1/dairy/dhia-tests
  app.post("/dairy/dhia-tests", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
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
    };

    if (!body.animalId) {
      return reply.code(400).send({ error: { code: "animal_id_required", message: "Animal ID is required" } });
    }
    if (!body.testDate) {
      return reply.code(400).send({ error: { code: "test_date_required", message: "Test date is required" } });
    }
    if (!body.testDayMilkLbs || body.testDayMilkLbs <= 0) {
      return reply.code(400).send({ error: { code: "test_day_milk_required", message: "Test day milk weight is required" } });
    }

    try {
      const record = await dairyService.recordDHIATest(tenantId, body);
      return reply.code(201).send(record);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LINEAR APPRAISALS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/dairy/appraisals
  app.get("/dairy/appraisals", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      animalId?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    };

    const result = await dairyService.listAppraisals(tenantId, {
      animalId: query.animalId ? parseInt(query.animalId, 10) : undefined,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // POST /api/v1/dairy/appraisals
  app.post("/dairy/appraisals", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
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
    };

    if (!body.animalId) {
      return reply.code(400).send({ error: { code: "animal_id_required", message: "Animal ID is required" } });
    }
    if (!body.appraisalDate) {
      return reply.code(400).send({ error: { code: "appraisal_date_required", message: "Appraisal date is required" } });
    }
    if (body.finalScore === undefined || body.finalScore < 0 || body.finalScore > 99) {
      return reply.code(400).send({ error: { code: "final_score_required", message: "Final score (0-99) is required" } });
    }

    try {
      const record = await dairyService.recordAppraisal(tenantId, body);
      return reply.code(201).send(record);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/dairy/analytics/summary
  app.get("/dairy/analytics/summary", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const summary = await dairyService.getDairySummary(tenantId);
    return reply.send(summary);
  });

  // GET /api/v1/dairy/analytics/production-trend
  app.get("/dairy/analytics/production-trend", async (req, reply) => {
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
      end = new Date();
      start = new Date();
      start.setDate(start.getDate() - 30);
    }

    const trend = await dairyService.getProductionTrend(tenantId, start, end);
    return reply.send({ trend });
  });

  // GET /api/v1/dairy/analytics/top-producers
  app.get("/dairy/analytics/top-producers", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 10;

    const producers = await dairyService.getTopProducers(tenantId, limit);
    return reply.send({ producers });
  });

  // GET /api/v1/animals/:animalId/dairy/history
  app.get("/animals/:animalId/dairy/history", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid animal ID" } });
    }

    const history = await dairyService.getAnimalDairyHistory(tenantId, animalId);
    return reply.send(history);
  });
};

export default dairyRoutes;
