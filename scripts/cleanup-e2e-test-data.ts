/**
 * Clean up leftover E2E test data
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupTestData() {
  console.log("Cleaning up leftover E2E test data...\n");

  // 1. First, unlink offspring groups from plans (to avoid FK constraint issues)
  const groupsToUnlink = await prisma.offspringGroup.findMany({
    where: { name: { startsWith: "E2E_BIRTH_DATE_TEST" } },
    select: { id: true, name: true, planId: true },
  });

  console.log(`Unlinking ${groupsToUnlink.length} offspring groups from plans...`);
  for (const group of groupsToUnlink) {
    if (group.planId) {
      await prisma.offspringGroup.update({
        where: { id: group.id },
        data: { planId: null },
      });
      console.log(`  Unlinked group ${group.id}`);
    }
  }

  // 2. Delete offspring in test groups
  const offspringInGroups = await prisma.offspring.findMany({
    where: {
      group: { name: { startsWith: "E2E_BIRTH_DATE_TEST" } },
    },
    select: { id: true },
  });

  if (offspringInGroups.length > 0) {
    console.log(`Deleting ${offspringInGroups.length} offspring in test groups...`);
    await prisma.offspring.deleteMany({
      where: {
        id: { in: offspringInGroups.map((o) => o.id) },
      },
    });
  }

  // 3. Delete test offspring groups
  const groupsToDelete = await prisma.offspringGroup.findMany({
    where: { name: { startsWith: "E2E_BIRTH_DATE_TEST" } },
    select: { id: true },
  });

  if (groupsToDelete.length > 0) {
    console.log(`Deleting ${groupsToDelete.length} offspring groups...`);
    await prisma.offspringGroup.deleteMany({
      where: { id: { in: groupsToDelete.map((g) => g.id) } },
    });
  }

  // 4. Delete test breeding plans
  const plansToDelete = await prisma.breedingPlan.findMany({
    where: { name: { startsWith: "E2E_BIRTH_DATE_TEST" } },
    select: { id: true },
  });

  if (plansToDelete.length > 0) {
    console.log(`Deleting ${plansToDelete.length} breeding plans...`);
    await prisma.breedingPlan.deleteMany({
      where: { id: { in: plansToDelete.map((p) => p.id) } },
    });
  }

  // 5. Delete test animals (sires created by test)
  const siresToDelete = await prisma.animal.findMany({
    where: { name: { startsWith: "E2E_BIRTH_DATE_TEST_Sire" } },
    select: { id: true },
  });

  if (siresToDelete.length > 0) {
    console.log(`Deleting ${siresToDelete.length} test sires...`);
    await prisma.animal.deleteMany({
      where: { id: { in: siresToDelete.map((a) => a.id) } },
    });
  }

  // 6. Delete test animals (dams created by test)
  const damsToDelete = await prisma.animal.findMany({
    where: { name: { startsWith: "E2E_BIRTH_DATE_TEST_Dam" } },
    select: { id: true },
  });

  if (damsToDelete.length > 0) {
    console.log(`Deleting ${damsToDelete.length} test dams...`);
    await prisma.animal.deleteMany({
      where: { id: { in: damsToDelete.map((a) => a.id) } },
    });
  }

  console.log("\n✅ Cleanup complete!");

  // Verify cleanup
  console.log("\nVerifying cleanup...");
  const remainingAnimals = await prisma.animal.count({
    where: { name: { startsWith: "E2E_BIRTH_DATE_TEST" } },
  });
  const remainingPlans = await prisma.breedingPlan.count({
    where: { name: { startsWith: "E2E_BIRTH_DATE_TEST" } },
  });
  const remainingGroups = await prisma.offspringGroup.count({
    where: { name: { startsWith: "E2E_BIRTH_DATE_TEST" } },
  });

  if (remainingAnimals + remainingPlans + remainingGroups === 0) {
    console.log("✅ All E2E test data has been removed!");
  } else {
    console.log(`⚠️ Still have: ${remainingAnimals} animals, ${remainingPlans} plans, ${remainingGroups} groups`);
  }

  await prisma.$disconnect();
}

cleanupTestData().catch((e) => {
  console.error(e);
  process.exit(1);
});
