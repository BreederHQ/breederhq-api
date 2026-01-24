import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = 4;

  console.log('🧹 Cleaning up test breeding plans...\n');

  // Find all test plans (those with DELETE- prefix in name)
  const testPlans = await prisma.breedingPlan.findMany({
    where: {
      tenantId,
      OR: [
        { name: { startsWith: 'DELETE-' } },
        { name: { contains: 'Delete Test Plan' } },
        { name: { contains: 'Test Plan' } },
        { name: { contains: 'Blocker' } },
      ]
    },
    select: {
      id: true,
      name: true,
      deletedAt: true,
    }
  });

  console.log(`Found ${testPlans.length} test plans to clean up:\n`);

  for (const plan of testPlans) {
    console.log(`  - Plan ${plan.id}: ${plan.name} ${plan.deletedAt ? '(already deleted)' : ''}`);
  }

  if (testPlans.length === 0) {
    console.log('\n✓ No test plans to clean up');
    return;
  }

  console.log('\n🗑️  Starting cleanup...\n');

  for (const plan of testPlans) {
    try {
      // Find offspring group
      const group = await prisma.offspringGroup.findFirst({
        where: { tenantId, planId: plan.id },
        select: { id: true }
      });

      if (group) {
        // Delete offspring individuals
        const offspringCount = await prisma.offspring.deleteMany({
          where: { tenantId, groupId: group.id }
        });
        if (offspringCount.count > 0) {
          console.log(`    ✓ Deleted ${offspringCount.count} offspring from group ${group.id}`);
        }

        // Delete legacy animals linked to group
        const animalCount = await prisma.animal.deleteMany({
          where: { tenantId, offspringGroupId: group.id }
        });
        if (animalCount.count > 0) {
          console.log(`    ✓ Deleted ${animalCount.count} legacy animals from group ${group.id}`);
        }

        // Delete group buyers
        const groupBuyersCount = await prisma.offspringGroupBuyer.deleteMany({
          where: { tenantId, groupId: group.id }
        });
        if (groupBuyersCount.count > 0) {
          console.log(`    ✓ Deleted ${groupBuyersCount.count} group buyers`);
        }

        // Delete offspring group
        await prisma.offspringGroup.delete({
          where: { id: group.id }
        });
        console.log(`    ✓ Deleted offspring group ${group.id}`);
      }

      // Delete plan buyers
      const planBuyersCount = await prisma.breedingPlanBuyer.deleteMany({
        where: { tenantId, planId: plan.id }
      });
      if (planBuyersCount.count > 0) {
        console.log(`    ✓ Deleted ${planBuyersCount.count} plan buyers`);
      }

      // Delete breeding plan
      await prisma.breedingPlan.delete({
        where: { id: plan.id }
      });
      console.log(`  ✓ Deleted plan ${plan.id}: ${plan.name}`);

    } catch (e: any) {
      console.error(`  ✗ Error cleaning plan ${plan.id}:`, e.message);
    }
  }

  console.log('\n✓ Cleanup complete!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
