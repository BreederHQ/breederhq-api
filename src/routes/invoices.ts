// src/routes/invoices.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { generateInvoiceNumber } from "../services/finance/invoice-numbering.js";
import {
  checkIdempotencyKey,
  storeIdempotencyKey,
  hashRequestBody,
  IdempotencyConflictError,
} from "../services/finance/idempotency.js";
import {
  validateInvoiceAnchors,
  determineInvoiceScope,
  type InvoiceAnchors,
} from "../services/finance/anchor-validator.js";

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

function invoiceDTO(inv: any) {
  return {
    id: inv.id,
    tenantId: inv.tenantId,
    invoiceNumber: inv.invoiceNumber,
    scope: inv.scope,
    offspringId: inv.offspringId,
    offspringGroupId: inv.groupId,
    animalId: inv.animalId,
    breedingPlanId: inv.breedingPlanId,
    clientPartyId: inv.clientPartyId,
    amountCents: inv.amountCents,
    balanceCents: inv.balanceCents,
    currency: inv.currency,
    status: inv.status,
    issuedAt: inv.issuedAt,
    dueAt: inv.dueAt,
    paidAt: inv.paidAt,
    voidedAt: inv.voidedAt,
    notes: inv.notes,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}

/* ───────────────────────── routes ───────────────────────── */

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /invoices - Create invoice with idempotency
  app.post("/invoices", async (req, reply) => {
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

      // Validate anchors
      const anchors: InvoiceAnchors = {
        offspringId: parseIntOrNull(body.offspringId),
        offspringGroupId: parseIntOrNull(body.offspringGroupId),
        animalId: parseIntOrNull(body.animalId),
        breedingPlanId: parseIntOrNull(body.breedingPlanId),
        serviceCode: body.serviceCode || null,
      };
      validateInvoiceAnchors(anchors);

      const clientPartyId = parseIntOrNull(body.clientPartyId);
      if (!clientPartyId) {
        return reply.code(400).send({ error: "clientPartyId_required" });
      }

      const amountCents = Number(body.amountCents);
      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return reply.code(400).send({ error: "invalid_amountCents" });
      }

      // Generate invoice number and create in transaction
      const result = await prisma.$transaction(async (tx: any) => {
        const invoiceNumber = await generateInvoiceNumber(tx, tenantId);
        const scope = determineInvoiceScope(anchors);

        const invoice = await tx.invoice.create({
          data: {
            tenantId,
            invoiceNumber,
            scope,
            offspringId: anchors.offspringId,
            groupId: anchors.offspringGroupId,
            animalId: anchors.animalId,
            breedingPlanId: anchors.breedingPlanId,
            clientPartyId,
            amountCents,
            balanceCents: amountCents, // Initially unpaid
            currency: body.currency || "USD",
            status: "draft",
            issuedAt: body.issuedAt ? new Date(body.issuedAt) : null,
            dueAt: body.dueAt ? new Date(body.dueAt) : null,
            paymentTerms: body.paymentTerms || null,
            notes: body.notes || null,
            data: body.data || null,
          },
        });

        return invoiceDTO(invoice);
      });

      // Store idempotency key
      await storeIdempotencyKey(prisma, tenantId, idempotencyKey, requestHash, result);

      return reply.code(201).send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /invoices - List invoices with filters
  app.get("/invoices", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as any;
      const { page, limit, skip } = parsePaging(query);

      const where: any = { tenantId };

      if (query.status) where.status = query.status;
      if (query.clientPartyId) where.clientPartyId = parseIntOrNull(query.clientPartyId);
      if (query.offspringId) where.offspringId = parseIntOrNull(query.offspringId);
      if (query.offspringGroupId) where.groupId = parseIntOrNull(query.offspringGroupId);
      if (query.animalId) where.animalId = parseIntOrNull(query.animalId);
      if (query.breedingPlanId) where.breedingPlanId = parseIntOrNull(query.breedingPlanId);

      if (query.dateFrom || query.dateTo) {
        where.issuedAt = {};
        if (query.dateFrom) where.issuedAt.gte = new Date(query.dateFrom);
        if (query.dateTo) where.issuedAt.lte = new Date(query.dateTo);
      }

      const [data, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.invoice.count({ where }),
      ]);

      return reply.code(200).send({
        data: data.map(invoiceDTO),
        meta: { page, limit, total },
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /invoices/:id - Get single invoice
  app.get("/invoices/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
      });

      if (!invoice) return reply.code(404).send({ error: "not_found" });

      return reply.code(200).send(invoiceDTO(invoice));
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // PATCH /invoices/:id - Update invoice
  app.patch("/invoices/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const body = req.body as any;
      const updates: any = {};

      // Allow updating these fields
      if (body.status !== undefined) updates.status = body.status;
      if (body.issuedAt !== undefined) updates.issuedAt = new Date(body.issuedAt);
      if (body.dueAt !== undefined) updates.dueAt = new Date(body.dueAt);
      if (body.notes !== undefined) updates.notes = body.notes;

      // Never allow changing invoiceNumber or amountCents after creation

      const invoice = await prisma.invoice.updateMany({
        where: { id, tenantId },
        data: updates,
      });

      if (invoice.count === 0) return reply.code(404).send({ error: "not_found" });

      const updated = await prisma.invoice.findUnique({ where: { id } });
      return reply.code(200).send(invoiceDTO(updated));
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // PATCH /invoices/:id/void - Void invoice
  app.patch("/invoices/:id/void", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const invoice = await prisma.invoice.updateMany({
        where: { id, tenantId },
        data: {
          status: "void",
          voidedAt: new Date(),
        },
      });

      if (invoice.count === 0) return reply.code(404).send({ error: "not_found" });

      const updated = await prisma.invoice.findUnique({ where: { id } });
      return reply.code(200).send(invoiceDTO(updated));
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });
};

export default routes;
