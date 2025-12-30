#!/usr/bin/env node
/**
 * prod-move-runbook.js - One-command wrapper for v1 prod snapshot → v2 prod migration
 *
 * Runs preflight checks, then executes the full migration sequence:
 *   1. Dump data from v1 prod snapshot
 *   2. Import data to v2 prod
 *   3. Run post-import fixes
 *   4. Validate data integrity
 *
 * Usage: node scripts/db/v2/prod-move-runbook.js
 *        npm run db:v2:prod:move
 */

import { spawn } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..", "..", "..");

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATION_STEPS = [
  {
    name: "Dump v1 prod snapshot data",
    script: "db:v2:dump:v1:prod:snapshot",
  },
  {
    name: "Import data to v2 prod",
    script: "db:v2:import:prod:data",
  },
  {
    name: "Run post-import fixes",
    script: "db:v2:postimport:prod",
  },
  {
    name: "Validate data integrity",
    script: "db:v2:validate:prod",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      cwd: rootDir,
      shell: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

function runCommandWithOutput(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["inherit", "pipe", "pipe"],
      cwd: rootDir,
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on("exit", (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

function printSetupInstructions() {
  console.log("\n┌──────────────────────────────────────────────────────────────┐");
  console.log("│  SETUP REQUIRED                                              │");
  console.log("└──────────────────────────────────────────────────────────────┘\n");

  console.log("To complete the v1 prod → v2 prod migration, follow these steps:\n");

  console.log("1. CREATE THE ENVIRONMENT FILE\n");
  console.log("   cp .env.v1.prod.snapshot.example .env.v1.prod.snapshot\n");

  console.log("2. GET THE V1 PROD SNAPSHOT DIRECT URL\n");
  console.log("   a) Go to Neon Console: https://console.neon.tech");
  console.log("   b) Select your v1 prod project");
  console.log("   c) Go to Branches → Create Branch (or use existing snapshot)");
  console.log("   d) Name it something like 'v1-prod-snapshot-YYYYMMDD'");
  console.log("   e) Go to the branch's Connection Details");
  console.log("   f) Copy the DIRECT connection string (NOT the pooled one)");
  console.log("      - Direct URLs use port 5432");
  console.log("      - Pooled URLs contain 'pooler' or use port 6543\n");

  console.log("3. SET THE ENVIRONMENT VARIABLE\n");
  console.log("   Edit .env.v1.prod.snapshot and set:\n");
  console.log("   V1_PROD_SNAPSHOT_DIRECT_URL=postgresql://...\n");

  console.log("4. RUN THE MIGRATION\n");
  console.log("   npm run db:v2:prod:move\n");

  console.log("─────────────────────────────────────────────────────────────────");
  console.log("See: docs/runbooks/DB_V1_TO_V2_DATA_MOVE_OPTION_B.md");
  console.log("─────────────────────────────────────────────────────────────────\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("v1 Prod Snapshot → v2 Prod: One-Command Migration");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ───────────────────────────────────────────────────────────────────────────
  // Step 1: Run preflight checks
  // ───────────────────────────────────────────────────────────────────────────
  console.log("Phase 1: Preflight Checks");
  console.log("─────────────────────────────────────────────────────────────────\n");

  const preflight = await runCommandWithOutput("npm", [
    "run",
    "db:v2:preflight:prod:move",
  ]);

  if (preflight.code !== 0) {
    const output = preflight.stdout + preflight.stderr;

    // Check for specific error tokens
    if (
      output.includes("ERR_MISSING_V1_SNAPSHOT_ENV_FILE") ||
      output.includes("ERR_MISSING_V1_SNAPSHOT_URL")
    ) {
      printSetupInstructions();
      process.exit(1);
    }

    // Generic preflight failure
    console.log("\n❌ Preflight checks failed. Fix the issues above and retry.\n");
    process.exit(1);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Step 2: Show migration plan
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────────────────────────");
  console.log("Phase 2: Migration Execution");
  console.log("─────────────────────────────────────────────────────────────────\n");

  console.log("The following steps will be executed:\n");
  for (let i = 0; i < MIGRATION_STEPS.length; i++) {
    const step = MIGRATION_STEPS[i];
    console.log(`  ${i + 1}. ${step.name}`);
    console.log(`     npm run ${step.script}\n`);
  }

  console.log("Starting migration...\n");

  // ───────────────────────────────────────────────────────────────────────────
  // Step 3: Execute migration steps
  // ───────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < MIGRATION_STEPS.length; i++) {
    const step = MIGRATION_STEPS[i];

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Step ${i + 1}/${MIGRATION_STEPS.length}: ${step.name}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    try {
      await runCommand("npm", ["run", step.script]);
      console.log(`\n✓ Step ${i + 1} completed: ${step.name}\n`);
    } catch (err) {
      console.log(`\n❌ Step ${i + 1} FAILED: ${step.name}`);
      console.log(`   Command: npm run ${step.script}`);
      console.log(`\nMigration stopped. Fix the error above and retry.\n`);
      console.log("To resume from this step, run the commands manually:");
      for (let j = i; j < MIGRATION_STEPS.length; j++) {
        console.log(`  npm run ${MIGRATION_STEPS[j].script}`);
      }
      console.log("");
      process.exit(1);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Success
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✓ MIGRATION COMPLETED SUCCESSFULLY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("Summary:");
  console.log("  ✓ Data dumped from v1 prod snapshot");
  console.log("  ✓ Data imported to v2 prod");
  console.log("  ✓ Post-import fixes applied");
  console.log("  ✓ Data integrity validated\n");

  console.log("Next steps:");
  console.log("  1. Verify v2 prod schema status: npm run db:v2:prod:status");
  console.log("  2. Update your application to use v2 prod database");
  console.log("  3. Monitor application for any issues\n");
}

main().catch((err) => {
  console.error("\n❌ Unexpected error:", err.message);
  process.exit(1);
});
