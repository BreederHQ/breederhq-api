// src/routes/flush-events.ts
// Flush Event API — tracks embryo flush/recovery procedures for ET breeding
// A flush event represents a single veterinary procedure where embryos are
// recovered from a donor female. For MOET, one flush can yield 5-15+ embryos.

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// ════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePaging(query: any) {
  const page = Math.max(1, Number(query?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(query?.limit ?? 25) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: { code: "missing_tenant", message: "Tenant ID is required" } });
    return null;
  }
  return tenantId;
}

// ════════════════════════════════════════════════════════════════════════════
// ROUTE PLUGIN
// ════════════════════════════════════════════════════════════════════════════

const flushEventsRoutes: FastifyPluginAsync = async (api: FastifyInstance) => {

  // ────────────── POST /api/v1/flush-events ──────────────
  api.post("/api/v1/flush-events", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
      geneticDamId: number;
      sireId?: number;
      flushDate: string;
      embryosRecovered?: number;
      embryosViable?: number;
      embryoGrades?: { grade: number; notes?: string }[];
      embryoType?: "FRESH" | "FROZEN";
      vetName?: string;
      location?: string;
      notes?: string;
      planIds?: number[];
    };

    // Validate required fields
    if (!body.geneticDamId || !body.flushDate) {
      return reply.code(400).send({
        error: { code: "validation", message: "geneticDamId and flushDate are required" },
      });
    }

    // Validate geneticDam exists in tenant and is female
    const geneticDam = await prisma.animal.findUnique({
      where: { id: body.geneticDamId },
      select: { id: true, tenantId: true, sex: true },
    });
    if (!geneticDam || geneticDam.tenantId !== tenantId) {
      return reply.code(404).send({ error: { code: "not_found", message: "Genetic dam not found in tenant" } });
    }
    if (geneticDam.sex !== "FEMALE") {
      return reply.code(400).send({ error: { code: "validation", message: "Genetic dam must be female" } });
    }

    // Validate sire if provided
    if (body.sireId) {
      const sire = await prisma.animal.findUnique({
        where: { id: body.sireId },
        select: { id: true, tenantId: true, sex: true },
      });
      if (!sire || sire.tenantId !== tenantId) {
        return reply.code(404).send({ error: { code: "not_found", message: "Sire not found in tenant" } });
      }
      if (sire.sex !== "MALE") {
        return reply.code(400).send({ error: { code: "validation", message: "Sire must be male" } });
      }
    }

    // Validate embryo counts
    if (
      body.embryosRecovered != null &&
      body.embryosViable != null &&
      body.embryosViable > body.embryosRecovered
    ) {
      return reply.code(400).send({
        error: { code: "validation", message: "embryosViable cannot exceed embryosRecovered" },
      });
    }

    // Create flush event
    const flushEvent = await prisma.flushEvent.create({
      data: {
        tenantId,
        geneticDamId: body.geneticDamId,
        sireId: body.sireId ?? null,
        flushDate: new Date(body.flushDate),
        embryosRecovered: body.embryosRecovered ?? null,
        embryosViable: body.embryosViable ?? null,
        embryoGrades: body.embryoGrades ?? undefined,
        embryoType: body.embryoType ?? null,
        vetName: body.vetName ?? null,
        location: body.location ?? null,
        notes: body.notes ?? null,
        updatedAt: new Date(),
      },
    });

    // Link plans if provided
    if (body.planIds && body.planIds.length > 0) {
      // Validate all plans are ET plans in same tenant with same geneticDamId
      const plans = await prisma.breedingPlan.findMany({
        where: {
          id: { in: body.planIds },
          tenantId,
          geneticDamId: body.geneticDamId,
        },
        select: { id: true },
      });

      const validPlanIds = plans.map((p) => p.id);
      if (validPlanIds.length > 0) {
        await prisma.breedingPlan.updateMany({
          where: { id: { in: validPlanIds } },
          data: { flushEventId: flushEvent.id },
        });
      }
    }

    return reply.code(201).send(flushEvent);
  });

  // ────────────── GET /api/v1/flush-events ──────────────
  api.get("/api/v1/flush-events", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const query = req.query as {
      page?: string;
      limit?: string;
      geneticDamId?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    const { page, limit, skip } = parsePaging(query);

    const where: any = { tenantId };

    if (query.geneticDamId) {
      const damId = parseIntStrict(query.geneticDamId);
      if (damId) where.geneticDamId = damId;
    }

    if (query.dateFrom || query.dateTo) {
      where.flushDate = {};
      if (query.dateFrom) where.flushDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.flushDate.lte = new Date(query.dateTo);
    }

    const [items, total] = await Promise.all([
      prisma.flushEvent.findMany({
        where,
        orderBy: { flushDate: "desc" },
        skip,
        take: limit,
        include: {
          Animal_FlushEvent_geneticDamIdToAnimal: { select: { id: true, name: true, sex: true, species: true } },
          Animal_FlushEvent_sireIdToAnimal: { select: { id: true, name: true, sex: true, species: true } },
          _count: { select: { BreedingPlan: true } },
        },
      }),
      prisma.flushEvent.count({ where }),
    ]);

    // Compute offspring counts for each flush event (batch query)
    const flushEventIds = items.map((fe) => fe.id);
    let offspringCounts: Record<number, number> = {};
    if (flushEventIds.length > 0) {
      const offspringAgg = await prisma.breedingPlan.groupBy({
        by: ["flushEventId"],
        where: { flushEventId: { in: flushEventIds }, tenantId },
        _sum: { countLive: true },
      });
      for (const row of offspringAgg) {
        if (row.flushEventId != null) {
          offspringCounts[row.flushEventId] = row._sum.countLive ?? 0;
        }
      }
    }

    const data = items.map((fe) => ({
      ...fe,
      geneticDam: fe.Animal_FlushEvent_geneticDamIdToAnimal,
      sire: fe.Animal_FlushEvent_sireIdToAnimal,
      plansCount: fe._count.BreedingPlan,
      offspringCount: offspringCounts[fe.id] ?? 0,
      Animal_FlushEvent_geneticDamIdToAnimal: undefined,
      Animal_FlushEvent_sireIdToAnimal: undefined,
      _count: undefined,
    }));

    return reply.send({ data, total, page, limit });
  });

  // ────────────── GET /api/v1/flush-events/:id ──────────────
  api.get("/api/v1/flush-events/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as any).id);
    if (!id) return reply.code(400).send({ error: { code: "validation", message: "Invalid flush event ID" } });

    const flushEvent = await prisma.flushEvent.findFirst({
      where: { id, tenantId },
      include: {
        Animal_FlushEvent_geneticDamIdToAnimal: { select: { id: true, name: true, sex: true, species: true } },
        Animal_FlushEvent_sireIdToAnimal: { select: { id: true, name: true, sex: true, species: true } },
        BreedingPlan: {
          select: {
            id: true,
            name: true,
            status: true,
            recipientDamId: true,
            Animal_BreedingPlan_recipientDamIdToAnimal: { select: { id: true, name: true } },
            birthDateActual: true,
            countLive: true,
          },
        },
      },
    });

    if (!flushEvent) {
      return reply.code(404).send({ error: { code: "not_found", message: "Flush event not found" } });
    }

    return reply.send({
      ...flushEvent,
      geneticDam: flushEvent.Animal_FlushEvent_geneticDamIdToAnimal,
      sire: flushEvent.Animal_FlushEvent_sireIdToAnimal,
      breedingPlans: flushEvent.BreedingPlan.map((p) => ({
        ...p,
        recipientDam: p.Animal_BreedingPlan_recipientDamIdToAnimal,
        Animal_BreedingPlan_recipientDamIdToAnimal: undefined,
      })),
      plansCount: flushEvent.BreedingPlan.length,
      offspringCount: flushEvent.BreedingPlan.reduce((sum: number, p: any) => sum + (p.countLive ?? 0), 0),
      Animal_FlushEvent_geneticDamIdToAnimal: undefined,
      Animal_FlushEvent_sireIdToAnimal: undefined,
      BreedingPlan: undefined,
    });
  });

  // ────────────── PATCH /api/v1/flush-events/:id ──────────────
  api.patch("/api/v1/flush-events/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as any).id);
    if (!id) return reply.code(400).send({ error: { code: "validation", message: "Invalid flush event ID" } });

    // Verify ownership
    const existing = await prisma.flushEvent.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Flush event not found" } });
    }

    const body = req.body as {
      sireId?: number | null;
      flushDate?: string;
      embryosRecovered?: number | null;
      embryosViable?: number | null;
      embryoGrades?: { grade: number; notes?: string }[] | null;
      embryoType?: "FRESH" | "FROZEN" | null;
      vetName?: string | null;
      location?: string | null;
      notes?: string | null;
    };

    // Validate sire if changing
    if (body.sireId !== undefined && body.sireId !== null) {
      const sire = await prisma.animal.findUnique({
        where: { id: body.sireId },
        select: { id: true, tenantId: true, sex: true },
      });
      if (!sire || sire.tenantId !== tenantId) {
        return reply.code(404).send({ error: { code: "not_found", message: "Sire not found in tenant" } });
      }
      if (sire.sex !== "MALE") {
        return reply.code(400).send({ error: { code: "validation", message: "Sire must be male" } });
      }
    }

    // Validate embryo counts
    const recovered = body.embryosRecovered !== undefined ? body.embryosRecovered : existing.embryosRecovered;
    const viable = body.embryosViable !== undefined ? body.embryosViable : existing.embryosViable;
    if (recovered != null && viable != null && viable > recovered) {
      return reply.code(400).send({
        error: { code: "validation", message: "embryosViable cannot exceed embryosRecovered" },
      });
    }

    const data: any = { updatedAt: new Date() };
    if (body.sireId !== undefined) data.sireId = body.sireId;
    if (body.flushDate !== undefined) data.flushDate = new Date(body.flushDate);
    if (body.embryosRecovered !== undefined) data.embryosRecovered = body.embryosRecovered;
    if (body.embryosViable !== undefined) data.embryosViable = body.embryosViable;
    if (body.embryoGrades !== undefined) data.embryoGrades = body.embryoGrades ?? undefined;
    if (body.embryoType !== undefined) data.embryoType = body.embryoType;
    if (body.vetName !== undefined) data.vetName = body.vetName;
    if (body.location !== undefined) data.location = body.location;
    if (body.notes !== undefined) data.notes = body.notes;

    const updated = await prisma.flushEvent.update({
      where: { id },
      data,
    });

    return reply.send(updated);
  });

  // ────────────── DELETE /api/v1/flush-events/:id ──────────────
  api.delete("/api/v1/flush-events/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as any).id);
    if (!id) return reply.code(400).send({ error: { code: "validation", message: "Invalid flush event ID" } });

    // Verify ownership
    const existing = await prisma.flushEvent.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { BreedingPlan: true } } },
    });
    if (!existing) {
      return reply.code(404).send({ error: { code: "not_found", message: "Flush event not found" } });
    }

    // Block deletion if plans are linked
    if (existing._count.BreedingPlan > 0) {
      return reply.code(409).send({
        error: {
          code: "has_linked_plans",
          message: `Cannot delete flush event: ${existing._count.BreedingPlan} breeding plan(s) are linked. Unlink plans first.`,
        },
      });
    }

    await prisma.flushEvent.delete({ where: { id } });
    return reply.code(204).send();
  });

  // ────────────── GET /api/v1/animals/:id/flush-history ──────────────
  api.get("/api/v1/animals/:id/flush-history", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as any).id);
    if (!animalId) return reply.code(400).send({ error: { code: "validation", message: "Invalid animal ID" } });

    // Verify animal in tenant
    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
      select: { id: true },
    });
    if (!animal) {
      return reply.code(404).send({ error: { code: "not_found", message: "Animal not found" } });
    }

    const query = req.query as { page?: string; limit?: string };
    const { page, limit, skip } = parsePaging(query);

    const where = { tenantId, geneticDamId: animalId };

    const [items, total] = await Promise.all([
      prisma.flushEvent.findMany({
        where,
        orderBy: { flushDate: "desc" },
        skip,
        take: limit,
        include: {
          Animal_FlushEvent_sireIdToAnimal: { select: { id: true, name: true } },
          _count: { select: { BreedingPlan: true } },
        },
      }),
      prisma.flushEvent.count({ where }),
    ]);

    // Batch offspring counts via raw count of offspring linked to plans
    const flushEventIds = items.map((fe: any) => fe.id);
    let offspringCounts: Record<number, number> = {};
    if (flushEventIds.length > 0) {
      const plansByFlush = await prisma.breedingPlan.findMany({
        where: { flushEventId: { in: flushEventIds }, tenantId },
        select: { flushEventId: true, countLive: true },
      });
      for (const row of plansByFlush) {
        if (row.flushEventId != null) {
          offspringCounts[row.flushEventId] = (offspringCounts[row.flushEventId] ?? 0) + (row.countLive ?? 0);
        }
      }
    }

    const data = items.map((fe: any) => ({
      ...fe,
      sire: fe.Animal_FlushEvent_sireIdToAnimal,
      plansCount: fe._count.BreedingPlan,
      offspringCount: offspringCounts[fe.id] ?? 0,
      Animal_FlushEvent_sireIdToAnimal: undefined,
      _count: undefined,
    }));

    return reply.send({ data, total, page, limit });
  });

  // ────────────── POST /api/v1/flush-events/:id/create-plans ──────────────
  // MOET: Batch-create ET breeding plans from a flush event
  api.post("/api/v1/flush-events/:id/create-plans", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const flushEventId = parseIntStrict((req.params as any).id);
    if (!flushEventId) return reply.code(400).send({ error: { code: "validation", message: "Invalid flush event ID" } });

    const body = req.body as {
      recipientDamIds: number[];
      planNameTemplate?: string; // e.g., "{{donor}} ET #{{n}}"
      breed?: string;
      breedingProgramId?: number;
    };

    if (!body.recipientDamIds || body.recipientDamIds.length === 0) {
      return reply.code(400).send({ error: { code: "validation", message: "At least one recipient is required" } });
    }

    // Verify flush event exists in tenant
    const flushEvent = await prisma.flushEvent.findFirst({
      where: { id: flushEventId, tenantId },
      include: {
        Animal_FlushEvent_geneticDamIdToAnimal: { select: { id: true, name: true, species: true } },
      },
    });
    if (!flushEvent) {
      return reply.code(404).send({ error: { code: "not_found", message: "Flush event not found" } });
    }

    const geneticDam = flushEvent.Animal_FlushEvent_geneticDamIdToAnimal;

    // Validate no duplicates in recipient list
    const uniqueRecipients = [...new Set(body.recipientDamIds)];
    if (uniqueRecipients.length !== body.recipientDamIds.length) {
      return reply.code(400).send({ error: { code: "validation", message: "Duplicate recipients not allowed" } });
    }

    // No recipient can be the donor
    if (uniqueRecipients.includes(flushEvent.geneticDamId)) {
      return reply.code(400).send({ error: { code: "validation", message: "Recipient cannot be the genetic donor" } });
    }

    // Validate all recipients: female, same species, same tenant
    const recipients = await prisma.animal.findMany({
      where: { id: { in: uniqueRecipients }, tenantId },
      select: { id: true, name: true, sex: true, species: true },
    });

    if (recipients.length !== uniqueRecipients.length) {
      return reply.code(400).send({ error: { code: "validation", message: "One or more recipients not found in tenant" } });
    }

    for (const r of recipients) {
      if (r.sex !== "FEMALE") {
        return reply.code(400).send({ error: { code: "validation", message: `Recipient ${r.name || r.id} must be female` } });
      }
      if (geneticDam && r.species !== geneticDam.species) {
        return reply.code(400).send({ error: { code: "validation", message: `Recipient ${r.name || r.id} must be same species as donor` } });
      }
    }

    // Warn (but don't block) if more recipients than viable embryos
    const warningMessage =
      flushEvent.embryosViable != null && uniqueRecipients.length > flushEvent.embryosViable
        ? `Warning: ${uniqueRecipients.length} recipients exceeds ${flushEvent.embryosViable} viable embryos`
        : null;

    // Create plans
    const donorName = geneticDam?.name || `Dam #${flushEvent.geneticDamId}`;
    const nameTemplate = body.planNameTemplate || `${donorName} ET #{{n}}`;

    const createdPlans = [];
    for (let i = 0; i < uniqueRecipients.length; i++) {
      const recipientId = uniqueRecipients[i];
      const planName = nameTemplate
        .replace("{{donor}}", donorName)
        .replace("{{n}}", String(i + 1));

      const plan = await prisma.breedingPlan.create({
        data: {
          tenantId,
          name: planName,
          species: geneticDam?.species ?? "HORSE",
          status: "PLANNING",
          damId: recipientId, // recipient is the carrying dam
          sireId: flushEvent.sireId ?? undefined,
          geneticDamId: flushEvent.geneticDamId,
          recipientDamId: recipientId,
          flushEventId: flushEvent.id,
          flushDate: flushEvent.flushDate,
          embryoType: flushEvent.embryoType,
          breedText: body.breed ?? null,
          programId: body.breedingProgramId ?? null,
          updatedAt: new Date(),
        },
      });
      createdPlans.push(plan);
    }

    return reply.code(201).send({
      plans: createdPlans,
      flushEvent,
      warning: warningMessage,
    });
  });
  /* ═══════════════════════════════════════════════════════════════════════
   * ET Analytics — aggregated stats for ET programs
   * GET /api/v1/et-analytics?species=HORSE&dateFrom=2025-01-01&dateTo=2026-12-31
   * ═══════════════════════════════════════════════════════════════════════ */

  api.get("/et-analytics", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const q = req.query as any;
    const species = q.species || undefined;
    const dateFrom = q.dateFrom ? new Date(q.dateFrom) : undefined;
    const dateTo = q.dateTo ? new Date(q.dateTo) : undefined;

    try {
      // All ET plans for this tenant (identified by having geneticDamId set)
      const etPlanWhere: any = {
        tenantId,
        geneticDamId: { not: null },
        deletedAt: null,
      };
      if (species) {
        etPlanWhere.species = species;
      }
      if (dateFrom || dateTo) {
        etPlanWhere.createdAt = {};
        if (dateFrom) etPlanWhere.createdAt.gte = dateFrom;
        if (dateTo) etPlanWhere.createdAt.lte = dateTo;
      }

      const etPlans = await prisma.breedingPlan.findMany({
        where: etPlanWhere,
        select: {
          id: true,
          status: true,
          geneticDamId: true,
          recipientDamId: true,
          embryoType: true,
          flushEventId: true,
          countLive: true,
          birthDateActual: true,
          createdAt: true,
          Animal_BreedingPlan_geneticDamIdToAnimal: { select: { id: true, name: true } },
          Animal_BreedingPlan_recipientDamIdToAnimal: { select: { id: true, name: true } },
        },
      });

      // Flush events for this tenant
      const flushWhere: any = { tenantId };
      if (dateFrom || dateTo) {
        flushWhere.flushDate = {};
        if (dateFrom) flushWhere.flushDate.gte = dateFrom;
        if (dateTo) flushWhere.flushDate.lte = dateTo;
      }
      const flushEvents = await prisma.flushEvent.findMany({
        where: flushWhere,
        select: { id: true, embryosRecovered: true, embryosViable: true, flushDate: true },
      });

      const pregnantStatuses = ["PREGNANT", "BIRTHED", "WEANED", "PLACEMENT", "PLACEMENT_COMPLETED", "COMPLETE"];
      const birthStatuses = ["BIRTHED", "WEANED", "PLACEMENT", "PLACEMENT_COMPLETED", "COMPLETE"];

      const totalFlushes = flushEvents.length;
      const totalEmbryosRecovered = flushEvents.reduce((s, f) => s + (f.embryosRecovered ?? 0), 0);
      const totalEmbryosTransferred = etPlans.length;
      const totalPregnanciesConfirmed = etPlans.filter((p) => pregnantStatuses.includes(p.status)).length;
      const totalOffspringBorn = etPlans.reduce((s, p) => s + (birthStatuses.includes(p.status) ? (p.countLive ?? 0) : 0), 0);
      const overallSuccessRate = totalEmbryosTransferred > 0 ? Math.round((totalPregnanciesConfirmed / totalEmbryosTransferred) * 1000) / 10 : 0;

      // Fresh vs Frozen breakdown
      const freshPlans = etPlans.filter((p) => p.embryoType === "FRESH");
      const frozenPlans = etPlans.filter((p) => p.embryoType === "FROZEN");
      const freshPreg = freshPlans.filter((p) => pregnantStatuses.includes(p.status)).length;
      const frozenPreg = frozenPlans.filter((p) => pregnantStatuses.includes(p.status)).length;

      const freshVsFrozenSuccess = {
        fresh: {
          transfers: freshPlans.length,
          pregnancies: freshPreg,
          rate: freshPlans.length > 0 ? Math.round((freshPreg / freshPlans.length) * 1000) / 10 : 0,
        },
        frozen: {
          transfers: frozenPlans.length,
          pregnancies: frozenPreg,
          rate: frozenPlans.length > 0 ? Math.round((frozenPreg / frozenPlans.length) * 1000) / 10 : 0,
        },
      };

      // Per-donor breakdown
      const donorMap = new Map<number, { name: string; flushes: Set<number>; plans: typeof etPlans }>();
      for (const p of etPlans) {
        if (!p.geneticDamId) continue;
        if (!donorMap.has(p.geneticDamId)) {
          donorMap.set(p.geneticDamId, {
            name: p.Animal_BreedingPlan_geneticDamIdToAnimal?.name ?? "Unknown",
            flushes: new Set(),
            plans: [],
          });
        }
        const d = donorMap.get(p.geneticDamId)!;
        if (p.flushEventId) d.flushes.add(p.flushEventId);
        d.plans.push(p);
      }

      const donorStats = Array.from(donorMap.entries()).map(([animalId, d]) => ({
        animalId,
        name: d.name,
        totalFlushes: d.flushes.size,
        embryosRecovered: flushEvents.filter((f) => d.flushes.has(f.id)).reduce((s, f) => s + (f.embryosRecovered ?? 0), 0),
        embryosViable: flushEvents.filter((f) => d.flushes.has(f.id)).reduce((s, f) => s + (f.embryosViable ?? 0), 0),
        offspringProduced: d.plans.reduce((s, p) => s + (birthStatuses.includes(p.status) ? (p.countLive ?? 0) : 0), 0),
        successRate: d.plans.length > 0 ? Math.round((d.plans.filter((p) => pregnantStatuses.includes(p.status)).length / d.plans.length) * 1000) / 10 : 0,
      }));

      // Per-recipient breakdown
      const recipientMap = new Map<number, { name: string; plans: typeof etPlans }>();
      for (const p of etPlans) {
        if (!p.recipientDamId) continue;
        if (!recipientMap.has(p.recipientDamId)) {
          recipientMap.set(p.recipientDamId, {
            name: p.Animal_BreedingPlan_recipientDamIdToAnimal?.name ?? "Unknown",
            plans: [],
          });
        }
        recipientMap.get(p.recipientDamId)!.plans.push(p);
      }

      const recipientStats = Array.from(recipientMap.entries()).map(([animalId, r]) => ({
        animalId,
        name: r.name,
        totalTransfers: r.plans.length,
        pregnanciesConfirmed: r.plans.filter((p) => pregnantStatuses.includes(p.status)).length,
        offspringBorn: r.plans.reduce((s, p) => s + (birthStatuses.includes(p.status) ? (p.countLive ?? 0) : 0), 0),
        successRate: r.plans.length > 0 ? Math.round((r.plans.filter((p) => pregnantStatuses.includes(p.status)).length / r.plans.length) * 1000) / 10 : 0,
      }));

      // Monthly trend
      const monthMap = new Map<string, { flushes: number; transfers: number; pregnancies: number; births: number }>();
      for (const f of flushEvents) {
        const month = f.flushDate.toISOString().slice(0, 7);
        if (!monthMap.has(month)) monthMap.set(month, { flushes: 0, transfers: 0, pregnancies: 0, births: 0 });
        monthMap.get(month)!.flushes++;
      }
      for (const p of etPlans) {
        const month = p.createdAt.toISOString().slice(0, 7);
        if (!monthMap.has(month)) monthMap.set(month, { flushes: 0, transfers: 0, pregnancies: 0, births: 0 });
        const m = monthMap.get(month)!;
        m.transfers++;
        if (pregnantStatuses.includes(p.status)) m.pregnancies++;
        if (birthStatuses.includes(p.status)) m.births += (p.countLive ?? 0);
      }

      const monthlyTrend = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, ...data }));

      return reply.send({
        totalFlushes,
        totalEmbryosRecovered,
        totalEmbryosTransferred,
        totalPregnanciesConfirmed,
        totalOffspringBorn,
        overallSuccessRate,
        freshVsFrozenSuccess,
        donorStats,
        recipientStats,
        monthlyTrend,
      });
    } catch (err: any) {
      console.error("[et-analytics] error:", err);
      return reply.code(500).send({ error: { code: "internal", message: err.message } });
    }
  });
};

export default flushEventsRoutes;
