/**
 * Purge E2E Test Data for Breeding Business Rules Tests
 *
 * This script HARD DELETES all test breeding plans and their related data:
 * - Test breeding plans (names starting with "Test Plan")
 * - Offspring groups linked to those plans
 * - All offspring records in those groups
 * - Any orphaned offspring groups
 *
 * Usage:
 *   npx tsx scripts/purge-e2e-test-data.ts
 *
 * Prerequisites:
 *   - Database connection configured
 *   - Tenant ID 4 (Tatooine) exists
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID = 4; // Tatooine tenant

async function purgeTestData() {
  console.log("═".repeat(60));
  console.log("PURGING E2E Test Data");
  console.log("═".repeat(60));
  console.log(`\nTarget tenant: ${TENANT_ID}\n`);

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: TENANT_ID },
  });

  if (!tenant) {
    console.error(`❌ Tenant ${TENANT_ID} not found!`);
    process.exit(1);
  }

  console.log(`✓ Tenant found: ${tenant.name}\n`);

  // Step 1: Find all test breeding plans (exclude already soft-deleted ones)
  const testPlans = await prisma.breedingPlan.findMany({
    where: {
      tenantId: TENANT_ID,
      name: { startsWith: "Test Plan" },
      deletedAt: null, // Only find non-deleted plans
    },
    include: {
      offspringGroup: {
        include: {
          Offspring: true,
          AnimalsLegacy: true,
        },
      },
    },
  });

  console.log(`\n🔍 Found ${testPlans.length} test breeding plans\n`);

  let deletedOffspring = 0;
  let deletedGroups = 0;
  let deletedPlans = 0;

  for (const plan of testPlans) {
    console.log(`\n📋 Processing plan: ${plan.name} (ID: ${plan.id})`);

    if (plan.offspringGroup) {
      const group = plan.offspringGroup;
      const offspring = group.Offspring || [];
      const animals = group.AnimalsLegacy || [];
      console.log(`   └─ Offspring group: ${group.id} (${offspring.length} offspring, ${animals.length} animals)`);

      // Delete all offspring in the group (bypass business rules with direct delete)
      if (offspring.length > 0) {
        // First, clear any business data that would block deletion
        for (const o of offspring) {
          try {
            // Clear blocking fields first
            await prisma.offspring.update({
              where: { id: o.id },
              data: {
                buyerPartyId: null,
                placementState: "UNASSIGNED",
                financialState: "NONE",
                lifeState: "ALIVE",
                placedAt: null,
                diedAt: null,
                paidInFullAt: null,
                depositCents: null,
                contractId: null,
                contractSignedAt: null,
                promotedAnimalId: null,
              },
            });

            // Then delete
            await prisma.offspring.delete({ where: { id: o.id } });
            deletedOffspring++;
            console.log(`      ✓ Deleted offspring: ${o.name || o.id}`);
          } catch (e) {
            console.log(`      ⚠ Could not delete offspring ${o.id}: ${e}`);
          }
        }
      }

      // Delete any animals linked to this group
      if (animals.length > 0) {
        for (const animal of animals) {
          try {
            await prisma.animal.update({
              where: { id: animal.id },
              data: { offspringGroupId: null },
            });
            console.log(`      ✓ Unlinked animal: ${animal.name || animal.id}`);
          } catch (e) {
            console.log(`      ⚠ Could not unlink animal ${animal.id}: ${e}`);
          }
        }
      }

      // Unlink the group from the plan, then delete the group
      try {
        await prisma.offspringGroup.update({
          where: { id: group.id },
          data: { planId: null },
        });
        await prisma.offspringGroup.delete({ where: { id: group.id } });
        deletedGroups++;
        console.log(`   ✓ Deleted offspring group: ${group.id}`);
      } catch (e) {
        console.log(`   ⚠ Could not delete group ${group.id}: ${e}`);
      }
    }

    // Delete the plan (hard delete)
    try {
      await prisma.breedingPlan.delete({ where: { id: plan.id } });
      deletedPlans++;
      console.log(`   ✓ Deleted plan: ${plan.name}`);
    } catch (e) {
      console.log(`   ⚠ Could not delete plan ${plan.id}: ${e}`);
    }
  }

  // Step 2: Find and delete any orphaned offspring groups
  console.log("\n\n🔍 Looking for orphaned offspring groups...");

  const orphanedGroups = await prisma.offspringGroup.findMany({
    where: {
      tenantId: TENANT_ID,
      planId: null,
    },
    include: {
      Offspring: true,
      AnimalsLegacy: true,
    },
  });

  console.log(`   Found ${orphanedGroups.length} orphaned groups`);

  for (const group of orphanedGroups) {
    const offspring = group.Offspring || [];
    const animals = group.AnimalsLegacy || [];
    console.log(`\n📦 Processing orphaned group: ${group.id} (${group.name || "unnamed"}) - ${offspring.length} offspring, ${animals.length} animals`);

    // Delete offspring
    for (const o of offspring) {
      try {
        await prisma.offspring.update({
          where: { id: o.id },
          data: {
            buyerPartyId: null,
            placementState: "UNASSIGNED",
            financialState: "NONE",
            lifeState: "ALIVE",
            placedAt: null,
            diedAt: null,
            paidInFullAt: null,
            depositCents: null,
            contractId: null,
            contractSignedAt: null,
            promotedAnimalId: null,
          },
        });
        await prisma.offspring.delete({ where: { id: o.id } });
        deletedOffspring++;
        console.log(`   ✓ Deleted offspring: ${o.name || o.id}`);
      } catch (e) {
        console.log(`   ⚠ Could not delete offspring ${o.id}: ${e}`);
      }
    }

    // Unlink animals
    for (const animal of animals) {
      try {
        await prisma.animal.update({
          where: { id: animal.id },
          data: { offspringGroupId: null },
        });
        console.log(`   ✓ Unlinked animal: ${animal.name || animal.id}`);
      } catch (e) {
        console.log(`   ⚠ Could not unlink animal ${animal.id}: ${e}`);
      }
    }

    // Delete the group
    try {
      await prisma.offspringGroup.delete({ where: { id: group.id } });
      deletedGroups++;
      console.log(`   ✓ Deleted orphaned group: ${group.id}`);
    } catch (e) {
      console.log(`   ⚠ Could not delete group ${group.id}: ${e}`);
    }
  }

  // Step 3: Find and clean up archived/soft-deleted test plans
  console.log("\n\n🔍 Looking for archived/soft-deleted test plans...");

  const archivedPlans = await prisma.breedingPlan.findMany({
    where: {
      tenantId: TENANT_ID,
      name: { startsWith: "Test Plan" },
      OR: [
        { archived: true },
        { deletedAt: { not: null } },
      ],
    },
  });

  console.log(`   Found ${archivedPlans.length} archived/soft-deleted test plans`);

  for (const plan of archivedPlans) {
    try {
      await prisma.breedingPlan.delete({ where: { id: plan.id } });
      deletedPlans++;
      console.log(`   ✓ Deleted plan: ${plan.name}`);
    } catch (e) {
      console.log(`   ⚠ Could not delete plan ${plan.id}: ${e}`);
    }
  }

  // Step 4: Find and clean up offspring groups named "Test Plan*"
  console.log("\n\n🔍 Looking for test offspring groups (by name)...");

  const testGroups = await prisma.offspringGroup.findMany({
    where: {
      tenantId: TENANT_ID,
      name: { startsWith: "Test Plan" },
    },
    include: {
      Offspring: true,
    },
  });

  console.log(`   Found ${testGroups.length} test offspring groups`);

  for (const group of testGroups) {
    const offspring = group.Offspring || [];
    console.log(`\n📦 Processing group: ${group.id} (${group.name}) - ${offspring.length} offspring`);

    // Delete offspring first
    for (const o of offspring) {
      try {
        await prisma.offspring.update({
          where: { id: o.id },
          data: {
            buyerPartyId: null,
            placementState: "UNASSIGNED",
            financialState: "NONE",
            lifeState: "ALIVE",
            placedAt: null,
            diedAt: null,
            paidInFullAt: null,
            depositCents: null,
            contractId: null,
            contractSignedAt: null,
            promotedAnimalId: null,
          },
        });
        await prisma.offspring.delete({ where: { id: o.id } });
        deletedOffspring++;
        console.log(`   ✓ Deleted offspring: ${o.name || o.id}`);
      } catch (e) {
        console.log(`   ⚠ Could not delete offspring ${o.id}: ${e}`);
      }
    }

    // Delete the group
    try {
      await prisma.offspringGroup.delete({ where: { id: group.id } });
      deletedGroups++;
      console.log(`   ✓ Deleted group: ${group.id}`);
    } catch (e) {
      console.log(`   ⚠ Could not delete group ${group.id}: ${e}`);
    }
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("PURGE SUMMARY");
  console.log("═".repeat(60));
  console.log(`
  Deleted:
    - ${deletedPlans} breeding plans
    - ${deletedGroups} offspring groups
    - ${deletedOffspring} offspring records

  Tenant: ${TENANT_ID} (${tenant.name})
`);
  console.log("═".repeat(60));
}

purgeTestData()
  .catch((e) => {
    console.error("❌ Purge failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
