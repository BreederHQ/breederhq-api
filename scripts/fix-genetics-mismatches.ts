import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixGeneticsMismatches() {
  console.log('Fixing genetics category and locus code mismatches');
  
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
    if (locus.locus === 'PSSM1') {
      console.log('Fixing: PSSM1 -> PSSM');
      return { ...locus, locus: 'PSSM' };
    }
    return locus;
  });

  await prisma.animalGenetics.update({
    where: { animalId: animal.id },
    data: {
      healthGeneticsData: updatedHealth,
    }
  });

  console.log('Updated health genetics');
  console.log('Updated loci:', updatedHealth.map(l => l.locus).join(', '));
}

fixGeneticsMismatches()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
