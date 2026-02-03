import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGenetics() {
  const genetics = await prisma.animalGenetics.findUnique({
    where: { animalId: 385 },
  });

  console.log('Luna (ID 385) Genetics Data:\n');
  console.log('testProvider:', genetics?.testProvider);
  console.log('testDate:', genetics?.testDate);
  console.log('\n--- coatColorData (first 3 items) ---');
  const coatColor = genetics?.coatColorData as any[];
  if (coatColor && coatColor.length > 0) {
    console.log(JSON.stringify(coatColor.slice(0, 3), null, 2));
    console.log(`... total ${coatColor.length} items`);
  } else {
    console.log('EMPTY or null');
  }

  console.log('\n--- healthGeneticsData (first 3 items) ---');
  const health = genetics?.healthGeneticsData as any[];
  if (health && health.length > 0) {
    console.log(JSON.stringify(health.slice(0, 3), null, 2));
    console.log(`... total ${health.length} items`);
  } else {
    console.log('EMPTY or null');
  }

  console.log('\n--- coatTypeData ---');
  const coatType = genetics?.coatTypeData as any[];
  if (coatType && coatType.length > 0) {
    console.log(JSON.stringify(coatType, null, 2));
  } else {
    console.log('EMPTY or null');
  }

  await prisma.$disconnect();
}

checkGenetics().catch(console.error);
