import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCoatColor() {
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
    console.log('No genetics found');
    return;
  }

  console.log(`🐴 ${animal.name} (${animal.species}) - ID: ${animal.id}\n`);
  console.log('='.repeat(60));
  console.log('COAT COLOR GENETICS DATA');
  console.log('='.repeat(60));

  const coatColor = (genetics.coatColorData as any[]) || [];
  console.log(`\nTotal coat color loci: ${coatColor.length}\n`);

  if (coatColor.length === 0) {
    console.log('❌ NO COAT COLOR DATA FOUND\n');
    console.log('This explains why the UI shows "1 of 32 provided" with 0 having data.');
    console.log('\nPossible causes:');
    console.log('1. Data was never imported from genetics lab');
    console.log('2. Data was lost during a migration or fix script');
    console.log('3. Data needs to be manually entered or re-imported');
  } else {
    console.log('Coat color loci found:');
    coatColor.forEach((locus: any) => {
      const hasData = locus.genotype || locus.allele1 || locus.allele2;
      const status = hasData ? '✅ HAS DATA' : '⚠️  NO DATA';
      console.log(`  ${status} - ${locus.locus} (${locus.locusName})`);
      if (hasData) {
        console.log(`      Genotype: ${locus.genotype || `${locus.allele1}/${locus.allele2}`}`);
      }
    });

    const lociWithData = coatColor.filter((l: any) =>
      l.genotype || l.allele1 || l.allele2
    );
    console.log(`\n📊 Summary: ${lociWithData.length} loci have data out of ${coatColor.length} total`);
  }

  // Also check all other categories for reference
  console.log('\n' + '='.repeat(60));
  console.log('ALL GENETICS CATEGORIES');
  console.log('='.repeat(60));

  const categories = [
    { name: 'Coat Color', data: genetics.coatColorData },
    { name: 'Coat Type', data: genetics.coatTypeData },
    { name: 'Physical Traits', data: genetics.physicalTraitsData },
    { name: 'Performance', data: genetics.performanceData },
    { name: 'Eye Color', data: genetics.eyeColorData },
    { name: 'Temperament', data: genetics.temperamentData },
    { name: 'Health', data: genetics.healthGeneticsData },
    { name: 'Other Traits', data: genetics.otherTraitsData },
  ];

  categories.forEach(cat => {
    const loci = (cat.data as any[]) || [];
    const withData = loci.filter((l: any) => l.genotype || l.allele1 || l.allele2);
    console.log(`${cat.name}: ${withData.length} with data / ${loci.length} total`);
  });
}

checkCoatColor()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
