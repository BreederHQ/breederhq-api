#!/usr/bin/env node
/**
 * run-postimport.js - Cross-platform wrapper for running post-import fixes
 *
 * Loads environment from .env.v2.{env} and runs v2_post_import_fix.sql.
 *
 * Usage: node scripts/db/v2/run-postimport.js [dev|prod]
 */

import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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
// Run psql with the SQL file
// ─────────────────────────────────────────────────────────────────────────────
console.log("Running post-import fixes...\n");

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
    console.log("\n✓ Post-import fixes completed successfully");
    console.log("\nNext steps:");
    console.log(`  1. npm run db:v2:validate:${env}`);
    console.log(`  2. npm run db:v2:${env}:status\n`);
  } else {
    console.error("\n❌ Post-import fixes failed with exit code:", code);
  }
  process.exit(code || 0);
});

child.on("error", (err) => {
  console.error(`\n❌ Failed to start psql: ${err.message}`);
  console.error("Make sure psql is installed and in your PATH.\n");
  process.exit(1);
});
