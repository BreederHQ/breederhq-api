// Test the animals API query directly using Prisma (same as API does)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testApiQuery() {
  const tenantId = 4;

  // This mimics what GET /animals does
  const where = {
    tenantId,
    archived: false,
    deletedAt: null,  // activeOnly filter
  };

  console.log('Testing API query for tenant 4...\n');
  console.log('Query WHERE:', JSON.stringify(where, null, 2));

  const [items, total] = await prisma.$transaction([
    prisma.animal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        sex: true,
        species: true,
        status: true,
      },
    }),
    prisma.animal.count({ where }),
  ]);

  console.log(`\nTotal animals returned: ${total}`);
  console.log(`Items in page: ${items.length}`);

  // Find Sadie
  const sadie = items.find(a => a.name.toLowerCase().includes('sadie'));
  console.log('\nSadie in results:', sadie ? 'YES' : 'NO');
  if (sadie) {
    console.log('  ', JSON.stringify(sadie));
  }

  // Show all females
  const females = items.filter(a => a.sex === 'FEMALE');
  console.log(`\nFemale animals in results: ${females.length}`);
  console.log('First 10 females:');
  females.slice(0, 10).forEach(f => {
    console.log(`  - ${f.name} (ID: ${f.id}, ${f.species})`);
  });

  await prisma.$disconnect();
}

testApiQuery().catch(console.error);
