/**
 * Simple cleanup for tenant 4
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log("🧹 Cleaning tenant 4...\n");

  try {
    const tenantId = 4;

    // 1. Find breeding plans by code
    console.log("📅 Finding breeding plans...");
    const targetCodes = [
      'PLN-PRINCESS-20260104-20260104',
      'PLN-PADME-20260104-20260104',
      'PLN-PADME-20260107-20260107-2',
    ];

    const plans = await prisma.breedingPlan.findMany({
      where: {
        tenantId,
        code: { in: targetCodes },
      },
    });

    console.log(`Found ${plans.length} breeding plans\n`);

    // 2. Delete each plan (this will cascade to offspring groups via SetNull)
    for (const plan of plans) {
      console.log(`🗑️  Deleting plan ${plan.id} (${plan.code})...`);
      await prisma.breedingPlan.delete({
        where: { id: plan.id },
      });
      console.log(`   ✓ Deleted`);
    }

    // 3. Find all offspring groups in tenant 4
    console.log("\n📋 Finding offspring groups...");
    const groups = await prisma.offspringGroup.findMany({
      where: { tenantId },
    });

    console.log(`Found ${groups.length} offspring groups\n`);

    // 4. Delete each group (will cascade to offspring individuals)
    for (const group of groups) {
      console.log(`🗑️  Deleting group ${group.id} (${group.name || 'unnamed'})...`);
      try {
        await prisma.offspringGroup.delete({
          where: { id: group.id },
        });
        console.log(`   ✓ Deleted`);
      } catch (err: any) {
        console.log(`   ⚠ Error: ${err.message}`);
      }
    }

    console.log("\n✅ Cleanup complete!\n");

  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup().catch(console.error);
