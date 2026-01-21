import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = 4;

  // List of group IDs from the screenshot
  const groupIds = [455, 451, 450, 447, 446, 444];

  console.log('🧹 Cleaning up specific offspring groups...\n');

  for (const groupId of groupIds) {
    try {
      const group = await prisma.offspringGroup.findUnique({
        where: { id: groupId },
        select: {
          id: true,
          name: true,
          planId: true,
          tenantId: true,
          deletedAt: true,
        }
      });

      if (!group) {
        console.log(`  - Group ${groupId}: Not found (already deleted)`);
        continue;
      }

      if (group.tenantId !== tenantId) {
        console.log(`  - Group ${groupId}: Different tenant (${group.tenantId}), skipping`);
        continue;
      }

      console.log(`  - Group ${groupId}: ${group.name || '(unnamed)'} - planId: ${group.planId} ${group.deletedAt ? '(soft deleted)' : ''}`);

      // Delete offspring individuals
      const offspringCount = await prisma.offspring.deleteMany({
        where: { groupId: group.id }
      });
      if (offspringCount.count > 0) {
        console.log(`    ✓ Deleted ${offspringCount.count} offspring`);
      }

      // Delete legacy animals
      const animalCount = await prisma.animal.deleteMany({
        where: { offspringGroupId: group.id }
      });
      if (animalCount.count > 0) {
        console.log(`    ✓ Deleted ${animalCount.count} legacy animals`);
      }

      // Delete group buyers
      const groupBuyersCount = await prisma.offspringGroupBuyer.deleteMany({
        where: { groupId: group.id }
      });
      if (groupBuyersCount.count > 0) {
        console.log(`    ✓ Deleted ${groupBuyersCount.count} group buyers`);
      }

      // Delete waitlist entries
      const waitlistCount = await prisma.waitlistEntry.deleteMany({
        where: { offspringGroupId: group.id }
      });
      if (waitlistCount.count > 0) {
        console.log(`    ✓ Deleted ${waitlistCount.count} waitlist entries`);
      }

      // Delete the group
      await prisma.offspringGroup.delete({
        where: { id: group.id }
      });
      console.log(`    ✓ Deleted group ${group.id}\n`);

    } catch (e: any) {
      console.error(`  ✗ Error cleaning group ${groupId}:`, e.message);
    }
  }

  console.log('✓ Cleanup complete!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
