/**
 * Party migration step 5: Backfill Animals domain party references
 *
 * This script performs idempotent backfill of:
 * A) Animal.buyerPartyId from buyerContactId/buyerOrganizationId
 * B) AnimalOwner.partyId from contactId/organizationId
 * C) AnimalOwnershipChange fromOwnerParties/toOwnerParties from legacy JSON
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config({ path: '.env.dev.migrate' });

const prisma = new PrismaClient();

interface BackfillStats {
  animalBuyers: {
    total: number;
    alreadyHasPartyId: number;
    backfilledFromContact: number;
    backfilledFromOrg: number;
    conflicts: number;
    noLegacyData: number;
  };
  animalOwners: {
    total: number;
    alreadyHasPartyId: number;
    backfilledFromContact: number;
    backfilledFromOrg: number;
    conflicts: number;
    noLegacyData: number;
  };
  ownershipChanges: {
    total: number;
    alreadyProcessed: number;
    fromOwnersProcessed: number;
    toOwnersProcessed: number;
    fromOwnersUnresolved: number;
    toOwnersUnresolved: number;
    errors: number;
  };
}

const stats: BackfillStats = {
  animalBuyers: {
    total: 0,
    alreadyHasPartyId: 0,
    backfilledFromContact: 0,
    backfilledFromOrg: 0,
    conflicts: 0,
    noLegacyData: 0,
  },
  animalOwners: {
    total: 0,
    alreadyHasPartyId: 0,
    backfilledFromContact: 0,
    backfilledFromOrg: 0,
    conflicts: 0,
    noLegacyData: 0,
  },
  ownershipChanges: {
    total: 0,
    alreadyProcessed: 0,
    fromOwnersProcessed: 0,
    toOwnersProcessed: 0,
    fromOwnersUnresolved: 0,
    toOwnersUnresolved: 0,
    errors: 0,
  },
};

/**
 * A) Backfill Animal.buyerPartyId
 */
async function backfillAnimalBuyers() {
  console.log('\n─────────────────────────────────────────────');
  console.log('A) Backfilling Animal.buyerPartyId...');
  console.log('─────────────────────────────────────────────');

  const animals = await prisma.animal.findMany({
    select: {
      id: true,
      buyerPartyId: true,
      buyerContactId: true,
      buyerOrganizationId: true,
    },
  });

  stats.animalBuyers.total = animals.length;

  for (const animal of animals) {
    // Already backfilled
    if (animal.buyerPartyId !== null) {
      stats.animalBuyers.alreadyHasPartyId++;
      continue;
    }

    // Conflict: both legacy IDs exist
    if (animal.buyerContactId && animal.buyerOrganizationId) {
      console.warn(
        `Animal ${animal.id}: Conflict - has both buyerContactId and buyerOrganizationId`
      );
      stats.animalBuyers.conflicts++;
      continue;
    }

    // Backfill from Contact
    if (animal.buyerContactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: animal.buyerContactId },
        select: { partyId: true },
      });

      if (contact?.partyId) {
        await prisma.animal.update({
          where: { id: animal.id },
          data: { buyerPartyId: contact.partyId },
        });
        stats.animalBuyers.backfilledFromContact++;
      } else {
        console.warn(
          `Animal ${animal.id}: Contact ${animal.buyerContactId} has no partyId`
        );
        stats.animalBuyers.noLegacyData++;
      }
      continue;
    }

    // Backfill from Organization
    if (animal.buyerOrganizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: animal.buyerOrganizationId },
        select: { partyId: true },
      });

      if (org?.partyId) {
        await prisma.animal.update({
          where: { id: animal.id },
          data: { buyerPartyId: org.partyId },
        });
        stats.animalBuyers.backfilledFromOrg++;
      } else {
        console.warn(
          `Animal ${animal.id}: Organization ${animal.buyerOrganizationId} has no partyId`
        );
        stats.animalBuyers.noLegacyData++;
      }
      continue;
    }

    // No legacy data
    stats.animalBuyers.noLegacyData++;
  }

  console.log('Animal buyers backfill complete:');
  console.log(`  Total animals: ${stats.animalBuyers.total}`);
  console.log(`  Already had partyId: ${stats.animalBuyers.alreadyHasPartyId}`);
  console.log(`  Backfilled from Contact: ${stats.animalBuyers.backfilledFromContact}`);
  console.log(`  Backfilled from Organization: ${stats.animalBuyers.backfilledFromOrg}`);
  console.log(`  Conflicts (both IDs): ${stats.animalBuyers.conflicts}`);
  console.log(`  No legacy data: ${stats.animalBuyers.noLegacyData}`);
}

/**
 * B) Backfill AnimalOwner.partyId
 */
async function backfillAnimalOwners() {
  console.log('\n─────────────────────────────────────────────');
  console.log('B) Backfilling AnimalOwner.partyId...');
  console.log('─────────────────────────────────────────────');

  const owners = await prisma.animalOwner.findMany({
    select: {
      id: true,
      partyId: true,
      contactId: true,
      organizationId: true,
    },
  });

  stats.animalOwners.total = owners.length;

  for (const owner of owners) {
    // Already backfilled
    if (owner.partyId !== null) {
      stats.animalOwners.alreadyHasPartyId++;
      continue;
    }

    // Conflict: both legacy IDs exist
    if (owner.contactId && owner.organizationId) {
      console.warn(
        `AnimalOwner ${owner.id}: Conflict - has both contactId and organizationId`
      );
      stats.animalOwners.conflicts++;
      continue;
    }

    // Backfill from Contact
    if (owner.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: owner.contactId },
        select: { partyId: true },
      });

      if (contact?.partyId) {
        await prisma.animalOwner.update({
          where: { id: owner.id },
          data: { partyId: contact.partyId },
        });
        stats.animalOwners.backfilledFromContact++;
      } else {
        console.warn(
          `AnimalOwner ${owner.id}: Contact ${owner.contactId} has no partyId`
        );
        stats.animalOwners.noLegacyData++;
      }
      continue;
    }

    // Backfill from Organization
    if (owner.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: owner.organizationId },
        select: { partyId: true },
      });

      if (org?.partyId) {
        await prisma.animalOwner.update({
          where: { id: owner.id },
          data: { partyId: org.partyId },
        });
        stats.animalOwners.backfilledFromOrg++;
      } else {
        console.warn(
          `AnimalOwner ${owner.id}: Organization ${owner.organizationId} has no partyId`
        );
        stats.animalOwners.noLegacyData++;
      }
      continue;
    }

    // No legacy data
    stats.animalOwners.noLegacyData++;
  }

  console.log('AnimalOwner backfill complete:');
  console.log(`  Total owners: ${stats.animalOwners.total}`);
  console.log(`  Already had partyId: ${stats.animalOwners.alreadyHasPartyId}`);
  console.log(`  Backfilled from Contact: ${stats.animalOwners.backfilledFromContact}`);
  console.log(`  Backfilled from Organization: ${stats.animalOwners.backfilledFromOrg}`);
  console.log(`  Conflicts (both IDs): ${stats.animalOwners.conflicts}`);
  console.log(`  No legacy data: ${stats.animalOwners.noLegacyData}`);
}

/**
 * C) Backfill AnimalOwnershipChange JSON
 */
interface LegacyOwner {
  contactId?: number;
  organizationId?: number;
  [key: string]: unknown;
}

interface PartyOwner {
  partyId: number | null;
  kind: 'CONTACT' | 'ORGANIZATION';
  legacyContactId?: number;
  legacyOrganizationId?: number;
  [key: string]: unknown;
}

async function backfillOwnershipChangeJSON() {
  console.log('\n─────────────────────────────────────────────');
  console.log('C) Backfilling AnimalOwnershipChange JSON...');
  console.log('─────────────────────────────────────────────');

  const changes = await prisma.animalOwnershipChange.findMany({
    select: {
      id: true,
      fromOwners: true,
      toOwners: true,
      fromOwnerParties: true,
      toOwnerParties: true,
    },
  });

  stats.ownershipChanges.total = changes.length;

  for (const change of changes) {
    try {
      // Skip if already processed
      if (change.fromOwnerParties !== null && change.toOwnerParties !== null) {
        stats.ownershipChanges.alreadyProcessed++;
        continue;
      }

      let fromParties: PartyOwner[] | null = null;
      let toParties: PartyOwner[] | null = null;

      // Process fromOwners
      if (change.fromOwnerParties === null && change.fromOwners) {
        const legacyFromOwners = Array.isArray(change.fromOwners)
          ? (change.fromOwners as LegacyOwner[])
          : [];

        fromParties = await Promise.all(
          legacyFromOwners.map(async (owner) => {
            const partyOwner: PartyOwner = {
              partyId: null,
              kind: owner.contactId ? 'CONTACT' : 'ORGANIZATION',
            };

            // Preserve original fields
            Object.assign(partyOwner, owner);

            // Resolve partyId
            if (owner.contactId) {
              const contact = await prisma.contact.findUnique({
                where: { id: owner.contactId },
                select: { partyId: true },
              });
              partyOwner.partyId = contact?.partyId ?? null;
              partyOwner.legacyContactId = owner.contactId;
            } else if (owner.organizationId) {
              const org = await prisma.organization.findUnique({
                where: { id: owner.organizationId },
                select: { partyId: true },
              });
              partyOwner.partyId = org?.partyId ?? null;
              partyOwner.legacyOrganizationId = owner.organizationId;
            }

            if (partyOwner.partyId === null) {
              stats.ownershipChanges.fromOwnersUnresolved++;
            }

            return partyOwner;
          })
        );
        stats.ownershipChanges.fromOwnersProcessed++;
      }

      // Process toOwners
      if (change.toOwnerParties === null && change.toOwners) {
        const legacyToOwners = Array.isArray(change.toOwners)
          ? (change.toOwners as LegacyOwner[])
          : [];

        toParties = await Promise.all(
          legacyToOwners.map(async (owner) => {
            const partyOwner: PartyOwner = {
              partyId: null,
              kind: owner.contactId ? 'CONTACT' : 'ORGANIZATION',
            };

            // Preserve original fields
            Object.assign(partyOwner, owner);

            // Resolve partyId
            if (owner.contactId) {
              const contact = await prisma.contact.findUnique({
                where: { id: owner.contactId },
                select: { partyId: true },
              });
              partyOwner.partyId = contact?.partyId ?? null;
              partyOwner.legacyContactId = owner.contactId;
            } else if (owner.organizationId) {
              const org = await prisma.organization.findUnique({
                where: { id: owner.organizationId },
                select: { partyId: true },
              });
              partyOwner.partyId = org?.partyId ?? null;
              partyOwner.legacyOrganizationId = owner.organizationId;
            }

            if (partyOwner.partyId === null) {
              stats.ownershipChanges.toOwnersUnresolved++;
            }

            return partyOwner;
          })
        );
        stats.ownershipChanges.toOwnersProcessed++;
      }

      // Update if we processed anything
      if (fromParties !== null || toParties !== null) {
        await prisma.animalOwnershipChange.update({
          where: { id: change.id },
          data: {
            ...(fromParties !== null && { fromOwnerParties: fromParties }),
            ...(toParties !== null && { toOwnerParties: toParties }),
          },
        });
      }
    } catch (error) {
      console.error(`Error processing ownership change ${change.id}:`, error);
      stats.ownershipChanges.errors++;
    }
  }

  console.log('AnimalOwnershipChange JSON backfill complete:');
  console.log(`  Total records: ${stats.ownershipChanges.total}`);
  console.log(`  Already processed: ${stats.ownershipChanges.alreadyProcessed}`);
  console.log(`  fromOwners processed: ${stats.ownershipChanges.fromOwnersProcessed}`);
  console.log(`  toOwners processed: ${stats.ownershipChanges.toOwnersProcessed}`);
  console.log(`  fromOwners unresolved: ${stats.ownershipChanges.fromOwnersUnresolved}`);
  console.log(`  toOwners unresolved: ${stats.ownershipChanges.toOwnersUnresolved}`);
  console.log(`  Errors: ${stats.ownershipChanges.errors}`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Party Migration Step 5: Animals Domain Backfill');
  console.log('═══════════════════════════════════════════════════════════');

  await backfillAnimalBuyers();
  await backfillAnimalOwners();
  await backfillOwnershipChangeJSON();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Backfill Complete');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\nSummary:');
  console.log('Animal Buyers:');
  console.log(`  Backfilled: ${stats.animalBuyers.backfilledFromContact + stats.animalBuyers.backfilledFromOrg}`);
  console.log(`  Conflicts: ${stats.animalBuyers.conflicts}`);
  console.log(`  Missing data: ${stats.animalBuyers.noLegacyData}`);
  console.log('\nAnimal Owners:');
  console.log(`  Backfilled: ${stats.animalOwners.backfilledFromContact + stats.animalOwners.backfilledFromOrg}`);
  console.log(`  Conflicts: ${stats.animalOwners.conflicts}`);
  console.log(`  Missing data: ${stats.animalOwners.noLegacyData}`);
  console.log('\nOwnership Changes:');
  console.log(`  Records processed: ${stats.ownershipChanges.fromOwnersProcessed + stats.ownershipChanges.toOwnersProcessed}`);
  console.log(`  Unresolved partyIds: ${stats.ownershipChanges.fromOwnersUnresolved + stats.ownershipChanges.toOwnersUnresolved}`);
  console.log(`  Errors: ${stats.ownershipChanges.errors}`);
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
