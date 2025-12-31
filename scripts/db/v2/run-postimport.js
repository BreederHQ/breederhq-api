#!/usr/bin/env node
/**
 * run-postimport.js - Cross-platform wrapper for running post-import fixes
 *
 * Loads environment from .env.{env}.migrate and runs v2_post_import_fix.sql.
 *
 * Usage: node scripts/db/v2/run-postimport.js [dev|prod]
 */

import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  probeDbIdent,
  printDbIdent,
  checkRequiredTables,
} from "./db-ident.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..", "..", "..");

// ─────────────────────────────────────────────────────────────────────────────
// Parse arguments
// ─────────────────────────────────────────────────────────────────────────────
const env = process.argv[2];

if (!env || !["dev", "prod"].includes(env)) {
  console.error("Usage: node scripts/db/v2/run-postimport.js [dev|prod]");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Determine env file
// ─────────────────────────────────────────────────────────────────────────────
const envFile = `.env.${env}.migrate`;
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
// Get target URL
// ─────────────────────────────────────────────────────────────────────────────
const targetUrl =
  fileEnv["DATABASE_DIRECT_URL"] || process.env["DATABASE_DIRECT_URL"];

if (!targetUrl) {
  console.error(
    `\n❌ Required environment variable not set: DATABASE_DIRECT_URL`
  );
  console.error(`\nCheck your ${envFile} file.\n`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Check SQL file exists
// ─────────────────────────────────────────────────────────────────────────────
const sqlFile = resolve(
  rootDir,
  "prisma",
  "sql",
  "backfills",
  "v2_post_import_fix.sql"
);

if (!existsSync(sqlFile)) {
  console.error(`\n❌ SQL file not found: ${sqlFile}`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Log status
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`run-postimport.js: Running post-import fixes on v2 ${env}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  Environment file: ${envFile}`);
console.log(`  DATABASE_DIRECT_URL: [SET - REDACTED]`);
console.log(`  SQL file: ${sqlFile}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// ─────────────────────────────────────────────────────────────────────────────
// Required v2 tables that MUST exist before running post-import fixes
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_V2_TABLES = ["Tenant", "Party", "Animal", "WaitlistEntry"];

// ─────────────────────────────────────────────────────────────────────────────
// Run psql with the SQL file
// ─────────────────────────────────────────────────────────────────────────────
function runPsql() {
  return new Promise((resolve, reject) => {
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
        resolve();
      } else {
        reject(new Error(`psql exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start psql: ${err.message}`));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  try {
    // Probe database identity for debugging
    const ident = await probeDbIdent(targetUrl, fileEnv, rootDir);
    printDbIdent("Postimport", ident);

    // Check that v2 schema is present
    console.log("Checking v2 schema presence...");
    const { present, missing } = await checkRequiredTables(
      targetUrl,
      fileEnv,
      rootDir,
      REQUIRED_V2_TABLES
    );

    if (missing.length > 0) {
      console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("❌ [ERR_V2_SCHEMA_MISSING]");
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error(`\nMissing required v2 tables: ${missing.join(", ")}`);
      console.error(`Present tables: ${present.length > 0 ? present.join(", ") : "(none)"}`);
      console.error(`Total tables in public schema: ${ident.tableCount}`);
      console.error("\nThe v2 init migration is not applied to this target,");
      console.error("or the env file points to the wrong database.");
      console.error("\nTo fix:");
      console.error(`  1. Verify .env.${env}.migrate points to the correct v2 database`);
      console.error(`  2. Run: npm run db:${env}:migrate (to apply v2 schema)`);
      console.error("  3. Then retry the migration\n");
      process.exit(1);
    }

    console.log(`  ✓ All required tables present: ${present.join(", ")}\n`);

    // Run post-import fixes
    console.log("Running post-import fixes...\n");
    await runPsql();

    console.log("\n✓ Post-import fixes completed successfully");
    console.log("\nNext steps:");
    console.log(`  1. npm run db:${env}:validate`);
    console.log(`  2. npm run db:${env}:status\n`);
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Post-import fixes failed:", err.message);
    console.error("Make sure psql is installed and in your PATH.\n");
    process.exit(1);
  }
}

main();
