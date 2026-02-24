// src/services/buyer-offspring-automation.ts
// Automates the connection of breeding plan buyers to born offspring
//
// OGC-02: Simplified to single buyer model (BreedingPlanBuyer only).
// connectGroupBuyersToOffspring() removed — group buyers are now plan buyers.
//
// When offspring are recorded for a breeding plan:
// 1. Find all BreedingPlanBuyer records for that plan
// 2. For each buyer with an ASSIGNED stage, create BuyerInterest for the new animal
// 3. Optionally create a Deal in INQUIRY stage

import prisma from "../prisma.js";
import { findOrCreateBuyer } from "./buyer-migration-service.js";
import type { BreedingPlanBuyerStage, InterestLevel, DealStage } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ConnectPlanBuyersParams {
  /** The breeding plan that produced offspring */
  breedingPlanId: number;
  /** The animal ID of the born offspring (from Animal table if promoted, or ID from Offspring) */
  offspringAnimalId: number;
  /** The tenant ID */
  tenantId: number;
  /** Only connect buyers in these stages (default: ASSIGNED, MATCHED_TO_OFFSPRING) */
  stages?: BreedingPlanBuyerStage[];
  /** Create a Deal for each buyer (default: false) */
  createDeals?: boolean;
  /** The interest level to set (default: SERIOUS) */
  interestLevel?: InterestLevel;
}

export interface ConnectResult {
  /** Number of buyers found for the plan */
  buyersFound: number;
  /** Number of BuyerInterest records created */
  interestsCreated: number;
  /** Number of BuyerInterest records that already existed */
  interestsSkipped: number;
  /** Number of Deals created (if createDeals was true) */
  dealsCreated: number;
  /** Errors encountered */
  errors: Array<{ buyerId: number; error: string }>;
}

// OGC-02: ConnectGroupBuyersParams removed — no separate group buyer model

// ────────────────────────────────────────────────────────────────────────────
// Core Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Connects all eligible buyers from a breeding plan to a newly born offspring.
 *
 * For each BreedingPlanBuyer with an eligible stage:
 * 1. Ensure the buyer has a Buyer CRM record (via findOrCreateBuyer)
 * 2. Create a BuyerInterest for the new animal
 * 3. Optionally create a Deal
 *
 * This function is idempotent - calling it multiple times for the same
 * plan/offspring pair will not create duplicate interests.
 */
export async function connectPlanBuyersToOffspring(
  params: ConnectPlanBuyersParams
): Promise<ConnectResult> {
  const {
    breedingPlanId,
    offspringAnimalId,
    tenantId,
    stages = ["ASSIGNED", "MATCHED_TO_OFFSPRING"],
    createDeals = false,
    interestLevel = "SERIOUS",
  } = params;

  const result: ConnectResult = {
    buyersFound: 0,
    interestsCreated: 0,
    interestsSkipped: 0,
    dealsCreated: 0,
    errors: [],
  };

  // Get all plan buyers with eligible stages
  const planBuyers = await prisma.breedingPlanBuyer.findMany({
    where: {
      tenantId,
      planId: breedingPlanId,
      stage: { in: stages },
    },
    include: {
      party: { select: { id: true, name: true } },
      waitlistEntry: { select: { clientPartyId: true } },
    },
  });

  result.buyersFound = planBuyers.length;

  // Verify the animal exists
  const animal = await prisma.animal.findFirst({
    where: { id: offspringAnimalId, tenantId },
    select: { id: true, name: true },
  });

  if (!animal) {
    throw new Error(`Animal id=${offspringAnimalId} not found in tenant ${tenantId}`);
  }

  for (const planBuyer of planBuyers) {
    try {
      // Resolve the party ID
      let partyId = planBuyer.partyId;
      if (!partyId && planBuyer.waitlistEntry?.clientPartyId) {
        partyId = planBuyer.waitlistEntry.clientPartyId;
      }

      if (!partyId) {
        result.errors.push({
          buyerId: planBuyer.id,
          error: "No party ID found",
        });
        continue;
      }

      // Get or create Buyer CRM record
      let buyerId = planBuyer.buyerId;
      if (!buyerId) {
        const buyer = await findOrCreateBuyer(tenantId, partyId, "BreedingPlanOffspring");
        buyerId = buyer.id;

        // Update the plan buyer with the buyerId
        await prisma.breedingPlanBuyer.update({
          where: { id: planBuyer.id },
          data: { buyerId },
        });
      }

      // Check if interest already exists
      const existingInterest = await prisma.buyerInterest.findUnique({
        where: {
          buyerId_animalId: {
            buyerId,
            animalId: offspringAnimalId,
          },
        },
      });

      if (existingInterest) {
        result.interestsSkipped++;
      } else {
        // Create BuyerInterest
        await prisma.buyerInterest.create({
          data: {
            buyerId,
            animalId: offspringAnimalId,
            level: interestLevel,
            notes: `Auto-linked from breeding plan (plan ID: ${breedingPlanId})`,
          },
        });
        result.interestsCreated++;
      }

      // Optionally create Deal
      if (createDeals) {
        // Check if deal already exists for this buyer/animal
        const existingDeal = await prisma.deal.findFirst({
          where: {
            tenantId,
            buyerId,
            animalId: offspringAnimalId,
          },
        });

        if (!existingDeal) {
          const buyerName = planBuyer.party?.name || "Buyer";
          const animalName = animal.name || "Offspring";

          await prisma.deal.create({
            data: {
              tenantId,
              buyerId,
              animalId: offspringAnimalId,
              name: `${buyerName} - ${animalName}`,
              stage: "INQUIRY" as DealStage,
              notes: `Auto-created from breeding plan offspring (plan ID: ${breedingPlanId})`,
            },
          });
          result.dealsCreated++;
        }
      }

      // Update BreedingPlanBuyer stage to MATCHED_TO_OFFSPRING if ASSIGNED
      if (planBuyer.stage === "ASSIGNED") {
        await prisma.breedingPlanBuyer.update({
          where: { id: planBuyer.id },
          data: {
            stage: "MATCHED_TO_OFFSPRING",
            offspringId: offspringAnimalId,
          },
        });
      }
    } catch (err) {
      result.errors.push({
        buyerId: planBuyer.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

// OGC-02: connectGroupBuyersToOffspring() REMOVED.
// Group buyers are now BreedingPlanBuyer records — connectPlanBuyersToOffspring handles everything.

/**
 * Connects all buyers from a breeding plan to a newly born offspring.
 *
 * OGC-02: Simplified — just calls connectPlanBuyersToOffspring.
 * The separate group buyers path has been eliminated.
 */
export async function connectAllBuyersToOffspring(params: {
  breedingPlanId: number;
  offspringAnimalId: number;
  tenantId: number;
  createDeals?: boolean;
  interestLevel?: InterestLevel;
}): Promise<{
  planBuyers: ConnectResult;
  groupBuyers: ConnectResult | null;
}> {
  const planResult = await connectPlanBuyersToOffspring({
    breedingPlanId: params.breedingPlanId,
    offspringAnimalId: params.offspringAnimalId,
    tenantId: params.tenantId,
    createDeals: params.createDeals,
    interestLevel: params.interestLevel,
  });

  // OGC-02: No separate group buyers path — return null for backward compat
  return {
    planBuyers: planResult,
    groupBuyers: null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Event Handlers (for integration with offspring recording flows)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Event handler for when an offspring is promoted to the Animal table.
 *
 * OGC-05: Uses offspring.breedingPlanId directly (OffspringGroup dropped).
 * If the offspring has a linked plan, connect plan buyers.
 * If not, return empty result.
 */
export async function onOffspringPromotedToAnimal(params: {
  offspringId: number;
  animalId: number;
  tenantId: number;
  createDeals?: boolean;
}): Promise<{
  planBuyers: ConnectResult;
  groupBuyers: ConnectResult | null;
}> {
  // Get the offspring to find the plan
  const offspring = await prisma.offspring.findFirst({
    where: { id: params.offspringId, tenantId: params.tenantId },
    select: { id: true, breedingPlanId: true },
  });

  if (!offspring) {
    throw new Error(`Offspring id=${params.offspringId} not found`);
  }

  const breedingPlanId = offspring.breedingPlanId;
  if (!breedingPlanId) {
    // Offspring not linked to a plan — no buyers to connect
    return {
      planBuyers: {
        buyersFound: 0,
        interestsCreated: 0,
        interestsSkipped: 0,
        dealsCreated: 0,
        errors: [],
      },
      groupBuyers: null,
    };
  }

  return connectAllBuyersToOffspring({
    breedingPlanId,
    offspringAnimalId: params.animalId,
    tenantId: params.tenantId,
    createDeals: params.createDeals,
  });
}

/**
 * Event handler for when offspring are recorded for a breeding plan.
 *
 * OGC-02: Simplified — only uses plan buyers.
 */
export async function onOffspringRecorded(params: {
  breedingPlanId: number;
  tenantId: number;
  /** Animal IDs if offspring were created directly as Animals */
  animalIds?: number[];
  /** Offspring IDs if using the Offspring table */
  offspringIds?: number[];
  createDeals?: boolean;
}): Promise<Array<{
  animalId: number | null;
  offspringId: number | null;
  planBuyers: ConnectResult;
  groupBuyers: ConnectResult | null;
}>> {
  const results: Array<{
    animalId: number | null;
    offspringId: number | null;
    planBuyers: ConnectResult;
    groupBuyers: ConnectResult | null;
  }> = [];

  // Handle direct Animal IDs
  if (params.animalIds?.length) {
    for (const animalId of params.animalIds) {
      const result = await connectAllBuyersToOffspring({
        breedingPlanId: params.breedingPlanId,
        offspringAnimalId: animalId,
        tenantId: params.tenantId,
        createDeals: params.createDeals,
      });

      results.push({
        animalId,
        offspringId: null,
        ...result,
      });
    }
  }

  // Handle Offspring IDs (need to check if they have linked Animals)
  if (params.offspringIds?.length) {
    for (const offspringId of params.offspringIds) {
      // In current schema, offspring don't have animalId
      // They get promoted to Animal table separately
      // So we track that the offspring exists but don't create interest yet
      results.push({
        animalId: null,
        offspringId,
        planBuyers: {
          buyersFound: 0,
          interestsCreated: 0,
          interestsSkipped: 0,
          dealsCreated: 0,
          errors: [],
        },
        groupBuyers: null,
      });
    }
  }

  return results;
}
