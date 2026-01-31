// src/services/buyer-migration-service.ts
// Buyer CRM Integration Service - Migrates old buyer systems to new CRM
//
// This service bridges the OLD buyer systems (BreedingPlanBuyer, OffspringGroupBuyer, WaitlistEntry)
// with the NEW Buyer CRM system (P4/P5).
//
// Old systems reference buyers via partyId/clientPartyId
// New system has Buyer records with unique partyId link
// This service:
// 1. Creates Buyer records for Parties that don't have one
// 2. Links old buyer records to the new Buyer entity via buyerId

import prisma from "../prisma.js";
import type { Buyer, BuyerStatus, Prisma } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface MigrationResult {
  total: number;
  migrated: number;
  alreadyLinked: number;
  skipped: number;
  errors: Array<{ id: number; error: string }>;
}

export interface FullMigrationResult {
  breedingPlanBuyers: MigrationResult;
  offspringGroupBuyers: MigrationResult;
  waitlistEntries: MigrationResult;
  buyersCreated: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Core Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Finds an existing Buyer for a Party, or creates one if it doesn't exist.
 *
 * This is the core function for migrating old buyer references to the new CRM.
 * If the Party already has a Buyer record, returns it.
 * If not, creates a new Buyer with LEAD status.
 *
 * @param tenantId - The tenant ID
 * @param partyId - The Party ID to find or create a Buyer for
 * @param source - Optional source to set on new Buyers (e.g., "Migration", "WaitlistEntry")
 * @returns The existing or newly created Buyer
 */
export async function findOrCreateBuyer(
  tenantId: number,
  partyId: number,
  source?: string
): Promise<Buyer> {
  // Check if Buyer already exists for this Party
  const existingBuyer = await prisma.buyer.findUnique({
    where: { partyId },
  });

  if (existingBuyer) {
    // Verify tenant matches
    if (existingBuyer.tenantId !== tenantId) {
      throw new Error(`Buyer partyId=${partyId} belongs to different tenant`);
    }
    return existingBuyer;
  }

  // Verify Party exists and belongs to this tenant
  const party = await prisma.party.findFirst({
    where: { id: partyId, tenantId },
    select: { id: true, name: true },
  });

  if (!party) {
    throw new Error(`Party id=${partyId} not found in tenant ${tenantId}`);
  }

  // Create new Buyer record
  const buyer = await prisma.buyer.create({
    data: {
      tenantId,
      partyId,
      status: "LEAD" as BuyerStatus,
      source: source || "Migration",
      preferredBreeds: [],
      preferredUses: [],
    },
  });

  // Log activity on the party
  try {
    await prisma.partyActivity.create({
      data: {
        tenantId,
        partyId,
        kind: "STATUS_CHANGED",
        title: "Added to buyer CRM",
        detail: `Migrated to buyer pipeline via ${source || "migration"}`,
      },
    });
  } catch {
    // Don't fail if activity logging fails
  }

  return buyer;
}

/**
 * Gets the Party ID from a BreedingPlanBuyer record.
 * Returns the direct partyId if set, otherwise resolves via waitlistEntry.
 */
async function getPartyIdForPlanBuyer(
  planBuyer: {
    partyId: number | null;
    waitlistEntryId: number | null;
  }
): Promise<number | null> {
  // Direct party reference takes precedence
  if (planBuyer.partyId) {
    return planBuyer.partyId;
  }

  // Resolve via waitlist entry
  if (planBuyer.waitlistEntryId) {
    const waitlistEntry = await prisma.waitlistEntry.findUnique({
      where: { id: planBuyer.waitlistEntryId },
      select: { clientPartyId: true },
    });
    return waitlistEntry?.clientPartyId || null;
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Migration Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Migrates all BreedingPlanBuyer records for a tenant to link to Buyer CRM.
 *
 * For each BreedingPlanBuyer:
 * 1. If already has buyerId, skip
 * 2. Resolve the Party (via partyId or waitlistEntry.clientPartyId)
 * 3. Find or create a Buyer for that Party
 * 4. Set the buyerId on the BreedingPlanBuyer
 */
export async function migrateBreedingPlanBuyers(
  tenantId: number
): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    alreadyLinked: 0,
    skipped: 0,
    errors: [],
  };

  const planBuyers = await prisma.breedingPlanBuyer.findMany({
    where: { tenantId },
    select: {
      id: true,
      partyId: true,
      waitlistEntryId: true,
      buyerId: true,
    },
  });

  result.total = planBuyers.length;

  for (const planBuyer of planBuyers) {
    try {
      // Already linked
      if (planBuyer.buyerId) {
        result.alreadyLinked++;
        continue;
      }

      // Resolve party ID
      const partyId = await getPartyIdForPlanBuyer(planBuyer);
      if (!partyId) {
        result.skipped++;
        continue;
      }

      // Find or create buyer
      const buyer = await findOrCreateBuyer(tenantId, partyId, "BreedingPlanBuyer");

      // Link to buyer
      await prisma.breedingPlanBuyer.update({
        where: { id: planBuyer.id },
        data: { buyerId: buyer.id },
      });

      result.migrated++;
    } catch (err) {
      result.errors.push({
        id: planBuyer.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Migrates all OffspringGroupBuyer records for a tenant to link to Buyer CRM.
 *
 * For each OffspringGroupBuyer:
 * 1. If already has buyerId, skip
 * 2. Resolve the Party (via buyerPartyId or waitlistEntry.clientPartyId)
 * 3. Find or create a Buyer for that Party
 * 4. Set the buyerId on the OffspringGroupBuyer
 */
export async function migrateOffspringGroupBuyers(
  tenantId: number
): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    alreadyLinked: 0,
    skipped: 0,
    errors: [],
  };

  const groupBuyers = await prisma.offspringGroupBuyer.findMany({
    where: { tenantId },
    select: {
      id: true,
      buyerPartyId: true,
      waitlistEntryId: true,
      buyerId: true,
    },
  });

  result.total = groupBuyers.length;

  for (const groupBuyer of groupBuyers) {
    try {
      // Already linked
      if (groupBuyer.buyerId) {
        result.alreadyLinked++;
        continue;
      }

      // Resolve party ID (buyerPartyId takes precedence)
      let partyId = groupBuyer.buyerPartyId;

      if (!partyId && groupBuyer.waitlistEntryId) {
        const waitlistEntry = await prisma.waitlistEntry.findUnique({
          where: { id: groupBuyer.waitlistEntryId },
          select: { clientPartyId: true },
        });
        partyId = waitlistEntry?.clientPartyId || null;
      }

      if (!partyId) {
        result.skipped++;
        continue;
      }

      // Find or create buyer
      const buyer = await findOrCreateBuyer(tenantId, partyId, "OffspringGroupBuyer");

      // Link to buyer
      await prisma.offspringGroupBuyer.update({
        where: { id: groupBuyer.id },
        data: { buyerId: buyer.id },
      });

      result.migrated++;
    } catch (err) {
      result.errors.push({
        id: groupBuyer.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Migrates all WaitlistEntry records for a tenant to link to Buyer CRM.
 *
 * For each WaitlistEntry:
 * 1. If already has buyerId, skip
 * 2. If has clientPartyId, find or create a Buyer
 * 3. Set the buyerId on the WaitlistEntry
 * 4. Optionally create BuyerInterest if the entry has an animal allocation
 */
export async function migrateWaitlistEntries(
  tenantId: number
): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    alreadyLinked: 0,
    skipped: 0,
    errors: [],
  };

  const entries = await prisma.waitlistEntry.findMany({
    where: { tenantId },
    select: {
      id: true,
      clientPartyId: true,
      buyerId: true,
      animalId: true,
      offspringId: true,
    },
  });

  result.total = entries.length;

  for (const entry of entries) {
    try {
      // Already linked
      if (entry.buyerId) {
        result.alreadyLinked++;
        continue;
      }

      // No party to link
      if (!entry.clientPartyId) {
        result.skipped++;
        continue;
      }

      // Find or create buyer
      const buyer = await findOrCreateBuyer(tenantId, entry.clientPartyId, "WaitlistEntry");

      // Link to buyer
      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { buyerId: buyer.id },
      });

      // If entry has an animal allocation (legacy), create BuyerInterest
      if (entry.animalId) {
        // Check if interest already exists
        const existingInterest = await prisma.buyerInterest.findUnique({
          where: {
            buyerId_animalId: {
              buyerId: buyer.id,
              animalId: entry.animalId,
            },
          },
        });

        if (!existingInterest) {
          await prisma.buyerInterest.create({
            data: {
              buyerId: buyer.id,
              animalId: entry.animalId,
              level: "SERIOUS",
              notes: "Migrated from waitlist allocation",
            },
          });
        }
      }

      result.migrated++;
    } catch (err) {
      result.errors.push({
        id: entry.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Runs full buyer migration for a tenant.
 *
 * Migrates all three old buyer systems to link to the new Buyer CRM:
 * - BreedingPlanBuyer
 * - OffspringGroupBuyer
 * - WaitlistEntry
 *
 * This is idempotent - can be run multiple times safely.
 */
export async function runFullBuyerMigration(
  tenantId: number
): Promise<FullMigrationResult> {
  // Count buyers before
  const buyersBefore = await prisma.buyer.count({
    where: { tenantId },
  });

  // Run migrations in order (waitlist first since others may reference it)
  const waitlistResult = await migrateWaitlistEntries(tenantId);
  const planBuyerResult = await migrateBreedingPlanBuyers(tenantId);
  const groupBuyerResult = await migrateOffspringGroupBuyers(tenantId);

  // Count buyers after
  const buyersAfter = await prisma.buyer.count({
    where: { tenantId },
  });

  return {
    breedingPlanBuyers: planBuyerResult,
    offspringGroupBuyers: groupBuyerResult,
    waitlistEntries: waitlistResult,
    buyersCreated: buyersAfter - buyersBefore,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Gets a unified view of all buyer connections for a Buyer record.
 *
 * Returns all the old-system records linked to this buyer:
 * - BreedingPlanBuyer records (interest in breeding plans)
 * - OffspringGroupBuyer records (interest in offspring groups)
 * - WaitlistEntry records (waitlist positions)
 */
export async function getBuyerConnections(buyerId: number) {
  const buyer = await prisma.buyer.findUnique({
    where: { id: buyerId },
    include: {
      // Direct BuyerInterest (new CRM)
      interests: {
        include: {
          animal: {
            select: {
              id: true,
              name: true,
              species: true,
              sex: true,
              breed: true,
              photoUrl: true,
            },
          },
        },
      },
      // Breeding plan buyers (old system)
      breedingPlanBuyers: {
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              status: true,
              sire: { select: { id: true, name: true } },
              dam: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      // Offspring group buyers (old system)
      offspringGroupBuyers: {
        include: {
          group: {
            select: {
              id: true,
              name: true,
              status: true,
              _count: { select: { Offspring: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      // Waitlist entries (old system)
      waitlistEntries: {
        include: {
          plan: { select: { id: true, name: true } },
          offspring: { select: { id: true, name: true } },
          animal: { select: { id: true, name: true } },
          program: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return buyer;
}

/**
 * Checks migration status for a tenant.
 *
 * Returns counts of linked vs unlinked records for each old buyer system.
 */
export async function getMigrationStatus(tenantId: number) {
  const [
    planBuyersTotal,
    planBuyersLinked,
    groupBuyersTotal,
    groupBuyersLinked,
    waitlistTotal,
    waitlistLinked,
    buyersTotal,
  ] = await Promise.all([
    prisma.breedingPlanBuyer.count({ where: { tenantId } }),
    prisma.breedingPlanBuyer.count({ where: { tenantId, buyerId: { not: null } } }),
    prisma.offspringGroupBuyer.count({ where: { tenantId } }),
    prisma.offspringGroupBuyer.count({ where: { tenantId, buyerId: { not: null } } }),
    prisma.waitlistEntry.count({ where: { tenantId } }),
    prisma.waitlistEntry.count({ where: { tenantId, buyerId: { not: null } } }),
    prisma.buyer.count({ where: { tenantId } }),
  ]);

  return {
    buyers: {
      total: buyersTotal,
    },
    breedingPlanBuyers: {
      total: planBuyersTotal,
      linked: planBuyersLinked,
      unlinked: planBuyersTotal - planBuyersLinked,
      percentage: planBuyersTotal > 0 ? Math.round((planBuyersLinked / planBuyersTotal) * 100) : 100,
    },
    offspringGroupBuyers: {
      total: groupBuyersTotal,
      linked: groupBuyersLinked,
      unlinked: groupBuyersTotal - groupBuyersLinked,
      percentage: groupBuyersTotal > 0 ? Math.round((groupBuyersLinked / groupBuyersTotal) * 100) : 100,
    },
    waitlistEntries: {
      total: waitlistTotal,
      linked: waitlistLinked,
      unlinked: waitlistTotal - waitlistLinked,
      percentage: waitlistTotal > 0 ? Math.round((waitlistLinked / waitlistTotal) * 100) : 100,
    },
    overallPercentage:
      planBuyersTotal + groupBuyersTotal + waitlistTotal > 0
        ? Math.round(
            ((planBuyersLinked + groupBuyersLinked + waitlistLinked) /
              (planBuyersTotal + groupBuyersTotal + waitlistTotal)) *
              100
          )
        : 100,
  };
}
