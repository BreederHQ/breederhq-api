// src/routes/supplements.ts
// Supplement tracking API endpoints - protocols, schedules, and administrations
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import {
  calculateScheduleDates,
  calculateNextDueDate,
  recalculateScheduleFromPlan,
  getDaysUntilDue,
} from "../services/supplement-scheduler.js";
import type { Species, SupplementScheduleStatus } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────────────────────

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseDateIso(v: unknown): Date | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(+d) ? null : d;
}

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: { code: "missing_tenant", message: "Tenant ID is required" } });
    return null;
  }
  return tenantId;
}

async function assertAnimalInTenant(animalId: number, tenantId: number) {
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    select: { id: true, tenantId: true, species: true, name: true, birthDate: true },
  });
  if (!animal) throw Object.assign(new Error("animal_not_found"), { statusCode: 404 });
  if (animal.tenantId !== tenantId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  return animal;
}

async function assertBreedingPlanInTenant(planId: number, tenantId: number) {
  const plan = await prisma.breedingPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      damId: true,
      expectedCycleStart: true,
      cycleStartDateActual: true,
      expectedBreedDate: true,
      breedDateActual: true,
      expectedBirthDate: true,
      birthDateActual: true,
      expectedWeaned: true,
      weanedDateActual: true,
    },
  });
  if (!plan) throw Object.assign(new Error("plan_not_found"), { statusCode: 404 });
  if (plan.tenantId !== tenantId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  return plan;
}

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

const supplementRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ══════════════════════════════════════════════════════════════════════════
  // SUPPLEMENT PROTOCOLS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/supplement-protocols
  // List all protocols (benchmark + tenant custom)
  app.get("/supplement-protocols", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { species?: string; active?: string };

    const where: any = {
      OR: [{ tenantId: null }, { tenantId }], // Benchmarks + tenant's custom
    };

    if (query.active !== undefined) {
      where.active = query.active === "true";
    }

    const protocols = await prisma.supplementProtocol.findMany({
      where,
      orderBy: [{ isBenchmark: "desc" }, { name: "asc" }],
    });

    // Filter by species if specified
    let filtered = protocols;
    if (query.species) {
      const speciesFilter = query.species.toUpperCase() as Species;
      filtered = protocols.filter((p) => p.species.includes(speciesFilter));
    }

    return reply.send({ protocols: filtered });
  });

  // GET /api/v1/supplement-protocols/benchmarks
  // List benchmark protocols only (filterable by species)
  app.get("/supplement-protocols/benchmarks", async (req, reply) => {
    const query = req.query as { species?: string };

    const protocols = await prisma.supplementProtocol.findMany({
      where: {
        isBenchmark: true,
        tenantId: null,
        active: true,
      },
      orderBy: { name: "asc" },
    });

    let filtered = protocols;
    if (query.species) {
      const speciesFilter = query.species.toUpperCase() as Species;
      filtered = protocols.filter((p) => p.species.includes(speciesFilter));
    }

    return reply.send({ protocols: filtered });
  });

  // GET /api/v1/supplement-protocols/:id
  // Get single protocol
  app.get("/supplement-protocols/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const protocolId = parseIntStrict((req.params as { id: string }).id);
    if (!protocolId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid protocol ID" } });

    const protocol = await prisma.supplementProtocol.findUnique({
      where: { id: protocolId },
    });

    if (!protocol) {
      return reply.code(404).send({ error: { code: "not_found", message: "Protocol not found" } });
    }

    // Must be benchmark or belong to tenant
    if (protocol.tenantId !== null && protocol.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    return reply.send(protocol);
  });

  // POST /api/v1/supplement-protocols
  // Create custom protocol
  app.post("/supplement-protocols", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
      name: string;
      description?: string;
      species: Species[];
      dosageAmount?: string;
      dosageUnit?: string;
      administrationRoute?: string;
      triggerType: "BREEDING_CYCLE_RELATIVE" | "AGE_BASED" | "MANUAL";
      anchorEvent?: "CYCLE_START" | "BREED_DATE" | "BIRTH_DATE" | "WEANED_DATE";
      offsetDays?: number;
      ageTriggerWeeks?: number;
      durationDays?: number;
      frequency?: "ONCE" | "DAILY" | "EVERY_OTHER_DAY" | "EVERY_3_DAYS" | "WEEKLY" | "ONGOING";
      reminderDaysBefore?: number[];
    };

    if (!body.name) {
      return reply.code(400).send({ error: { code: "name_required", message: "Protocol name is required" } });
    }
    if (!body.triggerType) {
      return reply.code(400).send({ error: { code: "trigger_type_required", message: "Trigger type is required" } });
    }
    if (!body.species || body.species.length === 0) {
      return reply.code(400).send({ error: { code: "species_required", message: "At least one species is required" } });
    }

    const protocol = await prisma.supplementProtocol.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description || null,
        species: body.species,
        isBenchmark: false,
        dosageAmount: body.dosageAmount || null,
        dosageUnit: body.dosageUnit || null,
        administrationRoute: body.administrationRoute || null,
        triggerType: body.triggerType,
        anchorEvent: body.anchorEvent || null,
        offsetDays: body.offsetDays ?? null,
        ageTriggerWeeks: body.ageTriggerWeeks ?? null,
        durationDays: body.durationDays ?? null,
        frequency: body.frequency || "DAILY",
        reminderDaysBefore: body.reminderDaysBefore || [7, 3, 1],
      },
    });

    return reply.code(201).send(protocol);
  });

  // POST /api/v1/supplement-protocols/:id/clone
  // Clone protocol (creates tenant copy)
  app.post("/supplement-protocols/:id/clone", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const protocolId = parseIntStrict((req.params as { id: string }).id);
    if (!protocolId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid protocol ID" } });

    const source = await prisma.supplementProtocol.findUnique({
      where: { id: protocolId },
    });

    if (!source) {
      return reply.code(404).send({ error: { code: "not_found", message: "Protocol not found" } });
    }

    // Allow cloning benchmarks or own protocols
    if (source.tenantId !== null && source.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    const body = req.body as { name?: string } | undefined;

    const cloned = await prisma.supplementProtocol.create({
      data: {
        tenantId,
        name: body?.name || `${source.name} (Copy)`,
        description: source.description,
        species: source.species,
        isBenchmark: false,
        benchmarkSource: source.isBenchmark ? source.benchmarkSource : null,
        benchmarkNotes: source.isBenchmark ? source.benchmarkNotes : null,
        dosageAmount: source.dosageAmount,
        dosageUnit: source.dosageUnit,
        administrationRoute: source.administrationRoute,
        triggerType: source.triggerType,
        anchorEvent: source.anchorEvent,
        offsetDays: source.offsetDays,
        ageTriggerWeeks: source.ageTriggerWeeks,
        durationDays: source.durationDays,
        frequency: source.frequency,
        reminderDaysBefore: source.reminderDaysBefore,
      },
    });

    return reply.code(201).send(cloned);
  });

  // PUT /api/v1/supplement-protocols/:id
  // Update custom protocol (403 for benchmarks)
  app.put("/supplement-protocols/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const protocolId = parseIntStrict((req.params as { id: string }).id);
    if (!protocolId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid protocol ID" } });

    const existing = await prisma.supplementProtocol.findUnique({
      where: { id: protocolId },
    });

    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Protocol not found" } });
    }

    if (existing.isBenchmark) {
      return reply.code(403).send({
        error: { code: "benchmark_readonly", message: "Benchmark protocols cannot be modified. Clone it first." },
      });
    }

    if (existing.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    const body = req.body as Partial<{
      name: string;
      description: string | null;
      species: Species[];
      dosageAmount: string | null;
      dosageUnit: string | null;
      administrationRoute: string | null;
      triggerType: "BREEDING_CYCLE_RELATIVE" | "AGE_BASED" | "MANUAL";
      anchorEvent: "CYCLE_START" | "BREED_DATE" | "BIRTH_DATE" | "WEANED_DATE" | null;
      offsetDays: number | null;
      ageTriggerWeeks: number | null;
      durationDays: number | null;
      frequency: "ONCE" | "DAILY" | "EVERY_OTHER_DAY" | "EVERY_3_DAYS" | "WEEKLY" | "ONGOING";
      reminderDaysBefore: number[];
      active: boolean;
    }>;

    const protocol = await prisma.supplementProtocol.update({
      where: { id: protocolId },
      data: body,
    });

    return reply.send(protocol);
  });

  // DELETE /api/v1/supplement-protocols/:id
  // Delete custom protocol (403 for benchmarks)
  app.delete("/supplement-protocols/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const protocolId = parseIntStrict((req.params as { id: string }).id);
    if (!protocolId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid protocol ID" } });

    const existing = await prisma.supplementProtocol.findUnique({
      where: { id: protocolId },
    });

    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Protocol not found" } });
    }

    if (existing.isBenchmark) {
      return reply.code(403).send({
        error: { code: "benchmark_readonly", message: "Benchmark protocols cannot be deleted" },
      });
    }

    if (existing.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    await prisma.supplementProtocol.delete({ where: { id: protocolId } });

    return reply.code(204).send();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUPPLEMENT SCHEDULES
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/breeding-plans/:planId/supplements
  // List schedules for a breeding plan
  app.get("/breeding-plans/:planId/supplements", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const planId = parseIntStrict((req.params as { planId: string }).planId);
    if (!planId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid plan ID" } });

    await assertBreedingPlanInTenant(planId, tenantId);

    const schedules = await prisma.supplementSchedule.findMany({
      where: { tenantId, breedingPlanId: planId },
      include: {
        protocol: true,
        animal: { select: { id: true, name: true, species: true } },
        _count: { select: { administrations: true } },
      },
      orderBy: { calculatedStartDate: "asc" },
    });

    const enriched = schedules.map((s) => ({
      ...s,
      daysUntilDue: getDaysUntilDue(s.nextDueDate),
    }));

    return reply.send({ schedules: enriched });
  });

  // POST /api/v1/breeding-plans/:planId/supplements
  // Add breeding-linked schedule to a plan
  app.post("/breeding-plans/:planId/supplements", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const planId = parseIntStrict((req.params as { planId: string }).planId);
    if (!planId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid plan ID" } });

    const plan = await assertBreedingPlanInTenant(planId, tenantId);

    const body = req.body as {
      protocolId: number;
      animalId: number;
      notes?: string;
    };

    if (!body.protocolId) {
      return reply.code(400).send({ error: { code: "protocol_required", message: "Protocol ID is required" } });
    }
    if (!body.animalId) {
      return reply.code(400).send({ error: { code: "animal_required", message: "Animal ID is required" } });
    }

    const protocol = await prisma.supplementProtocol.findUnique({
      where: { id: body.protocolId },
    });

    if (!protocol) {
      return reply.code(404).send({ error: { code: "protocol_not_found", message: "Protocol not found" } });
    }

    // Verify protocol is accessible (benchmark or tenant's)
    if (protocol.tenantId !== null && protocol.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied to protocol" } });
    }

    const animal = await assertAnimalInTenant(body.animalId, tenantId);

    // Calculate schedule dates
    const calculated = calculateScheduleDates(protocol, plan, null, animal.birthDate);

    if ("code" in calculated) {
      return reply.code(400).send({
        error: { code: calculated.code, message: calculated.message },
      });
    }

    const schedule = await prisma.supplementSchedule.create({
      data: {
        tenantId,
        protocolId: body.protocolId,
        breedingPlanId: planId,
        animalId: body.animalId,
        mode: "BREEDING_LINKED",
        calculatedStartDate: calculated.calculatedStartDate,
        calculatedEndDate: calculated.calculatedEndDate,
        totalDoses: calculated.totalDoses,
        nextDueDate: calculated.nextDueDate,
        notes: body.notes || null,
      },
      include: {
        protocol: true,
        animal: { select: { id: true, name: true, species: true } },
      },
    });

    return reply.code(201).send(schedule);
  });

  // GET /api/v1/animals/:animalId/supplements
  // List all schedules for an animal
  app.get("/animals/:animalId/supplements", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid animal ID" } });

    await assertAnimalInTenant(animalId, tenantId);

    const schedules = await prisma.supplementSchedule.findMany({
      where: { tenantId, animalId },
      include: {
        protocol: true,
        breedingPlan: { select: { id: true, name: true } },
        _count: { select: { administrations: true } },
      },
      orderBy: { calculatedStartDate: "asc" },
    });

    const enriched = schedules.map((s) => ({
      ...s,
      daysUntilDue: getDaysUntilDue(s.nextDueDate),
    }));

    return reply.send({ schedules: enriched });
  });

  // POST /api/v1/animals/:animalId/supplements
  // Create standalone schedule (not tied to breeding plan)
  app.post("/animals/:animalId/supplements", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { animalId: string }).animalId);
    if (!animalId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid animal ID" } });

    const animal = await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as {
      protocolId: number;
      startDate: string;
      notes?: string;
    };

    if (!body.protocolId) {
      return reply.code(400).send({ error: { code: "protocol_required", message: "Protocol ID is required" } });
    }
    if (!body.startDate) {
      return reply.code(400).send({ error: { code: "start_date_required", message: "Start date is required" } });
    }

    const startDate = parseDateIso(body.startDate);
    if (!startDate) {
      return reply.code(400).send({ error: { code: "invalid_date", message: "Invalid start date" } });
    }

    const protocol = await prisma.supplementProtocol.findUnique({
      where: { id: body.protocolId },
    });

    if (!protocol) {
      return reply.code(404).send({ error: { code: "protocol_not_found", message: "Protocol not found" } });
    }

    if (protocol.tenantId !== null && protocol.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied to protocol" } });
    }

    // Calculate schedule dates
    const calculated = calculateScheduleDates(protocol, null, startDate, animal.birthDate);

    if ("code" in calculated) {
      return reply.code(400).send({
        error: { code: calculated.code, message: calculated.message },
      });
    }

    const schedule = await prisma.supplementSchedule.create({
      data: {
        tenantId,
        protocolId: body.protocolId,
        breedingPlanId: null,
        animalId,
        mode: "STANDALONE",
        calculatedStartDate: calculated.calculatedStartDate,
        calculatedEndDate: calculated.calculatedEndDate,
        startDateOverride: startDate,
        totalDoses: calculated.totalDoses,
        nextDueDate: calculated.nextDueDate,
        notes: body.notes || null,
      },
      include: {
        protocol: true,
        animal: { select: { id: true, name: true, species: true } },
      },
    });

    return reply.code(201).send(schedule);
  });

  // GET /api/v1/supplement-schedules/:id
  // Get single schedule with details
  app.get("/supplement-schedules/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const scheduleId = parseIntStrict((req.params as { id: string }).id);
    if (!scheduleId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid schedule ID" } });

    const schedule = await prisma.supplementSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        protocol: true,
        animal: { select: { id: true, name: true, species: true } },
        breedingPlan: { select: { id: true, name: true } },
        administrations: {
          orderBy: { administeredAt: "desc" },
          take: 10,
        },
      },
    });

    if (!schedule) {
      return reply.code(404).send({ error: { code: "not_found", message: "Schedule not found" } });
    }

    if (schedule.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    return reply.send({
      ...schedule,
      daysUntilDue: getDaysUntilDue(schedule.nextDueDate),
    });
  });

  // PUT /api/v1/supplement-schedules/:id
  // Update schedule
  app.put("/supplement-schedules/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const scheduleId = parseIntStrict((req.params as { id: string }).id);
    if (!scheduleId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid schedule ID" } });

    const existing = await prisma.supplementSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Schedule not found" } });
    }

    if (existing.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    const body = req.body as Partial<{
      status: SupplementScheduleStatus;
      startDateOverride: string | null;
      notes: string | null;
    }>;

    const updates: any = {};

    if (body.status !== undefined) {
      updates.status = body.status;
    }
    if (body.startDateOverride !== undefined) {
      updates.startDateOverride = body.startDateOverride ? parseDateIso(body.startDateOverride) : null;
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }

    const schedule = await prisma.supplementSchedule.update({
      where: { id: scheduleId },
      data: updates,
      include: {
        protocol: true,
        animal: { select: { id: true, name: true, species: true } },
      },
    });

    return reply.send(schedule);
  });

  // DELETE /api/v1/supplement-schedules/:id
  // Delete schedule
  app.delete("/supplement-schedules/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const scheduleId = parseIntStrict((req.params as { id: string }).id);
    if (!scheduleId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid schedule ID" } });

    const existing = await prisma.supplementSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Schedule not found" } });
    }

    if (existing.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    await prisma.supplementSchedule.delete({ where: { id: scheduleId } });

    return reply.code(204).send();
  });

  // POST /api/v1/supplement-schedules/:id/recalculate
  // Recalculate dates from breeding plan
  app.post("/supplement-schedules/:id/recalculate", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const scheduleId = parseIntStrict((req.params as { id: string }).id);
    if (!scheduleId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid schedule ID" } });

    const schedule = await prisma.supplementSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        protocol: true,
        breedingPlan: true,
      },
    });

    if (!schedule) {
      return reply.code(404).send({ error: { code: "not_found", message: "Schedule not found" } });
    }

    if (schedule.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    if (schedule.mode !== "BREEDING_LINKED" || !schedule.breedingPlan) {
      return reply.code(400).send({
        error: { code: "not_breeding_linked", message: "Schedule is not linked to a breeding plan" },
      });
    }

    const result = recalculateScheduleFromPlan(schedule, schedule.protocol, schedule.breedingPlan);

    if (result === null) {
      return reply.send({ message: "No recalculation needed", schedule });
    }

    if ("code" in result) {
      return reply.code(400).send({
        error: { code: result.code, message: result.message },
      });
    }

    const updated = await prisma.supplementSchedule.update({
      where: { id: scheduleId },
      data: {
        calculatedStartDate: result.calculatedStartDate,
        calculatedEndDate: result.calculatedEndDate,
        totalDoses: result.totalDoses,
        // Don't reset nextDueDate if already in progress
        ...(schedule.status === "NOT_STARTED" ? { nextDueDate: result.nextDueDate } : {}),
      },
      include: {
        protocol: true,
        animal: { select: { id: true, name: true, species: true } },
      },
    });

    return reply.send(updated);
  });

  // POST /api/v1/supplement-schedules/:id/acknowledge-disclaimer
  // Acknowledge liability disclaimer
  app.post("/supplement-schedules/:id/acknowledge-disclaimer", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const scheduleId = parseIntStrict((req.params as { id: string }).id);
    if (!scheduleId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid schedule ID" } });

    const existing = await prisma.supplementSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Schedule not found" } });
    }

    if (existing.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    const userId = (req as any).userId || "unknown";

    const schedule = await prisma.supplementSchedule.update({
      where: { id: scheduleId },
      data: {
        disclaimerAcknowledgedAt: new Date(),
        disclaimerAcknowledgedBy: userId,
      },
    });

    return reply.send(schedule);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUPPLEMENT ADMINISTRATIONS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/supplement-schedules/:id/administrations
  // List administrations for a schedule
  app.get("/supplement-schedules/:scheduleId/administrations", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const scheduleId = parseIntStrict((req.params as { scheduleId: string }).scheduleId);
    if (!scheduleId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid schedule ID" } });

    const schedule = await prisma.supplementSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      return reply.code(404).send({ error: { code: "not_found", message: "Schedule not found" } });
    }

    if (schedule.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    const administrations = await prisma.supplementAdministration.findMany({
      where: { scheduleId },
      orderBy: { administeredAt: "desc" },
    });

    return reply.send({ administrations });
  });

  // POST /api/v1/supplement-schedules/:id/administrations
  // Record an administration
  app.post("/supplement-schedules/:scheduleId/administrations", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const scheduleId = parseIntStrict((req.params as { scheduleId: string }).scheduleId);
    if (!scheduleId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid schedule ID" } });

    const schedule = await prisma.supplementSchedule.findUnique({
      where: { id: scheduleId },
      include: { protocol: true },
    });

    if (!schedule) {
      return reply.code(404).send({ error: { code: "not_found", message: "Schedule not found" } });
    }

    if (schedule.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    const body = req.body as {
      administeredAt?: string;
      actualDosage?: string;
      givenBy?: string;
      notes?: string;
    };

    const administeredAt = body.administeredAt ? parseDateIso(body.administeredAt) : new Date();
    if (!administeredAt) {
      return reply.code(400).send({ error: { code: "invalid_date", message: "Invalid administered date" } });
    }

    // Create administration record
    const newDoseNumber = schedule.completedDoses + 1;

    const administration = await prisma.supplementAdministration.create({
      data: {
        tenantId,
        scheduleId,
        animalId: schedule.animalId,
        administeredAt,
        actualDosage: body.actualDosage || null,
        givenBy: body.givenBy || null,
        doseNumber: newDoseNumber,
        notes: body.notes || null,
      },
    });

    // Update schedule
    const nextDue = calculateNextDueDate(schedule, schedule.protocol, administration);
    const isComplete =
      schedule.totalDoses !== null && newDoseNumber >= schedule.totalDoses && schedule.protocol.frequency !== "ONGOING";

    await prisma.supplementSchedule.update({
      where: { id: scheduleId },
      data: {
        completedDoses: newDoseNumber,
        lastAdministeredAt: administeredAt,
        nextDueDate: nextDue,
        status: isComplete ? "COMPLETED" : "IN_PROGRESS",
      },
    });

    return reply.code(201).send(administration);
  });

  // PUT /api/v1/supplement-administrations/:id
  // Update an administration
  app.put("/supplement-administrations/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const adminId = parseIntStrict((req.params as { id: string }).id);
    if (!adminId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid administration ID" } });

    const existing = await prisma.supplementAdministration.findUnique({
      where: { id: adminId },
    });

    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Administration not found" } });
    }

    if (existing.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    const body = req.body as Partial<{
      administeredAt: string;
      actualDosage: string | null;
      givenBy: string | null;
      notes: string | null;
    }>;

    const updates: any = {};

    if (body.administeredAt !== undefined) {
      const date = parseDateIso(body.administeredAt);
      if (!date) {
        return reply.code(400).send({ error: { code: "invalid_date", message: "Invalid date" } });
      }
      updates.administeredAt = date;
    }
    if (body.actualDosage !== undefined) updates.actualDosage = body.actualDosage;
    if (body.givenBy !== undefined) updates.givenBy = body.givenBy;
    if (body.notes !== undefined) updates.notes = body.notes;

    const administration = await prisma.supplementAdministration.update({
      where: { id: adminId },
      data: updates,
    });

    return reply.send(administration);
  });

  // DELETE /api/v1/supplement-administrations/:id
  // Delete an administration
  app.delete("/supplement-administrations/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const adminId = parseIntStrict((req.params as { id: string }).id);
    if (!adminId) return reply.code(400).send({ error: { code: "invalid_id", message: "Invalid administration ID" } });

    const existing = await prisma.supplementAdministration.findUnique({
      where: { id: adminId },
      include: { schedule: true },
    });

    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Administration not found" } });
    }

    if (existing.tenantId !== tenantId) {
      return reply.code(403).send({ error: { code: "forbidden", message: "Access denied" } });
    }

    await prisma.supplementAdministration.delete({ where: { id: adminId } });

    // Update schedule's completed doses count
    const remainingCount = await prisma.supplementAdministration.count({
      where: { scheduleId: existing.scheduleId },
    });

    // Get the latest administration after deletion
    const latestAdmin = await prisma.supplementAdministration.findFirst({
      where: { scheduleId: existing.scheduleId },
      orderBy: { administeredAt: "desc" },
    });

    await prisma.supplementSchedule.update({
      where: { id: existing.scheduleId },
      data: {
        completedDoses: remainingCount,
        lastAdministeredAt: latestAdmin?.administeredAt || null,
        status: remainingCount === 0 ? "NOT_STARTED" : "IN_PROGRESS",
      },
    });

    return reply.code(204).send();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DASHBOARD / SUMMARY ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/v1/supplements/upcoming
  // Get upcoming supplement doses across all animals
  app.get("/supplements/upcoming", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as { days?: string };
    const days = parseInt(query.days || "14", 10);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);

    const schedules = await prisma.supplementSchedule.findMany({
      where: {
        tenantId,
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
        nextDueDate: {
          gte: today,
          lte: futureDate,
        },
      },
      include: {
        protocol: { select: { id: true, name: true, dosageAmount: true, dosageUnit: true } },
        animal: { select: { id: true, name: true, species: true } },
        breedingPlan: { select: { id: true, name: true } },
      },
      orderBy: { nextDueDate: "asc" },
    });

    const enriched = schedules.map((s) => ({
      ...s,
      daysUntilDue: getDaysUntilDue(s.nextDueDate),
    }));

    return reply.send({ schedules: enriched });
  });

  // GET /api/v1/supplements/overdue
  // Get overdue supplement doses
  app.get("/supplements/overdue", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const schedules = await prisma.supplementSchedule.findMany({
      where: {
        tenantId,
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
        nextDueDate: {
          lt: today,
        },
      },
      include: {
        protocol: { select: { id: true, name: true, dosageAmount: true, dosageUnit: true } },
        animal: { select: { id: true, name: true, species: true } },
        breedingPlan: { select: { id: true, name: true } },
      },
      orderBy: { nextDueDate: "asc" },
    });

    const enriched = schedules.map((s) => ({
      ...s,
      daysOverdue: Math.abs(getDaysUntilDue(s.nextDueDate) || 0),
    }));

    return reply.send({ schedules: enriched });
  });
};

export default supplementRoutes;
