#!/usr/bin/env node
/**
 * Seed realistic ovulation data for Phoebe (Animal ID 1977, Tenant 45)
 *
 * Creates 5 ReproductiveCycle records, 3 historical BreedingPlan records,
 * and updates 2 existing plans — producing a compelling Ovulation Pattern
 * Analysis chart for the video demo.
 *
 * Expected chart result:
 *   5 bars: Day 7, 8, 6, 7, 7 (3 green HIGH, 2 blue MEDIUM)
 *   Classification: "Late Ovulator" — HIGH confidence
 *   Guidance: "Start progesterone testing on Day 3..."
 *
 * Usage:
 *   node scripts/seed-phoebe-ovulation.js          (dry run)
 *   node scripts/seed-phoebe-ovulation.js --apply   (insert into dev DB)
 */

const TENANT_ID = 45;
const PHOEBE_ID = 1977;
const SIRE_ID = 1999; // VS Code Red

const CYCLES = [
  { start: "2022-03-15", ov: "2022-03-22", status: "COMPLETED", notes: "Spring 2022 — bred, resulted in 2023 foal" },
  { start: "2023-03-20", ov: "2023-03-28", status: "COMPLETED", notes: "Spring 2023 — progesterone confirmed, bred successfully" },
  { start: "2023-10-05", ov: "2023-10-11", status: "COMPLETED", notes: "Fall 2023 — bred, resulted in 2024 foal" },
  { start: "2024-04-02", ov: "2024-04-09", status: "COMPLETED", notes: "Spring 2024 — bred, resulted in 2025 foal (Plan 324)" },
  { start: "2025-04-10", ov: "2025-04-17", status: "ACTIVE",    notes: "Spring 2025 — current pregnancy (Plan 332)" },
];

// Historical plans so the cycle-analysis-service can match these cycles.
// Matching is done by cycleStartObserved within ±3 days of ReproductiveCycle.cycleStart.
const HISTORICAL_PLANS = [
  {
    // Matches Cycle 1. Path: BIRTH_CALCULATED → MEDIUM confidence.
    // Birth: 2022-03-22 (conception) + 340 (gestation) = 2023-02-25
    name: "Phoebe x VS Code Red 2022",
    cycleStartObserved: "2022-03-15",
    birthDateActual: "2023-02-25",
    status: "COMPLETE",
  },
  {
    // Matches Cycle 2. Path: HORMONE_TEST → HIGH confidence.
    name: "Phoebe x VS Code Red 2023 Spring",
    cycleStartObserved: "2023-03-20",
    ovulationConfirmed: "2023-03-28",
    ovulationConfirmedMethod: "PROGESTERONE_TEST",
    expectedOvulationOffset: 5,
    actualOvulationOffset: 8,
    birthDateActual: "2024-02-22",
    status: "COMPLETE",
  },
  {
    // Matches Cycle 3. Path: BIRTH_CALCULATED → MEDIUM confidence.
    // Birth: 2023-10-11 + 340 = 2024-09-16
    name: "Phoebe x VS Code Red 2023 Fall",
    cycleStartObserved: "2023-10-05",
    birthDateActual: "2024-09-16",
    status: "COMPLETE",
  },
];

// Updates to existing plans (existing Plan 324 and 332)
const PLAN_UPDATES = [
  {
    planId: 324,
    cycleStartObserved: "2024-04-02",
    ovulationConfirmed: "2024-04-09",
    ovulationConfirmedMethod: "PROGESTERONE_TEST",
    expectedOvulationOffset: 5,
    actualOvulationOffset: 7,
  },
  {
    planId: 332,
    cycleStartObserved: "2025-04-10",
    ovulationConfirmed: "2025-04-17",
    ovulationConfirmedMethod: "PROGESTERONE_TEST",
    expectedOvulationOffset: 5,
    actualOvulationOffset: 7,
  },
];

function buildSQL() {
  const stmts = [];

  // 1. ReproductiveCycle inserts
  for (const c of CYCLES) {
    stmts.push({
      label: `ReproductiveCycle: ${c.start} (offset Day ${daysBetween(c.ov, c.start)})`,
      sql: `INSERT INTO "ReproductiveCycle" ("tenantId", "femaleId", "cycleStart", "ovulation", "status", "notes", "createdAt", "updatedAt")
VALUES (${TENANT_ID}, ${PHOEBE_ID}, '${c.start}T00:00:00Z', '${c.ov}T12:00:00Z', '${c.status}', '${esc(c.notes)}', NOW(), NOW());`,
    });
  }

  // 2. Historical BreedingPlan inserts
  for (const hp of HISTORICAL_PLANS) {
    const ovCols = hp.ovulationConfirmed
      ? `"ovulationConfirmed", "ovulationConfirmedMethod", "expectedOvulationOffset", "actualOvulationOffset",`
      : "";
    const ovVals = hp.ovulationConfirmed
      ? `'${hp.ovulationConfirmed}T12:00:00Z', '${hp.ovulationConfirmedMethod}'::"OvulationMethod", ${hp.expectedOvulationOffset}, ${hp.actualOvulationOffset},`
      : "";

    stmts.push({
      label: `BreedingPlan (new): ${hp.name}`,
      sql: `INSERT INTO "BreedingPlan" (
  "tenantId", "name", "species", "damId", "sireId",
  "cycleStartObserved", "birthDateActual", "status",
  ${ovCols}
  "createdAt", "updatedAt"
) VALUES (
  ${TENANT_ID}, '${esc(hp.name)}', 'HORSE', ${PHOEBE_ID}, ${SIRE_ID},
  '${hp.cycleStartObserved}T00:00:00Z', '${hp.birthDateActual}T00:00:00Z', '${hp.status}',
  ${ovVals}
  NOW(), NOW()
);`,
    });
  }

  // 3. Existing plan updates
  for (const p of PLAN_UPDATES) {
    stmts.push({
      label: `BreedingPlan (update): #${p.planId}`,
      sql: `UPDATE "BreedingPlan"
SET "cycleStartObserved" = '${p.cycleStartObserved}T00:00:00Z',
    "ovulationConfirmed" = '${p.ovulationConfirmed}T12:00:00Z',
    "ovulationConfirmedMethod" = '${p.ovulationConfirmedMethod}'::"OvulationMethod",
    "expectedOvulationOffset" = ${p.expectedOvulationOffset},
    "actualOvulationOffset" = ${p.actualOvulationOffset},
    "updatedAt" = NOW()
WHERE "id" = ${p.planId} AND "tenantId" = ${TENANT_ID};`,
    });
  }

  return stmts;
}

function daysBetween(a, b) {
  return Math.round((new Date(a) - new Date(b)) / 86400000);
}

function esc(s) {
  return s.replace(/'/g, "''");
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  const stmts = buildSQL();

  if (dryRun) {
    console.log("=== DRY RUN (pass --apply to execute) ===\n");
  }

  console.log(`─── SQL (${stmts.length} statements) ───`);
  for (const s of stmts) {
    console.log(`\n-- ${s.label}`);
    console.log(s.sql);
  }

  if (dryRun) {
    console.log("\n─── Expected Chart ───");
    console.log("  Mare: Phoebe (ID 1977) — Quarter Horse");
    console.log("  Species default: ovulation Day 5");
    console.log("");
    console.log("  Bar 1: Apr 2025 → Day 7  GREEN  (HIGH — progesterone, Plan 332)");
    console.log("  Bar 2: Apr 2024 → Day 7  GREEN  (HIGH — progesterone, Plan 324)");
    console.log("  Bar 3: Oct 2023 → Day 6  BLUE   (MEDIUM — birth back-calc)");
    console.log("  Bar 4: Mar 2023 → Day 8  GREEN  (HIGH — progesterone)");
    console.log("  Bar 5: Mar 2022 → Day 7  BLUE   (MEDIUM — birth back-calc)");
    console.log("");
    console.log("  Pattern: offsets [7,7,6,8,7] → avg=7.0, σ=0.6");
    console.log("  Classification: Late Ovulator (HIGH confidence)");
    console.log("  Guidance: '...ovulates on Day 7, 2 days later than breed avg...'");
    console.log("\n  Pass --apply to insert.");
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    console.log("\n─── Executing ───");
    for (const s of stmts) {
      console.log(`  ✓ ${s.label}`);
      await prisma.$executeRawUnsafe(s.sql);
    }
    console.log("\n✅ Done! 5 cycles + 3 historical plans + 2 plan updates.");
    console.log("   → Open Phoebe's Cycle tab to verify the chart.");
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  } finally {
    await prisma["$disconnect"]();
  }
}

main();
