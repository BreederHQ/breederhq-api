// src/routes/expenses.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import {
  validateExpenseAnchors,
  type ExpenseAnchors,
} from "../services/finance/anchor-validator.js";

/* ───────────────────────── helpers ───────────────────────── */

function parseIntOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseFloatOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(200, Math.max(1, Number(q?.limit ?? 50) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function errorReply(err: unknown) {
  const any = err as any;
  const code = any?.code;
  if (code === "P2002") {
    return { status: 409, payload: { error: "duplicate", detail: any?.meta?.target } };
  }
  if (code === "P2025") {
    return { status: 404, payload: { error: "not_found" } };
  }
  return { status: 500, payload: { error: "internal_error", detail: any?.message } };
}

function expenseDTO(e: any) {
  return {
    id: e.id,
    tenantId: e.tenantId,
    amountCents: e.amountCents,
    currency: e.currency,
    incurredAt: e.incurredAt,
    category: e.category,
    description: e.description,
    vendorPartyId: e.vendorPartyId,
    breedingPlanId: e.breedingPlanId,
    animalId: e.animalId,
    foodProductId: e.foodProductId,
    quantityValue: e.quantityValue,
    quantityUnit: e.quantityUnit,
    notes: e.notes,
    data: e.data,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

/* ───────────────────────── routes ───────────────────────── */

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /expenses - Create expense
  app.post("/expenses", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = req.body as any;

      // Validate anchors (optional for expenses, but if provided must be only one)
      const anchors: ExpenseAnchors = {
        breedingPlanId: parseIntOrNull(body.breedingPlanId),
        animalId: parseIntOrNull(body.animalId),
      };
      validateExpenseAnchors(anchors);

      const amountCents = Number(body.amountCents);
      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return reply.code(400).send({ error: "invalid_amountCents" });
      }

      if (!body.category) {
        return reply.code(400).send({ error: "category_required" });
      }

      const incurredAt = body.incurredAt ? new Date(body.incurredAt) : new Date();

      // Validate quantityUnit if provided
      const validUnits = ["OZ", "LB", "G", "KG"];
      const quantityUnit = body.quantityUnit && validUnits.includes(body.quantityUnit.toUpperCase())
        ? body.quantityUnit.toUpperCase()
        : null;

      const expense = await prisma.expense.create({
        data: {
          tenantId,
          amountCents,
          currency: body.currency || "USD",
          incurredAt,
          category: body.category,
          description: body.description || null,
          vendorPartyId: parseIntOrNull(body.vendorPartyId),
          breedingPlanId: anchors.breedingPlanId,
          animalId: anchors.animalId,
          foodProductId: parseIntOrNull(body.foodProductId),
          quantityValue: parseFloatOrNull(body.quantityValue),
          quantityUnit,
          notes: body.notes || null,
          data: body.data || null,
        },
      });

      return reply.code(201).send(expenseDTO(expense));
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /expenses - List expenses with filters
  app.get("/expenses", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as any;
      const { page, limit, skip } = parsePaging(query);

      const where: any = { tenantId };

      // Text search on vendor name and description
      if (query.q) {
        where.OR = [
          { description: { contains: String(query.q), mode: "insensitive" } },
          { notes: { contains: String(query.q), mode: "insensitive" } },
        ];
      }

      if (query.category) where.category = query.category;
      if (query.vendorPartyId) where.vendorPartyId = parseIntOrNull(query.vendorPartyId);
      if (query.breedingPlanId) where.breedingPlanId = parseIntOrNull(query.breedingPlanId);
      if (query.animalId) where.animalId = parseIntOrNull(query.animalId);

      // Anchored/unanchored filters
      if (query.anchoredOnly === "true" || query.anchoredOnly === "1") {
        where.OR = [
          { breedingPlanId: { not: null } },
          { animalId: { not: null } },
        ];
      }
      if (query.unanchoredOnly === "true" || query.unanchoredOnly === "1") {
        where.breedingPlanId = null;
        where.animalId = null;
      }

      // Incurred date range
      if (query.incurredFrom || query.incurredTo) {
        where.incurredAt = {};
        if (query.incurredFrom) where.incurredAt.gte = new Date(query.incurredFrom);
        if (query.incurredTo) where.incurredAt.lte = new Date(query.incurredTo);
      }

      // Sorting
      const allowedSortFields = ["incurredAt", "createdAt", "amountCents", "category"];
      const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : "incurredAt";
      const sortDir = query.sortDir === "asc" ? "asc" : "desc";

      const [data, total] = await Promise.all([
        prisma.expense.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortDir },
        }),
        prisma.expense.count({ where }),
      ]);

      return reply.code(200).send({
        items: data.map(expenseDTO),
        total,
      });
    } catch (err) {
      console.error("[expenses GET] Error:", err);
      const { status, payload} = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /expenses/:id - Get single expense
  app.get("/expenses/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const expense = await prisma.expense.findFirst({
        where: { id, tenantId },
      });

      if (!expense) return reply.code(404).send({ error: "not_found" });

      return reply.code(200).send(expenseDTO(expense));
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // PATCH /expenses/:id - Update expense
  app.patch("/expenses/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const body = req.body as any;
      const updates: any = {};

      if (body.amountCents !== undefined) updates.amountCents = Number(body.amountCents);
      if (body.incurredAt !== undefined) updates.incurredAt = new Date(body.incurredAt);
      if (body.category !== undefined) updates.category = body.category;
      if (body.description !== undefined) updates.description = body.description;
      if (body.notes !== undefined) updates.notes = body.notes;
      if (body.foodProductId !== undefined) updates.foodProductId = parseIntOrNull(body.foodProductId);
      if (body.quantityValue !== undefined) updates.quantityValue = parseFloatOrNull(body.quantityValue);
      if (body.quantityUnit !== undefined) {
        const validUnits = ["OZ", "LB", "G", "KG"];
        updates.quantityUnit = body.quantityUnit && validUnits.includes(body.quantityUnit.toUpperCase())
          ? body.quantityUnit.toUpperCase()
          : null;
      }

      const expense = await prisma.expense.updateMany({
        where: { id, tenantId },
        data: updates,
      });

      if (expense.count === 0) return reply.code(404).send({ error: "not_found" });

      const updated = await prisma.expense.findFirst({ where: { id, tenantId } });
      return reply.code(200).send(expenseDTO(updated));
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // DELETE /expenses/:id - Delete expense
  app.delete("/expenses/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const deleted = await prisma.expense.deleteMany({
        where: { id, tenantId },
      });

      if (deleted.count === 0) return reply.code(404).send({ error: "not_found" });

      return reply.code(204).send();
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // POST /expenses/:id/attachments - Create receipt attachment
  app.post("/expenses/:id/attachments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const expense = await prisma.expense.findFirst({ where: { id, tenantId } });
      if (!expense) return reply.code(404).send({ error: "expense_not_found" });

      const b = req.body as any;
      const required = ["kind", "storageProvider", "storageKey", "filename", "mime", "bytes"];
      for (const k of required) {
        if (!(k in b)) return reply.code(400).send({ error: `missing_field_${k}` });
      }

      const created = await prisma.attachment.create({
        data: {
          tenantId,
          expenseId: id,
          kind: b.kind,
          storageProvider: b.storageProvider,
          storageKey: b.storageKey,
          filename: b.filename,
          mime: b.mime,
          bytes: Number(b.bytes) || 0,
          createdByUserId: b.createdByUserId ?? null,
        },
      });

      return reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /expenses/:id/attachments - List receipt attachments
  app.get("/expenses/:id/attachments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const expense = await prisma.expense.findFirst({ where: { id, tenantId } });
      if (!expense) return reply.code(404).send({ error: "expense_not_found" });

      const attachments = await prisma.attachment.findMany({
        where: { expenseId: id, tenantId },
        orderBy: { createdAt: "desc" },
      });

      return reply.code(200).send(attachments);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // DELETE /expenses/:id/attachments/:aid - Delete receipt attachment
  app.delete("/expenses/:id/attachments/:aid", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      const aid = parseIntOrNull((req.params as any).aid);
      if (!id || !aid) return reply.code(400).send({ error: "invalid_id" });

      const attachment = await prisma.attachment.findFirst({ where: { id: aid, tenantId } });
      if (!attachment) return reply.code(404).send({ error: "attachment_not_found" });
      if (attachment.expenseId !== id) {
        return reply.code(409).send({ error: "attachment_does_not_belong_to_expense" });
      }

      // Tenant-isolated delete: use deleteMany with tenantId
      await prisma.attachment.deleteMany({ where: { id: aid, tenantId } });
      return reply.send({ ok: true, deleted: aid });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });
};

export default routes;
