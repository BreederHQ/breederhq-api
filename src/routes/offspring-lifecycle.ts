// src/routes/offspring-lifecycle.ts
/**
 * Offspring Group Lifecycle Endpoints
 *
 * POST /offspring/:groupId/advance-status
 * POST /offspring/:groupId/rewind-status
 * PATCH /offspring/:groupId/dates
 * GET   /offspring/:groupId/milestones
 * POST  /offspring/:groupId/batch-weights
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { logEntityActivity } from "../services/activity-log.js";
import {
  advanceGroupStatus,
  rewindGroupStatus,
  dissolveGroup,
  autoAdvanceIfReady,
  LifecycleError,
} from "../services/offspring-group-lifecycle-service.js";

function getTenantId(req: any): number | null {
  const raw =
    req.headers?.["x-tenant-id"] ??
    req.headers?.["X-Tenant-Id"] ??
    null;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function idNum(raw: any): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function lifecycleErrorReply(err: unknown): { status: number; payload: any } {
  if (err instanceof LifecycleError) {
    const statusMap: Record<string, number> = {
      GROUP_NOT_FOUND: 404,
      CANNOT_ADVANCE_DISSOLVED: 409,
      ALREADY_COMPLETE: 409,
      INVALID_STATUS: 400,
      NO_NEXT_STATUS: 400,
      INVALID_TARGET: 400,
      BIRTH_DATE_REQUIRED: 400,
      NO_LIVE_OFFSPRING: 400,
      WEANED_DATE_REQUIRED: 400,
      PLACEMENT_START_REQUIRED: 400,
      OFFSPRING_NOT_PLACED: 409,
      INVALID_TRANSITION: 400,
      CANNOT_REWIND_PENDING: 400,
      CANNOT_REWIND_DISSOLVED: 409,
      CANNOT_REWIND: 400,
      LIVE_OFFSPRING_EXIST: 409,
    };
    return {
      status: statusMap[err.code] ?? 400,
      payload: { error: err.code, detail: err.message },
    };
  }

  const msg = err instanceof Error ? err.message : "Internal error";
  return { status: 500, payload: { error: "internal_error", detail: msg } };
}

const offspringLifecycleRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Inject tenant
  app.addHook("preHandler", async (req, reply) => {
    const tid = getTenantId(req);
    if (!tid) return reply.code(400).send({ error: "missing x-tenant-id" });
    (req as any).tenantId = tid;
  });

  // ─── POST /offspring/:groupId/advance-status ─────────────────────────────

  app.post("/offspring/:groupId/advance-status", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId as number;
      const groupId = idNum((req.params as any).groupId);
      if (!groupId) return reply.code(400).send({ error: "bad_id" });

      const body = (req.body || {}) as { targetStatus?: string };
      const targetStatus = body.targetStatus?.toUpperCase() as any;

      const updated = await advanceGroupStatus(prisma, groupId, tenantId, targetStatus || undefined);

      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: groupId,
        kind: "lifecycle_advanced",
        category: "status",
        title: `Lifecycle advanced to ${updated.lifecycleStatus}`,
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(updated);
    } catch (err) {
      const { status, payload } = lifecycleErrorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ─── POST /offspring/:groupId/rewind-status ──────────────────────────────

  app.post("/offspring/:groupId/rewind-status", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId as number;
      const groupId = idNum((req.params as any).groupId);
      if (!groupId) return reply.code(400).send({ error: "bad_id" });

      const updated = await rewindGroupStatus(prisma, groupId, tenantId);

      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: groupId,
        kind: "lifecycle_rewound",
        category: "status",
        title: `Lifecycle rewound to ${updated.lifecycleStatus}`,
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(updated);
    } catch (err) {
      const { status, payload } = lifecycleErrorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ─── PATCH /offspring/:groupId/dates ─────────────────────────────────────

  app.patch("/offspring/:groupId/dates", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId as number;
      const groupId = idNum((req.params as any).groupId);
      if (!groupId) return reply.code(400).send({ error: "bad_id" });

      const body = (req.body || {}) as {
        actualBirthOn?: string | null;
        weanedAt?: string | null;
        placementStartAt?: string | null;
        placementCompletedAt?: string | null;
        completedAt?: string | null;
        expectedWeanedAt?: string | null;
        expectedPlacementStartAt?: string | null;
        expectedPlacementCompletedAt?: string | null;
      };

      // Validate group exists
      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId, deletedAt: null },
      });
      if (!group) return reply.code(404).send({ error: "not_found" });

      // Build data patch (only include provided fields)
      const patch: Record<string, Date | null> = {};
      const dateFields = [
        "actualBirthOn",
        "weanedAt",
        "placementStartAt",
        "placementCompletedAt",
        "completedAt",
        "expectedWeanedAt",
        "expectedPlacementStartAt",
        "expectedPlacementCompletedAt",
      ] as const;

      for (const field of dateFields) {
        if (field in body) {
          const val = body[field];
          if (val === null || val === undefined) {
            patch[field] = null;
          } else {
            const d = new Date(val);
            if (Number.isNaN(d.getTime())) {
              return reply.code(400).send({ error: "invalid_date", field });
            }
            patch[field] = d;
          }
        }
      }

      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: "no_fields", detail: "No date fields provided" });
      }

      // Apply update and auto-advance in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.offspringGroup.update({
          where: { id: groupId },
          data: patch,
        });

        // Try to auto-advance if a date gate is now satisfied
        const advancedTo = await autoAdvanceIfReady(tx, groupId, tenantId);

        if (advancedTo) {
          // Re-fetch after auto-advance
          return tx.offspringGroup.findUniqueOrThrow({ where: { id: groupId } });
        }

        return updated;
      });

      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: groupId,
        kind: "dates_updated",
        category: "system",
        title: "Offspring group dates updated",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Internal error";
      reply.status(500).send({ error: "internal_error", detail: msg });
    }
  });

  // ─── GET /offspring/:groupId/milestones ──────────────────────────────────

  app.get("/offspring/:groupId/milestones", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId as number;
      const groupId = idNum((req.params as any).groupId);
      if (!groupId) return reply.code(400).send({ error: "bad_id" });

      // Validate group exists
      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!group) return reply.code(404).send({ error: "not_found" });

      const milestones = await prisma.breedingMilestone.findMany({
        where: { offspringGroupId: groupId, tenantId },
        orderBy: { scheduledDate: "asc" },
      });

      reply.send(milestones);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Internal error";
      reply.status(500).send({ error: "internal_error", detail: msg });
    }
  });

  // ─── POST /offspring/:groupId/batch-weights ──────────────────────────────

  app.post("/offspring/:groupId/batch-weights", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId as number;
      const groupId = idNum((req.params as any).groupId);
      if (!groupId) return reply.code(400).send({ error: "bad_id" });

      const body = (req.body || {}) as {
        weights: Array<{
          offspringId: number;
          weightGrams: number;
          recordedAt?: string;
        }>;
      };

      if (!Array.isArray(body.weights) || body.weights.length === 0) {
        return reply.code(400).send({ error: "weights_required", detail: "Must provide at least one weight entry" });
      }

      // Validate group exists
      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!group) return reply.code(404).send({ error: "not_found" });

      // Validate all offspring belong to this group
      const offspringIds = body.weights.map((w) => w.offspringId);
      const offspring = await prisma.offspring.findMany({
        where: { id: { in: offspringIds }, groupId, tenantId },
        select: { id: true },
      });
      const validIds = new Set(offspring.map((o) => o.id));
      const invalidIds = offspringIds.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        return reply.code(400).send({
          error: "invalid_offspring",
          detail: `Offspring IDs not found in this group: ${invalidIds.join(", ")}`,
        });
      }

      // Create weight records as HealthEvent entries (kind = 'weight')
      const userId = String((req as any).userId ?? (req as any).user?.id ?? "unknown");
      const created = await prisma.$transaction(async (tx) => {
        return Promise.all(
          body.weights.map((w) =>
            tx.healthEvent.create({
              data: {
                tenantId,
                offspringId: w.offspringId,
                kind: "weight",
                occurredAt: w.recordedAt ? new Date(w.recordedAt) : new Date(),
                weightGrams: w.weightGrams,
                recordedByUserId: userId,
              },
            }),
          ),
        );
      });

      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: groupId,
        kind: "batch_weights_recorded",
        category: "system",
        title: `${created.length} weight records added`,
        actorId: userId,
        actorName: (req as any).userName,
      });

      reply.send({ ok: true, count: created.length, records: created });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Internal error";
      reply.status(500).send({ error: "internal_error", detail: msg });
    }
  });

  // ─── POST /offspring/:groupId/dissolve ───────────────────────────────────

  app.post("/offspring/:groupId/dissolve", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId as number;
      const groupId = idNum((req.params as any).groupId);
      if (!groupId) return reply.code(400).send({ error: "bad_id" });

      const updated = await dissolveGroup(prisma, groupId, tenantId);

      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: groupId,
        kind: "lifecycle_dissolved",
        category: "status",
        title: "Group dissolved — all offspring deceased",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(updated);
    } catch (err) {
      const { status, payload } = lifecycleErrorReply(err);
      reply.status(status).send(payload);
    }
  });
};

export default offspringLifecycleRoutes;
