// prisma/seed/seed-tenant4-varied-genetics.ts
// Adds varied genetics data to existing dogs in tenant 4 to create
// interesting Best Match Finder results (not all 100 scores).
//
// Usage:
//   npx tsx prisma/seed/seed-tenant4-varied-genetics.ts
//
// Or with environment:
//   node scripts/run-with-env.js .env.dev.migrate npx tsx prisma/seed/seed-tenant4-varied-genetics.ts

import './seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 4;

// Genetics patterns that will cause score deductions
const GENETICS_PATTERNS = {
  // Merle carrier - pairs with other merle = Double Merle warning (-50 points)
  merleCarrier: {
    coatColor: [
      { locus: "A", locusName: "Agouti", allele1: "at", allele2: "at", genotype: "at/at" },
      { locus: "B", locusName: "Brown", allele1: "B", allele2: "B", genotype: "B/B" },
      { locus: "D", locusName: "Dilute", allele1: "D", allele2: "D", genotype: "D/D" },
      { locus: "M", locusName: "Merle", allele1: "M", allele2: "m", genotype: "M/m" },  // MERLE CARRIER
      { locus: "K", locusName: "Black Extension", allele1: "ky", allele2: "ky", genotype: "ky/ky" },
    ],
    health: [
      { locus: "MDR1", locusName: "MDR1 Drug Sensitivity", genotype: "Clear" },
      { locus: "DM", locusName: "Degenerative Myelopathy", genotype: "Clear" },
    ],
  },

  // EIC carrier - pairs with other EIC carrier = 25% affected (-20 points)
  eicCarrier: {
    coatColor: [
      { locus: "A", locusName: "Agouti", allele1: "Ay", allele2: "Ay", genotype: "Ay/Ay" },
      { locus: "B", locusName: "Brown", allele1: "B", allele2: "B", genotype: "B/B" },
      { locus: "D", locusName: "Dilute", allele1: "D", allele2: "D", genotype: "D/D" },
      { locus: "K", locusName: "Black Extension", allele1: "KB", allele2: "KB", genotype: "KB/KB" },
    ],
    health: [
      { locus: "EIC", locusName: "Exercise-Induced Collapse", genotype: "N/m" },  // CARRIER
      { locus: "DM", locusName: "Degenerative Myelopathy", genotype: "Clear" },
      { locus: "PRA", locusName: "Progressive Retinal Atrophy", genotype: "Clear" },
    ],
  },

  // Multiple health carriers - multiple conditions will stack penalties
  multiCarrier: {
    coatColor: [
      { locus: "A", locusName: "Agouti", allele1: "at", allele2: "at", genotype: "at/at" },
      { locus: "B", locusName: "Brown", allele1: "B", allele2: "b", genotype: "B/b" },
      { locus: "D", locusName: "Dilute", allele1: "D", allele2: "d", genotype: "D/d" },
      { locus: "K", locusName: "Black Extension", allele1: "ky", allele2: "ky", genotype: "ky/ky" },
    ],
    health: [
      { locus: "EIC", locusName: "Exercise-Induced Collapse", genotype: "N/m" },  // CARRIER
      { locus: "DM", locusName: "Degenerative Myelopathy", genotype: "N/m" },     // CARRIER
      { locus: "PRA", locusName: "Progressive Retinal Atrophy", genotype: "N/m" }, // CARRIER
      { locus: "HNPK", locusName: "Hereditary Nasal Parakeratosis", genotype: "N/m" }, // CARRIER
    ],
  },

  // Merle carrier + health carriers = worst match
  merleAndHealthCarrier: {
    coatColor: [
      { locus: "A", locusName: "Agouti", allele1: "at", allele2: "a", genotype: "at/a" },
      { locus: "B", locusName: "Brown", allele1: "B", allele2: "b", genotype: "B/b" },
      { locus: "D", locusName: "Dilute", allele1: "D", allele2: "d", genotype: "D/d" },
      { locus: "M", locusName: "Merle", allele1: "M", allele2: "m", genotype: "M/m" },  // MERLE CARRIER
      { locus: "K", locusName: "Black Extension", allele1: "ky", allele2: "ky", genotype: "ky/ky" },
    ],
    health: [
      { locus: "EIC", locusName: "Exercise-Induced Collapse", genotype: "N/m" },  // CARRIER
      { locus: "DM", locusName: "Degenerative Myelopathy", genotype: "N/m" },     // CARRIER
      { locus: "MDR1", locusName: "MDR1 Drug Sensitivity", genotype: "m/m" },     // AFFECTED
    ],
  },

  // All clear - good match (bonus points)
  allClear: {
    coatColor: [
      { locus: "A", locusName: "Agouti", allele1: "Ay", allele2: "Ay", genotype: "Ay/Ay" },
      { locus: "B", locusName: "Brown", allele1: "B", allele2: "B", genotype: "B/B" },
      { locus: "D", locusName: "Dilute", allele1: "D", allele2: "D", genotype: "D/D" },
      { locus: "M", locusName: "Merle", allele1: "m", allele2: "m", genotype: "m/m" },  // Non-merle
      { locus: "K", locusName: "Black Extension", allele1: "ky", allele2: "ky", genotype: "ky/ky" },
    ],
    health: [
      { locus: "EIC", locusName: "Exercise-Induced Collapse", genotype: "Clear" },
      { locus: "DM", locusName: "Degenerative Myelopathy", genotype: "Clear" },
      { locus: "PRA", locusName: "Progressive Retinal Atrophy", genotype: "Clear" },
      { locus: "MDR1", locusName: "MDR1 Drug Sensitivity", genotype: "Clear" },
    ],
  },

  // Non-merle but health carrier
  nonMerleHealthCarrier: {
    coatColor: [
      { locus: "A", locusName: "Agouti", allele1: "at", allele2: "at", genotype: "at/at" },
      { locus: "B", locusName: "Brown", allele1: "b", allele2: "b", genotype: "b/b" },
      { locus: "D", locusName: "Dilute", allele1: "D", allele2: "D", genotype: "D/D" },
      { locus: "M", locusName: "Merle", allele1: "m", allele2: "m", genotype: "m/m" },  // Non-merle
      { locus: "K", locusName: "Black Extension", allele1: "ky", allele2: "ky", genotype: "ky/ky" },
    ],
    health: [
      { locus: "EIC", locusName: "Exercise-Induced Collapse", genotype: "N/m" },  // CARRIER
      { locus: "DM", locusName: "Degenerative Myelopathy", genotype: "Clear" },
    ],
  },
};

async function main() {
  console.log('🧬 Adding varied genetics to tenant 4 dogs...\n');

  // Find SADIE first to see her genetics (so we can make matches that interact with her)
  const sadie = await prisma.animal.findFirst({
    where: {
      tenantId: TENANT_ID,
      name: { contains: 'Sadie', mode: 'insensitive' },
      species: 'DOG',
    },
    include: { genetics: true },
  });

  if (sadie) {
    console.log(`Found SADIE (ID: ${sadie.id})`);
    if (sadie.genetics) {
      console.log('SADIE current genetics:', JSON.stringify(sadie.genetics.healthGeneticsData, null, 2));
    } else {
      console.log('SADIE has no genetics data yet');
    }
  }

  // Get all male dogs in tenant 4
  const maleDogs = await prisma.animal.findMany({
    where: {
      tenantId: TENANT_ID,
      species: 'DOG',
      sex: 'MALE',
    },
    include: { genetics: true },
    orderBy: { name: 'asc' },
  });

  console.log(`\nFound ${maleDogs.length} male dogs in tenant ${TENANT_ID}\n`);

  // Define which dogs get which genetics pattern
  // We'll distribute patterns to create variety
  const patternAssignments: Record<string, keyof typeof GENETICS_PATTERNS> = {};

  maleDogs.forEach((dog, index) => {
    const patterns = Object.keys(GENETICS_PATTERNS) as Array<keyof typeof GENETICS_PATTERNS>;
    // Cycle through patterns, with some weighting toward problematic ones
    const weightedPatterns = [
      'merleCarrier',        // 1 - Double merle risk
      'eicCarrier',          // 2 - EIC carrier
      'multiCarrier',        // 3 - Multiple carriers
      'merleAndHealthCarrier', // 4 - Worst case
      'allClear',            // 5 - Good match
      'nonMerleHealthCarrier', // 6 - Moderate
      'eicCarrier',          // 7 - EIC carrier (repeat)
      'merleCarrier',        // 8 - Merle (repeat)
      'allClear',            // 9 - Good (repeat)
      'multiCarrier',        // 10 - Multi carrier (repeat)
    ];

    patternAssignments[dog.name] = weightedPatterns[index % weightedPatterns.length] as keyof typeof GENETICS_PATTERNS;
  });

  // First, give SADIE genetics that will interact with these patterns
  // Make her a merle carrier + EIC carrier so many males will have issues
  if (sadie) {
    const sadieGenetics = {
      coatColor: [
        { locus: "A", locusName: "Agouti", allele1: "at", allele2: "at", genotype: "at/at" },
        { locus: "B", locusName: "Brown", allele1: "B", allele2: "b", genotype: "B/b" },
        { locus: "D", locusName: "Dilute", allele1: "D", allele2: "D", genotype: "D/D" },
        { locus: "M", locusName: "Merle", allele1: "M", allele2: "m", genotype: "M/m" },  // MERLE CARRIER
        { locus: "K", locusName: "Black Extension", allele1: "ky", allele2: "ky", genotype: "ky/ky" },
      ],
      health: [
        { locus: "EIC", locusName: "Exercise-Induced Collapse", genotype: "N/m" },  // CARRIER
        { locus: "DM", locusName: "Degenerative Myelopathy", genotype: "N/m" },     // CARRIER
        { locus: "PRA", locusName: "Progressive Retinal Atrophy", genotype: "Clear" },
      ],
    };

    if (sadie.genetics) {
      await prisma.animalGenetics.update({
        where: { id: sadie.genetics.id },
        data: {
          coatColorData: sadieGenetics.coatColor,
          healthGeneticsData: sadieGenetics.health,
          testProvider: 'Embark',
          testDate: new Date(),
        },
      });
      console.log('✅ Updated SADIE with merle carrier + EIC/DM carrier genetics\n');
    } else {
      await prisma.animalGenetics.create({
        data: {
          animalId: sadie.id,
          coatColorData: sadieGenetics.coatColor,
          healthGeneticsData: sadieGenetics.health,
          testProvider: 'Embark',
          testDate: new Date(),
        },
      });
      console.log('✅ Created SADIE genetics with merle carrier + EIC/DM carrier\n');
    }
  }

  // Now update male dogs with varied genetics
  let updated = 0;
  let created = 0;

  for (const dog of maleDogs) {
    const patternKey = patternAssignments[dog.name];
    const pattern = GENETICS_PATTERNS[patternKey];

    if (dog.genetics) {
      // Update existing genetics
      await prisma.animalGenetics.update({
        where: { id: dog.genetics.id },
        data: {
          coatColorData: pattern.coatColor,
          healthGeneticsData: pattern.health,
          testProvider: 'Embark',
          testDate: new Date(),
        },
      });
      updated++;
    } else {
      // Create new genetics record
      await prisma.animalGenetics.create({
        data: {
          animalId: dog.id,
          coatColorData: pattern.coatColor,
          healthGeneticsData: pattern.health,
          testProvider: 'Embark',
          testDate: new Date(),
        },
      });
      created++;
    }

    // Determine expected impact
    let impact = '';
    if (patternKey === 'merleCarrier') impact = '⚠️ Double Merle risk with SADIE';
    else if (patternKey === 'eicCarrier') impact = '⚠️ EIC carrier × carrier with SADIE';
    else if (patternKey === 'multiCarrier') impact = '🔴 Multiple health risks with SADIE';
    else if (patternKey === 'merleAndHealthCarrier') impact = '🔴 Worst match - merle + health issues';
    else if (patternKey === 'allClear') impact = '✅ Good match - all clear';
    else if (patternKey === 'nonMerleHealthCarrier') impact = '⚠️ EIC carrier only';

    console.log(`${dog.genetics ? '📝' : '➕'} ${dog.name}: ${patternKey} ${impact}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🎉 Done!');
  console.log('═'.repeat(60));
  console.log(`   Updated: ${updated} dogs`);
  console.log(`   Created: ${created} new genetics records`);
  console.log('');
  console.log('Expected Best Match results for SADIE:');
  console.log('─'.repeat(60));
  console.log('  🟢 Score 100+: allClear dogs (no conflicts, bonus points)');
  console.log('  🟡 Score 80:   nonMerleHealthCarrier (EIC carrier × carrier)');
  console.log('  🟠 Score 60:   eicCarrier (EIC + possibly DM carrier)');
  console.log('  🟠 Score 50:   merleCarrier (Double Merle warning!)');
  console.log('  🔴 Score 30:   multiCarrier (multiple health risks)');
  console.log('  🔴 Score 10:   merleAndHealthCarrier (merle + multiple health)');
  console.log('─'.repeat(60));
  console.log('\n💡 Refresh the Best Match Finder page to see varied scores!\n');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
