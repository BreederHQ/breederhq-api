/**
 * Breeding Plan Pricing API Routes
 *
 * Manages pricing strategy at the breeding plan level and applies
 * pricing to offspring.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function resolveTenantIdFromRequest(req: { headers?: Record<string, unknown> }): number | null {
  const h = req.headers?.["x-tenant-id"];
  if (typeof h === "string") return toNum(h);
  if (typeof h === "number") return toNum(h);
  return null;
}

function errorReply(err: unknown): { status: number; payload: { error: string; message?: string } } {
  console.error("[breeding-plan-pricing] Error:", err);
  if (err instanceof Error) {
    return { status: 500, payload: { error: "internal_error", message: err.message } };
  }
  return { status: 500, payload: { error: "internal_error" } };
}

/* ───────────────────────── types ───────────────────────── */

type PricingStrategy = "PROGRAM_DEFAULT" | "FIXED" | "BY_SEX" | "INDIVIDUAL";

interface PricingResponse {
  pricingStrategy: PricingStrategy | null;
  groupPriceCents: number | null;
  malePriceCents: number | null;
  femalePriceCents: number | null;
  programDefaultPriceCents: number | null;
}

interface UpdatePricingBody {
  pricingStrategy: PricingStrategy;
  groupPriceCents?: number | null;
  malePriceCents?: number | null;
  femalePriceCents?: number | null;
}

interface ApplyResult {
  updated: number;
  skipped: number;
}

/* ───────────────────────── validation ───────────────────────── */

const VALID_STRATEGIES: ReadonlySet<string> = new Set([
  "PROGRAM_DEFAULT",
  "FIXED",
  "BY_SEX",
  "INDIVIDUAL",
]);

function validateStrategyFields(
  strategy: string,
  body: UpdatePricingBody
): string | null {
  if (!VALID_STRATEGIES.has(strategy)) {
    return `Invalid pricingStrategy: ${strategy}. Must be one of: ${[...VALID_STRATEGIES].join(", ")}`;
  }

  switch (strategy) {
    case "FIXED":
      if (body.groupPriceCents == null || body.groupPriceCents < 0) {
        return "FIXED strategy requires groupPriceCents (non-negative integer)";
      }
      break;
    case "BY_SEX":
      if (body.malePriceCents == null || body.malePriceCents < 0) {
        return "BY_SEX strategy requires malePriceCents (non-negative integer)";
      }
      if (body.femalePriceCents == null || body.femalePriceCents < 0) {
        return "BY_SEX strategy requires femalePriceCents (non-negative integer)";
      }
      break;
    // PROGRAM_DEFAULT and INDIVIDUAL don't require additional price fields
  }

  return null;
}

/* ───────────────────────── routes ───────────────────────── */

const breedingPlanPricingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Enforce tenant context
  app.addHook("preHandler", async (req, reply) => {
    let tenantId: number | null = toNum((req as any).tenantId);
    if (!tenantId) {
      tenantId = resolveTenantIdFromRequest(req as any);
      if (tenantId) (req as any).tenantId = tenantId;
    }
    if (!tenantId) {
      return reply
        .code(400)
        .send({ message: "Missing or invalid tenant context (X-Tenant-Id or session tenant)" });
    }
  });

  /**
   * GET /breeding/plans/:planId/pricing
   * Returns the plan's pricing strategy and relevant price fields,
   * plus the linked program's default price (if any).
   */
  app.get<{ Params: { planId: string } }>(
    "/breeding/plans/:planId/pricing",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        const plan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId },
          select: {
            pricingStrategy: true,
            groupPriceCents: true,
            malePriceCents: true,
            femalePriceCents: true,
            marketplaceDefaultPriceCents: true,
            programId: true,
          },
        });
        if (!plan) return reply.code(404).send({ error: "plan_not_found" });

        // Look up program default price from pricingTiers JSON if a program is linked
        let programDefaultPriceCents: number | null = null;
        if (plan.programId) {
          const program = await prisma.mktListingBreedingProgram.findUnique({
            where: { id: plan.programId },
            select: { pricingTiers: true },
          });
          if (program?.pricingTiers) {
            // pricingTiers is JSON — extract first tier's price as default
            const tiers = program.pricingTiers as Array<{ priceCents?: number; label?: string }>;
            if (Array.isArray(tiers) && tiers.length > 0 && tiers[0].priceCents != null) {
              programDefaultPriceCents = tiers[0].priceCents;
            }
          }
        }

        // Fall back to plan's own marketplace default
        if (programDefaultPriceCents == null && plan.marketplaceDefaultPriceCents != null) {
          programDefaultPriceCents = plan.marketplaceDefaultPriceCents;
        }

        const response: PricingResponse = {
          pricingStrategy: (plan.pricingStrategy as PricingStrategy) ?? null,
          groupPriceCents: plan.groupPriceCents,
          malePriceCents: plan.malePriceCents,
          femalePriceCents: plan.femalePriceCents,
          programDefaultPriceCents,
        };

        reply.send(response);
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  /**
   * PUT /breeding/plans/:planId/pricing
   * Update the plan's pricing strategy and price fields.
   * Validates strategy-field combinations.
   */
  app.put<{ Params: { planId: string }; Body: UpdatePricingBody }>(
    "/breeding/plans/:planId/pricing",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        const body = req.body || ({} as UpdatePricingBody);
        if (!body.pricingStrategy) {
          return reply.code(400).send({ error: "pricingStrategy_required" });
        }

        const validationError = validateStrategyFields(body.pricingStrategy, body);
        if (validationError) {
          return reply.code(400).send({ error: "validation_error", message: validationError });
        }

        // Verify plan exists and belongs to tenant
        const plan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId },
        });
        if (!plan) return reply.code(404).send({ error: "plan_not_found" });

        // Build update data — clear irrelevant fields based on strategy
        const updateData: {
          pricingStrategy: string;
          groupPriceCents: number | null;
          malePriceCents: number | null;
          femalePriceCents: number | null;
        } = {
          pricingStrategy: body.pricingStrategy,
          groupPriceCents: null,
          malePriceCents: null,
          femalePriceCents: null,
        };

        switch (body.pricingStrategy) {
          case "FIXED":
            updateData.groupPriceCents = body.groupPriceCents!;
            break;
          case "BY_SEX":
            updateData.malePriceCents = body.malePriceCents!;
            updateData.femalePriceCents = body.femalePriceCents!;
            break;
          // PROGRAM_DEFAULT and INDIVIDUAL don't store price fields on the plan
        }

        const updated = await prisma.breedingPlan.update({
          where: { id: planId, tenantId },
          data: updateData,
          select: {
            pricingStrategy: true,
            groupPriceCents: true,
            malePriceCents: true,
            femalePriceCents: true,
          },
        });

        reply.send({
          pricingStrategy: updated.pricingStrategy,
          groupPriceCents: updated.groupPriceCents,
          malePriceCents: updated.malePriceCents,
          femalePriceCents: updated.femalePriceCents,
        });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  /**
   * POST /breeding/plans/:planId/pricing/apply
   * Apply the plan's pricing strategy to all offspring in the plan.
   *
   * Skips:
   * - Keepers (keeperIntent = KEEP or WITHHELD)
   * - Offspring that already have an individually set price (when strategy != INDIVIDUAL)
   *   Note: INDIVIDUAL strategy is a no-op — it means each offspring is priced manually.
   *
   * Returns: { updated: number, skipped: number }
   */
  app.post<{ Params: { planId: string } }>(
    "/breeding/plans/:planId/pricing/apply",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        // Fetch plan with pricing fields
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

        const strategy = plan.pricingStrategy as PricingStrategy | null;
        if (!strategy) {
          return reply.code(400).send({
            error: "no_pricing_strategy",
            message: "Plan has no pricing strategy set. Use PUT to set one first.",
          });
        }

        // INDIVIDUAL means each offspring is priced manually — nothing to apply
        if (strategy === "INDIVIDUAL") {
          return reply.send({ updated: 0, skipped: 0 } satisfies ApplyResult);
        }

        // Resolve the price to apply
        let resolvedPrice: number | null = null;

        switch (strategy) {
          case "FIXED":
            resolvedPrice = plan.groupPriceCents;
            break;

          case "PROGRAM_DEFAULT": {
            // Try program pricingTiers first, then plan's marketplace default
            if (plan.programId) {
              const program = await prisma.mktListingBreedingProgram.findUnique({
                where: { id: plan.programId },
                select: { pricingTiers: true },
              });
              if (program?.pricingTiers) {
                const tiers = program.pricingTiers as Array<{ priceCents?: number }>;
                if (Array.isArray(tiers) && tiers.length > 0 && tiers[0].priceCents != null) {
                  resolvedPrice = tiers[0].priceCents;
                }
              }
            }
            if (resolvedPrice == null) {
              resolvedPrice = plan.marketplaceDefaultPriceCents;
            }
            break;
          }

          case "BY_SEX":
            // Handled per-offspring below
            break;
        }

        // For FIXED and PROGRAM_DEFAULT: need a resolved price
        if (strategy !== "BY_SEX" && resolvedPrice == null) {
          return reply.code(400).send({
            error: "no_price_resolved",
            message: `Cannot apply ${strategy} pricing: no price value available.`,
          });
        }

        // Fetch all offspring for this plan
        const offspring = await prisma.offspring.findMany({
          where: { breedingPlanId: planId, tenantId },
          select: {
            id: true,
            sex: true,
            keeperIntent: true,
            priceCents: true,
          },
        });

        let updated = 0;
        let skipped = 0;
        const updates: Array<{ id: number; priceCents: number }> = [];

        for (const o of offspring) {
          // Skip keepers
          if (o.keeperIntent === "KEEP" || o.keeperIntent === "WITHHELD") {
            skipped++;
            continue;
          }

          // Skip offspring that already have an individual price override
          if (o.priceCents != null) {
            skipped++;
            continue;
          }

          let priceForThis: number | null = null;

          if (strategy === "BY_SEX") {
            if (o.sex === "MALE" && plan.malePriceCents != null) {
              priceForThis = plan.malePriceCents;
            } else if (o.sex === "FEMALE" && plan.femalePriceCents != null) {
              priceForThis = plan.femalePriceCents;
            } else {
              // Unknown sex or missing price for this sex — skip
              skipped++;
              continue;
            }
          } else {
            priceForThis = resolvedPrice;
          }

          if (priceForThis != null) {
            updates.push({ id: o.id, priceCents: priceForThis });
            updated++;
          } else {
            skipped++;
          }
        }

        // Batch update in a transaction
        if (updates.length > 0) {
          await prisma.$transaction(
            updates.map(({ id, priceCents }) =>
              prisma.offspring.update({
                where: { id, tenantId },
                data: { priceCents },
              })
            )
          );
        }

        reply.send({ updated, skipped } satisfies ApplyResult);
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );
};

export default breedingPlanPricingRoutes;
