// prisma/seed/seed-pedigree-tenant-4.ts
// Creates a multi-generational pedigree for Sadie (EIC Carrier Lab) in tenant 4
// This makes the Genetics Lab Pedigree tab functional with real ancestry data
//
// Usage:
//   npx tsx prisma/seed/seed-pedigree-tenant-4.ts
//
// Or via API repo scripts:
//   node scripts/run-with-env.js .env.dev.migrate npx tsx prisma/seed/seed-pedigree-tenant-4.ts

import './seed-env-bootstrap';
import { PrismaClient, Species, Sex, AnimalStatus } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 4;

// Types for genetic data
interface LocusData {
  locus: string;
  locusName: string;
  allele1?: string;
  allele2?: string;
  genotype: string;
}

interface GeneticsData {
  coatColor?: LocusData[];
  coatType?: LocusData[];
  health?: LocusData[];
}

// Helper to create locus data
function locus(locusCode: string, locusName: string, allele1: string, allele2: string): LocusData {
  return {
    locus: locusCode,
    locusName,
    allele1,
    allele2,
    genotype: `${allele1}/${allele2}`,
  };
}

// Health locus (single genotype field)
function healthLocus(locusCode: string, locusName: string, status: string): LocusData {
  return {
    locus: locusCode,
    locusName,
    genotype: status,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PEDIGREE STRUCTURE FOR SADIE
// ═══════════════════════════════════════════════════════════════════════════════
//
// Generation 0 (Great-grandparents - Founders):
//   GGSire1  ─┬─ GGDam1          GGSire2 ─┬─ GGDam2
//             │                           │
// Generation 1 (Grandparents):            │
//   GSire (Paternal) ─┬─ GDam (Maternal)  │
//                     │                   │
// Generation 2 (Parents):                 │
//   Sire (Sadie's Dad) ─────┬─── Dam (Sadie's Mom)
//                           │
// Generation 3 (Current):   │
//                        SADIE
//
// Additionally: Max (EIC Carrier Lab) will get his own lineage
//

interface PedigreeAnimal {
  name: string;
  sex: Sex;
  breed: string;
  birthYear: number;
  notes: string;
  genetics: GeneticsData;
  testProvider?: string;
  // References by name (resolved to IDs during creation)
  sireRef?: string;
  damRef?: string;
}

// Sadie's Ancestors (maternal line has EIC, paternal line is clear)
const SADIE_PEDIGREE: PedigreeAnimal[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATION 0 - Great-grandparents (Founders)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Champion Blackwater Duke",
    sex: "MALE",
    breed: "Labrador Retriever",
    birthYear: 2012,
    notes: "Sadie's paternal great-grandfather. Field trial champion. EIC Clear.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "B"),          // Black pigment
        locus("E", "Extension", "E", "E"),      // Normal extension
        locus("K", "Black Extension", "KB", "KB"), // Dominant black
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/N"),  // CLEAR
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "N/N"),
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
  {
    name: "Willow Creek Bella",
    sex: "FEMALE",
    breed: "Labrador Retriever",
    birthYear: 2013,
    notes: "Sadie's paternal great-grandmother. Show champion. EIC Clear.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "b"),          // Black, carries chocolate
        locus("E", "Extension", "E", "e"),      // Normal, carries yellow
        locus("K", "Black Extension", "KB", "ky"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/N"),  // CLEAR
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "N/N"),
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
  {
    name: "Riverbend Thunder",
    sex: "MALE",
    breed: "Labrador Retriever",
    birthYear: 2011,
    notes: "Sadie's maternal great-grandfather. EIC CARRIER - source of the gene.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("B", "Brown", "b", "b"),          // Chocolate
        locus("E", "Extension", "E", "E"),
        locus("K", "Black Extension", "KB", "KB"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/m"),  // CARRIER ⚠️
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "N/N"),
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
  {
    name: "Sunset Valley Rose",
    sex: "FEMALE",
    breed: "Labrador Retriever",
    birthYear: 2012,
    notes: "Sadie's maternal great-grandmother. EIC Clear.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "B"),
        locus("E", "Extension", "e", "e"),      // Yellow
        locus("K", "Black Extension", "ky", "ky"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/N"),  // CLEAR
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "N/m"), // CARRIER
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATION 1 - Grandparents
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Blackwater's Noble Prince",
    sex: "MALE",
    breed: "Labrador Retriever",
    birthYear: 2015,
    sireRef: "Champion Blackwater Duke",
    damRef: "Willow Creek Bella",
    notes: "Sadie's paternal grandfather. EIC Clear. Show champion.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "b"),          // Black, carries chocolate
        locus("E", "Extension", "E", "e"),      // Normal, carries yellow
        locus("K", "Black Extension", "KB", "KB"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/N"),  // CLEAR
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "N/N"),
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
  {
    name: "Riverbend's Coco Bean",
    sex: "FEMALE",
    breed: "Labrador Retriever",
    birthYear: 2014,
    sireRef: "Riverbend Thunder",
    damRef: "Sunset Valley Rose",
    notes: "Sadie's paternal grandmother. EIC CARRIER inherited from Thunder.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("B", "Brown", "b", "b"),          // Chocolate
        locus("E", "Extension", "E", "e"),
        locus("K", "Black Extension", "KB", "ky"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/m"),  // CARRIER ⚠️
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "N/m"), // CARRIER
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
  {
    name: "Maple Hill Hunter",
    sex: "MALE",
    breed: "Labrador Retriever",
    birthYear: 2015,
    notes: "Sadie's maternal grandfather. Field lines. EIC Clear.",
    testProvider: "Wisdom Panel",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "B"),
        locus("E", "Extension", "E", "E"),
        locus("K", "Black Extension", "KB", "KB"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/N"),  // CLEAR
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "N/N"),
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/m"),     // CARRIER
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
  {
    name: "Sunny Meadow Daisy",
    sex: "FEMALE",
    breed: "Labrador Retriever",
    birthYear: 2016,
    notes: "Sadie's maternal grandmother. Yellow lab. EIC Clear.",
    testProvider: "Wisdom Panel",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "b"),
        locus("E", "Extension", "e", "e"),      // Yellow
        locus("K", "Black Extension", "ky", "ky"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/N"),  // CLEAR
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "N/N"),
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATION 2 - Parents
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Blackwater's Dark Knight",
    sex: "MALE",
    breed: "Labrador Retriever",
    birthYear: 2018,
    sireRef: "Blackwater's Noble Prince",
    damRef: "Riverbend's Coco Bean",
    notes: "Sadie's SIRE (father). Black Lab. EIC CARRIER from Coco Bean.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "b"),          // Black, carries chocolate
        locus("E", "Extension", "E", "e"),
        locus("K", "Black Extension", "KB", "KB"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/m"),  // CARRIER ⚠️
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "N/m"), // CARRIER
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
  {
    name: "Meadow's Golden Girl",
    sex: "FEMALE",
    breed: "Labrador Retriever",
    birthYear: 2019,
    sireRef: "Maple Hill Hunter",
    damRef: "Sunny Meadow Daisy",
    notes: "Sadie's DAM (mother). Yellow Lab. EIC Clear.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "b"),
        locus("E", "Extension", "e", "e"),      // Yellow
        locus("K", "Black Extension", "ky", "ky"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/N"),  // CLEAR
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "N/N"),
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/m"),     // CARRIER from Hunter
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
];

// Max's Ancestors (separate line, also EIC carrier)
const MAX_PEDIGREE: PedigreeAnimal[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // MAX'S GRANDPARENTS (Founders for Max's line)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Northwind Storm King",
    sex: "MALE",
    breed: "Labrador Retriever",
    birthYear: 2013,
    notes: "Max's paternal grandfather. EIC CARRIER.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "B"),
        locus("E", "Extension", "E", "E"),
        locus("K", "Black Extension", "KB", "KB"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/m"),  // CARRIER ⚠️
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
  {
    name: "Lakeside Luna",
    sex: "FEMALE",
    breed: "Labrador Retriever",
    birthYear: 2014,
    notes: "Max's paternal grandmother. EIC Clear.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "B"),
        locus("E", "Extension", "E", "e"),
        locus("K", "Black Extension", "KB", "ky"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/N"),  // CLEAR
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
  {
    name: "Coastal Baron",
    sex: "MALE",
    breed: "Labrador Retriever",
    birthYear: 2014,
    notes: "Max's maternal grandfather. EIC Clear.",
    testProvider: "Wisdom Panel",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "b"),
        locus("E", "Extension", "E", "E"),
        locus("K", "Black Extension", "KB", "KB"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/N"),  // CLEAR
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
  {
    name: "Harborview Penny",
    sex: "FEMALE",
    breed: "Labrador Retriever",
    birthYear: 2015,
    notes: "Max's maternal grandmother. EIC Clear.",
    testProvider: "Wisdom Panel",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "B"),
        locus("E", "Extension", "E", "E"),
        locus("K", "Black Extension", "KB", "KB"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/N"),  // CLEAR
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MAX'S PARENTS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Northwind's Black Thunder",
    sex: "MALE",
    breed: "Labrador Retriever",
    birthYear: 2017,
    sireRef: "Northwind Storm King",
    damRef: "Lakeside Luna",
    notes: "Max's SIRE (father). Black Lab. EIC CARRIER from Storm King.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "B"),
        locus("E", "Extension", "E", "e"),
        locus("K", "Black Extension", "KB", "ky"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/m"),  // CARRIER ⚠️
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
  {
    name: "Coastal Breeze Lady",
    sex: "FEMALE",
    breed: "Labrador Retriever",
    birthYear: 2018,
    sireRef: "Coastal Baron",
    damRef: "Harborview Penny",
    notes: "Max's DAM (mother). Black Lab. EIC Clear.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("B", "Brown", "B", "b"),
        locus("E", "Extension", "E", "E"),
        locus("K", "Black Extension", "KB", "KB"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/N"),  // CLEAR
        healthLocus("CNM", "Centronuclear Myopathy", "N/N"),
        healthLocus("DM", "Degenerative Myelopathy", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('🧬 Creating pedigree data for tenant 4...\n');

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: TENANT_ID }
  });

  if (!tenant) {
    console.log(`❌ Tenant ${TENANT_ID} not found!`);
    process.exit(1);
  }

  console.log(`✓ Found tenant: ${tenant.name} (ID: ${TENANT_ID})\n`);

  // Find existing Sadie and Max
  const sadie = await prisma.animal.findFirst({
    where: {
      tenantId: TENANT_ID,
      name: { contains: 'Sadie' },
      species: 'DOG',
    }
  });

  const max = await prisma.animal.findFirst({
    where: {
      tenantId: TENANT_ID,
      name: { contains: 'Max' },
      species: 'DOG',
    }
  });

  if (!sadie) {
    console.log('❌ Sadie not found in tenant 4! Creating her first...');
  } else {
    console.log(`✓ Found Sadie: ID ${sadie.id}`);
  }

  if (!max) {
    console.log('❌ Max not found in tenant 4! Creating him first...');
  } else {
    console.log(`✓ Found Max: ID ${max.id}`);
  }

  // Map to store created animal IDs by name
  const animalIdMap = new Map<string, number>();

  // Helper to create an animal with genetics
  async function createAnimal(animal: PedigreeAnimal): Promise<number> {
    // Check if already exists
    const existing = await prisma.animal.findFirst({
      where: {
        tenantId: TENANT_ID,
        name: animal.name,
        species: 'DOG',
      }
    });

    if (existing) {
      console.log(`⏭️  Skipped (exists): ${animal.name}`);
      animalIdMap.set(animal.name, existing.id);
      return existing.id;
    }

    // Resolve parent IDs
    let sireId: number | null = null;
    let damId: number | null = null;

    if (animal.sireRef) {
      sireId = animalIdMap.get(animal.sireRef) || null;
      if (!sireId) {
        const sire = await prisma.animal.findFirst({
          where: { tenantId: TENANT_ID, name: animal.sireRef, species: 'DOG' }
        });
        sireId = sire?.id || null;
      }
    }

    if (animal.damRef) {
      damId = animalIdMap.get(animal.damRef) || null;
      if (!damId) {
        const dam = await prisma.animal.findFirst({
          where: { tenantId: TENANT_ID, name: animal.damRef, species: 'DOG' }
        });
        damId = dam?.id || null;
      }
    }

    const birthDate = new Date(`${animal.birthYear}-06-15`);

    // Create the animal
    const newAnimal = await prisma.animal.create({
      data: {
        tenantId: TENANT_ID,
        name: animal.name,
        species: 'DOG',
        sex: animal.sex,
        breed: animal.breed,
        birthDate,
        notes: animal.notes,
        status: AnimalStatus.ACTIVE,
        sireId,
        damId,
      }
    });

    // Create genetics record
    await prisma.animalGenetics.create({
      data: {
        animalId: newAnimal.id,
        testProvider: animal.testProvider || null,
        testDate: new Date(birthDate.getTime() + 180 * 24 * 60 * 60 * 1000),
        coatColorData: animal.genetics.coatColor || [],
        healthGeneticsData: animal.genetics.health || [],
      }
    });

    const parentInfo = [];
    if (animal.sireRef) parentInfo.push(`Sire: ${animal.sireRef}`);
    if (animal.damRef) parentInfo.push(`Dam: ${animal.damRef}`);
    const parentStr = parentInfo.length > 0 ? ` [${parentInfo.join(', ')}]` : ' [Founder]';

    console.log(`✅ Created: ${animal.name}${parentStr}`);
    animalIdMap.set(animal.name, newAnimal.id);
    return newAnimal.id;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE SADIE'S PEDIGREE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n📦 Creating Sadie\'s pedigree (ancestors)...\n');

  for (const animal of SADIE_PEDIGREE) {
    await createAnimal(animal);
  }

  // Now link Sadie to her parents
  if (sadie) {
    const sire = await prisma.animal.findFirst({
      where: { tenantId: TENANT_ID, name: "Blackwater's Dark Knight", species: 'DOG' }
    });
    const dam = await prisma.animal.findFirst({
      where: { tenantId: TENANT_ID, name: "Meadow's Golden Girl", species: 'DOG' }
    });

    if (sire && dam) {
      await prisma.animal.update({
        where: { id: sadie.id },
        data: {
          sireId: sire.id,
          damId: dam.id,
        }
      });
      console.log(`\n🔗 Linked Sadie to her parents:`);
      console.log(`   Sire: ${sire.name} (ID: ${sire.id})`);
      console.log(`   Dam: ${dam.name} (ID: ${dam.id})`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE MAX'S PEDIGREE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n📦 Creating Max\'s pedigree (ancestors)...\n');

  for (const animal of MAX_PEDIGREE) {
    await createAnimal(animal);
  }

  // Now link Max to his parents
  if (max) {
    const sire = await prisma.animal.findFirst({
      where: { tenantId: TENANT_ID, name: "Northwind's Black Thunder", species: 'DOG' }
    });
    const dam = await prisma.animal.findFirst({
      where: { tenantId: TENANT_ID, name: "Coastal Breeze Lady", species: 'DOG' }
    });

    if (sire && dam) {
      await prisma.animal.update({
        where: { id: max.id },
        data: {
          sireId: sire.id,
          damId: dam.id,
        }
      });
      console.log(`\n🔗 Linked Max to his parents:`);
      console.log(`   Sire: ${sire.name} (ID: ${sire.id})`);
      console.log(`   Dam: ${dam.name} (ID: ${dam.id})`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🎉 Pedigree seed completed for tenant 4!');
  console.log('═'.repeat(70));
  console.log('\n📋 WHAT TO TEST:');
  console.log('─'.repeat(70));
  console.log('1. Go to Genetics Lab');
  console.log('2. Select Sadie as Dam and Max as Sire');
  console.log('3. Click the "Pedigree" tab');
  console.log('4. You should now see a multi-generational family tree!');
  console.log('5. Click the locus buttons (EIC, etc.) to highlight inheritance');
  console.log('─'.repeat(70));
  console.log('\n📊 EIC INHERITANCE PATH:');
  console.log('   Sadie\'s EIC carrier gene came from:');
  console.log('   Riverbend Thunder (great-grandsire)');
  console.log('   → Riverbend\'s Coco Bean (grandmother)');
  console.log('   → Blackwater\'s Dark Knight (sire)');
  console.log('   → Sadie');
  console.log('');
  console.log('   Max\'s EIC carrier gene came from:');
  console.log('   Northwind Storm King (grandfather)');
  console.log('   → Northwind\'s Black Thunder (sire)');
  console.log('   → Max');
  console.log('─'.repeat(70));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
