// src/routes/rearing-exceptions.ts
// Rearing Protocols API - Per-offspring exceptions
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

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
  console.error("[rearing-exceptions]", msg);
  return { status: 500, payload: { error: "internal_error", message: msg } };
}

/* ───────────────────────── routes ───────────────────────── */

const rearingExceptionsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-assignments/:id/exceptions - List exceptions for assignment
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-assignments/:id/exceptions", async (req, reply) => {
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

      const exceptions = await prisma.offspringProtocolException.findMany({
        where: { assignmentId, tenantId },
        orderBy: { createdAt: "desc" },
        include: {
          offspring: {
            select: { id: true, name: true },
          },
        },
      });

      return reply.send({ exceptions });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-assignments/:id/exceptions - Create exception
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-assignments/:id/exceptions", async (req, reply) => {
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
      const activityId = trimToNull(body.activityId);
      const exceptionType = body.exceptionType;
      const reason = trimToNull(body.reason);

      if (!offspringId) {
        return reply.code(400).send({ error: "offspring_id_required" });
      }
      if (!activityId) {
        return reply.code(400).send({ error: "activity_id_required" });
      }
      if (!exceptionType) {
        return reply.code(400).send({ error: "exception_type_required" });
      }
      if (!reason) {
        return reply.code(400).send({ error: "reason_required" });
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

      const exception = await prisma.offspringProtocolException.create({
        data: {
          tenantId,
          assignmentId,
          offspringId,
          activityId,
          checklistItemKey: trimToNull(body.checklistItemKey),
          exceptionType: exceptionType as any,
          reason,
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
          createdBy: userId,
        },
        include: {
          offspring: {
            select: { id: true, name: true },
          },
        },
      });

      return reply.code(201).send(exception);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PUT /rearing-exceptions/:id - Update exception
  // ─────────────────────────────────────────────────────────────────────────────
  app.put("/rearing-exceptions/:id", async (req, reply) => {
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
      const existing = await prisma.offspringProtocolException.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      const exception = await prisma.offspringProtocolException.update({
        where: { id },
        data: {
          exceptionType: body.exceptionType ?? existing.exceptionType,
          reason: trimToNull(body.reason) ?? existing.reason,
          startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : existing.startDate,
          endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : existing.endDate,
        },
        include: {
          offspring: {
            select: { id: true, name: true },
          },
        },
      });

      return reply.send(exception);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /rearing-exceptions/:id - Delete exception
  // ─────────────────────────────────────────────────────────────────────────────
  app.delete("/rearing-exceptions/:id", async (req, reply) => {
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
      const existing = await prisma.offspringProtocolException.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      await prisma.offspringProtocolException.delete({
        where: { id },
      });

      return reply.send({ success: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });
};

export default rearingExceptionsRoutes;
