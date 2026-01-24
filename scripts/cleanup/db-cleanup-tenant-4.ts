/**
 * Direct database cleanup for tenant 4
 * Run from breederhq-api directory:
 * cd C:\Users\Aaron\Documents\Projects\breederhq-api
 * npx tsx ../breederhq/scripts/db-cleanup-tenant-4.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupTenant4() {
  console.log("🧹 Direct database cleanup for tenant 4...\n");

  try {
    const tenantId = 4;

    // 1. Find and delete breeding plans by plan code
    console.log("📅 Finding breeding plans by plan code...");
    const targetPlanCodes = [
      'PLN-PRINCESS-20260104-20260104',
      'PLN-PADME-20260104-20260104',
      'PLN-PADME-20260107-20260107-2',
    ];

    const breedingPlansByCode = await prisma.breedingPlan.findMany({
      where: {
        tenantId,
        code: { in: targetPlanCodes },
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
      },
    });

    console.log(`Found ${breedingPlansByCode.length} breeding plans by code\n`);

    if (breedingPlansByCode.length > 0) {
      breedingPlansByCode.forEach(p => {
        console.log(`  - ID ${p.id}: "${p.name}" (${p.planCode})`);
      });

      console.log("\n🗑️  Deleting breeding plans by code...");
      for (const plan of breedingPlansByCode) {
        try {
          // First unlink any offspring groups
          await prisma.offspringGroup.updateMany({
            where: { breedingPlanId: plan.id },
            data: { breedingPlanId: null },
          });

          // Then delete the plan
          await prisma.breedingPlan.delete({
            where: { id: plan.id },
          });
          console.log(`   ✓ Deleted breeding plan ${plan.id} (${plan.planCode})`);
        } catch (err: any) {
          console.log(`   ⚠ Could not delete plan ${plan.id}: ${err.message}`);
        }
      }
      console.log();
    }

    // 2. Find all offspring groups in tenant 4
    console.log("📋 Fetching offspring groups from database...");
    const offspringGroups = await prisma.offspringGroup.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        breedingPlanId: true,
        createdAt: true,
      },
    });

    console.log(`Found ${offspringGroups.length} offspring groups\n`);

    if (offspringGroups.length === 0) {
      console.log("✓ No offspring groups to clean up");
      return;
    }

    offspringGroups.forEach(g => {
      console.log(`  - ID ${g.id}: "${g.name || 'undefined'}" (breedingPlanId: ${g.breedingPlanId || 'null'})`);
    });

    // 3. Find any remaining breeding plans linked to these groups
    const linkedPlanIds = offspringGroups
      .map(g => g.breedingPlanId)
      .filter(id => id !== null) as number[];

    if (linkedPlanIds.length > 0) {
      console.log(`📅 Found ${linkedPlanIds.length} additional linked breeding plan IDs: ${linkedPlanIds.join(', ')}`);

      const breedingPlans = await prisma.breedingPlan.findMany({
        where: {
          id: { in: linkedPlanIds },
        },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
        },
      });

      console.log(`   Database returned ${breedingPlans.length} breeding plans\n`);

      // Delete remaining breeding plans
      console.log("🗑️  Deleting remaining linked breeding plans...");
      for (const plan of breedingPlans) {
        try {
          await prisma.breedingPlan.delete({
            where: { id: plan.id },
          });
          console.log(`   ✓ Deleted breeding plan ${plan.id} (${plan.planCode})`);
        } catch (err: any) {
          console.log(`   ⚠ Could not delete plan ${plan.id}: ${err.message}`);
        }
      }
      console.log();
    }

    // 4. Unlink offspring groups from breeding plans
    console.log("\n🔗 Unlinking offspring groups from breeding plans...");
    await prisma.offspringGroup.updateMany({
      where: {
        tenantId,
        breedingPlanId: { not: null },
      },
      data: {
        breedingPlanId: null,
      },
    });
    console.log("   ✓ Unlinked all groups");

    // 5. Delete offspring individuals first
    console.log("\n🗑️  Deleting offspring individuals...");
    const groupIds = offspringGroups.map(g => g.id);

    const offspring = await prisma.offspring.findMany({
      where: {
        tenantId,
        groupId: { in: groupIds },
      },
      select: { id: true, name: true },
    });

    console.log(`   Found ${offspring.length} offspring individuals`);

    for (const o of offspring) {
      try {
        await prisma.offspring.delete({
          where: { id: o.id },
        });
        console.log(`   ✓ Deleted offspring ${o.id} (${o.name})`);
      } catch (err: any) {
        console.log(`   ⚠ Could not delete offspring ${o.id}: ${err.message}`);
      }
    }

    // 6. Delete offspring groups
    console.log("\n🗑️  Deleting offspring groups...");
    for (const group of offspringGroups) {
      try {
        await prisma.offspringGroup.delete({
          where: { id: group.id },
        });
        console.log(`   ✓ Deleted group ${group.id}`);
      } catch (err: any) {
        console.log(`   ⚠ Could not delete group ${group.id}: ${err.message}`);
      }
    }

    console.log("\n✅ Cleanup complete!\n");

  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupTenant4().catch(console.error);
