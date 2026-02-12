import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigration() {
  console.log('Verifying performance genetics migration for Painted Lady...\n');

  // Get Painted Lady's genetics
  const animal = await prisma.animal.findFirst({
    where: { name: { contains: 'Painted Lady' } },
    include: { genetics: true }
  });

  if (!animal || !animal.genetics) {
    console.log('❌ Animal or genetics not found');
    return;
  }

  console.log(`🐴 ${animal.name} (${animal.species}) - ID: ${animal.id}\n`);

  const genetics = animal.genetics;

  // Check physicalTraitsData (should be empty now)
  const physicalTraits = (genetics.physicalTraitsData as any[]) || [];
  console.log('Physical Traits Data:');
  console.log(`  Count: ${physicalTraits.length}`);
  if (physicalTraits.length > 0) {
    console.log('  Loci:', physicalTraits.map((l: any) => l.locus).join(', '));
  }
  const hasMSTNinPhysical = physicalTraits.some((l: any) => l.locus === 'MSTN');
  const hasDMRT3inPhysical = physicalTraits.some((l: any) => l.locus === 'DMRT3');
  console.log(`  Contains MSTN: ${hasMSTNinPhysical ? '❌ YES (WRONG!)' : '✅ No'}`);
  console.log(`  Contains DMRT3: ${hasDMRT3inPhysical ? '❌ YES (WRONG!)' : '✅ No'}`);

  // Check performanceData (should have MSTN and DMRT3)
  const performance = (genetics.performanceData as any[]) || [];
  console.log('\nPerformance Data:');
  console.log(`  Count: ${performance.length}`);
  if (performance.length > 0) {
    performance.forEach((l: any) => {
      console.log(`  ✓ ${l.locus} (${l.locusName}): ${l.genotype || `${l.allele1}/${l.allele2}`}`);
    });
  }
  const hasMSTNinPerformance = performance.some((l: any) => l.locus === 'MSTN');
  const hasDMRT3inPerformance = performance.some((l: any) => l.locus === 'DMRT3');

  // Check animal_loci table
  console.log('\nSearchable Index (animal_loci table):');
  const loci = await prisma.$queryRaw<any[]>`
    SELECT category, locus, locus_name, genotype, allele1, allele2
    FROM animal_loci
    WHERE animal_id = ${animal.id}
    ORDER BY category, locus
  `;

  const performanceLoci = loci.filter(l => l.category === 'performance');
  const physicalLoci = loci.filter(l => l.category === 'physicalTraits');

  console.log(`  Total loci indexed: ${loci.length}`);
  console.log(`  Performance category: ${performanceLoci.length} loci`);
  if (performanceLoci.length > 0) {
    performanceLoci.forEach(l => {
      console.log(`    ✓ ${l.locus} (${l.locus_name}): ${l.genotype || `${l.allele1}/${l.allele2}`}`);
    });
  }

  console.log(`  PhysicalTraits category: ${physicalLoci.length} loci`);
  if (physicalLoci.length > 0) {
    physicalLoci.forEach(l => {
      console.log(`    - ${l.locus} (${l.locus_name}): ${l.genotype || `${l.allele1}/${l.allele2}`}`);
    });
  }

  // Final verification
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION RESULTS:');
  console.log('='.repeat(60));

  const allGood =
    !hasMSTNinPhysical &&
    !hasDMRT3inPhysical &&
    hasMSTNinPerformance &&
    hasDMRT3inPerformance &&
    performanceLoci.some(l => l.locus === 'MSTN') &&
    performanceLoci.some(l => l.locus === 'DMRT3');

  if (allGood) {
    console.log('✅ ALL CHECKS PASSED!');
    console.log('   - MSTN removed from physicalTraits ✓');
    console.log('   - DMRT3 removed from physicalTraits ✓');
    console.log('   - MSTN added to performance ✓');
    console.log('   - DMRT3 added to performance ✓');
    console.log('   - animal_loci table synced correctly ✓');
  } else {
    console.log('❌ ISSUES DETECTED:');
    if (hasMSTNinPhysical) console.log('   - MSTN still in physicalTraits');
    if (hasDMRT3inPhysical) console.log('   - DMRT3 still in physicalTraits');
    if (!hasMSTNinPerformance) console.log('   - MSTN missing from performance');
    if (!hasDMRT3inPerformance) console.log('   - DMRT3 missing from performance');
    if (!performanceLoci.some(l => l.locus === 'MSTN')) {
      console.log('   - MSTN not synced to animal_loci');
    }
    if (!performanceLoci.some(l => l.locus === 'DMRT3')) {
      console.log('   - DMRT3 not synced to animal_loci');
    }
  }
}

verifyMigration()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
