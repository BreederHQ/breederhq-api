/**
 * Re-seed genetics for animal 396 (Painted Lady - Frame Overo Mare)
 * This resets the genetics data to proper format with allele1, allele2, genotype values
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper functions matching seed format
function locus(locusCode, locusName, allele1, allele2) {
  return {
    locus: locusCode,
    locusName,
    allele1,
    allele2,
    genotype: `${allele1}/${allele2}`,
  };
}

function healthLocus(locusCode, locusName, status) {
  return {
    locus: locusCode,
    locusName,
    genotype: status,
  };
}

async function main() {
  const animalId = 396;

  console.log('═'.repeat(70));
  console.log('RE-SEEDING GENETICS FOR ANIMAL 396 (Painted Lady)');
  console.log('═'.repeat(70));

  // Verify the animal exists
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    select: { id: true, name: true, species: true, breed: true }
  });

  if (!animal) {
    console.error('❌ Animal 396 not found!');
    process.exit(1);
  }

  console.log(`\n✓ Found animal: ${animal.name} (${animal.species} - ${animal.breed})`);

  // Delete existing genetics
  const deleted = await prisma.animalGenetics.deleteMany({
    where: { animalId }
  });

  console.log(`✓ Deleted ${deleted.count} existing genetics record(s)`);

  // Proper seed data for Painted Lady (Frame Overo Mare)
  const geneticsData = {
    animalId,
    testProvider: "UC Davis VGL",
    testDate: new Date("2020-06-15"),
    testId: "VGL-2020-HORSE-0396",

    // Coat Color genetics - complete data with alleles
    coatColorData: [
      locus("E", "Extension", "E", "e"),      // Black-based, carries red
      locus("A", "Agouti", "A", "a"),         // Bay
      locus("O", "Overo (OLWS)", "O", "n"),   // FRAME OVERO - LETHAL WHITE RISK
      locus("TO", "Tobiano", "to", "to"),     // Non-tobiano
      locus("Cr", "Cream", "n", "n"),         // No cream
      locus("Rn", "Roan", "n", "n"),          // No roan
    ],

    // Health genetics - carrier status
    healthGeneticsData: [
      healthLocus("OLWS", "Overo Lethal White Syndrome", "O/n"),  // CARRIER - dangerous!
      healthLocus("HYPP", "Hyperkalemic Periodic Paralysis", "N/N"),
      healthLocus("GBED", "Glycogen Branching Enzyme Deficiency", "N/N"),
      healthLocus("HERDA", "Hereditary Equine Regional Dermal Asthenia", "N/N"),
      healthLocus("PSSM1", "Polysaccharide Storage Myopathy Type 1", "N/N"),
      healthLocus("MH", "Malignant Hyperthermia", "N/N"),
    ],

    // Physical traits - height genetics
    physicalTraitsData: [
      locus("LCORL", "Height (LCORL)", "C", "T"),   // Heterozygous - medium height
      locus("HMGA2", "Height (HMGA2)", "G", "G"),   // Homozygous
      locus("ZFAT", "Height (ZFAT)", "C", "C"),     // Homozygous
      locus("TBX3", "Body Proportion", "C", "C"),   // Normal proportion
    ],

    // Performance genetics
    performanceData: [
      locus("MSTN", "Speed Gene (Myostatin)", "C", "T"),  // Sprint/middle distance
      locus("DMRT3", "Gait Keeper", "A", "A"),            // Normal gait (not gaited)
      locus("CKM", "Muscle Fiber Composition", "A", "G"), // Mixed fiber type
      locus("COX4I2", "Oxygen Utilization", "C", "C"),    // Endurance capacity
    ],

    // Temperament genetics (behavioral)
    temperamentData: [
      locus("SLC6A4", "Serotonin Transporter", "L", "S"),   // L/S = moderate anxiety threshold
      locus("DRD4", "Dopamine Receptor D4", "A", "A"),      // Novelty seeking - normal
      locus("OPRM1", "Opioid Receptor", "A", "G"),          // Pain sensitivity - moderate
      locus("COMT", "Catechol-O-Methyltransferase", "Val", "Met"), // Stress response - balanced
    ],

    // Eye color (horses typically don't have varied eye color genetics like dogs)
    eyeColorData: [],

    // Other traits
    otherTraitsData: [],

    // Coat type (horses don't have the same coat type variations)
    coatTypeData: [],

    // Breed composition
    breedComposition: [
      { breed: "Paint Horse", percentage: 100 }
    ],
  };

  // Create new genetics record
  const created = await prisma.animalGenetics.create({
    data: geneticsData,
  });

  console.log(`✓ Created new genetics record (ID: ${created.id})`);

  // Verify the data
  const verify = await prisma.animalGenetics.findFirst({
    where: { animalId }
  });

  console.log('\n📊 VERIFICATION:');
  console.log(`   Coat Color loci: ${(verify.coatColorData || []).length}`);
  console.log(`   Health loci: ${(verify.healthGeneticsData || []).length}`);
  console.log(`   Physical Traits loci: ${(verify.physicalTraitsData || []).length}`);
  console.log(`   Performance loci: ${(verify.performanceData || []).length}`);
  console.log(`   Temperament loci: ${(verify.temperamentData || []).length}`);

  // Sample output
  console.log('\n📋 SAMPLE DATA (first coat color locus):');
  console.log(JSON.stringify(verify.coatColorData[0], null, 2));

  console.log('\n═'.repeat(70));
  console.log('✅ RE-SEED COMPLETE');
  console.log('═'.repeat(70));
  console.log('\nPainted Lady now has proper genetic data with allele values.');
  console.log('The UI should show "X of Y provided" with actual counts.\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
