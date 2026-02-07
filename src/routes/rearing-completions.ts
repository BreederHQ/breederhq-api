// src/routes/rearing-completions.ts
// Rearing Protocols API - Activity completions
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "50", 10) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function idNum(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function trimToNull(v: any) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function errorReply(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[rearing-completions]", msg);
  return { status: 500, payload: { error: "internal_error", message: msg } };
}

/* ───────────────────────── routes ───────────────────────── */

const rearingCompletionsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-assignments/:id/completions - List completions for assignment
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-assignments/:id/completions", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const assignmentId = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!assignmentId) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Verify assignment belongs to tenant
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: { id: assignmentId, tenantId },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "assignment_not_found" });
      }

      const q = (req.query as any) ?? {};
      const { page, limit, skip } = parsePaging(q);

      const [total, completions] = await Promise.all([
        prisma.activityCompletion.count({ where: { assignmentId, tenantId } }),
        prisma.activityCompletion.findMany({
          where: { assignmentId, tenantId },
          skip,
          take: limit,
          orderBy: { completedAt: "desc" },
          include: {
            offspring: {
              select: { id: true, name: true },
            },
          },
        }),
      ]);

      return reply.send({ completions, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-assignments/:id/completions - Record single completion
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-assignments/:id/completions", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const userId = (req as any).userId as string;
      const assignmentId = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!assignmentId) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const body = req.body as any;
      const activityId = trimToNull(body.activityId);
      const scope = body.scope || "LITTER";
      const offspringId = idNum(body.offspringId);
      const checklistItemKey = trimToNull(body.checklistItemKey);

      if (!activityId) {
        return reply.code(400).send({ error: "activity_id_required" });
      }

      // Verify assignment belongs to tenant and check disclaimer
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: { id: assignmentId, tenantId },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "assignment_not_found" });
      }

      // Check disclaimer acknowledgment
      if (!assignment.acknowledgedDisclaimer) {
        return reply.code(400).send({
          error: "disclaimer_required",
          message: "Disclaimer must be acknowledged before recording completions",
        });
      }

      // Check for duplicate completion
      const existingCompletion = await prisma.activityCompletion.findFirst({
        where: {
          assignmentId,
          activityId,
          offspringId: offspringId ?? null,
          checklistItemKey: checklistItemKey ?? null,
        },
      });

      if (existingCompletion) {
        return reply.code(409).send({ error: "already_completed" });
      }

      // Create completion and update progress
      const completion = await prisma.$transaction(async (tx) => {
        const created = await tx.activityCompletion.create({
          data: {
            tenantId,
            assignmentId,
            activityId,
            scope: scope as any,
            offspringId,
            completedBy: userId,
            checklistItemKey,
            notes: trimToNull(body.notes),
          },
          include: {
            offspring: {
              select: { id: true, name: true },
            },
          },
        });

        // Update completion count
        await tx.rearingProtocolAssignment.update({
          where: { id: assignmentId },
          data: { completedActivities: { increment: 1 } },
        });

        return created;
      });

      return reply.code(201).send(completion);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-assignments/:id/completions/batch - Batch complete checklist items
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-assignments/:id/completions/batch", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const userId = (req as any).userId as string;
      const assignmentId = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!assignmentId) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const body = req.body as any;
      const activityId = trimToNull(body.activityId);
      const completedItems = body.completedItems as string[];
      const scope = body.scope || "LITTER";
      const offspringId = idNum(body.offspringId);

      if (!activityId) {
        return reply.code(400).send({ error: "activity_id_required" });
      }
      if (!completedItems || !Array.isArray(completedItems) || completedItems.length === 0) {
        return reply.code(400).send({ error: "completed_items_required" });
      }

      // Verify assignment belongs to tenant and check disclaimer
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: { id: assignmentId, tenantId },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "assignment_not_found" });
      }

      if (!assignment.acknowledgedDisclaimer) {
        return reply.code(400).send({
          error: "disclaimer_required",
          message: "Disclaimer must be acknowledged before recording completions",
        });
      }

      // Create batch completions
      const result = await prisma.$transaction(async (tx) => {
        const created: any[] = [];

        for (const itemKey of completedItems) {
          // Check if already completed
          const existing = await tx.activityCompletion.findFirst({
            where: {
              assignmentId,
              activityId,
              offspringId: offspringId ?? null,
              checklistItemKey: itemKey,
            },
          });

          if (!existing) {
            const completion = await tx.activityCompletion.create({
              data: {
                tenantId,
                assignmentId,
                activityId,
                scope: scope as any,
                offspringId,
                completedBy: userId,
                checklistItemKey: itemKey,
              },
            });
            created.push(completion);
          }
        }

        // Update completion count
        if (created.length > 0) {
          await tx.rearingProtocolAssignment.update({
            where: { id: assignmentId },
            data: { completedActivities: { increment: created.length } },
          });
        }

        return created;
      });

      return reply.code(201).send({
        completions: result,
        created: result.length,
        skipped: completedItems.length - result.length,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /rearing-completions/:id - Remove completion
  // ─────────────────────────────────────────────────────────────────────────────
  app.delete("/rearing-completions/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Verify ownership
      const existing = await prisma.activityCompletion.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Delete and decrement count
      await prisma.$transaction(async (tx) => {
        await tx.activityCompletion.delete({
          where: { id },
        });

        await tx.rearingProtocolAssignment.update({
          where: { id: existing.assignmentId },
          data: { completedActivities: { decrement: 1 } },
        });
      });

      return reply.send({ success: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });
};

export default rearingCompletionsRoutes;
