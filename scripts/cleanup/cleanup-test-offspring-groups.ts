import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = 4;

  console.log('🧹 Cleaning up test offspring groups...\n');

  // Find all test offspring groups (those with DELETE- prefix or orphaned numbered groups)
  const testGroups = await prisma.offspringGroup.findMany({
    where: {
      tenantId,
      OR: [
        { name: { contains: 'DELETE-' } },
        { name: { contains: 'DELETE' } },
        { name: { startsWith: 'Group #44' } },
        { name: { startsWith: 'Group #45' } },
        { planId: null }, // Orphaned groups
      ]
    },
    select: {
      id: true,
      name: true,
      planId: true,
      deletedAt: true,
    }
  });

  console.log(`Found ${testGroups.length} test offspring groups to clean up:\n`);

  for (const group of testGroups) {
    console.log(`  - Group ${group.id}: ${group.name || '(unnamed)'} ${group.deletedAt ? '(soft deleted)' : ''} ${!group.planId ? '(orphaned)' : ''}`);
  }

  if (testGroups.length === 0) {
    console.log('\n✓ No test offspring groups to clean up');
    return;
  }

  console.log('\n🗑️  Starting cleanup...\n');

  for (const group of testGroups) {
    try {
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

      // Delete waitlist entries
      const waitlistCount = await prisma.waitlistEntry.deleteMany({
        where: { tenantId, offspringGroupId: group.id }
      });
      if (waitlistCount.count > 0) {
        console.log(`    ✓ Deleted ${waitlistCount.count} waitlist entries`);
      }

      // Delete offspring group
      await prisma.offspringGroup.delete({
        where: { id: group.id }
      });
      console.log(`  ✓ Deleted offspring group ${group.id}: ${group.name || '(unnamed)'}`);

    } catch (e: any) {
      console.error(`  ✗ Error cleaning group ${group.id}:`, e.message);
    }
  }

  console.log('\n✓ Offspring group cleanup complete!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
