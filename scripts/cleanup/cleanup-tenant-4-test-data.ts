/**
 * Direct database cleanup for tenant 4 - DELETE test data
 * Run from breederhq-api directory:
 * npx tsx scripts/cleanup-tenant-4-test-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupTenant4() {
  console.log("🧹 Direct database cleanup for tenant 4...\n");

  try {
    const tenantId = 4;

    // 1. Find and delete breeding plans by name pattern
    console.log("📅 Finding breeding plans by name pattern...");
    const targetPlanNames = [
      'DELETE-008 Multiple Blockers',
      'DELETE-006 Plan with Buyers',
      'DELETE-005 Plan with Offspring',
      'DELETE-007 Plan with Birth Date',
      'DELETE-002 Plan with Empty Group',
      'DELETE-003 Bred Plan No Deps',
    ];

    const breedingPlansByName = await prisma.breedingPlan.findMany({
      where: {
        tenantId,
        name: { in: targetPlanNames },
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
      },
    });

    console.log(`Found ${breedingPlansByName.length} breeding plans by name\n`);

    if (breedingPlansByName.length > 0) {
      breedingPlansByName.forEach(p => {
        console.log(`  - ID ${p.id}: "${p.name}" (${p.code}) - ${p.status}`);
      });

      console.log("\n🗑️  Deleting breeding plans by name...");
      for (const plan of breedingPlansByName) {
        try {
          // First unlink any offspring groups
          await prisma.offspringGroup.updateMany({
            where: { planId: plan.id },
            data: { planId: null },
          });

          // Then delete the plan
          await prisma.breedingPlan.delete({
            where: { id: plan.id },
          });
          console.log(`   ✓ Deleted breeding plan ${plan.id} (${plan.name})`);
        } catch (err: any) {
          console.log(`   ⚠ Could not delete plan ${plan.id}: ${err.message}`);
        }
      }
      console.log();
    }

    // 2. Find specific offspring groups by ID or name pattern
    console.log("📋 Fetching offspring groups from database...");
    const targetGroupIds = [411, 409];
    const targetGroupNames = [
      'DELETE-008 Multiple Blockers',
      'DELETE-005 Plan with Offspring Group',
    ];

    const offspringGroups = await prisma.offspringGroup.findMany({
      where: {
        tenantId,
        OR: [
          { id: { in: targetGroupIds } },
          { name: { in: targetGroupNames } },
        ],
      },
      select: {
        id: true,
        name: true,
        planId: true,
        createdAt: true,
      },
    });

    console.log(`Found ${offspringGroups.length} offspring groups\n`);

    if (offspringGroups.length === 0) {
      console.log("✓ No offspring groups to clean up");
      return;
    }

    offspringGroups.forEach(g => {
      console.log(`  - ID ${g.id}: "${g.name || 'undefined'}" (planId: ${g.planId || 'null'})`);
    });

    // 3. Find any remaining breeding plans linked to these groups
    const linkedPlanIds = offspringGroups
      .map(g => g.planId)
      .filter(id => id !== null) as number[];

    if (linkedPlanIds.length > 0) {
      console.log(`\n📅 Found ${linkedPlanIds.length} additional linked breeding plan IDs: ${linkedPlanIds.join(', ')}`);

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
          console.log(`   ✓ Deleted breeding plan ${plan.id} (${plan.name})`);
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
        id: { in: offspringGroups.map(g => g.id) },
        planId: { not: null },
      },
      data: {
        planId: null,
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
        console.log(`   ✓ Deleted group ${group.id} (${group.name})`);
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
