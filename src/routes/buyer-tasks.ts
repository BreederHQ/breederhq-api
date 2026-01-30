// src/routes/buyer-tasks.ts
// Buyer CRM task management routes (P5)
//
// All routes are prefixed with /api/v1/buyer-tasks
// GET    /api/v1/buyer-tasks              - List tasks with filters
// POST   /api/v1/buyer-tasks              - Create task
// GET    /api/v1/buyer-tasks/:id          - Get task details
// PATCH  /api/v1/buyer-tasks/:id          - Update task
// DELETE /api/v1/buyer-tasks/:id          - Delete task
// POST   /api/v1/buyer-tasks/:id/complete - Mark task complete
//
// Buyer-specific routes (nested under buyers)
// GET    /api/v1/buyers/:buyerId/tasks    - Get tasks for a buyer
//
// Dashboard routes
// GET    /api/v1/buyer-tasks/overdue      - Get overdue tasks
// GET    /api/v1/buyer-tasks/upcoming     - Get tasks due soon

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import type { BuyerTaskType, BuyerTaskPriority, BuyerTaskStatus } from "@prisma/client";
import { getOverdueTasks, getUpcomingTasks } from "../services/buyer-automation-service.js";

// ───────────────────────── Helpers ─────────────────────────

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function trimToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function parsePaging(q: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(q?.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(q?.limit ?? "50"), 10) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// Valid enum values
const TASK_TYPES: BuyerTaskType[] = [
  "FOLLOW_UP",
  "CALL",
  "EMAIL",
  "SCHEDULE_VIEWING",
  "SEND_INFO",
  "VET_CHECK",
  "CONTRACT",
  "PAYMENT",
  "OTHER",
];

const TASK_PRIORITIES: BuyerTaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const TASK_STATUSES: BuyerTaskStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "DEFERRED",
];

function isValidTaskType(v: unknown): v is BuyerTaskType {
  return typeof v === "string" && TASK_TYPES.includes(v as BuyerTaskType);
}

function isValidPriority(v: unknown): v is BuyerTaskPriority {
  return typeof v === "string" && TASK_PRIORITIES.includes(v as BuyerTaskPriority);
}

function isValidStatus(v: unknown): v is BuyerTaskStatus {
  return typeof v === "string" && TASK_STATUSES.includes(v as BuyerTaskStatus);
}

// ───────────────────────── Routes ─────────────────────────

const buyerTasksRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────
  // LIST TASKS
  // ─────────────────────────────────────────────────────────

  // GET /buyer-tasks - List all tasks
  app.get("/buyer-tasks", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(query);

      // Filters
      const status = query.status as string | undefined;
      const priority = query.priority as string | undefined;
      const taskType = query.taskType as string | undefined;
      const buyerId = toNum(query.buyerId);
      const dealId = toNum(query.dealId);
      const assignedToUserId = trimToNull(query.assignedToUserId);
      const overdueOnly = query.overdueOnly === "true";
      const includeCompleted = query.includeCompleted === "true";

      const where: any = { tenantId };

      if (status && isValidStatus(status)) {
        where.status = status;
      } else if (!includeCompleted) {
        where.status = { in: ["PENDING", "IN_PROGRESS"] };
      }

      if (priority && isValidPriority(priority)) {
        where.priority = priority;
      }

      if (taskType && isValidTaskType(taskType)) {
        where.taskType = taskType;
      }

      if (buyerId) where.buyerId = buyerId;
      if (dealId) where.dealId = dealId;
      if (assignedToUserId) where.assignedToUserId = assignedToUserId;

      if (overdueOnly) {
        where.dueAt = { lt: new Date() };
        where.status = { in: ["PENDING", "IN_PROGRESS"] };
      }

      const [tasks, total] = await Promise.all([
        prisma.buyerTask.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ dueAt: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
          include: {
            buyer: {
              include: {
                party: { select: { name: true, email: true } },
              },
            },
            deal: { select: { id: true, name: true, stage: true } },
            animal: { select: { id: true, name: true } },
            assignedToUser: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        prisma.buyerTask.count({ where }),
      ]);

      return reply.send({ items: tasks, total, page, limit });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to list buyer tasks");
      return reply.code(500).send({ error: "list_tasks_failed" });
    }
  });

  // GET /buyer-tasks/overdue - Get overdue tasks
  app.get("/buyer-tasks/overdue", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const tasks = await getOverdueTasks(tenantId);

      return reply.send({ items: tasks, total: tasks.length });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get overdue tasks");
      return reply.code(500).send({ error: "get_overdue_failed" });
    }
  });

  // GET /buyer-tasks/upcoming - Get upcoming tasks
  app.get("/buyer-tasks/upcoming", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as Record<string, unknown>;
      const daysAhead = Math.min(14, Math.max(1, parseInt(String(query.days ?? "2"), 10) || 2));

      const tasks = await getUpcomingTasks(tenantId, daysAhead);

      return reply.send({ items: tasks, total: tasks.length });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get upcoming tasks");
      return reply.code(500).send({ error: "get_upcoming_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // CREATE TASK
  // ─────────────────────────────────────────────────────────

  // POST /buyer-tasks - Create task
  app.post("/buyer-tasks", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = req.body as Record<string, unknown>;
      const title = trimToNull(body.title);
      if (!title) return reply.code(400).send({ error: "title_required" });

      const description = trimToNull(body.description);
      const taskType = body.taskType as string | undefined;
      const priority = body.priority as string | undefined;
      const buyerId = toNum(body.buyerId);
      const dealId = toNum(body.dealId);
      const animalId = toNum(body.animalId);
      const assignedToUserId = trimToNull(body.assignedToUserId);
      const dueAt = body.dueAt ? new Date(body.dueAt as string) : null;
      const reminderAt = body.reminderAt ? new Date(body.reminderAt as string) : null;

      // Must have at least buyerId or dealId
      if (!buyerId && !dealId) {
        return reply.code(400).send({ error: "buyer_or_deal_required" });
      }

      // Validate buyer if provided
      if (buyerId) {
        const buyer = await prisma.buyer.findFirst({
          where: { id: buyerId, tenantId },
        });
        if (!buyer) return reply.code(404).send({ error: "buyer_not_found" });
      }

      // Validate deal if provided
      if (dealId) {
        const deal = await prisma.deal.findFirst({
          where: { id: dealId, tenantId },
        });
        if (!deal) return reply.code(404).send({ error: "deal_not_found" });
      }

      // Validate animal if provided
      if (animalId) {
        const animal = await prisma.animal.findFirst({
          where: { id: animalId, tenantId },
        });
        if (!animal) return reply.code(404).send({ error: "animal_not_found" });
      }

      const task = await prisma.buyerTask.create({
        data: {
          tenantId,
          title,
          description,
          taskType: taskType && isValidTaskType(taskType) ? taskType : "FOLLOW_UP",
          priority: priority && isValidPriority(priority) ? priority : "MEDIUM",
          status: "PENDING",
          buyerId,
          dealId,
          animalId,
          assignedToUserId,
          dueAt,
          reminderAt,
        },
        include: {
          buyer: {
            include: {
              party: { select: { name: true } },
            },
          },
          deal: { select: { id: true, name: true } },
          animal: { select: { id: true, name: true } },
          assignedToUser: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return reply.code(201).send({ task });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to create buyer task");
      return reply.code(500).send({ error: "create_task_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // GET SINGLE TASK
  // ─────────────────────────────────────────────────────────

  // GET /buyer-tasks/:id - Get task details
  app.get("/buyer-tasks/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const taskId = toNum((req.params as any).id);
      if (!taskId) return reply.code(400).send({ error: "invalid_task_id" });

      const task = await prisma.buyerTask.findFirst({
        where: { id: taskId, tenantId },
        include: {
          buyer: {
            include: {
              party: { select: { name: true, email: true } },
            },
          },
          deal: { select: { id: true, name: true, stage: true } },
          animal: { select: { id: true, name: true } },
          assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          completedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (!task) {
        return reply.code(404).send({ error: "task_not_found" });
      }

      return reply.send({ task });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get buyer task");
      return reply.code(500).send({ error: "get_task_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // UPDATE TASK
  // ─────────────────────────────────────────────────────────

  // PATCH /buyer-tasks/:id - Update task
  app.patch("/buyer-tasks/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const taskId = toNum((req.params as any).id);
      if (!taskId) return reply.code(400).send({ error: "invalid_task_id" });

      // Verify task exists
      const existing = await prisma.buyerTask.findFirst({
        where: { id: taskId, tenantId },
      });
      if (!existing) {
        return reply.code(404).send({ error: "task_not_found" });
      }

      const body = req.body as Record<string, unknown>;
      const updates: any = {};

      if ("title" in body) {
        const title = trimToNull(body.title);
        if (!title) return reply.code(400).send({ error: "title_cannot_be_empty" });
        updates.title = title;
      }

      if ("description" in body) updates.description = trimToNull(body.description);
      if ("taskType" in body && isValidTaskType(body.taskType)) updates.taskType = body.taskType;
      if ("priority" in body && isValidPriority(body.priority)) updates.priority = body.priority;
      if ("status" in body && isValidStatus(body.status)) updates.status = body.status;
      if ("assignedToUserId" in body) updates.assignedToUserId = trimToNull(body.assignedToUserId);
      if ("dueAt" in body) updates.dueAt = body.dueAt ? new Date(body.dueAt as string) : null;
      if ("reminderAt" in body) updates.reminderAt = body.reminderAt ? new Date(body.reminderAt as string) : null;

      // If marking as completed, set completedAt
      if (updates.status === "COMPLETED" && existing.status !== "COMPLETED") {
        updates.completedAt = new Date();
        // Get userId from request if available
        const userId = (req as any).userId;
        if (userId) updates.completedById = userId;
      }

      // If un-completing, clear completedAt
      if (updates.status && updates.status !== "COMPLETED" && existing.status === "COMPLETED") {
        updates.completedAt = null;
        updates.completedById = null;
      }

      const task = await prisma.buyerTask.update({
        where: { id: taskId },
        data: updates,
        include: {
          buyer: {
            include: {
              party: { select: { name: true } },
            },
          },
          deal: { select: { id: true, name: true } },
          animal: { select: { id: true, name: true } },
          assignedToUser: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return reply.send({ task });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to update buyer task");
      return reply.code(500).send({ error: "update_task_failed" });
    }
  });

  // POST /buyer-tasks/:id/complete - Mark task complete
  app.post("/buyer-tasks/:id/complete", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const taskId = toNum((req.params as any).id);
      if (!taskId) return reply.code(400).send({ error: "invalid_task_id" });

      const existing = await prisma.buyerTask.findFirst({
        where: { id: taskId, tenantId },
      });
      if (!existing) {
        return reply.code(404).send({ error: "task_not_found" });
      }

      if (existing.status === "COMPLETED") {
        return reply.code(400).send({ error: "task_already_completed" });
      }

      const userId = (req as any).userId;

      const task = await prisma.buyerTask.update({
        where: { id: taskId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          completedById: userId || null,
        },
        include: {
          buyer: {
            include: {
              party: { select: { name: true } },
            },
          },
        },
      });

      // Log activity if buyer is associated
      if (task.buyerId && task.buyer) {
        try {
          await prisma.partyActivity.create({
            data: {
              tenantId,
              partyId: task.buyer.partyId,
              kind: "NOTE_ADDED",
              title: `Task completed: ${task.title}`,
              metadata: { taskId: task.id, taskType: task.taskType },
            },
          });
        } catch {
          // Don't fail if activity logging fails
        }
      }

      return reply.send({ task });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to complete buyer task");
      return reply.code(500).send({ error: "complete_task_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // DELETE TASK
  // ─────────────────────────────────────────────────────────

  // DELETE /buyer-tasks/:id - Delete task
  app.delete("/buyer-tasks/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const taskId = toNum((req.params as any).id);
      if (!taskId) return reply.code(400).send({ error: "invalid_task_id" });

      const existing = await prisma.buyerTask.findFirst({
        where: { id: taskId, tenantId },
      });
      if (!existing) {
        return reply.code(404).send({ error: "task_not_found" });
      }

      await prisma.buyerTask.delete({
        where: { id: taskId },
      });

      return reply.send({ ok: true });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to delete buyer task");
      return reply.code(500).send({ error: "delete_task_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // BUYER-SPECIFIC TASK ROUTES
  // ─────────────────────────────────────────────────────────

  // GET /buyers/:buyerId/tasks - Get tasks for a specific buyer
  app.get("/buyers/:buyerId/tasks", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const buyerId = toNum((req.params as any).buyerId);
      if (!buyerId) return reply.code(400).send({ error: "invalid_buyer_id" });

      const query = req.query as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(query);
      const includeCompleted = query.includeCompleted === "true";

      // Verify buyer exists
      const buyer = await prisma.buyer.findFirst({
        where: { id: buyerId, tenantId },
      });
      if (!buyer) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      const where: any = { tenantId, buyerId };
      if (!includeCompleted) {
        where.status = { in: ["PENDING", "IN_PROGRESS"] };
      }

      const [tasks, total] = await Promise.all([
        prisma.buyerTask.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
          include: {
            deal: { select: { id: true, name: true } },
            animal: { select: { id: true, name: true } },
            assignedToUser: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        prisma.buyerTask.count({ where }),
      ]);

      return reply.send({ items: tasks, total, page, limit });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get buyer tasks");
      return reply.code(500).send({ error: "get_buyer_tasks_failed" });
    }
  });
};

export default buyerTasksRoutes;
