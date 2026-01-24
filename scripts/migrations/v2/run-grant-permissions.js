#!/usr/bin/env node
/**
 * run-grant-permissions.js - Grant bhq_app runtime permissions
 *
 * Loads environment from .env.{env}.migrate and runs grant_bhq_app_permissions.sql.
 * Must be run by bhq_migrator (who owns the tables).
 *
 * Usage: node scripts/db/v2/run-grant-permissions.js [dev|prod]
 */

import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..", "..", "..");

// ─────────────────────────────────────────────────────────────────────────────
// Parse args
// ─────────────────────────────────────────────────────────────────────────────
const env = process.argv[2];

if (!env || !["dev", "prod"].includes(env)) {
  console.error("Usage: node scripts/db/v2/run-grant-permissions.js [dev|prod]");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Determine env file
// ─────────────────────────────────────────────────────────────────────────────
const envFile = `.env.${env}.migrate`;
const envPath = resolve(rootDir, envFile);

if (!existsSync(envPath)) {
  console.error(`\n❌ Environment file not found: ${envFile}`);
  console.error(`\nExpected path: ${envPath}`);
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
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const parsedEnv = parseEnvFile(envPath);
const directUrl = parsedEnv["DATABASE_DIRECT_URL"] || parsedEnv["DATABASE_URL"];

if (!directUrl) {
  console.error(`\n❌ DATABASE_DIRECT_URL not found in ${envFile}\n`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify using migrator role
// ─────────────────────────────────────────────────────────────────────────────
if (!directUrl.includes("bhq_migrator")) {
  console.error(`\n❌ Grant script must be run as bhq_migrator role`);
  console.error(`   Current URL appears to use a different role.`);
  console.error(`   Ensure ${envFile} uses bhq_migrator credentials.\n`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Run grant script
// ─────────────────────────────────────────────────────────────────────────────
const sqlFile = resolve(rootDir, "prisma", "sql", "grant_bhq_app_permissions.sql");

if (!existsSync(sqlFile)) {
  console.error(`\n❌ SQL file not found: ${sqlFile}\n`);
  process.exit(1);
}

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`Granting bhq_app permissions on ${env} database`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  Environment file: ${envFile}`);
console.log(`  SQL file: prisma/sql/grant_bhq_app_permissions.sql`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Pass DATABASE_URL as environment variable to avoid shell escaping issues
const childEnv = { ...process.env, DATABASE_URL: directUrl };

// Windows needs quotes around the env var reference to prevent & parsing
const urlRef = process.platform === "win32" ? '"%DATABASE_URL%"' : '"$DATABASE_URL"';

const psql = spawn("psql", [urlRef, "-f", sqlFile], {
  stdio: "inherit",
  shell: true,
  env: childEnv,
});

psql.on("exit", (code) => {
  if (code === 0) {
    console.log("\n✓ Permissions granted successfully");
    console.log("\nRuntime user bhq_app can now access all tables and sequences.\n");
  } else {
    console.error("\n❌ Failed to grant permissions\n");
  }
  process.exit(code || 0);
});

psql.on("error", (err) => {
  console.error("\n❌ Failed to run psql:", err.message);
  console.error("Make sure psql is installed and in your PATH.\n");
  process.exit(1);
});
