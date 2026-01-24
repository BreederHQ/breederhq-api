import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Delete the legacy "Tenant 2 Program" and "No program" entries
  const result = await prisma.breedingProgram.deleteMany({
    where: {
      tenantId: 4,
      OR: [
        { slug: 'tenant2-program' },
        { slug: 'no-program' },
        { name: 'Tenant 2 Program' },
        { name: '— No program —' }
      ]
    }
  });

  console.log(`\n✓ Deleted ${result.count} legacy breeding program(s) from Tenant 4\n`);

  // Show remaining programs
  const remaining = await prisma.breedingProgram.findMany({
    where: { tenantId: 4 },
    select: { id: true, slug: true, name: true, species: true, breedText: true }
  });

  console.log(`Remaining programs for Tenant 4:`);
  remaining.forEach(p => {
    console.log(`  - ${p.name} (${p.slug})`);
  });
  console.log('');

  await prisma.$disconnect();
}

main().catch(console.error);
