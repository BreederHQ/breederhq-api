#!/usr/bin/env node
/**
 * prepare-shadow.js - Prepare shadow database with required extensions
 *
 * Creates the citext extension in the shadow database before running
 * `prisma migrate dev`. This is needed because Neon managed databases
 * don't allow Prisma to auto-install extensions in shadow databases.
 *
 * Usage: node scripts/db/v2/prepare-shadow.js [dev]
 *        npm run db:v2:shadow:prepare:dev
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
const env = process.argv[2] || "dev";

if (!["dev"].includes(env)) {
  console.error("Usage: node scripts/db/v2/prepare-shadow.js [dev]");
  console.error("Note: Shadow databases are only used for dev migrations.");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse env file
// ─────────────────────────────────────────────────────────────────────────────
function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8");
  const envVars = {};

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

    envVars[key] = value;
  }

  return envVars;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get shadow database URL
// ─────────────────────────────────────────────────────────────────────────────
const envFile = `.env.v2.${env}`;
const envPath = resolve(rootDir, envFile);

if (!existsSync(envPath)) {
  console.error(`\n❌ Environment file not found: ${envFile}`);
  console.error(`\nTo create this file:`);
  console.error(`  cp ${envFile}.example ${envFile}`);
  process.exit(1);
}

const fileEnv = parseEnvFile(envPath);
const shadowUrl = fileEnv["SHADOW_DATABASE_URL"] || process.env["SHADOW_DATABASE_URL"];

if (!shadowUrl) {
  console.error(`\n❌ SHADOW_DATABASE_URL not set in ${envFile}`);
  console.error(`\nTo fix:`);
  console.error(`  1. Create a shadow branch in Neon for your v2 project`);
  console.error(`  2. Add SHADOW_DATABASE_URL to ${envFile}`);
  console.error(`  3. Run this command again`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Create citext extension
// ─────────────────────────────────────────────────────────────────────────────
const sql = `CREATE EXTENSION IF NOT EXISTS citext;`;

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`prepare-shadow.js: Preparing shadow database for v2 ${env}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  Environment file: ${envFile}`);
console.log(`  SHADOW_DATABASE_URL: [SET - REDACTED]`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

console.log("Creating citext extension in shadow database...\n");

const child = spawn("psql", [shadowUrl, "-c", sql], {
  stdio: "inherit",
  env: { ...process.env, ...fileEnv },
  cwd: rootDir,
});

child.on("exit", (code) => {
  if (code === 0) {
    console.log("\n✓ Shadow database prepared successfully");
    console.log("\nYou can now run:");
    console.log(`  npm run db:v2:${env}:migrate\n`);
    process.exit(0);
  } else {
    console.error(`\n❌ Failed to prepare shadow database (exit code ${code})`);
    process.exit(1);
  }
});

child.on("error", (err) => {
  console.error(`\n❌ Failed to run psql: ${err.message}`);
  console.error("Make sure psql is installed and in your PATH.\n");
  process.exit(1);
});
