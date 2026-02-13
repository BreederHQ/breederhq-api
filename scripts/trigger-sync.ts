import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function triggerSync() {
  const animal = await prisma.animal.findFirst({
    where: { name: { contains: 'Painted Lady' } }
  });
  
  if (!animal) {
    console.log('Animal not found');
    return;
  }
  
  await prisma.animalGenetics.update({
    where: { animalId: animal.id },
    data: { updatedAt: new Date() }
  });
  
  console.log('Triggered database trigger to re-sync animal_loci table');
  
  const loci: any[] = await prisma.$queryRaw`
    SELECT category, locus, locus_name, genotype, allele1, allele2
    FROM animal_loci 
    WHERE animal_id = ${animal.id}
    AND (genotype IS NOT NULL OR allele1 IS NOT NULL OR allele2 IS NOT NULL)
    ORDER BY category, locus
  `;
  
  console.log('\nLoci with data after fix:');
  loci.forEach(l => {
    const value = l.genotype || `${l.allele1}/${l.allele2}`;
    console.log(`  ${l.category}/${l.locus}: ${value}`);
  });
  
  await prisma.$disconnect();
}

triggerSync().catch(console.error);
