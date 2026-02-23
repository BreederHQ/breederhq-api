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
import { sendEmail } from "../services/email-service.js";
import { renderInvoiceEmail } from "../services/email-templates.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";
import { activeOnly } from "../utils/query-helpers.js";
import { auditCreate, auditUpdate, auditDelete, type AuditContext } from "../services/audit-trail.js";
import { generateInvoicePdf } from "../services/finance/invoice-pdf-builder.js";
import { logEntityActivity } from "../services/activity-log.js";

/** Build AuditContext from a Fastify request */
function auditCtx(req: any, tenantId: number): AuditContext {
  return {
    tenantId,
    userId: String((req as any).userId ?? "unknown"),
    userName: (req as any).userName ?? undefined,
    changeSource: "PLATFORM",
    ip: req.ip,
  };
}

/* ───────────────────────── errors ───────────────────────── */

class InvoicePartyNotGroupBuyerError extends Error {
  offspringGroupId: number;
  billToPartyId: number;

  constructor(offspringGroupId: number, billToPartyId: number) {
    super("Bill-to party is not assigned as a buyer for this offspring group");
    this.name = "InvoicePartyNotGroupBuyerError";
    this.offspringGroupId = offspringGroupId;
    this.billToPartyId = billToPartyId;
  }
}

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
  if (err instanceof InvoicePartyNotGroupBuyerError) {
    return {
      status: 422,
      payload: {
        error: "INVOICE_PARTY_NOT_GROUP_BUYER",
        offspringGroupId: any.offspringGroupId,
        billToPartyId: any.billToPartyId,
        message: "Bill-to party is not assigned as a buyer for this offspring group",
      },
    };
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
    amountCents: Number(inv.amountCents),
    balanceCents: Number(inv.balanceCents),
    currency: inv.currency,
    status: inv.status,
    category: inv.category,
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
  // GET /finance/summary - Finance home summary tiles
  app.get("/finance/summary", async (req, reply) => {
    try {
      const actorContext = (req as any).actorContext;
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      // Get current month range
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Base where clause for party scope
      const partyWhere: any = { tenantId };
      if (actorContext === "CLIENT") {
        const { partyId } = await requireClientPartyScope(req);
        partyWhere.clientPartyId = partyId;
      }

      // Outstanding total (all non-void invoices with balance > 0)
      const outstandingResult = await prisma.invoice.aggregate({
        where: activeOnly({
          ...partyWhere,
          status: { not: "void" },
          balanceCents: { gt: 0 },
        }),
        _sum: { balanceCents: true },
      });

      // Invoiced MTD (total of invoices issued this month, not void)
      const invoicedMtdResult = await prisma.invoice.aggregate({
        where: activeOnly({
          ...partyWhere,
          status: { not: "void" },
          issuedAt: { gte: startOfMonth, lte: endOfMonth },
        }),
        _sum: { amountCents: true },
      });

      // Collected MTD (payments received this month) - needs invoice join for CLIENT scope
      let collectedMtdCents = 0;
      if (actorContext === "CLIENT") {
        const { partyId } = await requireClientPartyScope(req);
        const payments = await prisma.payment.findMany({
          where: {
            tenantId,
            receivedAt: { gte: startOfMonth, lte: endOfMonth },
            status: "succeeded",
            invoice: { clientPartyId: partyId },
          },
          select: { amountCents: true },
        });
        collectedMtdCents = payments.reduce((sum, p) => sum + Number(p.amountCents || 0), 0);
      } else {
        const collectedMtdResult = await prisma.payment.aggregate({
          where: {
            tenantId,
            receivedAt: { gte: startOfMonth, lte: endOfMonth },
            status: "succeeded",
          },
          _sum: { amountCents: true },
        });
        collectedMtdCents = Number(collectedMtdResult._sum.amountCents || 0);
      }

      // Expenses MTD - CLIENTs should not see expenses (staff-only data)
      let expensesMtdCents = 0;
      if (actorContext !== "CLIENT") {
        const expensesMtdResult = await prisma.expense.aggregate({
          where: {
            tenantId,
            incurredAt: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amountCents: true },
        });
        expensesMtdCents = Number(expensesMtdResult._sum.amountCents || 0);
      }

      // Deposits outstanding (invoices with category DEPOSIT or MIXED, not void, with balance > 0)
      const depositsResult = await prisma.invoice.aggregate({
        where: activeOnly({
          ...partyWhere,
          category: { in: ["DEPOSIT", "MIXED"] },
          status: { not: "void" },
          balanceCents: { gt: 0 },
        }),
        _sum: { balanceCents: true },
      });
      const depositsOutstandingCents = Number(depositsResult._sum.balanceCents || 0);

      return reply.code(200).send({
        outstandingTotalCents: Number(outstandingResult._sum.balanceCents || 0),
        invoicedMtdCents: Number(invoicedMtdResult._sum.amountCents || 0),
        collectedMtdCents,
        expensesMtdCents,
        depositsOutstandingCents,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

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

      // Line items support (optional for backward compatibility)
      const lineItems: any[] = body.lineItems || [];
      let amountCents = Number(body.amountCents);
      let invoiceCategory = body.category || "OTHER";

      // If line items provided, compute total and category from them
      if (lineItems.length > 0) {
        // Validate line items
        for (const item of lineItems) {
          // unitCents can be 0 (free item) or negative (discount), so check type not truthiness
          const unitCents = Number(item.unitCents);
          const qty = Number(item.qty);
          if (!item.description || !Number.isFinite(unitCents) || !Number.isFinite(qty) || qty <= 0) {
            return reply.code(400).send({ error: "invalid_line_item" });
          }
        }

        // Compute total from line items
        amountCents = lineItems.reduce((sum: number, item: any) => {
          const qty = Number(item.qty) || 1;
          const unitCents = Number(item.unitCents) || 0;
          return sum + (qty * unitCents);
        }, 0);

        // Determine category from line item kinds
        const kinds = lineItems.map((item: any) => item.kind || "OTHER");
        const hasDeposit = kinds.includes("DEPOSIT");
        const hasOther = kinds.some((k: string) => k !== "DEPOSIT");

        if (hasDeposit && !hasOther) {
          invoiceCategory = "DEPOSIT";
        } else if (hasDeposit && hasOther) {
          invoiceCategory = "MIXED";
        } else if (kinds.includes("SERVICE_FEE")) {
          invoiceCategory = "SERVICE";
        } else if (kinds.includes("GOODS")) {
          invoiceCategory = "GOODS";
        } else {
          invoiceCategory = "OTHER";
        }
      }

      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return reply.code(400).send({ error: "invalid_amountCents" });
      }

      // Offspring Group context: enforce buyer-only billing
      // When offspringGroupId is present, clientPartyId must be an assigned buyer for that group
      if (anchors.offspringGroupId) {
        const buyerAssignment = await prisma.offspringGroupBuyer.findFirst({
          where: {
            groupId: anchors.offspringGroupId,
            buyerPartyId: clientPartyId,
            // Note: buyer status (Missed/Inactive) is currently allowed per spec
            // Add status check here if business decides to block inactive buyers
          },
        });
        if (!buyerAssignment) {
          throw new InvoicePartyNotGroupBuyerError(anchors.offspringGroupId, clientPartyId);
        }
      }

      // Generate invoice number and create in transaction
      const result = await prisma.$transaction(async (tx: any) => {
        const invoiceNumber = await generateInvoiceNumber(tx, tenantId);
        const scope = determineInvoiceScope(anchors);

        // Optional: link to a specific breeding plan buyer
        const breedingPlanBuyerId = parseIntOrNull(body.breedingPlanBuyerId);

        const invoice = await tx.invoice.create({
          data: {
            tenantId,
            invoiceNumber,
            scope,
            offspringId: anchors.offspringId,
            groupId: anchors.offspringGroupId,
            animalId: anchors.animalId,
            breedingPlanId: anchors.breedingPlanId,
            breedingPlanBuyerId: breedingPlanBuyerId || null,
            clientPartyId,
            amountCents,
            balanceCents: amountCents, // Initially unpaid
            currency: body.currency || "USD",
            status: "draft",
            category: invoiceCategory,
            issuedAt: body.issuedAt ? new Date(body.issuedAt) : null,
            dueAt: body.dueAt ? new Date(body.dueAt) : null,
            paymentTerms: body.paymentTerms || null,
            notes: body.notes || null,
            data: body.data || null,
          },
        });

        // Create line items if provided
        if (lineItems.length > 0) {
          for (const item of lineItems) {
            const qty = Number(item.qty) || 1;
            const unitCents = Number(item.unitCents) || 0;
            const totalCents = qty * unitCents;

            await tx.invoiceLineItem.create({
              data: {
                tenantId,
                invoiceId: invoice.id,
                kind: item.kind || "OTHER",
                description: item.description,
                qty,
                unitCents,
                totalCents,
                discountCents: item.discountCents || null,
                taxRate: item.taxRate || null,
                category: item.category || null,
                itemCode: item.itemCode || null,
              },
            });
          }
        }

        return invoiceDTO(invoice);
      });

      // Store idempotency key
      await storeIdempotencyKey(prisma, tenantId, idempotencyKey, requestHash, result);

      // Audit trail & activity log (fire-and-forget)
      const ctx = auditCtx(req, tenantId);
      auditCreate("INVOICE", result.id, result as any, ctx);
      logEntityActivity({
        tenantId,
        entityType: "INVOICE",
        entityId: result.id,
        kind: "invoice_created",
        category: "financial",
        title: "Invoice created",
        actorId: ctx.userId,
        actorName: ctx.userName,
      });

      return reply.code(201).send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /invoices - List invoices with filters
  app.get("/invoices", async (req, reply) => {
    try {
      const actorContext = (req as any).actorContext;
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as any;
      const { page, limit, skip } = parsePaging(query);

      const where: any = { tenantId };

      // PORTAL CLIENT: Enforce party scope - only show invoices for their party
      if (actorContext === "CLIENT") {
        const { partyId } = await requireClientPartyScope(req);
        where.clientPartyId = partyId;
      }

      // Status filter (single or multiple comma-separated)
      if (query.status) {
        const statuses = String(query.status).split(",").map(s => s.trim());
        if (statuses.length === 1) {
          where.status = statuses[0];
        } else {
          where.status = { in: statuses };
        }
      }

      // Outstanding only filter (issued, partially_paid, or overdue)
      if (query.outstandingOnly === "true" || query.outstandingOnly === "1") {
        where.status = { in: ["issued", "partially_paid"] };
        where.balanceCents = { gt: 0 };
      }

      // Text search on invoice number
      if (query.q) {
        where.invoiceNumber = { contains: String(query.q), mode: "insensitive" };
      }

      // Party and anchor filters (only for STAFF, CLIENT already has partyId locked)
      if (actorContext !== "CLIENT") {
        if (query.clientPartyId) where.clientPartyId = parseIntOrNull(query.clientPartyId);
      }
      if (query.offspringId) where.offspringId = parseIntOrNull(query.offspringId);
      if (query.offspringGroupId) where.groupId = parseIntOrNull(query.offspringGroupId);
      if (query.animalId) where.animalId = parseIntOrNull(query.animalId);
      if (query.breedingPlanId) where.breedingPlanId = parseIntOrNull(query.breedingPlanId);

      // Issued date range
      if (query.issuedFrom || query.issuedTo) {
        where.issuedAt = {};
        if (query.issuedFrom) where.issuedAt.gte = new Date(query.issuedFrom);
        if (query.issuedTo) where.issuedAt.lte = new Date(query.issuedTo);
      }

      // Due date range
      if (query.dueFrom || query.dueTo) {
        where.dueAt = {};
        if (query.dueFrom) where.dueAt.gte = new Date(query.dueFrom);
        if (query.dueTo) where.dueAt.lte = new Date(query.dueTo);
      }

      // Sorting
      const allowedSortFields = ["issuedAt", "dueAt", "createdAt", "amountCents", "invoiceNumber"];
      const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : "createdAt";
      const sortDir = query.sortDir === "asc" ? "asc" : "desc";

      const whereWithActive = activeOnly(where);
      const [data, total] = await Promise.all([
        prisma.invoice.findMany({
          where: whereWithActive,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortDir },
          include: {
            clientParty: {
              select: {
                name: true,
                contact: { select: { display_name: true } },
                organization: { select: { name: true } },
              },
            },
          },
        }),
        prisma.invoice.count({ where: whereWithActive }),
      ]);

      // Map to DTO with clientPartyName resolved
      const items = data.map((inv: any) => {
        const dto = invoiceDTO(inv);
        // Resolve client name from party -> contact/org
        const party = inv.clientParty;
        let clientPartyName: string | null = null;
        if (party) {
          clientPartyName = party.name
            || party.contact?.display_name
            || party.organization?.name
            || null;
        }
        return {
          ...dto,
          // Frontend expects totalCents, backend uses amountCents
          totalCents: dto.amountCents,
          clientPartyName,
        };
      });

      return reply.code(200).send({
        items,
        total,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /invoices/:id - Get single invoice
  app.get("/invoices/:id", async (req, reply) => {
    try {
      const actorContext = (req as any).actorContext;
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const where: any = { id, tenantId };

      // PORTAL CLIENT: Enforce party scope - only show their invoices
      if (actorContext === "CLIENT") {
        const { partyId } = await requireClientPartyScope(req);
        where.clientPartyId = partyId;
      }

      const invoice = await prisma.invoice.findFirst({
        where: activeOnly(where),
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

      // Get current invoice before update
      const beforeUpdate = await prisma.invoice.findFirst({
        where: activeOnly({ id, tenantId }),
        include: {
          clientParty: { select: { email: true, name: true } },
          tenant: { select: { name: true } },
        },
      });

      if (!beforeUpdate) return reply.code(404).send({ error: "not_found" });

      const invoice = await prisma.invoice.updateMany({
        where: activeOnly({ id, tenantId }),
        data: updates,
      });

      if (invoice.count === 0) return reply.code(404).send({ error: "not_found" });

      const updated = await prisma.invoice.findUnique({ where: { id } });

      // Audit trail (fire-and-forget)
      if (beforeUpdate && updated) {
        auditUpdate("INVOICE", id, beforeUpdate as any, updated as any, auditCtx(req, tenantId));
      }

      // If status changed to "issued", send email
      if (body.status === "issued" && beforeUpdate.status !== "issued") {
        const clientEmail = beforeUpdate.clientParty?.email;
        if (clientEmail) {
          const emailContent = renderInvoiceEmail({
            invoiceNumber: beforeUpdate.invoiceNumber,
            amountCents: Number(beforeUpdate.amountCents),
            currency: beforeUpdate.currency,
            dueAt: beforeUpdate.dueAt,
            clientName: beforeUpdate.clientParty?.name || "Valued Customer",
            tenantName: beforeUpdate.tenant?.name || "BreederHQ",
          });

          // Fire and forget email send, log in background
          sendEmail({
            tenantId,
            to: clientEmail,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
            templateKey: "invoice_issued",
            relatedInvoiceId: id,
            category: "transactional",
            metadata: { invoiceId: id, invoiceNumber: beforeUpdate.invoiceNumber },
          }).catch((err) => {
            req.log.error({ err, invoiceId: id }, "Failed to send invoice email");
          });
        }
      }

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
        where: activeOnly({ id, tenantId }),
        data: {
          status: "void",
          voidedAt: new Date(),
        },
      });

      if (invoice.count === 0) return reply.code(404).send({ error: "not_found" });

      const updated = await prisma.invoice.findUnique({ where: { id } });

      // Audit trail & activity log (fire-and-forget)
      const ctx = auditCtx(req, tenantId);
      auditDelete("INVOICE", id, ctx, { reason: "voided" });
      logEntityActivity({
        tenantId,
        entityType: "INVOICE",
        entityId: id,
        kind: "invoice_voided",
        category: "financial",
        title: "Invoice voided",
        actorId: ctx.userId,
        actorName: ctx.userName,
      });

      return reply.code(200).send(invoiceDTO(updated));
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // POST /invoices/:id/attachments - Create invoice attachment
  app.post("/invoices/:id/attachments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const invoice = await prisma.invoice.findFirst({ where: activeOnly({ id, tenantId }) });
      if (!invoice) return reply.code(404).send({ error: "invoice_not_found" });

      const b = req.body as any;
      const required = ["kind", "storageProvider", "storageKey", "filename", "mime", "bytes"];
      for (const k of required) {
        if (!(k in b)) return reply.code(400).send({ error: `missing_field_${k}` });
      }

      const created = await prisma.attachment.create({
        data: {
          tenantId,
          invoiceId: id,
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

  // GET /invoices/:id/attachments - List invoice attachments
  app.get("/invoices/:id/attachments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const invoice = await prisma.invoice.findFirst({ where: activeOnly({ id, tenantId }) });
      if (!invoice) return reply.code(404).send({ error: "invoice_not_found" });

      const attachments = await prisma.attachment.findMany({
        where: { invoiceId: id, tenantId },
        orderBy: { createdAt: "desc" },
      });

      return reply.code(200).send(attachments);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // DELETE /invoices/:id/attachments/:aid - Delete invoice attachment
  app.delete("/invoices/:id/attachments/:aid", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      const aid = parseIntOrNull((req.params as any).aid);
      if (!id || !aid) return reply.code(400).send({ error: "invalid_id" });

      const attachment = await prisma.attachment.findFirst({ where: { id: aid, tenantId } });
      if (!attachment) return reply.code(404).send({ error: "attachment_not_found" });
      if (attachment.invoiceId !== id) {
        return reply.code(409).send({ error: "attachment_does_not_belong_to_invoice" });
      }

      await prisma.attachment.delete({ where: { id: aid } });
      return reply.send({ ok: true, deleted: aid });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  /* ───────────────────────── Stripe Invoice Endpoints ───────────────────────── */

  // GET /invoices/:id/stripe/status - Get Stripe status for an invoice
  app.get("/invoices/:id/stripe/status", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const tenantInvoiceStripe = await import("../services/tenant-invoice-stripe-service.js");
      const status = await tenantInvoiceStripe.getInvoiceStripeStatus(tenantId, id);

      return reply.send(status);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // POST /invoices/:id/stripe - Create Stripe invoice from existing platform invoice
  app.post("/invoices/:id/stripe", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const body = req.body as any;
      const dueInDays = body.dueInDays ? Number(body.dueInDays) : 7;

      const tenantInvoiceStripe = await import("../services/tenant-invoice-stripe-service.js");

      // Check if tenant can create Stripe invoices
      const canCreate = await tenantInvoiceStripe.canTenantCreateStripeInvoices(tenantId);
      if (!canCreate) {
        return reply.code(400).send({
          error: "stripe_not_configured",
          message: "Please complete Stripe Connect onboarding to create Stripe invoices.",
        });
      }

      const result = await tenantInvoiceStripe.createStripeInvoiceForTenant({
        tenantId,
        invoiceId: id,
        dueInDays,
      });

      return reply.code(201).send({
        success: true,
        invoice: result,
      });
    } catch (err: any) {
      if (err.message === "stripe_invoice_already_exists") {
        return reply.code(409).send({
          error: "stripe_invoice_exists",
          message: "A Stripe invoice already exists for this invoice.",
        });
      }
      if (err.message === "client_email_required") {
        return reply.code(400).send({
          error: "client_email_required",
          message: "The invoice client must have an email address to create a Stripe invoice.",
        });
      }
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // POST /invoices/:id/stripe/send - Send Stripe invoice to client
  app.post("/invoices/:id/stripe/send", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const tenantInvoiceStripe = await import("../services/tenant-invoice-stripe-service.js");
      const result = await tenantInvoiceStripe.sendTenantStripeInvoice(tenantId, id);

      return reply.send({
        success: true,
        message: "Invoice sent successfully.",
        invoice: result,
      });
    } catch (err: any) {
      if (err.message === "stripe_invoice_not_created") {
        return reply.code(400).send({
          error: "stripe_invoice_not_created",
          message: "Create a Stripe invoice first using POST /invoices/:id/stripe",
        });
      }
      if (err.message === "invoice_already_sent") {
        return reply.code(400).send({
          error: "invoice_already_sent",
          message: "This invoice has already been sent.",
        });
      }
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // POST /invoices/:id/stripe/void - Void Stripe invoice
  app.post("/invoices/:id/stripe/void", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const tenantInvoiceStripe = await import("../services/tenant-invoice-stripe-service.js");
      const result = await tenantInvoiceStripe.voidTenantStripeInvoice(tenantId, id);

      return reply.send({
        success: true,
        message: "Invoice voided successfully.",
        invoice: result,
      });
    } catch (err: any) {
      if (err.message === "cannot_void_invoice") {
        return reply.code(400).send({
          error: "cannot_void_invoice",
          message: "This invoice cannot be voided. It may already be paid or voided.",
        });
      }
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /invoices/:id/stripe/pdf - Get PDF URL for Stripe invoice
  app.get("/invoices/:id/stripe/pdf", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const tenantInvoiceStripe = await import("../services/tenant-invoice-stripe-service.js");
      const url = await tenantInvoiceStripe.getTenantInvoicePdfUrl(tenantId, id);

      return reply.send({ url });
    } catch (err: any) {
      if (err.message === "pdf_not_available") {
        return reply.code(400).send({
          error: "pdf_not_available",
          message: "PDF is not available. Invoice may need to be sent first.",
        });
      }
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /invoices/:id/stripe/payment-url - Get payment URL for Stripe invoice
  app.get("/invoices/:id/stripe/payment-url", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntOrNull((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const tenantInvoiceStripe = await import("../services/tenant-invoice-stripe-service.js");
      const url = await tenantInvoiceStripe.getTenantInvoicePaymentUrl(tenantId, id);

      return reply.send({ url });
    } catch (err: any) {
      if (err.message === "payment_url_not_available") {
        return reply.code(400).send({
          error: "payment_url_not_available",
          message: "Payment URL is not available. Invoice may need to be sent first.",
        });
      }
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

  // GET /invoices/:id/pdf - Download invoice PDF
  app.get("/invoices/:id/pdf", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = Number((req.params as any).id);
      if (!id || !Number.isInteger(id)) return reply.code(400).send({ error: "invalid_id" });

      // Check if invoice has a Stripe PDF — if so, redirect to it
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId, ...activeOnly },
        select: { stripeInvoiceId: true },
      });

      if (!invoice) return reply.code(404).send({ error: "not_found" });

      if (invoice.stripeInvoiceId) {
        // Fetch Stripe invoice PDF URL via existing service
        try {
          const tenantInvoiceStripe = await import("../services/tenant-invoice-stripe-service.js");
          const pdfUrl = await tenantInvoiceStripe.getTenantInvoicePdfUrl(tenantId, id);
          return reply.redirect(pdfUrl);
        } catch {
          // Fall through to generate our own PDF
        }
      }

      // Generate platform PDF
      const { buffer, filename } = await generateInvoicePdf(id, tenantId);

      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(Buffer.from(buffer));
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.code(status).send(payload);
    }
  });

};

export default routes;
