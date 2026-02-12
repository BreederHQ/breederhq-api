import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Expected loci for HORSE species (copied from speciesLoci.ts)
const HORSE_EXPECTED_LOCI = {
  health: ['HYPP', 'GBED', 'HERDA', 'OLWS', 'MH', 'PSSM', 'IMM', 'WFFS', 'LWO', 'CA', 'SCID', 'LFS', 'OAAM', 'Hydro', 'FrDwarf', 'JEB'],
  physicalTraits: ['LCORL', 'HMGA2', 'ZFAT', 'MSTN', 'DMRT3'],
  performance: ['PPARGC1A', 'CKM', 'COX4I2', 'PDK4'],
  coatColor: ['E', 'A', 'Cr', 'D', 'G', 'Ch', 'Z', 'TO', 'O', 'SB', 'LP', 'Rn', 'W', 'nCh', 'SW'],
  coatType: [],
  eyeColor: [],
  temperament: ['SLC6A4', 'DRD4'],
  otherTraits: [],
};

async function checkMismatches() {
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

  console.log('🔍 Checking for mismatches between database data and UI expectations\n');
  console.log('Animal:', animal.name, '(ID:', animal.id + ')');
  console.log('Species:', animal.species);
  console.log('');

  // Expected loci for this species
  const expectedLoci = HORSE_EXPECTED_LOCI;

  // Check each category
  const categories = [
    { dbField: 'coatColorData', apiField: 'coatColor', uiField: 'coatColor' },
    { dbField: 'healthGeneticsData', apiField: 'health', uiField: 'health' },
    { dbField: 'coatTypeData', apiField: 'coatType', uiField: 'coatType' },
    { dbField: 'physicalTraitsData', apiField: 'physicalTraits', uiField: 'physicalTraits' },
    { dbField: 'eyeColorData', apiField: 'eyeColor', uiField: 'eyeColor' },
    { dbField: 'otherTraitsData', apiField: 'otherTraits', uiField: 'otherTraits' },
  ];

  let hasMismatches = false;

  for (const category of categories) {
    const data = (genetics as any)[category.dbField] as any[];
    if (!data || data.length === 0) continue;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Category: ${category.apiField}`);
    console.log(`${'='.repeat(60)}`);

    const expectedLociForCategory = (expectedLoci as any)[category.uiField] || [];
    const expectedCodes = new Set(expectedLociForCategory);

    // Build map of where each locus appears
    const allExpectedLoci: Record<string, string[]> = {};
    for (const [catName, loci] of Object.entries(expectedLoci)) {
      if (Array.isArray(loci)) {
        loci.forEach(locusCode => {
          if (!allExpectedLoci[locusCode]) {
            allExpectedLoci[locusCode] = [];
          }
          allExpectedLoci[locusCode].push(catName);
        });
      }
    }

    data.forEach((locus: any) => {
      const locusCode = locus.locus;
      const hasData = locus.genotype || locus.allele1 || locus.allele2;

      if (!expectedCodes.has(locusCode)) {
        hasMismatches = true;
        console.log(`\n⚠️  MISMATCH: ${locusCode} (${locus.locusName})`);
        console.log(`   Database category: ${category.apiField}`);
        console.log(`   UI expects it in:  ${allExpectedLoci[locusCode]?.join(', ') || 'NONE - locus code not found!'}`);
        console.log(`   Has data: ${hasData ? 'YES' : 'NO'}`);
        if (hasData) {
          console.log(`   Data: genotype="${locus.genotype}", allele1="${locus.allele1}", allele2="${locus.allele2}"`);
        }
      } else {
        console.log(`\n✓  ${locusCode} (${locus.locusName}) - matches UI expectations`);
        if (hasData) {
          console.log(`   Data: genotype="${locus.genotype}", allele1="${locus.allele1}", allele2="${locus.allele2}"`);
        }
      }
    });
  }

  if (!hasMismatches) {
    console.log('\n✅ No mismatches found! Database and UI are in sync.');
  } else {
    console.log('\n\n' + '='.repeat(60));
    console.log('❌ MISMATCHES FOUND!');
    console.log('='.repeat(60));
    console.log('\nThis explains why data is not displaying correctly.');
    console.log('The database has loci stored in categories or with codes');
    console.log('that don\'t match what the UI expects.');
  }
}

checkMismatches()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
