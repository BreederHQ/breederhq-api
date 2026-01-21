/**
 * Check for leftover E2E test data
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkTestData() {
  console.log("Checking for leftover E2E test data...\n");

  // Check for test animals
  const animals = await prisma.animal.findMany({
    where: { name: { startsWith: "E2E_BIRTH_DATE_TEST" } },
    select: { id: true, name: true },
  });
  console.log("Animals with E2E_BIRTH_DATE_TEST prefix:", animals.length);
  if (animals.length > 0) console.log(animals);

  // Check for test breeding plans
  const plans = await prisma.breedingPlan.findMany({
    where: { name: { startsWith: "E2E_BIRTH_DATE_TEST" } },
    select: { id: true, name: true },
  });
  console.log("Breeding plans with E2E_BIRTH_DATE_TEST prefix:", plans.length);
  if (plans.length > 0) console.log(plans);

  // Check for test offspring groups
  const groups = await prisma.offspringGroup.findMany({
    where: { name: { startsWith: "E2E_BIRTH_DATE_TEST" } },
    select: { id: true, name: true },
  });
  console.log("Offspring groups with E2E_BIRTH_DATE_TEST prefix:", groups.length);
  if (groups.length > 0) console.log(groups);

  // Check for test offspring
  const offspring = await prisma.offspring.findMany({
    where: { name: { startsWith: "E2E_BIRTH_DATE_TEST" } },
    select: { id: true, name: true },
  });
  console.log("Offspring with E2E_BIRTH_DATE_TEST prefix:", offspring.length);
  if (offspring.length > 0) console.log(offspring);

  console.log("\n--- Summary ---");
  const total = animals.length + plans.length + groups.length + offspring.length;
  if (total === 0) {
    console.log("✅ All test data has been cleaned up successfully!");
  } else {
    console.log("⚠️ Found", total, "leftover test records");
  }

  await prisma.$disconnect();
}

checkTestData().catch((e) => {
  console.error(e);
  process.exit(1);
});
