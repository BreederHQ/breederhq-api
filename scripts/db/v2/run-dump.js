#!/usr/bin/env node
/**
 * run-dump.js - Cross-platform wrapper for dump-v1-data.sh
 *
 * Loads environment from .env.v1.{env}.snapshot and runs pg_dump.
 *
 * Usage: node scripts/db/v2/run-dump.js [dev|prod]
 */

import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { probeDbIdent, printDbIdent } from "./db-ident.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..", "..", "..");

// ─────────────────────────────────────────────────────────────────────────────
// Parse arguments
// ─────────────────────────────────────────────────────────────────────────────
const env = process.argv[2];

if (!env || !["dev", "prod"].includes(env)) {
  console.error("Usage: node scripts/db/v2/run-dump.js [dev|prod]");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Determine env file and required var
// ─────────────────────────────────────────────────────────────────────────────
const envFile = `.env.v1.${env}.snapshot`;
const envPath = resolve(rootDir, envFile);
const requiredVar =
  env === "dev" ? "V1_DEV_SNAPSHOT_DIRECT_URL" : "V1_PROD_SNAPSHOT_DIRECT_URL";

// ─────────────────────────────────────────────────────────────────────────────
// Check env file exists
// ─────────────────────────────────────────────────────────────────────────────
if (!existsSync(envPath)) {
  console.error(`\n❌ Environment file not found: ${envFile}`);
  console.error(`\nExpected path: ${envPath}`);
  console.error(`\nTo create this file:`);
  console.error(`  1. Copy ${envFile}.example to ${envFile}`);
  console.error(`  2. Fill in the ${requiredVar} value`);
  console.error(
    `\nSee docs/runbooks/DB_V1_TO_V2_DATA_MOVE_OPTION_B.md for details.\n`
  );
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse env file
// ─────────────────────────────────────────────────────────────────────────────
function parseEnvFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const env = {};

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
// Check required var
// ─────────────────────────────────────────────────────────────────────────────
const sourceUrl = fileEnv[requiredVar] || process.env[requiredVar];

if (!sourceUrl) {
  console.error(`\n❌ Required environment variable not set: ${requiredVar}`);
  console.error(`\nCheck your ${envFile} file.\n`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Set up environment for pg_dump
// ─────────────────────────────────────────────────────────────────────────────
const mergedEnv = {
  ...process.env,
  ...fileEnv,
  SOURCE_URL: sourceUrl,
};

// ─────────────────────────────────────────────────────────────────────────────
// Log status
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`run-dump.js: Dumping v1 ${env} snapshot data`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  Environment file: ${envFile}`);
console.log(`  ${requiredVar}: [SET - REDACTED]`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// ─────────────────────────────────────────────────────────────────────────────
// Run pg_dump directly (cross-platform)
// ─────────────────────────────────────────────────────────────────────────────
const outFile = resolve(rootDir, "tmp", "v1_data.sql");
const outDir = resolve(rootDir, "tmp");

// Ensure tmp directory exists
import { mkdirSync } from "fs";
try {
  mkdirSync(outDir, { recursive: true });
} catch (e) {
  // ignore if already exists
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function with identity verification
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  // Probe and print database identity before dump
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Pre-flight: Database Identity Verification");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    const ident = await probeDbIdent(sourceUrl, mergedEnv, rootDir);
    printDbIdent(`Source (v1 ${env})`, ident);
    console.log("✓ Source database identity verified\n");
  } catch (err) {
    console.error(`⚠ Warning: Could not verify source identity: ${err.message}`);
    console.error("  Proceeding with dump anyway.\n");
  }

  console.log("Starting pg_dump (data-only)...");
  console.log(`Output file: ${outFile}\n`);

  // Note: We do NOT use --disable-triggers because Neon (managed Postgres)
  // blocks DISABLE TRIGGER ALL for non-superusers. Instead, we drop FK
  // constraints before import and restore them after.
  //
  // We exclude _prisma_migrations because v2 has its own migration history.
  // Including v1's migrations would cause duplicate key violations.
  const child = spawn(
    "pg_dump",
    [
      "--data-only",
      "--no-owner",
      "--no-acl",
      "--exclude-table=_prisma_migrations",
      "--exclude-table=_prisma_migrations_lock",
      "--dbname",
      sourceUrl,
      "--file",
      outFile,
    ],
    {
      stdio: "inherit",
      env: mergedEnv,
      cwd: rootDir,
    }
  );

  child.on("exit", (code) => {
    if (code === 0) {
      console.log("\n✓ pg_dump completed successfully");
      console.log(`  Output: ${outFile}\n`);
    }
    process.exit(code || 0);
  });

  child.on("error", (err) => {
    console.error(`\n❌ Failed to start pg_dump: ${err.message}`);
    console.error("Make sure pg_dump is installed and in your PATH.\n");
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(`\n❌ Unexpected error: ${err.message}\n`);
  process.exit(1);
});
