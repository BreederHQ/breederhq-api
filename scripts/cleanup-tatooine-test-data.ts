/**
 * Cleanup Test Data for Tatooine tenant (ID 4)
 *
 * This script removes test data created during E2E testing:
 * - Test breeding plans (names starting with "E2E Test" or "Test Plan")
 * - Test animals (names starting with "E2E Test")
 * - Test parties (names starting with "E2E Test")
 * - Orphaned offspring groups and offspring
 *
 * Usage:
 *   npx tsx scripts/cleanup-tatooine-test-data.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID = 1; // Tenant 1 has the test data

async function main() {
  console.log("═".repeat(60));
  console.log("Cleanup Test Data for Tatooine Tenant");
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

  // Step 1: Find and clean up test breeding plans
  console.log("🧹 Cleaning up test breeding plans...\n");

  const testPlans = await prisma.breedingPlan.findMany({
    where: {
      tenantId: TENANT_ID,
      OR: [
        { name: { startsWith: "E2E Test" } },
        { name: { startsWith: "Test Plan" } },
        { name: { startsWith: "Cleanup Test" } },
        { name: { contains: "Test Group" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (testPlans.length > 0) {
    console.log(`  Found ${testPlans.length} test breeding plans`);
    for (const plan of testPlans) {
      try {
        // Find and delete associated offspring groups
        const groups = await prisma.offspringGroup.findMany({
          where: { planId: plan.id },
        });

        for (const group of groups) {
          // Delete offspring first
          await prisma.offspring.deleteMany({ where: { groupId: group.id } });
          // Delete animals linked to the group
          await prisma.animal.deleteMany({ where: { offspringGroupId: group.id } });
          // Unlink group from plan
          await prisma.offspringGroup.update({
            where: { id: group.id },
            data: { planId: null },
          });
          // Delete the group
          await prisma.offspringGroup.delete({ where: { id: group.id } });
        }

        // Delete breeding events
        await prisma.breedingEvent.deleteMany({ where: { planId: plan.id } });

        // Delete the plan
        await prisma.breedingPlan.delete({ where: { id: plan.id } });
        console.log(`    ✓ Deleted plan: ${plan.name} (ID: ${plan.id})`);
      } catch (e: any) {
        console.log(`    ⚠ Could not delete plan ${plan.id}: ${e.message}`);
      }
    }
  } else {
    console.log("  No test breeding plans found");
  }

  // Step 2: Clean up orphaned offspring groups
  console.log("\n🧹 Cleaning up orphaned offspring groups...\n");

  const orphanedGroups = await prisma.offspringGroup.findMany({
    where: {
      tenantId: TENANT_ID,
      planId: null,
    },
    select: { id: true, name: true },
  });

  if (orphanedGroups.length > 0) {
    console.log(`  Found ${orphanedGroups.length} orphaned offspring groups`);
    for (const group of orphanedGroups) {
      try {
        await prisma.offspring.deleteMany({ where: { groupId: group.id } });
        await prisma.animal.deleteMany({ where: { offspringGroupId: group.id } });
        await prisma.offspringGroup.delete({ where: { id: group.id } });
        console.log(`    ✓ Deleted orphaned group: ${group.name || group.id}`);
      } catch (e: any) {
        console.log(`    ⚠ Could not delete group ${group.id}: ${e.message}`);
      }
    }
  } else {
    console.log("  No orphaned offspring groups found");
  }

  // Step 3: Clean up test animals
  console.log("\n🧹 Cleaning up test animals...\n");

  const testAnimals = await prisma.animal.findMany({
    where: {
      tenantId: TENANT_ID,
      name: { startsWith: "E2E Test" },
    },
    select: { id: true, name: true },
  });

  if (testAnimals.length > 0) {
    console.log(`  Found ${testAnimals.length} test animals`);
    for (const animal of testAnimals) {
      try {
        await prisma.animal.delete({ where: { id: animal.id } });
        console.log(`    ✓ Deleted animal: ${animal.name} (ID: ${animal.id})`);
      } catch (e: any) {
        console.log(`    ⚠ Could not delete animal ${animal.id}: ${e.message}`);
      }
    }
  } else {
    console.log("  No test animals found");
  }

  // Step 4: Clean up test parties
  console.log("\n🧹 Cleaning up test parties...\n");

  const testParties = await prisma.party.findMany({
    where: {
      tenantId: TENANT_ID,
      name: { startsWith: "E2E Test" },
    },
    select: { id: true, name: true },
  });

  if (testParties.length > 0) {
    console.log(`  Found ${testParties.length} test parties`);
    for (const party of testParties) {
      try {
        await prisma.party.delete({ where: { id: party.id } });
        console.log(`    ✓ Deleted party: ${party.name} (ID: ${party.id})`);
      } catch (e: any) {
        console.log(`    ⚠ Could not delete party ${party.id}: ${e.message}`);
      }
    }
  } else {
    console.log("  No test parties found");
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("CLEANUP COMPLETE");
  console.log("═".repeat(60));
  console.log(`
Summary:
  - Breeding plans removed: ${testPlans.length}
  - Orphaned groups removed: ${orphanedGroups.length}
  - Test animals removed: ${testAnimals.length}
  - Test parties removed: ${testParties.length}
`);
  console.log("═".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
