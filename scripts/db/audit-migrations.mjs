#!/usr/bin/env node
/**
 * Comprehensive Migration Audit
 *
 * Checks for all possible Prisma migration issues:
 * 1. Zero-step migrations (applied_steps_count = 0)
 * 2. Rolled back migrations still in table
 * 3. Stuck migrations (never finished)
 * 4. Duplicate migration names
 * 5. Migration files not in DB (pending)
 * 6. DB records without migration files (orphaned)
 */

import { PrismaClient } from "@prisma/client";
import { readdirSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

// Same baseline list as check-migration-integrity.mjs
const BASELINE_MIGRATIONS = [
  "20251230112400_init",
  "20251231162841_add_audit_event_log",
  "20260102204500_add_offspringgroup_link_to_scheduling_block",
  "20260108160000_add_titles_competitions",
];

async function auditMigrations() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  COMPREHENSIVE MIGRATION AUDIT");
  console.log("═══════════════════════════════════════════════════════════════\n");

  let issues = 0;

  // 1. All migration records
  const all = await prisma.$queryRaw`
    SELECT migration_name, applied_steps_count, finished_at, rolled_back_at, logs
    FROM "_prisma_migrations"
    ORDER BY started_at
  `;

  console.log(`Total migration records: ${all.length}\n`);

  // 2. Zero-step migrations (excluding baselines)
  const zeroStep = all.filter(m => m.applied_steps_count === 0 && !m.rolled_back_at);
  const zeroStepBaseline = zeroStep.filter(m => BASELINE_MIGRATIONS.includes(m.migration_name));
  const zeroStepNonBaseline = zeroStep.filter(m => !BASELINE_MIGRATIONS.includes(m.migration_name));

  if (zeroStepBaseline.length > 0) {
    console.log("Baselined migrations (zero-step, expected):");
    zeroStepBaseline.forEach(m => console.log(`  - ${m.migration_name} ✓`));
    console.log("");
  }

  console.log("Zero-step migrations (NOT baselined - ISSUES):");
  if (zeroStepNonBaseline.length === 0) {
    console.log("  None ✓");
  } else {
    zeroStepNonBaseline.forEach(m => console.log(`  - ${m.migration_name}`));
    issues += zeroStepNonBaseline.length;
  }
  console.log("");

  // 3. Rolled back
  const rolledBack = all.filter(m => m.rolled_back_at);
  console.log("Rolled back migrations:");
  if (rolledBack.length === 0) {
    console.log("  None ✓");
  } else {
    rolledBack.forEach(m => console.log(`  - ${m.migration_name}`));
    issues += rolledBack.length;
  }
  console.log("");

  // 4. Stuck (not finished)
  const stuck = all.filter(m => !m.finished_at && !m.rolled_back_at);
  console.log("Stuck migrations (never finished):");
  if (stuck.length === 0) {
    console.log("  None ✓");
  } else {
    stuck.forEach(m => {
      const logs = m.logs ? String(m.logs).substring(0, 100) : "no logs";
      console.log(`  - ${m.migration_name} | ${logs}`);
    });
    issues += stuck.length;
  }
  console.log("");

  // 5. Duplicates
  const names = all.map(m => m.migration_name);
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
  console.log("Duplicate migration names:");
  if (duplicates.length === 0) {
    console.log("  None ✓");
  } else {
    [...new Set(duplicates)].forEach(n => console.log(`  - ${n}`));
    issues += duplicates.length;
  }
  console.log("");

  // 6. Check migration files vs DB records
  const migrationsDir = join(process.cwd(), "prisma/migrations");
  const folders = readdirSync(migrationsDir).filter(f => /^\d{14}_/.test(f));

  const inDb = new Set(all.map(m => m.migration_name));
  const onDisk = new Set(folders);

  const missingInDb = folders.filter(f => !inDb.has(f));
  const missingOnDisk = all.filter(m => !onDisk.has(m.migration_name)).map(m => m.migration_name);

  console.log("Migration files not in DB (pending):");
  if (missingInDb.length === 0) {
    console.log("  None ✓");
  } else {
    missingInDb.forEach(f => console.log(`  - ${f}`));
    // Pending migrations aren't necessarily issues
  }
  console.log("");

  console.log("DB records without migration files (orphaned):");
  if (missingOnDisk.length === 0) {
    console.log("  None ✓");
  } else {
    missingOnDisk.forEach(n => console.log(`  - ${n}`));
    issues += missingOnDisk.length;
  }
  console.log("");

  // Summary
  console.log("═══════════════════════════════════════════════════════════════");
  if (issues === 0) {
    console.log("  ✓ ALL CHECKS PASSED - No migration issues found");
  } else {
    console.log(`  ❌ FOUND ${issues} ISSUE(S) - Review above`);
  }
  console.log("═══════════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
  return issues;
}

auditMigrations()
  .then(issues => process.exit(issues > 0 ? 1 : 0))
  .catch(err => {
    console.error("Audit failed:", err.message);
    process.exit(2);
  });
