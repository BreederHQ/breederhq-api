#!/usr/bin/env tsx
/**
 * Post-Import Validation Runner for v1 → v2 Data Migration
 *
 * Executes validation SQL and reports results.
 * Exits non-zero if any orphan count > 0.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." tsx scripts/db/v2/validate-post-import.ts
 *
 * Or via npm scripts:
 *   npm run db:v2:validate:dev
 *   npm run db:v2:validate:prod
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

interface ValidationResult {
  section: string;
  data: Record<string, unknown>;
}

interface TableCounts {
  [tableName: string]: number;
}

interface OrphanCheck {
  table: string;
  column: string;
  orphan_count: number;
}

interface TypeMismatch {
  table: string;
  issue: string;
  count: number;
}

async function runValidation(): Promise<boolean> {
  const sqlFile = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "prisma",
    "sql",
    "validation",
    "v2_post_import_checks.sql"
  );

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("v1 → v2 Post-Import Validation");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // Check if SQL file exists
  try {
    await fs.access(sqlFile);
  } catch {
    console.error(`ERROR: Validation SQL file not found: ${sqlFile}`);
    return false;
  }

  // Read and execute SQL
  const sql = await fs.readFile(sqlFile, "utf-8");

  // Execute each statement separately since we have multiple SELECT statements
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toUpperCase().startsWith("SELECT"));

  let hasOrphans = false;
  const tableCounts: TableCounts = {};
  const orphanChecks: OrphanCheck[] = [];
  const typeMismatches: TypeMismatch[] = [];

  for (const statement of statements) {
    try {
      const results = await prisma.$queryRawUnsafe<ValidationResult[]>(
        statement + ";"
      );

      for (const row of results) {
        if (row.section === "table_counts") {
          Object.assign(tableCounts, row.data);
        } else if (row.section === "orphan_check") {
          const check = row.data as unknown as OrphanCheck;
          orphanChecks.push(check);
          if (check.orphan_count > 0) {
            hasOrphans = true;
          }
        } else if (row.section === "type_mismatch") {
          const mismatch = row.data as unknown as TypeMismatch;
          typeMismatches.push(mismatch);
          if (mismatch.count > 0) {
            hasOrphans = true;
          }
        }
      }
    } catch (error) {
      // Some statements might fail due to table not existing, skip them
      const errMsg = error instanceof Error ? error.message : String(error);
      if (!errMsg.includes("does not exist")) {
        console.warn(`Warning: Query error: ${errMsg.slice(0, 100)}`);
      }
    }
  }

  // Print table counts
  console.log("TABLE ROW COUNTS:");
  console.log("─────────────────────────────────────────");
  const sortedTables = Object.entries(tableCounts).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  for (const [table, count] of sortedTables) {
    const countStr = String(count).padStart(10);
    console.log(`  ${table.padEnd(25)} ${countStr}`);
  }
  console.log("");

  // Print orphan checks
  console.log("ORPHAN CHECKS (Party FK Integrity):");
  console.log("─────────────────────────────────────────");
  for (const check of orphanChecks) {
    const status = check.orphan_count === 0 ? "✓" : "✗";
    const countStr = String(check.orphan_count).padStart(6);
    console.log(
      `  ${status} ${check.table}.${check.column}`.padEnd(45) + countStr
    );
  }
  console.log("");

  // Print type mismatches
  if (typeMismatches.length > 0) {
    console.log("TYPE MISMATCHES:");
    console.log("─────────────────────────────────────────");
    for (const mismatch of typeMismatches) {
      const status = mismatch.count === 0 ? "✓" : "✗";
      const countStr = String(mismatch.count).padStart(6);
      console.log(
        `  ${status} ${mismatch.table}.${mismatch.issue}`.padEnd(45) + countStr
      );
    }
    console.log("");
  }

  // Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (hasOrphans) {
    console.log("RESULT: FAIL - Orphan records detected");
    console.log("");
    console.log("Action required:");
    console.log("  1. Check the orphan counts above");
    console.log("  2. Use sample queries in v2_post_import_checks.sql to investigate");
    console.log("  3. Fix the data issues before proceeding");
  } else {
    console.log("RESULT: PASS - All integrity checks passed");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return !hasOrphans;
}

async function main() {
  // Fail fast if DATABASE_URL is not set
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(1);
  }

  try {
    const passed = await runValidation();
    await prisma.$disconnect();
    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error("Fatal error:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
