import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const programs = await prisma.breedingProgram.findMany({
    where: { tenantId: 4 },
    select: {
      id: true,
      slug: true,
      name: true,
      species: true,
      breedText: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\nFound ${programs.length} breeding programs for Tenant 4:\n`);
  programs.forEach((p, idx) => {
    console.log(`${idx + 1}. ID: ${p.id}`);
    console.log(`   Slug: ${p.slug}`);
    console.log(`   Name: ${p.name || '(null)'}`);
    console.log(`   Species: ${p.species || '(null)'}`);
    console.log(`   Breed: ${p.breedText || '(null)'}`);
    console.log(`   Created: ${p.createdAt}`);
    console.log('');
  });

  await prisma.$disconnect();
}

main().catch(console.error);
