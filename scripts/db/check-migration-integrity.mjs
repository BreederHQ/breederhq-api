#!/usr/bin/env node
/**
 * Migration Integrity Gate
 *
 * Prevents silent migration failures by detecting:
 * 1. Migrations marked as applied but with applied_steps_count = 0
 * 2. Migrations with finished_at = null (stuck/failed)
 * 3. Migrations with rolled_back_at set but still in table
 *
 * This script should be run:
 * - Before any `prisma migrate deploy` in CI
 * - After any `prisma migrate resolve` (should never pass if resolve was used incorrectly)
 * - As part of deployment health checks
 *
 * Usage:
 *   node scripts/run-with-env.js .env.dev.migrate node scripts/db/check-migration-integrity.mjs
 *   node scripts/run-with-env.js .env.prod.migrate node scripts/db/check-migration-integrity.mjs
 *
 * Exit codes:
 *   0 - All migrations have integrity
 *   1 - Integrity violations found
 *   2 - Connection/query error
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Baseline migrations that were intentionally resolved during initial setup
// These are migrations where the DDL was already applied by a previous system
// and we used `prisma migrate resolve --applied` to baseline the history.
// Add new entries here ONLY during initial project setup, never during normal development.
const BASELINE_MIGRATIONS = [
  "20251230112400_init",
  "20251231162841_add_audit_event_log",
];

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Migration Integrity Gate");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const violations = [];

  try {
    // 1. Check for migrations with applied_steps_count = 0 but marked as applied
    // Exclude known baseline migrations
    const zeroStepsMigrations = await prisma.$queryRaw`
      SELECT migration_name, started_at, finished_at, applied_steps_count, rolled_back_at
      FROM "_prisma_migrations"
      WHERE applied_steps_count = 0
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL
      ORDER BY started_at DESC
    `;

    // Filter out baseline migrations
    const nonBaselineZeroSteps = zeroStepsMigrations.filter(
      (m) => !BASELINE_MIGRATIONS.includes(m.migration_name)
    );

    if (nonBaselineZeroSteps.length > 0) {
      violations.push({
        type: "ZERO_STEPS_APPLIED",
        message: "Migrations marked as applied but with applied_steps_count = 0",
        detail: "These migrations were likely marked via 'prisma migrate resolve --applied' without DDL execution",
        migrations: nonBaselineZeroSteps.map((m) => ({
          name: m.migration_name,
          finished_at: m.finished_at,
        })),
      });
    }

    // Log baseline migrations for visibility
    const baselineFound = zeroStepsMigrations.filter(
      (m) => BASELINE_MIGRATIONS.includes(m.migration_name)
    );
    if (baselineFound.length > 0) {
      console.log(`Baseline migrations (excluded from checks): ${baselineFound.length}`);
      baselineFound.forEach((m) => console.log(`  - ${m.migration_name}`));
      console.log("");
    }

    // 2. Check for stuck/failed migrations (started but not finished)
    const stuckMigrations = await prisma.$queryRaw`
      SELECT migration_name, started_at, finished_at, applied_steps_count, logs
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
      ORDER BY started_at DESC
    `;

    if (stuckMigrations.length > 0) {
      violations.push({
        type: "STUCK_MIGRATION",
        message: "Migrations started but never finished",
        detail: "These migrations may have failed mid-execution or timed out",
        migrations: stuckMigrations.map((m) => ({
          name: m.migration_name,
          started_at: m.started_at,
          logs: m.logs ? String(m.logs).substring(0, 200) : null,
        })),
      });
    }

    // 3. Check for rolled back migrations still in the table
    const rolledBackMigrations = await prisma.$queryRaw`
      SELECT migration_name, started_at, rolled_back_at, logs
      FROM "_prisma_migrations"
      WHERE rolled_back_at IS NOT NULL
      ORDER BY started_at DESC
    `;

    if (rolledBackMigrations.length > 0) {
      violations.push({
        type: "ROLLED_BACK_PRESENT",
        message: "Rolled back migrations still in migration history",
        detail: "These should be cleaned up or properly re-applied",
        migrations: rolledBackMigrations.map((m) => ({
          name: m.migration_name,
          rolled_back_at: m.rolled_back_at,
        })),
      });
    }

    // 4. Summary check - count total vs healthy migrations
    const totalCount = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM "_prisma_migrations"
    `;
    const healthyCount = await prisma.$queryRaw`
      SELECT COUNT(*) as healthy FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
        AND rolled_back_at IS NULL
        AND applied_steps_count > 0
    `;

    const total = Number(totalCount[0].total);
    const healthy = Number(healthyCount[0].healthy);

    console.log(`Migration Summary:`);
    console.log(`  Total records:   ${total}`);
    console.log(`  Healthy records: ${healthy}`);
    console.log(`  Violations:      ${total - healthy}\n`);

    // Report violations
    if (violations.length > 0) {
      console.log("❌ INTEGRITY VIOLATIONS DETECTED\n");

      for (const v of violations) {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Type: ${v.type}`);
        console.log(`Issue: ${v.message}`);
        console.log(`Detail: ${v.detail}`);
        console.log(`Affected migrations:`);
        for (const m of v.migrations) {
          console.log(`  - ${m.name}`);
          if (m.logs) console.log(`    Logs: ${m.logs}...`);
        }
        console.log("");
      }

      console.log("═══════════════════════════════════════════════════════════════");
      console.log("  RECOMMENDED ACTIONS:");
      console.log("═══════════════════════════════════════════════════════════════");
      console.log("");
      console.log("  1. NEVER use 'prisma migrate resolve --applied' to skip failed migrations");
      console.log("  2. Fix the underlying issue (permissions, schema drift, etc.)");
      console.log("  3. Delete corrupt migration records from _prisma_migrations");
      console.log("  4. Re-run 'prisma migrate deploy' with correct role");
      console.log("");
      console.log("  For detailed fix procedure, see:");
      console.log("  docs/runbooks/PRISMA_MIGRATION_WORKFLOW.md");
      console.log("");

      process.exit(1);
    }

    console.log("✓ All migrations have integrity\n");
    console.log("  - No zero-step migrations");
    console.log("  - No stuck migrations");
    console.log("  - No rolled-back records");
    console.log("");

  } catch (err) {
    console.error("❌ Error checking migration integrity:", err.message);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

main();
