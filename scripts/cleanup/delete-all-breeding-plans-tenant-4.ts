/**
 * Delete ALL breeding plans from tenant 4
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllPlans() {
  console.log("🗑️  Deleting ALL breeding plans from tenant 4...\n");

  try {
    const tenantId = 4;

    // Get all breeding plans
    const plans = await prisma.breedingPlan.findMany({
      where: { tenantId },
      select: { id: true, name: true, code: true },
    });

    console.log(`Found ${plans.length} breeding plans\n`);

    // Delete each one
    for (const plan of plans) {
      console.log(`Deleting plan ${plan.id}: ${plan.name} (${plan.code})...`);
      try {
        await prisma.breedingPlan.delete({
          where: { id: plan.id },
        });
        console.log(`  ✓ Deleted`);
      } catch (err: any) {
        console.log(`  ⚠ Error: ${err.message}`);
      }
    }

    console.log("\n✅ All breeding plans deleted!\n");

  } catch (error) {
    console.error("❌ Delete failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllPlans().catch(console.error);
