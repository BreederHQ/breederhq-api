#!/usr/bin/env node
/**
 * run-import.js - Cross-platform wrapper for v1 → v2 data import
 *
 * Loads environment from .env.v2.{env} and runs psql import with
 * FK constraint handling for Neon compatibility.
 *
 * Flow:
 *   0. Safety truncate _prisma_migrations (v2 has own migration history)
 *   1. Drop FK constraints (v2_pre_import_drop_fks.sql)
 *   2. Import data (v1_data.sql)
 *   3. Restore FK constraints (v2_post_import_restore_fks.sql)
 *
 * Usage: node scripts/db/v2/run-import.js [dev|prod]
 */

import { spawn } from "child_process";
import { readFileSync, existsSync, statSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..", "..", "..");

// ─────────────────────────────────────────────────────────────────────────────
// Parse arguments
// ─────────────────────────────────────────────────────────────────────────────
const env = process.argv[2];

if (!env || !["dev", "prod"].includes(env)) {
  console.error("Usage: node scripts/db/v2/run-import.js [dev|prod]");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Determine env file and required var
// ─────────────────────────────────────────────────────────────────────────────
const envFile = `.env.v2.${env}`;
const envPath = resolve(rootDir, envFile);

// ─────────────────────────────────────────────────────────────────────────────
// Check env file exists
// ─────────────────────────────────────────────────────────────────────────────
if (!existsSync(envPath)) {
  console.error(`\n❌ Environment file not found: ${envFile}`);
  console.error(`\nExpected path: ${envPath}`);
  console.error(`\nTo create this file:`);
  console.error(`  1. Copy ${envFile}.example to ${envFile}`);
  console.error(`  2. Fill in the DATABASE_DIRECT_URL value`);
  console.error(
    `\nSee docs/runbooks/DB_V1_TO_V2_DATA_MOVE_OPTION_B.md for details.\n`
  );
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse env file
// ─────────────────────────────────────────────────────────────────────────────
function parseEnvFile(filePath) {
  const env = {};
  const content = readFileSync(filePath, "utf-8");

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const fileEnv = parseEnvFile(envPath);

// ─────────────────────────────────────────────────────────────────────────────
// Get target URL (use DATABASE_DIRECT_URL from env file)
// ─────────────────────────────────────────────────────────────────────────────
const targetUrl =
  fileEnv["DATABASE_DIRECT_URL"] || process.env["DATABASE_DIRECT_URL"];

if (!targetUrl) {
  console.error(`\n❌ Required environment variable not set: DATABASE_DIRECT_URL`);
  console.error(`\nCheck your ${envFile} file.\n`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Check input files exist
// ─────────────────────────────────────────────────────────────────────────────
const inFile = resolve(rootDir, "tmp", "v1_data.sql");
const dropFksFile = resolve(rootDir, "prisma", "sql", "backfills", "v2_pre_import_drop_fks.sql");
const restoreFksFile = resolve(rootDir, "prisma", "sql", "backfills", "v2_post_import_restore_fks.sql");

if (!existsSync(inFile)) {
  console.error(`\n❌ Input file not found: ${inFile}`);
  console.error("\nRun the dump command first:");
  console.error(`  npm run db:v2:dump:v1:${env}:snapshot\n`);
  process.exit(1);
}

if (!existsSync(dropFksFile)) {
  console.error(`\n❌ FK drop script not found: ${dropFksFile}\n`);
  process.exit(1);
}

if (!existsSync(restoreFksFile)) {
  console.error(`\n❌ FK restore script not found: ${restoreFksFile}\n`);
  process.exit(1);
}

const fileSize = statSync(inFile).size;

// ─────────────────────────────────────────────────────────────────────────────
// Log status
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`run-import.js: Importing data to v2 ${env}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  Environment file: ${envFile}`);
console.log(`  DATABASE_DIRECT_URL: [SET - REDACTED]`);
console.log(`  Input file: ${inFile}`);
console.log(`  File size: ${fileSize} bytes`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// ─────────────────────────────────────────────────────────────────────────────
// Helper to run psql with a file
// ─────────────────────────────────────────────────────────────────────────────
function runPsql(sqlFile, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${description}...`);
    console.log(`  File: ${sqlFile}\n`);

    const child = spawn(
      "psql",
      [targetUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlFile],
      {
        stdio: "inherit",
        env: { ...process.env, ...fileEnv },
        cwd: rootDir,
      }
    );

    child.on("exit", (code) => {
      if (code === 0) {
        console.log(`\n✓ ${description} completed\n`);
        resolve();
      } else {
        reject(new Error(`${description} failed with exit code ${code}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start psql: ${err.message}`));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper to run inline SQL command
// ─────────────────────────────────────────────────────────────────────────────
function runPsqlCommand(sql, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${description}...`);

    const child = spawn(
      "psql",
      [targetUrl, "-v", "ON_ERROR_STOP=1", "-c", sql],
      {
        stdio: "inherit",
        env: { ...process.env, ...fileEnv },
        cwd: rootDir,
      }
    );

    child.on("exit", (code) => {
      if (code === 0) {
        console.log(`✓ ${description} completed\n`);
        resolve();
      } else {
        reject(new Error(`${description} failed with exit code ${code}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start psql: ${err.message}`));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main import flow
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  try {
    // Step 0 (safety): Truncate _prisma_migrations if exists
    // This is a safety net in case someone runs an old dump that still
    // contains _prisma_migrations data. v2 has its own migration history.
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 0/4: Safety truncate _prisma_migrations (if exists)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await runPsqlCommand(
      `TRUNCATE TABLE IF EXISTS "_prisma_migrations" CASCADE;`,
      "Truncate _prisma_migrations"
    );

    // Step 1: Drop FK constraints
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 1/4: Drop FK constraints");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await runPsql(dropFksFile, "Drop FK constraints");

    // Step 2: Import data
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 2/4: Import v1 data");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await runPsql(inFile, "Import v1 data");

    // Step 3: Restore FK constraints
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 3/4: Restore FK constraints");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await runPsql(restoreFksFile, "Restore FK constraints");

    // Success
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✓ Import completed successfully");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    process.exit(0);

  } catch (err) {
    console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error(`❌ ${err.message}`);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("\nCheck the error above for details.");
    console.error("Common issues:");
    console.error("  - Data violates FK constraints");
    console.error("  - Enum value mismatches");
    console.error("  - Missing tables");
    console.error("\nNote: If FK drop succeeded but import failed, FKs are NOT");
    console.error("restored. You may need to restore manually or reset the DB.\n");
    process.exit(1);
  }
}

main();
