import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Migrate MSTN and DMRT3 from physicalTraitsData to performanceData
 * These are performance genetics (speed, gait) not physical traits (height, size)
 */
async function migratePerformanceGenetics() {
  console.log('Migrating MSTN and DMRT3 from physicalTraitsData to performanceData...\n');

  // Find all animals with genetics data
  const allGenetics = await prisma.animalGenetics.findMany({
    include: {
      animal: {
        select: { id: true, name: true, species: true }
      }
    }
  });

  let migratedCount = 0;

  for (const genetics of allGenetics) {
    const physicalTraits = (genetics.physicalTraitsData as any[]) || [];
    const performance = (genetics.performanceData as any[]) || [];

    // Find MSTN and DMRT3 in physicalTraits
    const mstn = physicalTraits.find((l: any) => l.locus === 'MSTN');
    const dmrt3 = physicalTraits.find((l: any) => l.locus === 'DMRT3');

    if (!mstn && !dmrt3) {
      continue; // No migration needed
    }

    console.log(`\n📦 ${genetics.animal.name} (${genetics.animal.species}) - ID: ${genetics.animal.id}`);

    // Remove MSTN and DMRT3 from physicalTraits
    const newPhysicalTraits = physicalTraits.filter(
      (l: any) => l.locus !== 'MSTN' && l.locus !== 'DMRT3'
    );

    // Add to performance (avoid duplicates)
    const newPerformance = [...performance];

    if (mstn && !performance.some((l: any) => l.locus === 'MSTN')) {
      console.log(`  ✓ Moving MSTN: ${mstn.genotype || `${mstn.allele1}/${mstn.allele2}`}`);
      newPerformance.push(mstn);
    }

    if (dmrt3 && !performance.some((l: any) => l.locus === 'DMRT3')) {
      console.log(`  ✓ Moving DMRT3: ${dmrt3.genotype || `${dmrt3.allele1}/${dmrt3.allele2}`}`);
      newPerformance.push(dmrt3);
    }

    // Update the database
    await prisma.animalGenetics.update({
      where: { id: genetics.id },
      data: {
        physicalTraitsData: newPhysicalTraits,
        performanceData: newPerformance,
      }
    });

    console.log(`  📝 Updated genetics record (physicalTraits: ${physicalTraits.length} → ${newPhysicalTraits.length}, performance: ${performance.length} → ${newPerformance.length})`);
    migratedCount++;
  }

  console.log(`\n✅ Migration complete! Updated ${migratedCount} animal(s).`);

  if (migratedCount > 0) {
    console.log('\nℹ️  The database trigger will automatically sync these changes to the animal_loci table.');
  }
}

migratePerformanceGenetics()
  .catch((e) => {
    console.error('❌ Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
