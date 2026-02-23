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
import { renderPaymentReceiptEmail, renderBreederPaymentNotification } from "../services/email-templates.js";
import { sendEmail } from "../services/email-service.js";

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
    amountCents: Number(p.amountCents),
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

      // Fire-and-forget: send payment notification emails
      (async () => {
        try {
          const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: {
              invoiceNumber: true,
              amountCents: true,
              balanceCents: true,
              status: true,
              clientParty: { select: { name: true, email: true } },
              tenant: {
                select: {
                  name: true,
                  primaryEmail: true,
                  slug: true,
                },
              },
            },
          });

          if (!invoice?.clientParty?.email || !invoice.tenant) return;

          const isPaid = invoice.status === "paid";

          // 1. Receipt email to buyer
          const receipt = renderPaymentReceiptEmail({
            invoiceNumber: invoice.invoiceNumber || `INV-${invoiceId}`,
            paymentAmountCents: amountCents,
            totalCents: Number(invoice.amountCents),
            remainingBalanceCents: Number(invoice.balanceCents),
            clientName: invoice.clientParty.name || "Client",
            tenantName: invoice.tenant.name || "Breeder",
            methodType: body.methodType,
            receivedAt,
            portalUrl: invoice.tenant.slug
              ? `${process.env.PORTAL_BASE_URL || "https://portal.breederhq.com"}/t/${invoice.tenant.slug}/financials`
              : undefined,
          });

          await sendEmail({
            tenantId,
            to: invoice.clientParty.email,
            subject: receipt.subject,
            html: receipt.html,
            text: receipt.text,
            templateKey: "payment_receipt",
            relatedInvoiceId: invoiceId,
            category: "transactional",
          });

          // 2. Notification email to breeder
          if (invoice.tenant.primaryEmail) {
            const notification = renderBreederPaymentNotification({
              invoiceNumber: invoice.invoiceNumber || `INV-${invoiceId}`,
              paymentAmountCents: amountCents,
              remainingBalanceCents: Number(invoice.balanceCents),
              clientName: invoice.clientParty.name || "Client",
              tenantName: invoice.tenant.name || "Breeder",
              isPaid,
            });

            await sendEmail({
              tenantId,
              to: invoice.tenant.primaryEmail,
              subject: notification.subject,
              html: notification.html,
              text: notification.text,
              templateKey: "breeder_payment_notification",
              relatedInvoiceId: invoiceId,
              category: "transactional",
            });
          }
        } catch (emailErr) {
          req.log?.warn?.({ err: emailErr }, "Payment notification email failed (non-blocking)");
        }
      })();

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

  // POST /finance/payments/export - Export payments scoped to invoice filters
  app.post("/finance/payments/export", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = req.body as any;

      // Build invoice filter where clause from the same filters as GET /invoices
      const invoiceWhere: any = { tenantId };

      if (body.q) {
        invoiceWhere.OR = [
          { invoiceNumber: { contains: body.q, mode: "insensitive" } },
          { clientParty: { name: { contains: body.q, mode: "insensitive" } } },
        ];
      }

      if (body.status) invoiceWhere.status = body.status;
      if (body.outstandingOnly === true || body.outstandingOnly === "true") {
        invoiceWhere.balanceCents = { gt: 0 };
      }

      if (body.issuedFrom || body.issuedTo) {
        invoiceWhere.issuedAt = {};
        if (body.issuedFrom) invoiceWhere.issuedAt.gte = new Date(body.issuedFrom);
        if (body.issuedTo) invoiceWhere.issuedAt.lte = new Date(body.issuedTo);
      }

      if (body.dueFrom || body.dueTo) {
        invoiceWhere.dueAt = {};
        if (body.dueFrom) invoiceWhere.dueAt.gte = new Date(body.dueFrom);
        if (body.dueTo) invoiceWhere.dueAt.lte = new Date(body.dueTo);
      }

      // Anchor filters
      if (body.animalId) invoiceWhere.animalId = parseIntOrNull(body.animalId);
      if (body.offspringGroupId) invoiceWhere.groupId = parseIntOrNull(body.offspringGroupId);
      if (body.breedingPlanId) invoiceWhere.breedingPlanId = parseIntOrNull(body.breedingPlanId);
      if (body.clientPartyId) invoiceWhere.clientPartyId = parseIntOrNull(body.clientPartyId);

      // Get matching invoice IDs
      const matchingInvoices = await prisma.invoice.findMany({
        where: invoiceWhere,
        select: {
          id: true,
          invoiceNumber: true,
          clientParty: { select: { name: true } },
        },
      });

      const invoiceIds = matchingInvoices.map(inv => inv.id);

      // If no invoices match, return empty
      if (invoiceIds.length === 0) {
        return reply.code(200).send({ items: [], total: 0 });
      }

      // Cap at 10k payments
      if (invoiceIds.length > 10000) {
        return reply.code(400).send({
          error: "too_many_results",
          detail: "Export limited to 10,000 invoices. Please narrow your filters.",
        });
      }

      // Fetch payments for matching invoices with receipt counts
      const payments = await prisma.payment.findMany({
        where: {
          tenantId,
          invoiceId: { in: invoiceIds },
        },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              clientParty: { select: { name: true } },
            },
          },
          _count: {
            select: { Attachments: true },
          },
        },
        orderBy: { receivedAt: "desc" },
        take: 10000,
      });

      const items = payments.map(p => ({
        id: p.id,
        invoiceId: p.invoiceId,
        invoiceNumber: p.invoice.invoiceNumber,
        clientPartyName: p.invoice.clientParty?.name || null,
        amountCents: Number(p.amountCents),
        receivedAt: p.receivedAt,
        methodType: p.methodType,
        processor: p.processor,
        processorRef: p.processorRef,
        status: p.status,
        attachmentCount: p._count.Attachments,
        createdAt: p.createdAt,
      }));

      return reply.code(200).send({ items, total: items.length });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // POST /payments/:id/attachments - Create receipt attachment
  app.post("/payments/:id/attachments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const payment = await prisma.payment.findFirst({ where: { id, tenantId } });
      if (!payment) return reply.code(404).send({ error: "payment_not_found" });

      const b = req.body as any;
      const required = ["kind", "storageProvider", "storageKey", "filename", "mime", "bytes"];
      for (const k of required) {
        if (!(k in b)) return reply.code(400).send({ error: `missing_field_${k}` });
      }

      const created = await prisma.attachment.create({
        data: {
          tenantId,
          paymentId: id,
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

  // GET /payments/:id/attachments - List receipt attachments
  app.get("/payments/:id/attachments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const payment = await prisma.payment.findFirst({ where: { id, tenantId } });
      if (!payment) return reply.code(404).send({ error: "payment_not_found" });

      const attachments = await prisma.attachment.findMany({
        where: { paymentId: id, tenantId },
        orderBy: { createdAt: "desc" },
      });

      return reply.code(200).send(attachments);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // DELETE /payments/:id/attachments/:aid - Delete receipt attachment
  app.delete("/payments/:id/attachments/:aid", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      const aid = parseIntOrNull((req.params as any).aid);
      if (!id || !aid) return reply.code(400).send({ error: "invalid_id" });

      const attachment = await prisma.attachment.findFirst({ where: { id: aid, tenantId } });
      if (!attachment) return reply.code(404).send({ error: "attachment_not_found" });
      if (attachment.paymentId !== id) {
        return reply.code(409).send({ error: "attachment_does_not_belong_to_payment" });
      }

      await prisma.attachment.delete({ where: { id: aid } });
      return reply.send({ ok: true, deleted: aid });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });
};

export default routes;
