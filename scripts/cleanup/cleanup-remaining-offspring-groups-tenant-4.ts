/**
 * Cleanup remaining numbered offspring groups in tenant 4
 * Run from breederhq-api directory:
 * npx tsx scripts/cleanup-remaining-offspring-groups-tenant-4.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupRemainingGroups() {
  console.log("🧹 Cleaning up remaining offspring groups in tenant 4...\n");

  try {
    const tenantId = 4;

    // Find all offspring groups with null names or matching test patterns
    console.log("📋 Fetching offspring groups from database...");
    const offspringGroups = await prisma.offspringGroup.findMany({
      where: {
        tenantId,
        OR: [
          { name: null },
          { name: { startsWith: "Group #" } },
        ],
      },
      select: {
        id: true,
        name: true,
        planId: true,
        createdAt: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    console.log(`Found ${offspringGroups.length} offspring groups to clean up\n`);

    if (offspringGroups.length === 0) {
      console.log("✓ No offspring groups to clean up");
      return;
    }

    offspringGroups.forEach(g => {
      console.log(`  - ID ${g.id}: "${g.name}" (planId: ${g.planId || 'null'})`);
    });

    // Find any breeding plans linked to these groups
    const linkedPlanIds = offspringGroups
      .map(g => g.planId)
      .filter(id => id !== null) as number[];

    if (linkedPlanIds.length > 0) {
      console.log(`\n📅 Found ${linkedPlanIds.length} linked breeding plan IDs: ${linkedPlanIds.join(', ')}`);

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

      console.log(`   Database returned ${breedingPlans.length} breeding plans`);
      breedingPlans.forEach(p => {
        console.log(`   - ID ${p.id}: "${p.name}" (${p.code}) - ${p.status}`);
      });

      // Delete breeding plans first
      console.log("\n🗑️  Deleting linked breeding plans...");
      for (const plan of breedingPlans) {
        try {
          // First unlink offspring groups
          await prisma.offspringGroup.updateMany({
            where: { planId: plan.id },
            data: { planId: null },
          });

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

    // Unlink offspring groups from any remaining breeding plans
    console.log("🔗 Unlinking offspring groups from breeding plans...");
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

    // Delete offspring individuals first
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

    if (offspring.length > 0) {
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
    }

    // Delete offspring groups
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

cleanupRemainingGroups().catch(console.error);
