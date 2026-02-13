import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function revertPSSMFix() {
  console.log('Reverting PSSM back to PSSM1 (correct lab format)');
  
  const animal = await prisma.animal.findFirst({
    where: { name: { contains: 'Painted Lady' } }
  });

  if (!animal) {
    console.log('Animal not found');
    return;
  }

  const genetics = await prisma.animalGenetics.findUnique({
    where: { animalId: animal.id }
  });

  if (!genetics) {
    console.log('No genetics record found');
    return;
  }

  const health = (genetics.healthGeneticsData as any[]) || [];
  const updatedHealth = health.map(locus => {
    if (locus.locus === 'PSSM') {
      console.log('Reverting: PSSM -> PSSM1 (matches lab reporting)');
      return { ...locus, locus: 'PSSM1', locusName: 'Polysaccharide Storage Myopathy Type 1' };
    }
    return locus;
  });

  await prisma.animalGenetics.update({
    where: { animalId: animal.id },
    data: {
      healthGeneticsData: updatedHealth,
      updatedAt: new Date()  // Trigger database sync
    }
  });

  console.log('Reverted! Health loci:', updatedHealth.map(l => l.locus).join(', '));
}

revertPSSMFix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
