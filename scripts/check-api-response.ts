import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAPI() {
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

  console.log('=== API Response Structure (what frontend receives) ===\n');

  const apiResponse = {
    testResults: {
      testName: genetics.testProvider,
      testDate: genetics.testDate,
      testId: genetics.testId,
    },
    coatColor: genetics.coatColorData,
    health: genetics.healthGeneticsData,
    coatType: genetics.coatTypeData,
    physicalTraits: genetics.physicalTraitsData,
    eyeColor: genetics.eyeColorData,
    otherTraits: genetics.otherTraitsData,
  };

  console.log(JSON.stringify(apiResponse, null, 2));

  console.log('\n=== Checking hasData() Logic ===\n');

  // Replicate the hasData function
  const hasData = (l: any) => {
    const allele1 = l.allele1?.trim?.();
    const allele2 = l.allele2?.trim?.();
    const genotype = l.genotype?.trim?.().toLowerCase();

    const result = (allele1 && allele1 !== '?') ||
           (allele2 && allele2 !== '?') ||
           (genotype && genotype !== '?/?' && genotype !== 'not tested' && genotype !== '?');

    return result;
  };

  console.log('Coat Color loci with data:');
  (apiResponse.coatColor as any[])?.forEach(l => {
    if (hasData(l)) {
      console.log(`  ✓ ${l.locus} (${l.locusName}): ${l.genotype || `${l.allele1}/${l.allele2}`}`);
    }
  });

  console.log('\nHealth loci with data:');
  (apiResponse.health as any[])?.forEach(l => {
    const has = hasData(l);
    console.log(`  ${has ? '✓' : '✗'} ${l.locus} (${l.locusName}): genotype="${l.genotype}", allele1="${l.allele1}", allele2="${l.allele2}"`);
  });

  console.log('\nPhysical Traits loci with data:');
  (apiResponse.physicalTraits as any[])?.forEach(l => {
    if (hasData(l)) {
      console.log(`  ✓ ${l.locus} (${l.locusName}): ${l.genotype || `${l.allele1}/${l.allele2}`}`);
    }
  });
}

checkAPI()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
  });
