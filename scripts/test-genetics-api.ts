import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testGeneticsData() {
  // Check both Luna (385) and Maverick (386)
  const animalIds = [385, 386];

  for (const animalId of animalIds) {
    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true, name: true, tenantId: true },
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Animal: ${animal?.name} (ID: ${animalId}, Tenant: ${animal?.tenantId})`);
    console.log('='.repeat(60));

    const genetics = await prisma.animalGenetics.findUnique({
      where: { animalId },
      select: {
        id: true,
        testProvider: true,
        testDate: true,
        testId: true,
        coatColorData: true,
        healthGeneticsData: true,
        coatTypeData: true,
        physicalTraitsData: true,
        eyeColorData: true,
        otherTraitsData: true,
      },
    });

    if (!genetics) {
      console.log('NO GENETICS RECORD FOUND!');
      continue;
    }

    // Simulate what the API returns
    const apiResponse = {
      testProvider: genetics.testProvider,
      testDate: genetics.testDate,
      testId: genetics.testId,
      coatColor: genetics.coatColorData || [],
      health: genetics.healthGeneticsData || [],
      coatType: genetics.coatTypeData || [],
      physicalTraits: genetics.physicalTraitsData || [],
      eyeColor: genetics.eyeColorData || [],
      otherTraits: genetics.otherTraitsData || [],
    };

    console.log('\nAPI Response Format:');
    console.log('testProvider:', apiResponse.testProvider);
    console.log('coatColor count:', (apiResponse.coatColor as any[]).length);
    console.log('health count:', (apiResponse.health as any[]).length);
    console.log('coatType count:', (apiResponse.coatType as any[]).length);
    console.log('physicalTraits count:', (apiResponse.physicalTraits as any[]).length);
    console.log('eyeColor count:', (apiResponse.eyeColor as any[]).length);

    // Check if coatColor has allele1/allele2
    const coatColorData = apiResponse.coatColor as any[];
    if (coatColorData.length > 0) {
      console.log('\nCoatColor sample (first item):');
      console.log(JSON.stringify(coatColorData[0], null, 2));
      const hasAlleles = coatColorData[0].allele1 && coatColorData[0].allele2;
      console.log('Has allele1/allele2:', hasAlleles ? 'YES' : 'NO ⚠️');
    }

    // Check if health has allele1/allele2
    const healthData = apiResponse.health as any[];
    if (healthData.length > 0) {
      console.log('\nHealth sample (first item):');
      console.log(JSON.stringify(healthData[0], null, 2));
      const hasAlleles = healthData[0].allele1 && healthData[0].allele2;
      console.log('Has allele1/allele2:', hasAlleles ? 'YES' : 'NO ⚠️ (health uses genotype field)');
    }
  }

  await prisma.$disconnect();
}

testGeneticsData().catch(console.error);
