// src/routes/fiber.ts
// Fiber/Wool Production Tracking API endpoints
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fiberService from "../services/fiber-production-service.js";
import type { ShearingType, FleeceGrade, FiberLabTestType } from "@prisma/client";

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

const fiberRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ══════════════════════════════════════════════════════════════════════════
  // SHEARING RECORDS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/fiber/shearings
  app.get("/fiber/shearings", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      animalId?: string;
      grade?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    };

    const result = await fiberService.listShearings(tenantId, {
      animalId: query.animalId ? parseInt(query.animalId, 10) : undefined,
      grade: query.grade?.toUpperCase() as FleeceGrade | undefined,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // GET /api/v1/fiber/shearings/:id
  app.get("/fiber/shearings/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid shearing ID" } });
    }

    const shearing = await fiberService.getShearing(tenantId, id);
    if (!shearing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Shearing record not found" } });
    }

    return reply.send(shearing);
  });

  // POST /api/v1/fiber/shearings
  app.post("/fiber/shearings", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
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
    };

    if (!body.animalId) {
      return reply.code(400).send({ error: { code: "animal_id_required", message: "Animal ID is required" } });
    }
    if (!body.shearingDate) {
      return reply.code(400).send({ error: { code: "shearing_date_required", message: "Shearing date is required" } });
    }
    if (!body.grossWeightLbs || body.grossWeightLbs <= 0) {
      return reply.code(400).send({ error: { code: "gross_weight_required", message: "Gross weight is required" } });
    }

    try {
      const record = await fiberService.recordShearing(tenantId, body);
      return reply.code(201).send(record);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // PATCH /api/v1/fiber/shearings/:id
  app.patch("/fiber/shearings/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid shearing ID" } });
    }

    try {
      const record = await fiberService.updateShearing(tenantId, id, req.body as any);
      return reply.send(record);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // DELETE /api/v1/fiber/shearings/:id
  app.delete("/fiber/shearings/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid shearing ID" } });
    }

    try {
      await fiberService.deleteShearing(tenantId, id);
      return reply.code(204).send();
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // GET /api/v1/animals/:animalId/fiber/shearings
  app.get("/animals/:animalId/fiber/shearings", async (req, reply) => {
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

    const result = await fiberService.listShearings(tenantId, {
      animalId,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // GET /api/v1/animals/:animalId/fiber/latest
  app.get("/animals/:animalId/fiber/latest", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid animal ID" } });
    }

    const shearing = await fiberService.getLatestShearing(tenantId, animalId);
    return reply.send(shearing);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LAB TESTS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/fiber/lab-tests
  app.get("/fiber/lab-tests", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      animalId?: string;
      shearingRecordId?: string;
      testType?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    };

    const result = await fiberService.listLabTests(tenantId, {
      animalId: query.animalId ? parseInt(query.animalId, 10) : undefined,
      shearingRecordId: query.shearingRecordId ? parseInt(query.shearingRecordId, 10) : undefined,
      testType: query.testType?.toUpperCase() as FiberLabTestType | undefined,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // POST /api/v1/fiber/lab-tests
  app.post("/fiber/lab-tests", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
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
    };

    if (!body.animalId) {
      return reply.code(400).send({ error: { code: "animal_id_required", message: "Animal ID is required" } });
    }
    if (!body.testDate) {
      return reply.code(400).send({ error: { code: "test_date_required", message: "Test date is required" } });
    }

    try {
      const record = await fiberService.recordLabTest(tenantId, body);
      return reply.code(201).send(record);
    } catch (e: any) {
      if (e.statusCode === 404) {
        return reply.code(404).send({ error: { code: "not_found", message: e.message } });
      }
      throw e;
    }
  });

  // GET /api/v1/animals/:animalId/fiber/lab-tests
  app.get("/animals/:animalId/fiber/lab-tests", async (req, reply) => {
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

    const result = await fiberService.listLabTests(tenantId, {
      animalId,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    return reply.send(result);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/fiber/analytics/summary
  app.get("/fiber/analytics/summary", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const summary = await fiberService.getFiberSummary(tenantId);
    return reply.send(summary);
  });

  // GET /api/v1/fiber/analytics/quality-trend
  app.get("/fiber/analytics/quality-trend", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { startDate?: string; endDate?: string };

    let start: Date;
    let end: Date;

    if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      end = new Date(query.endDate);
    } else {
      // Default to last 2 years
      end = new Date();
      start = new Date();
      start.setFullYear(start.getFullYear() - 2);
    }

    const trend = await fiberService.getQualityTrend(tenantId, start, end);
    return reply.send({ trend });
  });

  // GET /api/v1/fiber/analytics/top-producers
  app.get("/fiber/analytics/top-producers", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { limit?: string; sortBy?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 10;
    const sortBy = (query.sortBy as "weight" | "micron") ?? "weight";

    const producers = await fiberService.getTopProducers(tenantId, limit, sortBy);
    return reply.send({ producers });
  });

  // GET /api/v1/animals/:animalId/fiber/history
  app.get("/animals/:animalId/fiber/history", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) {
      return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid animal ID" } });
    }

    const history = await fiberService.getAnimalFiberHistory(tenantId, animalId);
    return reply.send(history);
  });
};

export default fiberRoutes;
