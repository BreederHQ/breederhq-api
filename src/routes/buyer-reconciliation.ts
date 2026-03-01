/**
 * Buyer Financial Reconciliation Routes
 *
 * Provides reconciliation summaries at match time — when a buyer is matched
 * to an offspring, this endpoint looks up all paid invoices for the buyer on
 * the plan, resolves the offspring's effective price via the pricing cascade,
 * and returns the balance due with a recommendation.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { generateInvoiceNumber } from "../services/finance/invoice-numbering.js";
import {
  checkIdempotencyKey,
  storeIdempotencyKey,
  hashRequestBody,
  IdempotencyConflictError,
} from "../services/finance/idempotency.js";
import { determineInvoiceScope } from "../services/finance/anchor-validator.js";
import { activeOnly } from "../utils/query-helpers.js";
import { auditCreate, type AuditContext } from "../services/audit-trail.js";
import { logEntityActivity } from "../services/activity-log.js";

/* ───────────────────────── helpers ───────────────────────── */

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function auditCtx(req: any, tenantId: number): AuditContext {
  return {
    tenantId,
    userId: String((req as any).userId ?? "unknown"),
    userName: (req as any).userName ?? undefined,
    changeSource: "PLATFORM",
    ip: req.ip,
  };
}

function errorReply(err: unknown): { status: number; payload: { error: string; message?: string } } {
  console.error("[buyer-reconciliation] Error:", err);
  if (err instanceof IdempotencyConflictError) {
    return { status: 409, payload: { error: "idempotency_conflict", message: (err as any)?.message } };
  }
  const code = (err as any)?.code;
  if (code === "P2002") {
    return { status: 409, payload: { error: "duplicate", message: (err as any)?.meta?.target } };
  }
  if (code === "P2025") {
    return { status: 404, payload: { error: "not_found" } };
  }
  if (err instanceof Error) {
    return { status: 500, payload: { error: "internal_error", message: err.message } };
  }
  return { status: 500, payload: { error: "internal_error" } };
}

/* ───────────────────────── pricing cascade ───────────────────────── */

type Recommendation =
  | "CREATE_BALANCE_INVOICE"
  | "FULLY_PAID"
  | "OVERPAID"
  | "NO_PRICE_SET";

/**
 * Resolve the effective price for a single offspring using the pricing cascade:
 *   1. Offspring.priceCents (individual override)
 *   2. Plan strategy (FIXED → groupPriceCents, BY_SEX → male/femalePriceCents)
 *   3. PROGRAM_DEFAULT → program pricingTiers → marketplaceDefaultPriceCents
 *   4. null (INDIVIDUAL strategy or no price resolved)
 */
async function resolveOffspringPrice(
  offspring: { priceCents: number | null; sex: string | null },
  plan: {
    pricingStrategy: string | null;
    groupPriceCents: number | null;
    malePriceCents: number | null;
    femalePriceCents: number | null;
    marketplaceDefaultPriceCents: number | null;
    programId: number | null;
  },
): Promise<number | null> {
  // 1. Individual override
  if (offspring.priceCents != null) return offspring.priceCents;

  const strategy = plan.pricingStrategy;
  if (!strategy || strategy === "INDIVIDUAL") return null;

  // 2. FIXED
  if (strategy === "FIXED") return plan.groupPriceCents;

  // 3. BY_SEX
  if (strategy === "BY_SEX") {
    if (offspring.sex === "MALE") return plan.malePriceCents;
    if (offspring.sex === "FEMALE") return plan.femalePriceCents;
    return null;
  }

  // 4. PROGRAM_DEFAULT
  if (strategy === "PROGRAM_DEFAULT") {
    if (plan.programId) {
      const program = await prisma.mktListingBreedingProgram.findUnique({
        where: { id: plan.programId },
        select: { pricingTiers: true },
      });
      if (program?.pricingTiers) {
        const tiers = program.pricingTiers as Array<{ priceCents?: number }>;
        if (Array.isArray(tiers) && tiers.length > 0 && tiers[0].priceCents != null) {
          return tiers[0].priceCents;
        }
      }
    }
    return plan.marketplaceDefaultPriceCents;
  }

  return null;
}

/* ───────────────────────── routes ───────────────────────── */

const buyerReconciliationRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Enforce tenant context
  app.addHook("preHandler", async (req, reply) => {
    let tenantId: number | null = toNum((req as any).tenantId);
    if (!tenantId) {
      const h = req.headers?.["x-tenant-id"];
      if (typeof h === "string" || typeof h === "number") tenantId = toNum(h);
      if (tenantId) (req as any).tenantId = tenantId;
    }
    if (!tenantId) {
      return reply
        .code(400)
        .send({ message: "Missing or invalid tenant context (X-Tenant-Id or session tenant)" });
    }
  });

  /**
   * GET /breeding/plans/:planId/buyers/:buyerId/reconciliation?offspringId=X
   *
   * Returns the financial reconciliation summary for a buyer-offspring match.
   */
  app.get<{
    Params: { planId: string; buyerId: string };
    Querystring: { offspringId?: string };
  }>(
    "/breeding/plans/:planId/buyers/:buyerId/reconciliation",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        const buyerId = toNum(req.params.buyerId);
        const offspringId = toNum(req.query.offspringId);

        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });
        if (!buyerId) return reply.code(400).send({ error: "bad_buyer_id" });
        if (!offspringId) return reply.code(400).send({ error: "offspringId_required" });

        // Verify plan exists and belongs to tenant
        const plan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId },
          select: {
            id: true,
            pricingStrategy: true,
            groupPriceCents: true,
            malePriceCents: true,
            femalePriceCents: true,
            marketplaceDefaultPriceCents: true,
            programId: true,
          },
        });
        if (!plan) return reply.code(404).send({ error: "plan_not_found" });

        // Verify buyer exists and belongs to this plan/tenant
        const buyer = await prisma.breedingPlanBuyer.findFirst({
          where: { id: buyerId, planId, tenantId },
          select: {
            id: true,
            partyId: true,
            waitlistEntryId: true,
            waitlistEntry: {
              select: { clientPartyId: true },
            },
          },
        });
        if (!buyer) return reply.code(404).send({ error: "buyer_not_found" });

        // Resolve the buyer's partyId (direct or via waitlist entry)
        const buyerPartyId = buyer.partyId ?? buyer.waitlistEntry?.clientPartyId ?? null;
        if (!buyerPartyId) {
          return reply.code(400).send({ error: "buyer_has_no_party" });
        }

        // Verify offspring exists and belongs to this plan/tenant
        const offspring = await prisma.offspring.findFirst({
          where: { id: offspringId, breedingPlanId: planId, tenantId },
          select: {
            id: true,
            name: true,
            priceCents: true,
            sex: true,
          },
        });
        if (!offspring) return reply.code(404).send({ error: "offspring_not_found" });

        // Resolve offspring price via pricing cascade
        const offspringPrice = await resolveOffspringPrice(offspring, plan);

        // Look up all non-void invoices for this buyer on this plan
        const invoiceWhere: any = {
          tenantId,
          clientPartyId: buyerPartyId,
          breedingPlanId: planId,
          status: { not: "void" },
        };
        const invoices = await prisma.invoice.findMany({
          where: activeOnly(invoiceWhere),
          select: {
            id: true,
            amountCents: true,
            balanceCents: true,
            status: true,
            category: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        });

        // Also include invoices linked via BreedingPlanBuyer (deposit invoices)
        // that may not have breedingPlanId set
        const buyerLinkedWhere: any = {
          tenantId,
          breedingPlanBuyerId: buyerId,
          status: { not: "void" },
        };
        const buyerLinkedInvoice = await prisma.invoice.findFirst({
          where: activeOnly(buyerLinkedWhere),
          select: {
            id: true,
            amountCents: true,
            balanceCents: true,
            status: true,
            category: true,
            createdAt: true,
          },
        });

        // Merge and deduplicate
        const invoiceMap = new Map<number, typeof invoices[0]>();
        for (const inv of invoices) invoiceMap.set(inv.id, inv);
        if (buyerLinkedInvoice) invoiceMap.set(buyerLinkedInvoice.id, buyerLinkedInvoice);

        const allInvoices = [...invoiceMap.values()].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        );

        // Calculate total buyer contributions (amount paid = amountCents - balanceCents)
        const buyerContributions = allInvoices.reduce(
          (sum, inv) => sum + (Number(inv.amountCents) - Number(inv.balanceCents)),
          0,
        );

        // Calculate balance due and recommendation
        let balanceDue: number;
        let recommendation: Recommendation;

        if (offspringPrice == null) {
          balanceDue = 0;
          recommendation = "NO_PRICE_SET";
        } else {
          balanceDue = offspringPrice - buyerContributions;
          if (balanceDue > 0) {
            recommendation = "CREATE_BALANCE_INVOICE";
          } else if (balanceDue === 0) {
            recommendation = "FULLY_PAID";
          } else {
            recommendation = "OVERPAID";
          }
        }

        return reply.send({
          offspringId: offspring.id,
          offspringName: offspring.name,
          offspringPrice,
          buyerContributions,
          invoices: allInvoices.map((inv) => ({
            id: inv.id,
            amount: Number(inv.amountCents),
            status: inv.status,
            type: inv.category,
            createdAt: inv.createdAt.toISOString(),
          })),
          balanceDue: Math.max(0, balanceDue),
          balanceOverpaid: balanceDue < 0 ? Math.abs(balanceDue) : 0,
          recommendation,
        });
      } catch (err) {
        const { status, payload } = errorReply(err);
        return reply.code(status).send(payload);
      }
    },
  );

  /**
   * POST /breeding/plans/:planId/buyers/:buyerId/reconciliation/create-invoice
   *
   * Creates a balance invoice linked to the buyer, offspring, and plan.
   * Uses idempotency to prevent duplicate invoices.
   */
  app.post<{
    Params: { planId: string; buyerId: string };
    Body: { offspringId: number; amountCents: number };
  }>(
    "/breeding/plans/:planId/buyers/:buyerId/reconciliation/create-invoice",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        const buyerId = toNum(req.params.buyerId);

        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });
        if (!buyerId) return reply.code(400).send({ error: "bad_buyer_id" });

        const body = req.body as any;
        const offspringId = toNum(body?.offspringId);
        const amountCents = Number(body?.amountCents);

        if (!offspringId) return reply.code(400).send({ error: "offspringId_required" });
        if (!Number.isInteger(amountCents) || amountCents <= 0) {
          return reply.code(400).send({ error: "invalid_amountCents" });
        }

        // Idempotency
        const idempotencyKey = req.headers["idempotency-key"] as string;
        if (!idempotencyKey) {
          return reply.code(400).send({ error: "missing_idempotency_key" });
        }

        const requestHash = hashRequestBody(body);
        const existing = await checkIdempotencyKey(prisma, tenantId, idempotencyKey, requestHash);
        if (existing) {
          return reply.code(200).send(existing);
        }

        // Verify plan
        const plan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId },
          select: { id: true },
        });
        if (!plan) return reply.code(404).send({ error: "plan_not_found" });

        // Verify buyer and resolve party
        const buyer = await prisma.breedingPlanBuyer.findFirst({
          where: { id: buyerId, planId, tenantId },
          select: {
            id: true,
            partyId: true,
            waitlistEntry: { select: { clientPartyId: true } },
          },
        });
        if (!buyer) return reply.code(404).send({ error: "buyer_not_found" });

        const clientPartyId = buyer.partyId ?? buyer.waitlistEntry?.clientPartyId ?? null;
        if (!clientPartyId) {
          return reply.code(400).send({ error: "buyer_has_no_party" });
        }

        // Verify offspring
        const offspring = await prisma.offspring.findFirst({
          where: { id: offspringId, breedingPlanId: planId, tenantId },
          select: { id: true },
        });
        if (!offspring) return reply.code(404).send({ error: "offspring_not_found" });

        // Create invoice in transaction
        const result = await prisma.$transaction(async (tx: any) => {
          const invoiceNumber = await generateInvoiceNumber(tx, tenantId);
          const scope = determineInvoiceScope({ offspringId, animalId: null, breedingPlanId: planId, serviceCode: null });

          const invoice = await tx.invoice.create({
            data: {
              tenantId,
              invoiceNumber,
              scope,
              offspringId,
              breedingPlanId: planId,
              clientPartyId,
              amountCents,
              balanceCents: amountCents,
              currency: "USD",
              status: "draft",
              category: "GOODS",
              notes: `Balance invoice for offspring match (Plan #${planId}, Buyer #${buyerId})`,
            },
          });

          // Create an OffspringInvoiceLink with SALE role
          await tx.offspringInvoiceLink.create({
            data: {
              tenantId,
              offspringId,
              invoiceId: invoice.id,
              role: "SALE",
              amountCents,
            },
          });

          return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            scope: invoice.scope,
            offspringId: invoice.offspringId,
            breedingPlanId: invoice.breedingPlanId,
            clientPartyId: invoice.clientPartyId,
            amountCents: Number(invoice.amountCents),
            balanceCents: Number(invoice.balanceCents),
            currency: invoice.currency,
            status: invoice.status,
            category: invoice.category,
            createdAt: invoice.createdAt,
          };
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
          title: "Balance invoice created (buyer reconciliation)",
          actorId: ctx.userId,
          actorName: ctx.userName,
        });

        return reply.code(201).send(result);
      } catch (err) {
        const { status, payload } = errorReply(err);
        return reply.code(status).send(payload);
      }
    },
  );
};

export default buyerReconciliationRoutes;
