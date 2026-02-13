// Fix animal 396 (Painted Lady) genetics - convert full locus codes to short codes
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const codeMapping: Record<string, string> = {
  // Coat color mappings
  'EXTENSION': 'E',
  'AGOUTI': 'A',
  'CREAM': 'Cr',
  'DUN': 'D',
  'GRAY': 'G',
  'CHAMPAGNE': 'Ch',
  'SILVER': 'Z',
  'TOBIANO': 'TO',
  'FRAME': 'O',
  'OVERO': 'O',
  'SABINO': 'SB',
  'LEOPARD_COMPLEX': 'LP',
  'ROAN': 'Rn',
  'DOMINANT_WHITE': 'W',
  'SPLASHED_WHITE': 'SW',
  'CHESTNUT_FACTOR': 'nCh',

  // Performance mappings
  'MYOSTATIN': 'MSTN',
  'GAIT_KEEPER': 'DMRT3',

  // Health mappings
  'HYPERKALEMIC_PERIODIC_PARALYSIS': 'HYPP',
  'GLYCOGEN_BRANCHING_ENZYME_DEFICIENCY': 'GBED',
  'HEREDITARY_EQUINE_REGIONAL_DERMAL_ASTHENIA': 'HERDA',
  'POLYSACCHARIDE_STORAGE_MYOPATHY_TYPE_1': 'PSSM1',
};

async function main() {
  console.log('Fixing Painted Lady (animal 396) genetics...');

  const genetics = await prisma.animalGenetics.findFirst({
    where: { animalId: 396 },
  });

  if (!genetics) {
    console.log('No genetics found for animal 396');
    return;
  }

  const coatColor = (genetics.coatColorData as any[]) || [];
  const physicalTraits = (genetics.physicalTraitsData as any[]) || [];
  const health = (genetics.healthGeneticsData as any[]) || [];

  // Fix coat color loci
  const fixedCoatColor = coatColor.map(locus => {
    const newCode = codeMapping[locus.locus.toUpperCase()] || locus.locus;
    if (newCode !== locus.locus) {
      console.log(`  Mapping ${locus.locus} -> ${newCode}`);
    }
    return {
      ...locus,
      locus: newCode,
    };
  });

  // Fix physical traits loci
  const fixedPhysicalTraits = physicalTraits.map(locus => {
    const newCode = codeMapping[locus.locus.toUpperCase()] || locus.locus;
    if (newCode !== locus.locus) {
      console.log(`  Mapping ${locus.locus} -> ${newCode}`);
    }
    return {
      ...locus,
      locus: newCode,
    };
  });

  // Fix health loci
  const fixedHealth = health.map(locus => {
    const newCode = codeMapping[locus.locus.toUpperCase()] || locus.locus;
    if (newCode !== locus.locus) {
      console.log(`  Mapping ${locus.locus} -> ${newCode}`);
    }
    return {
      ...locus,
      locus: newCode,
    };
  });

  // Remove duplicate loci (keep ones with allele data)
  const uniqueCoatColor = Array.from(
    new Map(
      fixedCoatColor
        .sort((a, b) => {
          // Sort so entries with allele data come first
          const aHasData = a.allele1 || a.allele2 || (a.genotype && a.genotype !== 'N/N' && a.genotype !== '?/?');
          const bHasData = b.allele1 || b.allele2 || (b.genotype && b.genotype !== 'N/N' && b.genotype !== '?/?');
          if (aHasData && !bHasData) return -1;
          if (!aHasData && bHasData) return 1;
          return 0;
        })
        .map(locus => [locus.locus, locus])
    ).values()
  );

  const uniquePhysicalTraits = Array.from(
    new Map(fixedPhysicalTraits.map(locus => [locus.locus, locus])).values()
  );

  const uniqueHealth = Array.from(
    new Map(fixedHealth.map(locus => [locus.locus, locus])).values()
  );

  console.log(`\nUpdating genetics...`);
  console.log(`  Coat Color: ${coatColor.length} -> ${uniqueCoatColor.length} loci`);
  console.log(`  Physical Traits: ${physicalTraits.length} -> ${uniquePhysicalTraits.length} loci`);
  console.log(`  Health: ${health.length} -> ${uniqueHealth.length} loci`);

  await prisma.animalGenetics.update({
    where: { id: genetics.id },
    data: {
      coatColorData: uniqueCoatColor,
      physicalTraitsData: uniquePhysicalTraits,
      healthGeneticsData: uniqueHealth,
    },
  });

  console.log('\nDone! ✓');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
