#!/usr/bin/env node
/**
 * validate-schema-drift.js - Validates that database schema matches schema.prisma
 *
 * Uses `prisma migrate diff` to detect schema drift. Exits non-zero if drift
 * is detected, EXCEPT for the known no-op case where the only diff is:
 *
 *   CREATE SCHEMA IF NOT EXISTS "public";
 *
 * This happens because Prisma always emits this statement even when the public
 * schema already exists. It's a harmless no-op that can be safely ignored.
 *
 * Exit codes:
 *   0 - Schema is in sync (or only CREATE SCHEMA no-op)
 *   1 - Schema drift detected (real differences)
 *   2 - Error running validation
 *
 * Usage:
 *   DATABASE_URL="..." node scripts/db/v2/validate-schema-drift.js
 *   npm run db:v2:validate:dev:schema
 *   npm run db:v2:validate:prod:schema
 */

import { spawn } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..", "..", "..");

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

// Known no-op patterns that can be safely ignored.
// These are SQL statements that Prisma emits but have no effect.
const ALLOWED_NOOP_PATTERNS = [
  // Prisma always emits CREATE SCHEMA even if it exists (IF NOT EXISTS makes it no-op)
  /^\s*CREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+"public"\s*;\s*$/i,
  // Also allow just whitespace/empty lines
  /^\s*$/,
  // Allow SQL comments
  /^\s*--.*$/,
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function runPrismaDiff() {
  return new Promise((resolve, reject) => {
    const args = [
      "prisma",
      "migrate",
      "diff",
      "--from-schema-datasource",
      "prisma/schema.prisma",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
    ];

    const child = spawn("npx", args, {
      cwd: rootDir,
      shell: true,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("exit", (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Checks if the diff output contains only allowed no-op statements.
 * Returns { isNoopOnly: boolean, offendingLines: string[] }
 */
function analyzeOutput(output) {
  const lines = output.split("\n");
  const offendingLines = [];

  for (const line of lines) {
    // Check if this line matches any allowed pattern
    const isAllowed = ALLOWED_NOOP_PATTERNS.some((pattern) =>
      pattern.test(line)
    );

    if (!isAllowed) {
      offendingLines.push(line);
    }
  }

  return {
    isNoopOnly: offendingLines.length === 0,
    offendingLines,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Schema Drift Validation");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(2);
  }

  console.log("Running prisma migrate diff...\n");

  let result;
  try {
    result = await runPrismaDiff();
  } catch (err) {
    console.error("ERROR: Failed to run prisma migrate diff:", err.message);
    process.exit(2);
  }

  // prisma migrate diff exit codes:
  // 0 = no differences
  // 2 = differences found (when using --exit-code, but we're not using it)
  // We capture output instead of using --exit-code for better control

  const output = result.stdout.trim();

  if (!output) {
    // No output means no differences
    console.log("✓ Schema is in sync with database\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("RESULT: PASS - No schema drift detected");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    process.exit(0);
  }

  // Analyze the output
  const { isNoopOnly, offendingLines } = analyzeOutput(output);

  if (isNoopOnly) {
    // Only no-op statements found - this is acceptable
    console.log("Diff output (no-op only):");
    console.log("─────────────────────────────────────────");
    console.log(output);
    console.log("─────────────────────────────────────────\n");
    console.log(
      "✓ Only CREATE SCHEMA IF NOT EXISTS \"public\" detected (no-op)\n"
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("RESULT: PASS - Schema drift is acceptable no-op");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    process.exit(0);
  }

  // Real schema drift detected
  console.log("Diff output:");
  console.log("─────────────────────────────────────────");
  console.log(output);
  console.log("─────────────────────────────────────────\n");

  console.log("✗ Schema drift detected!\n");
  console.log("Offending statements:");
  for (const line of offendingLines) {
    if (line.trim()) {
      console.log(`  ${line}`);
    }
  }
  console.log("");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("RESULT: FAIL - Schema drift detected");
  console.log("");
  console.log("Action required:");
  console.log("  1. Review the diff output above");
  console.log("  2. If database needs to match schema, run:");
  console.log("     npm run db:v2:dev:migrate (for dev)");
  console.log("     npm run db:v2:prod:deploy (for prod)");
  console.log("  3. If schema needs to match database, update schema.prisma");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(2);
});
