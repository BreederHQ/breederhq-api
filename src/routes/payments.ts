// src/routes/payments.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import {
  checkIdempotencyKey,
  storeIdempotencyKey,
  hashRequestBody,
  IdempotencyConflictError,
} from "../services/finance/idempotency.js";
import { createPaymentAndRecalculate } from "../services/finance/payment-service.js";

/* ───────────────────────── helpers ───────────────────────── */

function parseIntOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(200, Math.max(1, Number(q?.limit ?? 50) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function errorReply(err: unknown) {
  const any = err as any;
  if (err instanceof IdempotencyConflictError) {
    return { status: 409, payload: { error: "idempotency_conflict", detail: any?.message } };
  }
  const code = any?.code;
  if (code === "P2002") {
    return { status: 409, payload: { error: "duplicate", detail: any?.meta?.target } };
  }
  if (code === "P2025") {
    return { status: 404, payload: { error: "not_found" } };
  }
  return { status: 500, payload: { error: "internal_error", detail: any?.message } };
}

function paymentDTO(p: any) {
  return {
    id: p.id,
    tenantId: p.tenantId,
    invoiceId: p.invoiceId,
    amountCents: p.amountCents,
    receivedAt: p.receivedAt,
    methodType: p.methodType,
    processor: p.processor,
    processorRef: p.processorRef,
    status: p.status,
    notes: p.notes,
    createdAt: p.createdAt,
  };
}

/* ───────────────────────── routes ───────────────────────── */

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /payments - Create payment with idempotency and balance recalc
  app.post("/payments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const idempotencyKey = req.headers["idempotency-key"] as string;
      if (!idempotencyKey) {
        return reply.code(400).send({ error: "missing_idempotency_key" });
      }

      const body = req.body as any;
      const requestHash = hashRequestBody(body);

      // Check idempotency
      const existing = await checkIdempotencyKey(prisma, tenantId, idempotencyKey, requestHash);
      if (existing) {
        return reply.code(200).send(existing);
      }

      const invoiceId = parseIntOrNull(body.invoiceId);
      if (!invoiceId) {
        return reply.code(400).send({ error: "invoiceId_required" });
      }

      const amountCents = Number(body.amountCents);
      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return reply.code(400).send({ error: "invalid_amountCents" });
      }

      const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();

      // Create payment and recalculate invoice in transaction
      const result = await prisma.$transaction(async (tx: any) => {
        const payment = await createPaymentAndRecalculate(tx, {
          tenantId,
          invoiceId,
          amountCents,
          receivedAt,
          methodType: body.methodType || null,
          processor: body.processor || null,
          processorRef: body.processorRef || null,
          status: body.status || "succeeded",
          notes: body.notes || null,
          data: body.data || null,
        });

        return paymentDTO(payment);
      });

      // Store idempotency key
      await storeIdempotencyKey(prisma, tenantId, idempotencyKey, requestHash, result);

      return reply.code(201).send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /payments - List payments with filters
  app.get("/payments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as any;
      const { page, limit, skip } = parsePaging(query);

      const where: any = { tenantId };

      if (query.invoiceId) where.invoiceId = parseIntOrNull(query.invoiceId);
      if (query.status) where.status = query.status;
      if (query.methodType) where.methodType = query.methodType;
      if (query.processor) where.processor = query.processor;

      // Received date range
      if (query.receivedFrom || query.receivedTo) {
        where.receivedAt = {};
        if (query.receivedFrom) where.receivedAt.gte = new Date(query.receivedFrom);
        if (query.receivedTo) where.receivedAt.lte = new Date(query.receivedTo);
      }

      // Sorting
      const allowedSortFields = ["receivedAt", "createdAt", "amountCents"];
      const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : "receivedAt";
      const sortDir = query.sortDir === "asc" ? "asc" : "desc";

      const [data, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortDir },
        }),
        prisma.payment.count({ where }),
      ]);

      return reply.code(200).send({
        items: data.map(paymentDTO),
        total,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /payments/:id - Get single payment
  app.get("/payments/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const payment = await prisma.payment.findFirst({
        where: { id, tenantId },
      });

      if (!payment) return reply.code(404).send({ error: "not_found" });

      return reply.code(200).send(paymentDTO(payment));
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });
};

export default routes;
