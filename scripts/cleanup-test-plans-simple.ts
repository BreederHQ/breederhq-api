/**
 * Simple cleanup of test breeding plans
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Finding test plans...");

  const plans = await prisma.breedingPlan.findMany({
    where: {
      OR: [
        { name: { contains: "Test Group" } },
        { name: { contains: "Cleanup Test" } },
        { name: { startsWith: "E2E" } },
      ]
    },
    select: { id: true, name: true, tenantId: true },
  });

  console.log(`Found ${plans.length} test plans to delete`);

  for (const plan of plans) {
    try {
      await prisma.breedingPlan.delete({ where: { id: plan.id } });
      console.log(`  ✓ Deleted: ${plan.name} (ID: ${plan.id}, Tenant: ${plan.tenantId})`);
    } catch (e: any) {
      console.log(`  ⚠ Could not delete plan ${plan.id}: ${e.message}`);
    }
  }

  console.log("\nDone!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
