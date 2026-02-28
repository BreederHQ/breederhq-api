// src/routes/rearing-assessments.ts
// Rearing Protocols API - Assessments (Volhard PAT and custom)
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "25", 10) || 25));
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
  console.error("[rearing-assessments]", msg);
  return { status: 500, payload: { error: "internal_error", message: msg } };
}

// Volhard PAT score fields
const VOLHARD_FIELDS = [
  "socialAttraction",
  "following",
  "restraint",
  "socialDominance",
  "elevationDominance",
  "retrieving",
  "touchSensitivity",
  "soundSensitivity",
  "sightSensitivity",
  "stability",
];

function validateVolhardScores(scores: Record<string, any>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of VOLHARD_FIELDS) {
    const val = scores[field];
    if (val === undefined || val === null) {
      errors.push(`Missing field: ${field}`);
    } else if (typeof val !== "number" || val < 1 || val > 6) {
      errors.push(`${field} must be a number between 1 and 6`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/* ───────────────────────── routes ───────────────────────── */

const rearingAssessmentsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-assignments/:id/assessments - List for assignment
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-assignments/:id/assessments", async (req, reply) => {
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

      const results = await prisma.assessmentResult.findMany({
        where: { assignmentId, tenantId },
        orderBy: { assessedAt: "desc" },
        include: {
          offspring: {
            select: { id: true, name: true },
          },
        },
      });

      return reply.send({ results });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /offspring/:id/assessments - List for offspring
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/offspring/:id/assessments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const offspringId = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!offspringId) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Verify offspring belongs to tenant
      const offspring = await prisma.offspring.findFirst({
        where: { id: offspringId, tenantId },
      });

      if (!offspring) {
        return reply.code(404).send({ error: "offspring_not_found" });
      }

      const results = await prisma.assessmentResult.findMany({
        where: { offspringId, tenantId },
        orderBy: { assessedAt: "desc" },
        include: {
          assignment: {
            select: {
              id: true,
              protocol: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      return reply.send({ results });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-assessments/:id - Get single assessment
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-assessments/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const result = await prisma.assessmentResult.findFirst({
        where: { id, tenantId },
        include: {
          offspring: {
            select: { id: true, name: true },
          },
          assignment: {
            select: {
              id: true,
              protocol: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      if (!result) {
        return reply.code(404).send({ error: "not_found" });
      }

      return reply.send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-assignments/:id/assessments - Record assessment
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-assignments/:id/assessments", async (req, reply) => {
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
      const offspringId = idNum(body.offspringId);
      const assessmentType = body.assessmentType || "VOLHARD_PAT";
      const scores = body.scores;

      if (!offspringId) {
        return reply.code(400).send({ error: "offspring_id_required" });
      }
      if (!scores || typeof scores !== "object") {
        return reply.code(400).send({ error: "scores_required" });
      }

      // Validate Volhard scores if applicable
      if (assessmentType === "VOLHARD_PAT") {
        const validation = validateVolhardScores(scores);
        if (!validation.valid) {
          return reply.code(400).send({
            error: "invalid_volhard_scores",
            details: validation.errors,
          });
        }
      }

      // Verify assignment belongs to tenant
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: { id: assignmentId, tenantId },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "assignment_not_found" });
      }

      // Verify offspring belongs to the assignment's breeding plan
      const offspring = await prisma.offspring.findFirst({
        where: { id: offspringId, breedingPlanId: assignment.breedingPlanId ?? undefined, tenantId },
      });

      if (!offspring) {
        return reply.code(404).send({ error: "offspring_not_found" });
      }

      const result = await prisma.assessmentResult.create({
        data: {
          tenantId,
          assignmentId,
          offspringId,
          assessmentType: assessmentType as any,
          scores,
          notes: trimToNull(body.notes),
          assessedAt: body.assessedAt ? new Date(body.assessedAt) : new Date(),
          assessedBy: userId,
        },
        include: {
          offspring: {
            select: { id: true, name: true },
          },
        },
      });

      return reply.code(201).send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PUT /rearing-assessments/:id - Update assessment
  // ─────────────────────────────────────────────────────────────────────────────
  app.put("/rearing-assessments/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const body = req.body as any;

      // Verify ownership
      const existing = await prisma.assessmentResult.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Validate Volhard scores if updating them
      if (body.scores && existing.assessmentType === "VOLHARD_PAT") {
        const validation = validateVolhardScores(body.scores);
        if (!validation.valid) {
          return reply.code(400).send({
            error: "invalid_volhard_scores",
            details: validation.errors,
          });
        }
      }

      // tenant-verified above via findFirst({ where: { id, tenantId } })
      const result = await prisma.assessmentResult.update({
        where: { id },
        data: {
          scores: body.scores ?? existing.scores,
          notes: body.notes !== undefined ? trimToNull(body.notes) : existing.notes,
          assessedAt: body.assessedAt ? new Date(body.assessedAt) : existing.assessedAt,
        },
        include: {
          offspring: {
            select: { id: true, name: true },
          },
        },
      });

      return reply.send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /rearing-assessments/:id - Delete assessment
  // ─────────────────────────────────────────────────────────────────────────────
  app.delete("/rearing-assessments/:id", async (req, reply) => {
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
      const existing = await prisma.assessmentResult.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      await prisma.assessmentResult.deleteMany({
        where: { id, tenantId },
      });

      return reply.send({ success: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });
};

export default rearingAssessmentsRoutes;
