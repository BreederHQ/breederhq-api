// src/routes/contracts.ts
/**
 * Contracts API (Platform - Breeder Dashboard)
 *
 * Endpoints for managing contracts:
 * - Create contracts from templates
 * - Send contracts to buyers
 * - Track contract status
 * - Void/resend contracts
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { checkEntitlement } from "../services/subscription/entitlement-service.js";
import {
  createContract,
  sendContract,
  voidContract,
  getContractWithDetails,
  listContracts,
  getContractEvents,
  generateContractPdf,
  type CreateContractInput,
} from "../services/contracts/index.js";
import { auditCreate, auditUpdate, auditDelete, type AuditContext } from "../services/audit-trail.js";
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

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /contracts
   * List contracts for the tenant
   */
  app.get("/contracts", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { status, partyId, offspringId, animalId, limit, offset } = req.query as any;

    const filters: any = {};
    if (status) filters.status = status;
    if (partyId) filters.partyId = parseInt(partyId, 10);
    if (offspringId) filters.offspringId = parseInt(offspringId, 10);
    if (animalId) filters.animalId = parseInt(animalId, 10);

    const contracts = await listContracts(tenantId, filters);

    // Apply pagination if needed
    const take = limit ? parseInt(limit, 10) : contracts.length;
    const skip = offset ? parseInt(offset, 10) : 0;
    const paginated = contracts.slice(skip, skip + take);

    return reply.send({
      items: paginated,
      total: contracts.length,
    });
  });

  /**
   * GET /contracts/:id
   * Get single contract with details
   */
  app.get<{ Params: { id: string } }>("/contracts/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const contractId = parseInt(req.params.id, 10);
    if (isNaN(contractId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    try {
      const contract = await getContractWithDetails(tenantId, contractId);
      return reply.send(contract);
    } catch (err: any) {
      if (err.code === "P2025") {
        return reply.code(404).send({ error: "not_found" });
      }
      throw err;
    }
  });

  /**
   * POST /contracts
   * Create a new contract
   */
  app.post("/contracts", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    // Check E_SIGNATURES entitlement
    const entitlement = await checkEntitlement(tenantId, "E_SIGNATURES");
    if (!entitlement.hasAccess) {
      return reply.code(403).send({
        error: "upgrade_required",
        message: "E-Signatures require a paid subscription",
      });
    }

    const body = req.body as any;

    // Validate required fields
    if (!body.title) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Title is required",
      });
    }

    if (!body.parties || body.parties.length === 0) {
      return reply.code(400).send({
        error: "validation_error",
        message: "At least one party is required",
      });
    }

    // Auto-fill SELLER party email from current user if not provided
    const userId = (req as any).userId as string;
    if (userId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      });
      if (currentUser) {
        for (const party of body.parties) {
          if (party.role === "SELLER" && !party.email) {
            party.email = currentUser.email;
            if (!party.name || party.name === "Breeder") {
              party.name = [currentUser.firstName, currentUser.lastName]
                .filter(Boolean)
                .join(" ") || "Breeder";
            }
          }
        }
      }
    }

    // Ensure all signing parties have email
    for (const party of body.parties) {
      if (party.signer && !party.email) {
        return reply.code(400).send({
          error: "validation_error",
          message: `Party "${party.name || party.role}" must have an email address`,
        });
      }
    }

    const input: CreateContractInput = {
      templateId: body.templateId,
      title: body.title,
      offspringId: body.offspringId,
      animalId: body.animalId,
      waitlistEntryId: body.waitlistEntryId,
      invoiceId: body.invoiceId,
      parties: body.parties,
      expiresInDays: body.expiresInDays || 30,
      reminderDays: body.reminderDays || [7, 3, 1],
      customContent: body.customContent,
    };

    const contract = await createContract(req, tenantId, input);

    // Audit trail & activity log (fire-and-forget)
    const ctx = auditCtx(req, tenantId);
    auditCreate("CONTRACT", contract.id, contract as any, ctx);
    logEntityActivity({
      tenantId,
      entityType: "CONTRACT",
      entityId: contract.id,
      kind: "contract_created",
      category: "document",
      title: "Contract created",
      actorId: ctx.userId,
      actorName: ctx.userName,
    });

    return reply.code(201).send(contract);
  });

  /**
   * PATCH /contracts/:id
   * Update a draft contract (only while in draft status)
   */
  app.patch<{ Params: { id: string } }>("/contracts/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const contractId = parseInt(req.params.id, 10);
    if (isNaN(contractId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    if (existing.status !== "draft") {
      return reply.code(400).send({
        error: "cannot_update",
        message: `Cannot update contract in status: ${existing.status}`,
      });
    }

    const { title, templateId, expiresAt, data } = req.body as any;

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        title: title ?? existing.title,
        templateId: templateId !== undefined ? templateId : existing.templateId,
        expiresAt: expiresAt ? new Date(expiresAt) : existing.expiresAt,
        data: data !== undefined ? data : existing.data,
      },
    });

    // Audit trail (fire-and-forget) — `existing` is the before-snapshot
    auditUpdate("CONTRACT", contractId, existing as any, updated as any, auditCtx(req, tenantId));

    return reply.send(updated);
  });

  /**
   * POST /contracts/:id/send
   * Send contract to all signing parties
   */
  app.post<{ Params: { id: string } }>("/contracts/:id/send", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const contractId = parseInt(req.params.id, 10);
    if (isNaN(contractId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const { message } = req.body as any;

    try {
      await sendContract(req, tenantId, contractId, message);

      // Activity log (fire-and-forget)
      const ctx = auditCtx(req, tenantId);
      logEntityActivity({
        tenantId,
        entityType: "CONTRACT",
        entityId: contractId,
        kind: "contract_sent",
        category: "document",
        title: "Contract sent for signing",
        actorId: ctx.userId,
        actorName: ctx.userName,
      });

      return reply.send({ success: true, message: "Contract sent" });
    } catch (err: any) {
      return reply.code(400).send({
        error: "send_failed",
        message: err.message,
      });
    }
  });

  /**
   * POST /contracts/:id/void
   * Void a contract (cannot void signed contracts)
   */
  app.post<{ Params: { id: string } }>("/contracts/:id/void", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    const userId = (req as any).userId as string;
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const contractId = parseInt(req.params.id, 10);
    if (isNaN(contractId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const { reason } = req.body as any;

    try {
      await voidContract(req, tenantId, contractId, userId, reason);

      // Audit trail & activity log (fire-and-forget)
      const ctx = auditCtx(req, tenantId);
      auditDelete("CONTRACT", contractId, ctx, { reason });
      logEntityActivity({
        tenantId,
        entityType: "CONTRACT",
        entityId: contractId,
        kind: "contract_voided",
        category: "document",
        title: "Contract voided",
        actorId: ctx.userId,
        actorName: ctx.userName,
        metadata: { reason },
      });

      return reply.send({ success: true, message: "Contract voided" });
    } catch (err: any) {
      return reply.code(400).send({
        error: "void_failed",
        message: err.message,
      });
    }
  });

  /**
   * POST /contracts/:id/remind
   * Send reminder to unsigned parties
   */
  app.post<{ Params: { id: string } }>("/contracts/:id/remind", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const contractId = parseInt(req.params.id, 10);
    if (isNaN(contractId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        parties: {
          where: { signer: true, status: { in: ["pending", "viewed"] } },
        },
      },
    });

    if (!contract) {
      return reply.code(404).send({ error: "not_found" });
    }

    if (contract.status !== "sent" && contract.status !== "viewed") {
      return reply.code(400).send({
        error: "cannot_remind",
        message: `Cannot send reminder for contract in status: ${contract.status}`,
      });
    }

    if (contract.parties.length === 0) {
      return reply.code(400).send({
        error: "no_unsigned_parties",
        message: "All parties have already signed",
      });
    }

    // Create reminder notification (will be delivered by notification system)
    const now = new Date();
    for (const party of contract.parties) {
      await prisma.notification.create({
        data: {
          tenantId,
          userId: null,
          type: "contract_reminder_1d", // Manual reminders use highest priority type
          priority: "HIGH",
          title: `Contract Reminder Sent: ${contract.title}`,
          message: `A reminder has been sent to ${party.name || party.email} to sign the contract.`,
          linkUrl: `/contracts/${contractId}`,
          status: "UNREAD",
          idempotencyKey: `contract_manual_remind:${contractId}:${party.email}:${now.toISOString()}`,
          metadata: {
            contractId,
            partyEmail: party.email,
            manual: true,
          },
        },
      });
    }

    return reply.send({
      success: true,
      message: `Reminder sent to ${contract.parties.length} unsigned parties`,
    });
  });

  /**
   * GET /contracts/:id/events
   * Get signature event audit trail for a contract
   */
  app.get<{ Params: { id: string } }>("/contracts/:id/events", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const contractId = parseInt(req.params.id, 10);
    if (isNaN(contractId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    // Verify contract exists and belongs to tenant
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
    });

    if (!contract) {
      return reply.code(404).send({ error: "not_found" });
    }

    const events = await getContractEvents(tenantId, contractId);

    return reply.send({ items: events });
  });

  /**
   * GET /contracts/:id/pdf
   * Download the contract PDF (with signatures if signed)
   */
  app.get<{ Params: { id: string } }>("/contracts/:id/pdf", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const contractId = parseInt(req.params.id, 10);
    if (isNaN(contractId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: { content: true },
    });

    if (!contract) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Require contract to be sent (has content rendered)
    if (!contract.content) {
      return reply.code(400).send({
        error: "pdf_not_available",
        message: "Contract content has not been rendered yet",
      });
    }

    try {
      // Determine if we should add a watermark for unsigned contracts
      const watermark = contract.status !== "signed" ? "DRAFT - NOT SIGNED" : undefined;

      const { buffer, filename } = await generateContractPdf(contractId, tenantId, {
        includeAuditTrail: contract.status === "signed",
        watermark,
      });

      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(Buffer.from(buffer));
    } catch (err: any) {
      console.error("[contracts] PDF generation error:", err);
      return reply.code(500).send({
        error: "pdf_generation_failed",
        message: err.message,
      });
    }
  });
};

export default routes;
