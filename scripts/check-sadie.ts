import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  // Full Sadie record
  const sadie = await prisma.animal.findUnique({
    where: { id: 392 },
  });

  console.log('SADIE FULL RECORD:');
  console.log('  id:', sadie?.id);
  console.log('  tenantId:', sadie?.tenantId);
  console.log('  name:', sadie?.name);
  console.log('  sex:', sadie?.sex);
  console.log('  species:', sadie?.species);
  console.log('  status:', sadie?.status);
  console.log('  sireId:', sadie?.sireId);
  console.log('  damId:', sadie?.damId);
  console.log('  breed:', sadie?.breed);
  console.log('  deletedAt:', sadie?.deletedAt);
  console.log('  archived:', sadie?.archived);

  // Count animals
  const totalCount = await prisma.animal.count({ where: { tenantId: 4 } });
  const femaleCount = await prisma.animal.count({ where: { tenantId: 4, sex: 'FEMALE' } });
  const dogCount = await prisma.animal.count({ where: { tenantId: 4, species: 'DOG' } });

  console.log('\nCOUNTS:');
  console.log('  Total animals in tenant 4:', totalCount);
  console.log('  Female animals:', femaleCount);
  console.log('  Dogs:', dogCount);

  // Check genetics record
  const genetics = await prisma.animalGenetics.findUnique({
    where: { animalId: 392 }
  });
  console.log('\nGENETICS RECORD EXISTS:', genetics ? 'YES' : 'NO');

  await prisma.$disconnect();
}

check().catch(console.error);
