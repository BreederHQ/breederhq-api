/**
 * KVS Demo Tenant — Supplemental Seeder for Video Demo
 *
 * Applies the supplemental data defined in kvs-demo-supplements.ts.
 * Must be run AFTER the main kvs seed (npm run db:dev:seed:kvs).
 *
 * What it creates:
 *   1. CYCLE-phase breeding plan (Sophie x Good Better Best Fall 2026)
 *   2. Pre-breeding P4 + follicle exam test results on the CYCLE plan
 *   3. Cycle start dates (heat history) on Annie and Sophie
 *   4. Vaccination records for Kennedy and Annie
 *   5. Foaling check records for Raven (overdue mare)
 *   6. Health trait values (Coggins, BSE) for Kennedy, Annie, Waylon
 *
 * Usage:
 *   npx tsx scripts/seeding/kvs-demo-tenant/seed-kvs-demo-supplements.ts
 */

import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
import {
  KVS_CYCLE_PLAN,
  KVS_CYCLE_PLAN_TESTS,
  KVS_CYCLE_HISTORY_ANNIE,
  KVS_CYCLE_HISTORY_SOPHIE,
  KVS_VACCINATIONS,
  KVS_FOALING_CHECKS,
  KVS_HEALTH_TRAITS,
} from './kvs-demo-supplements';

const prisma = new PrismaClient();
const KVS_SLUG = 'kvs-demo';

function log(msg: string) { console.log(`  ${msg}`); }
function section(title: string) { console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`); }

// ── Resolve tenant + animal lookup ──────────────────────────────────

async function getTenantId(): Promise<number> {
  const tenant = await prisma.tenant.findFirst({ where: { slug: KVS_SLUG } });
  if (!tenant) throw new Error(`Tenant "${KVS_SLUG}" not found — run main seed first!`);
  return tenant.id;
}

async function buildAnimalMap(tenantId: number): Promise<Map<string, number>> {
  const animals = await prisma.animal.findMany({
    where: { tenantId },
    select: { id: true, name: true, nickname: true },
  });
  const map = new Map<string, number>();
  for (const a of animals) {
    map.set(a.name, a.id);
    if (a.nickname) map.set(a.nickname, a.id);
  }
  return map;
}

async function buildPlanMap(tenantId: number): Promise<Map<string, number>> {
  const plans = await prisma.breedingPlan.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });
  const map = new Map<string, number>();
  for (const p of plans) map.set(p.name, p.id);
  return map;
}

async function buildTagMap(tenantId: number): Promise<Map<string, number>> {
  const tags = await prisma.tag.findMany({ where: { tenantId } });
  const map = new Map<string, number>();
  for (const t of tags) map.set(`${t.module}:${t.name}`, t.id);
  return map;
}

// ══════════════════════════════════════════════════════════════════════
// 1. CYCLE-PHASE BREEDING PLAN
// ══════════════════════════════════════════════════════════════════════

async function seedCyclePlan(
  tenantId: number,
  animalMap: Map<string, number>,
  tagMap: Map<string, number>,
): Promise<number | null> {
  section('Supplement 1: CYCLE-Phase Plan');

  const existing = await prisma.breedingPlan.findFirst({
    where: { tenantId, name: KVS_CYCLE_PLAN.name },
  });
  if (existing) {
    log(`⏭️  Plan already exists: "${existing.name}" (id=${existing.id})`);
    return existing.id;
  }

  const damId = animalMap.get(KVS_CYCLE_PLAN.damRef);
  const sireId = animalMap.get(KVS_CYCLE_PLAN.sireRef);
  if (!damId) { log(`⚠️  Dam not found: ${KVS_CYCLE_PLAN.damRef}`); return null; }
  if (!sireId) { log(`⚠️  Sire not found: ${KVS_CYCLE_PLAN.sireRef}`); return null; }

  const plan = await prisma.breedingPlan.create({
    data: {
      tenantId,
      name: KVS_CYCLE_PLAN.name,
      nickname: KVS_CYCLE_PLAN.nickname,
      species: KVS_CYCLE_PLAN.species,
      breedText: KVS_CYCLE_PLAN.breedText,
      damId,
      sireId,
      status: KVS_CYCLE_PLAN.status as any,
      notes: KVS_CYCLE_PLAN.notes,
      isCommittedIntent: true,
      committedAt: new Date(),
      reproAnchorMode: 'CYCLE_START' as any,
      cycleStartDateActual: new Date(`${KVS_CYCLE_PLAN.cycleStartDateActual}T12:00:00Z`),
    },
  });
  log(`✅ Created CYCLE plan: "${plan.name}" (id=${plan.id})`);

  // Tag it
  const tagId = tagMap.get('BREEDING_PLAN:2026 Season');
  if (tagId) {
    await prisma.tagAssignment.create({ data: { tagId, breedingPlanId: plan.id } });
  }

  // Seed the pre-breeding test results
  let testCount = 0;
  for (const t of KVS_CYCLE_PLAN_TESTS) {
    await prisma.testResult.create({
      data: {
        tenantId,
        planId: plan.id,
        animalId: damId,
        kind: t.kind,
        method: t.method,
        collectedAt: new Date(`${t.collectedAt}T12:00:00Z`),
        valueNumber: t.valueNumber,
        units: t.units,
        notes: t.notes,
      },
    });
    testCount++;
  }
  log(`✅ ${testCount} pre-breeding test results (P4 + follicle) created`);

  return plan.id;
}

// ══════════════════════════════════════════════════════════════════════
// 2. CYCLE START DATES
// ══════════════════════════════════════════════════════════════════════

async function seedCycleHistory(
  tenantId: number,
  animalMap: Map<string, number>,
): Promise<void> {
  section('Supplement 2: Cycle Start Dates');

  const pairs: [string, string[]][] = [
    ['Hot Pistol Annie', KVS_CYCLE_HISTORY_ANNIE],
    ['Sophie', KVS_CYCLE_HISTORY_SOPHIE],
  ];

  for (const [animalRef, dates] of pairs) {
    const femaleId = animalMap.get(animalRef);
    if (!femaleId) { log(`⚠️  Animal not found: ${animalRef}`); continue; }

    // Check for existing ReproductiveCycle records
    const existing = await prisma.reproductiveCycle.findMany({
      where: { tenantId, femaleId },
    });
    if (existing.length > 0) {
      log(`⏭️  ${animalRef} already has ${existing.length} cycle records — skipping`);
      continue;
    }

    // Create a ReproductiveCycle record for each date
    const sorted = [...dates].sort();
    for (const dateStr of sorted) {
      await prisma.reproductiveCycle.create({
        data: {
          tenantId,
          femaleId,
          cycleStart: new Date(`${dateStr}T12:00:00Z`),
        },
      });
    }
    log(`✅ ${animalRef}: ${sorted.length} cycle start dates added`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// 3. VACCINATION RECORDS
// ══════════════════════════════════════════════════════════════════════

async function seedVaccinations(
  tenantId: number,
  animalMap: Map<string, number>,
): Promise<void> {
  section('Supplement 3: Vaccination Records');
  let created = 0;

  for (const v of KVS_VACCINATIONS) {
    const animalId = animalMap.get(v.animalRef);
    if (!animalId) { log(`⚠️  Animal not found: ${v.animalRef}`); continue; }

    const administeredAt = new Date(`${v.administeredAt}T12:00:00Z`);

    // Check for existing (same animal + protocol + date)
    const existing = await prisma.vaccinationRecord.findFirst({
      where: { tenantId, animalId, protocolKey: v.protocolKey, administeredAt },
    });
    if (existing) continue;

    await prisma.vaccinationRecord.create({
      data: {
        tenantId,
        animalId,
        protocolKey: v.protocolKey,
        administeredAt,
        expiresAt: v.expiresAt ? new Date(`${v.expiresAt}T12:00:00Z`) : undefined,
        veterinarian: v.veterinarianName ?? undefined,
        clinic: v.clinicName ?? undefined,
        batchLotNumber: v.batchNumber ?? undefined,
        notes: v.notes ?? undefined,
      },
    });
    created++;
  }

  log(`✅ ${created} vaccination records created`);
}

// ══════════════════════════════════════════════════════════════════════
// 4. FOALING CHECKS (Pre-Foaling Monitor)
// ══════════════════════════════════════════════════════════════════════

async function seedFoalingChecks(
  tenantId: number,
  animalMap: Map<string, number>,
  planMap: Map<string, number>,
): Promise<void> {
  section('Supplement 4: Foaling Check History');
  let created = 0;

  // Raven's foaling checks belong to her breeding plan
  // Find Raven's plan by looking for a plan with Raven as dam
  const ravenId = animalMap.get('Raven');
  if (!ravenId) { log('⚠️  Raven not found — skipping foaling checks'); return; }

  const ravenPlan = await prisma.breedingPlan.findFirst({
    where: { tenantId, damId: ravenId },
    orderBy: { createdAt: 'desc' },
  });
  if (!ravenPlan) { log('⚠️  No breeding plan found for Raven — skipping foaling checks'); return; }

  for (const fc of KVS_FOALING_CHECKS) {
    const checkedAt = new Date(fc.checkedAt);

    // Check existing by timestamp proximity (within 1 hour)
    const existingChecks = await prisma.foalingCheck.findMany({
      where: {
        tenantId,
        breedingPlanId: ravenPlan.id,
        checkedAt: {
          gte: new Date(checkedAt.getTime() - 60 * 60 * 1000),
          lte: new Date(checkedAt.getTime() + 60 * 60 * 1000),
        },
      },
    });
    if (existingChecks.length > 0) continue;

    await prisma.foalingCheck.create({
      data: {
        tenantId,
        breedingPlanId: ravenPlan.id,
        checkedAt,
        udderDevelopment: fc.udderDevelopment,
        vulvaRelaxation: fc.vulvaRelaxation,
        tailHeadRelaxation: fc.tailheadRelaxation,
        temperature: fc.temperature ?? undefined,
        behaviorNotes: fc.behaviorNotes ?? [],
        additionalNotes: fc.additionalNotes ?? undefined,
        foalingImminent: fc.foalingImminent ?? false,
        updatedAt: checkedAt,
      },
    });
    created++;
  }

  log(`✅ ${created} foaling checks created for Raven (plan: ${ravenPlan.name})`);
}

// ══════════════════════════════════════════════════════════════════════
// 5. HEALTH TRAIT VALUES
// ══════════════════════════════════════════════════════════════════════

async function seedHealthTraits(
  tenantId: number,
  animalMap: Map<string, number>,
): Promise<void> {
  section('Supplement 5: Health Trait Values');
  let created = 0;

  for (const ht of KVS_HEALTH_TRAITS) {
    const animalId = animalMap.get(ht.animalRef);
    if (!animalId) { log(`⚠️  Animal not found: ${ht.animalRef}`); continue; }

    // Find the trait definition for this key + species
    const traitDef = await (prisma as any).traitDefinition.findFirst({
      where: { key: ht.traitKey, species: 'HORSE' },
    });
    if (!traitDef) {
      log(`⚠️  TraitDefinition not found: ${ht.traitKey} (HORSE) — skipping`);
      continue;
    }

    // Check for existing
    const existing = await prisma.animalTraitValue.findFirst({
      where: { tenantId, animalId, traitDefinitionId: traitDef.id },
    });
    if (existing) {
      log(`⏭️  ${ht.animalRef}/${ht.traitKey} already has value — skipping`);
      continue;
    }

    // Map the string value to the correct typed column based on TraitDefinition.valueType
    const valueData: Record<string, unknown> = {};
    const vt: string = traitDef.valueType;
    if (vt === 'BOOLEAN') {
      valueData.valueBoolean = ht.value === 'true';
    } else if (vt === 'NUMBER') {
      valueData.valueNumber = parseFloat(ht.value);
    } else if (vt === 'DATE') {
      valueData.valueDate = new Date(ht.value);
    } else {
      // TEXT, ENUM, or anything else → valueText
      valueData.valueText = ht.value;
    }

    await prisma.animalTraitValue.create({
      data: {
        tenantId,
        animalId,
        traitDefinitionId: traitDef.id,
        ...valueData,
        notes: ht.notes ?? undefined,
        networkVisible: true,
      } as any,
    });
    created++;
  }

  log(`✅ ${created} health trait values created`);
}

// ══════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  KVS Demo Supplements — Video Demo Data                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const tenantId = await getTenantId();
  log(`Tenant: kvs-demo (id=${tenantId})`);

  const animalMap = await buildAnimalMap(tenantId);
  const planMap = await buildPlanMap(tenantId);
  const tagMap = await buildTagMap(tenantId);
  log(`Loaded: ${animalMap.size} animals, ${planMap.size} plans, ${tagMap.size} tags\n`);

  await seedCyclePlan(tenantId, animalMap, tagMap);
  await seedCycleHistory(tenantId, animalMap);
  await seedVaccinations(tenantId, animalMap);
  await seedFoalingChecks(tenantId, animalMap, planMap);
  await seedHealthTraits(tenantId, animalMap);

  console.log('\n── Summary ─────────────────────────────────────────────');
  console.log('  Demo supplements applied. You can now demo:');
  console.log('  • Mare Status Board: Sophie (Open→CYCLE), Raven (overdue)');
  console.log('  • Cycle Tab: Annie (6 cycle dates), Sophie (6 cycle dates)');
  console.log('  • Breeding Plan (CYCLE phase): Sophie x Good Better Best');
  console.log('  • P4 Trend Chart: Sophie plan has 2 P4 + 2 follicle results');
  console.log('  • Health Tab: Kennedy + Annie (vaccinations + Coggins + BSE)');
  console.log('  • Pre-Foaling Monitor: Raven (5 progressive foaling checks)');
  console.log('  • Genetics Lab: Kennedy x Machine Made (GBED carrier pair)');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
