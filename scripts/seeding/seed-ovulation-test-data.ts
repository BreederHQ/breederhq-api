/**
 * Seed script: Create test dam with ovulation pattern data
 *
 * This creates a realistic female dog with:
 * - 4 heat cycles recorded
 * - 3 breeding plans with different anchor types
 * - Birth outcomes for pattern back-calculation
 * - Mix of HIGH/MEDIUM/LOW confidence data
 *
 * Usage: tsx scripts/seed-ovulation-test-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ovulation test data...\n');

  // Use Tatooine tenant (ID: 4)
  const tenant = await prisma.tenant.findUnique({
    where: { id: 4 }
  });

  if (!tenant) {
    throw new Error('Tatooine tenant (ID: 4) not found');
  }

  console.log(`✓ Using tenant: ${tenant.name} (ID: ${tenant.id})\n`);

  // Idempotency: check if test dam already exists
  let dam = await prisma.animal.findFirst({
    where: { tenantId: tenant.id, name: "Fang's Legacy", species: 'DOG' }
  });

  if (dam) {
    console.log(`⏭️  Dam already exists: ${dam.name} (ID: ${dam.id}) — skipping entire seed`);
    console.log(`   Navigate to: /animals/${dam.id} → CYCLE INFO tab to see pattern analysis\n`);
    return;
  }

  // Create test dam: "Fang's Legacy" - A proven breeder with pattern
  console.log('Creating test dam: Fang\'s Legacy...');

  dam = await prisma.animal.create({
    data: {
      tenantId: tenant.id,
      name: "Fang's Legacy",
      species: 'DOG',
      sex: 'FEMALE',
      status: 'ACTIVE',
      birthDate: new Date('2020-03-15'),
      notes: 'Consistent late ovulator - typically Day 14. Great for testing ovulation pattern analysis.',
      // Override cycle length to 180 days (6 months)
      femaleCycleLenOverrideDays: 180
    }
  });
  console.log(`✓ Created dam: ${dam.name} (ID: ${dam.id})\n`);

  // Create a sire for breeding plans
  console.log('Creating test sire...');
  const sire = await prisma.animal.create({
    data: {
      tenantId: tenant.id,
      name: "Padfoot's Pride",
      species: 'DOG',
      sex: 'MALE',
      status: 'ACTIVE',
      birthDate: new Date('2019-06-20')
    }
  });
  console.log(`✓ Created sire: ${sire.name} (ID: ${sire.id})\n`);

  // Cycle 1: June 2024 (oldest)
  // Heat start: June 1, 2024
  // Ovulation: June 15, 2024 (Day 14 - late ovulator)
  // Birth: Aug 17, 2024 (63 days from ovulation)
  // Confidence: MEDIUM (back-calculated from birth)

  console.log('Creating Cycle 1 (June 2024) - Back-calculated from birth...');

  const cycle1Start = new Date('2024-06-01');
  const cycle1Ovulation = new Date('2024-06-15'); // Day 14
  const cycle1Birth = new Date('2024-08-17'); // 63 days from ovulation

  const cycle1 = await prisma.reproductiveCycle.create({
    data: {
      tenantId: tenant.id,
      femaleId: dam.id,
      cycleStart: cycle1Start,
      ovulation: cycle1Ovulation,
      notes: 'Back-calculated ovulation from birth date'
    }
  });

  const plan1 = await prisma.breedingPlan.create({
    data: {
      tenantId: tenant.id,
      name: 'June 2024 Breeding',
      species: 'DOG',
      damId: dam.id,
      sireId: sire.id,
      status: 'BIRTHED',
      reproAnchorMode: 'CYCLE_START',
      primaryAnchor: 'CYCLE_START',

      // Cycle start data
      cycleStartObserved: cycle1Start,
      cycleStartSource: 'OBSERVED',
      cycleStartConfidence: 'MEDIUM',
      lockedCycleStart: cycle1Start,

      // Birth data (will be used to back-calculate ovulation)
      birthDateActual: cycle1Birth,

      // Variance calculation (system would calculate this)
      expectedOvulationOffset: 12, // Species default for dogs
      actualOvulationOffset: 14,   // Actual: Day 14
      varianceFromExpected: 2      // +2 days late
    }
  });
  console.log(`✓ Created Cycle 1 breeding plan (MEDIUM confidence)\n`);

  // Cycle 2: December 2024
  // Heat start: Dec 1, 2024
  // Ovulation: Dec 15, 2024 (Day 14 - late ovulator, CONFIRMED via progesterone)
  // Birth: Feb 16, 2025
  // Confidence: HIGH (hormone-tested)

  console.log('Creating Cycle 2 (Dec 2024) - Hormone-tested ovulation...');

  const cycle2Start = new Date('2024-12-01');
  const cycle2Ovulation = new Date('2024-12-15'); // Day 14
  const cycle2Birth = new Date('2025-02-16');

  const cycle2 = await prisma.reproductiveCycle.create({
    data: {
      tenantId: tenant.id,
      femaleId: dam.id,
      cycleStart: cycle2Start,
      ovulation: cycle2Ovulation,
      notes: 'Ovulation confirmed via progesterone test (6.8 ng/mL on Day 14)'
    }
  });

  const plan2 = await prisma.breedingPlan.create({
    data: {
      tenantId: tenant.id,
      name: 'December 2024 Breeding',
      species: 'DOG',
      damId: dam.id,
      sireId: sire.id,
      status: 'BIRTHED',
      reproAnchorMode: 'OVULATION',
      primaryAnchor: 'OVULATION',

      // Cycle start data
      cycleStartObserved: cycle2Start,
      cycleStartSource: 'OBSERVED',
      cycleStartConfidence: 'HIGH',
      lockedCycleStart: cycle2Start,

      // Ovulation confirmation (HIGH confidence)
      ovulationConfirmed: cycle2Ovulation,
      ovulationConfirmedMethod: 'PROGESTERONE_TEST',
      ovulationConfidence: 'HIGH',

      // Birth data
      birthDateActual: cycle2Birth,

      // Variance calculation
      expectedOvulationOffset: 12,
      actualOvulationOffset: 14,
      varianceFromExpected: 2
    }
  });
  console.log(`✓ Created Cycle 2 breeding plan (HIGH confidence)\n`);

  // Cycle 3: June 2025
  // Heat start: June 1, 2025
  // Ovulation: June 16, 2025 (Day 15 - slightly later than usual)
  // Birth: Aug 18, 2025
  // Confidence: MEDIUM (back-calculated)

  console.log('Creating Cycle 3 (June 2025) - Back-calculated, slight variation...');

  const cycle3Start = new Date('2025-06-01');
  const cycle3Ovulation = new Date('2025-06-16'); // Day 15 (variation)
  const cycle3Birth = new Date('2025-08-18');

  const cycle3 = await prisma.reproductiveCycle.create({
    data: {
      tenantId: tenant.id,
      femaleId: dam.id,
      cycleStart: cycle3Start,
      ovulation: cycle3Ovulation,
      notes: 'Back-calculated from birth. Ovulated slightly later this cycle.'
    }
  });

  const plan3 = await prisma.breedingPlan.create({
    data: {
      tenantId: tenant.id,
      name: 'June 2025 Breeding',
      species: 'DOG',
      damId: dam.id,
      sireId: sire.id,
      status: 'BIRTHED',
      reproAnchorMode: 'CYCLE_START',
      primaryAnchor: 'CYCLE_START',

      cycleStartObserved: cycle3Start,
      cycleStartSource: 'OBSERVED',
      cycleStartConfidence: 'MEDIUM',
      lockedCycleStart: cycle3Start,

      birthDateActual: cycle3Birth,

      expectedOvulationOffset: 12,
      actualOvulationOffset: 15, // Day 15 this time
      varianceFromExpected: 3   // +3 days late
    }
  });
  console.log(`✓ Created Cycle 3 breeding plan (MEDIUM confidence)\n`);

  // Cycle 4: December 2025 (most recent)
  // Heat start: Dec 1, 2025
  // NO BREEDING - just cycle tracking
  // Confidence: LOW (estimated)

  console.log('Creating Cycle 4 (Dec 2025) - No breeding, cycle tracking only...');

  const cycle4Start = new Date('2025-12-01');
  const cycle4Ovulation = new Date('2025-12-15'); // Estimated based on pattern

  const cycle4 = await prisma.reproductiveCycle.create({
    data: {
      tenantId: tenant.id,
      femaleId: dam.id,
      cycleStart: cycle4Start,
      ovulation: cycle4Ovulation,
      notes: 'No breeding this cycle. Ovulation estimated based on her historical pattern (Day 14).'
    }
  });
  console.log(`✓ Created Cycle 4 (no breeding)\n`);

  // Summary
  console.log('\n✅ Seed complete!\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Test Dam Created: Fang\'s Legacy');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Dam ID: ${dam.id}`);
  console.log(`Tenant: ${tenant.name}`);
  console.log('\nCycle History:');
  console.log('  • Cycle 1 (Jun 2024): Day 14 ovulation - Back-calculated (MEDIUM)');
  console.log('  • Cycle 2 (Dec 2024): Day 14 ovulation - Progesterone test (HIGH)');
  console.log('  • Cycle 3 (Jun 2025): Day 15 ovulation - Back-calculated (MEDIUM)');
  console.log('  • Cycle 4 (Dec 2025): No breeding - Estimated only (LOW)');
  console.log('\nExpected Pattern Analysis:');
  console.log('  • Classification: Late Ovulator');
  console.log('  • Average Offset: 14.3 days (3 reliable cycles)');
  console.log('  • Standard Deviation: ~0.58 days');
  console.log('  • Confidence: HIGH (consistent pattern with hormone test)');
  console.log('  • Variance: +2 to +3 days later than breed average (Day 12)');
  console.log('\nNext Projected Cycle:');
  console.log('  • Heat Start: June 1, 2026');
  console.log('  • Ovulation Window: June 13-17, 2026 (most likely: 15th)');
  console.log('  • Testing Recommendation: Start Day 10 (June 11, 2026)');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Navigate to: /animals/${dam.id} → CYCLE INFO tab to see pattern analysis\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
