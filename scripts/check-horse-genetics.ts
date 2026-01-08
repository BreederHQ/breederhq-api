import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  // Find Luke's tenant
  const luke = await prisma.user.findFirst({ where: { email: 'luke.skywalker@tester.local' } });
  if (!luke) {
    console.log('Luke not found');
    process.exit(1);
  }

  const membership = await prisma.tenantMembership.findFirst({ where: { userId: luke.id } });
  if (!membership) {
    console.log('Membership not found');
    process.exit(1);
  }

  const tenantId = membership.tenantId;

  // Get Painted Lady
  const paintedLady = await prisma.animal.findFirst({
    where: { tenantId, name: 'Painted Lady (Frame Overo Mare)' },
    include: { genetics: true }
  });

  // Get Storm Chaser
  const stormChaser = await prisma.animal.findFirst({
    where: { tenantId, name: 'Storm Chaser (Frame Overo Stallion)' },
    include: { genetics: true }
  });

  console.log('=== Painted Lady ===');
  console.log('ID:', paintedLady?.id);
  console.log('Species:', paintedLady?.species);
  console.log('coatColorData:', JSON.stringify(paintedLady?.genetics?.coatColorData, null, 2));
  console.log('healthGeneticsData:', JSON.stringify(paintedLady?.genetics?.healthGeneticsData, null, 2));

  console.log('\n=== Storm Chaser ===');
  console.log('ID:', stormChaser?.id);
  console.log('Species:', stormChaser?.species);
  console.log('coatColorData:', JSON.stringify(stormChaser?.genetics?.coatColorData, null, 2));
  console.log('healthGeneticsData:', JSON.stringify(stormChaser?.genetics?.healthGeneticsData, null, 2));

  // Now test what the API would return
  console.log('\n=== What API would return for Painted Lady ===');
  if (paintedLady?.genetics) {
    const apiResponse = {
      coatColor: paintedLady.genetics.coatColorData || [],
      health: paintedLady.genetics.healthGeneticsData || [],
      coatType: paintedLady.genetics.coatTypeData || [],
      physicalTraits: paintedLady.genetics.physicalTraitsData || [],
      eyeColor: paintedLady.genetics.eyeColorData || [],
    };
    console.log(JSON.stringify(apiResponse, null, 2));
  }

  // Check if O locus exists and has correct structure
  console.log('\n=== O Locus Check ===');
  const damCoatColor = paintedLady?.genetics?.coatColorData as any[] || [];
  const sireCoatColor = stormChaser?.genetics?.coatColorData as any[] || [];

  const damO = damCoatColor.find((l: any) => l.locus === 'O');
  const sireO = sireCoatColor.find((l: any) => l.locus === 'O');

  console.log('Dam O locus:', damO);
  console.log('Sire O locus:', sireO);

  if (damO && sireO) {
    const dangerousAllele = 'O';
    const damHas = damO.allele1 === dangerousAllele || damO.allele2 === dangerousAllele;
    const sireHas = sireO.allele1 === dangerousAllele || sireO.allele2 === dangerousAllele;
    console.log('\nWarning check simulation:');
    console.log('  dangerousAllele:', dangerousAllele);
    console.log('  damHas O:', damHas, `(allele1=${damO.allele1}, allele2=${damO.allele2})`);
    console.log('  sireHas O:', sireHas, `(allele1=${sireO.allele1}, allele2=${sireO.allele2})`);
    console.log('  Should trigger warning:', damHas && sireHas);
  } else {
    console.log('ERROR: O locus not found in one or both animals!');
  }

  await prisma.$disconnect();
}

check();
