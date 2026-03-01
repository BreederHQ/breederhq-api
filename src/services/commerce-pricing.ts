/**
 * Commerce Pricing — Offspring Price Cascade Resolution
 *
 * Resolves the effective price for an offspring by walking the cascade:
 *
 *   1. offspring.priceCents          → source 'individual'
 *   2. plan.groupPriceCents          → source 'plan_fixed'   (strategy FIXED)
 *      plan.male/femalePriceCents    → source 'plan_sex'     (strategy BY_SEX)
 *   3. program pricingTiers[0]       → source 'program'
 *   4. null                          → source 'none'  (listing should use priceModel = "inquire")
 */

import type { PrismaClient } from "@prisma/client";

export type PriceSource =
  | "individual"
  | "plan_fixed"
  | "plan_sex"
  | "program"
  | "none";

export interface ResolvedPrice {
  priceCents: number | null;
  source: PriceSource;
}

/**
 * Resolve the effective marketplace price for an offspring using the
 * pricing cascade:
 *
 *   offspring.priceCents
 *     ?? plan-level pricing (FIXED → groupPriceCents, BY_SEX → sex-based)
 *     ?? program pricingTiers[0].priceCents
 *     ?? null (source = 'none')
 *
 * @param offspringId - Offspring record ID
 * @param prisma      - Prisma client instance
 */
export async function resolveOffspringPrice(
  offspringId: number,
  prisma: PrismaClient,
): Promise<ResolvedPrice> {
  // ── Step 1: Fetch offspring with plan + program in one query ────────
  const offspring = await prisma.offspring.findUnique({
    where: { id: offspringId },
    select: {
      priceCents: true,
      sex: true,
      breedingPlanId: true,
      BreedingPlan: {
        select: {
          pricingStrategy: true,
          groupPriceCents: true,
          malePriceCents: true,
          femalePriceCents: true,
          marketplaceDefaultPriceCents: true,
          programId: true,
        },
      },
    },
  });

  if (!offspring) {
    return { priceCents: null, source: "none" };
  }

  // ── Step 2: Individual override ────────────────────────────────────
  if (offspring.priceCents != null) {
    return { priceCents: offspring.priceCents, source: "individual" };
  }

  // ── Step 3: Plan-level pricing ─────────────────────────────────────
  const plan = offspring.BreedingPlan;
  if (plan) {
    const strategy = plan.pricingStrategy as string | null;

    if (strategy === "FIXED" && plan.groupPriceCents != null) {
      return { priceCents: plan.groupPriceCents, source: "plan_fixed" };
    }

    if (strategy === "BY_SEX") {
      if (offspring.sex === "MALE" && plan.malePriceCents != null) {
        return { priceCents: plan.malePriceCents, source: "plan_sex" };
      }
      if (offspring.sex === "FEMALE" && plan.femalePriceCents != null) {
        return { priceCents: plan.femalePriceCents, source: "plan_sex" };
      }
    }

    // PROGRAM_DEFAULT strategy — fall through to program lookup below
    // INDIVIDUAL strategy with no offspring.priceCents — also fall through

    // ── Step 4: Program default (pricingTiers[0]) ────────────────────
    if (plan.programId) {
      const program = await prisma.mktListingBreedingProgram.findUnique({
        where: { id: plan.programId },
        select: { pricingTiers: true },
      });

      if (program?.pricingTiers) {
        const tiers = program.pricingTiers as Array<{
          priceCents?: number;
          label?: string;
        }>;
        if (
          Array.isArray(tiers) &&
          tiers.length > 0 &&
          tiers[0].priceCents != null
        ) {
          return { priceCents: tiers[0].priceCents, source: "program" };
        }
      }
    }

    // Fall back to plan's own marketplace default price (legacy field)
    if (plan.marketplaceDefaultPriceCents != null) {
      return {
        priceCents: plan.marketplaceDefaultPriceCents,
        source: "program",
      };
    }
  }

  // ── Step 5: No price resolved ──────────────────────────────────────
  return { priceCents: null, source: "none" };
}
