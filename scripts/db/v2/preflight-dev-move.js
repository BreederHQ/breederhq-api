#!/usr/bin/env node
/**
 * preflight-dev-move.js - Preflight checks for v1 dev → v2 dev data migration
 *
 * Verifies all preconditions are met before running the data migration:
 * - On git branch 'dev'
 * - Working tree is clean
 * - .env.v1.dev.snapshot file exists
 * - V1_DEV_SNAPSHOT_DIRECT_URL is set
 * - .env.v2.dev file exists
 * - DATABASE_DIRECT_URL (v2 dev) is set
 *
 * Usage: node scripts/db/v2/preflight-dev-move.js
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..", "..", "..");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return null;
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

function check(name, passed, message) {
  if (passed) {
    console.log(`  ✓ ${name}`);
    return true;
  } else {
    console.log(`  ✗ ${name}`);
    console.log(`    → ${message}`);
    return false;
  }
}

/**
 * Validates a database URL is a direct connection (not pooled).
 * Returns { valid: boolean, reason: string }
 */
function validateDirectUrl(url, varName) {
  if (!url || url.length === 0) {
    return { valid: false, reason: `${varName} is empty` };
  }

  // Must start with postgres:// or postgresql://
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    return { valid: false, reason: `${varName} must start with postgres:// or postgresql://` };
  }

  // Reject known pooler patterns (Neon pooler, pgbouncer)
  const poolerPatterns = [
    "pooler",
    "pgbouncer",
    ":6543",  // Neon pooler port
    "pgbouncer=true",
  ];

  for (const pattern of poolerPatterns) {
    if (url.toLowerCase().includes(pattern.toLowerCase())) {
      return {
        valid: false,
        reason: `${varName} appears to be a pooler URL (contains '${pattern}'). Use direct connection URL instead.`
      };
    }
  }

  return { valid: true, reason: "" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Run preflight checks
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("Preflight: v1 Dev Snapshot → v2 Dev Data Migration");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

let allPassed = true;

// ─────────────────────────────────────────────────────────────────────────────
// Check 1: Git branch is 'dev'
// ─────────────────────────────────────────────────────────────────────────────
console.log("Git checks:");
let currentBranch = "";
try {
  currentBranch = execSync("git branch --show-current", {
    cwd: rootDir,
    encoding: "utf-8",
  }).trim();
} catch (e) {
  currentBranch = "unknown";
}

allPassed =
  check(
    "On branch 'dev'",
    currentBranch === "dev",
    `Current branch is '${currentBranch}'. Switch to 'dev' first.`
  ) && allPassed;

// ─────────────────────────────────────────────────────────────────────────────
// Check 2: Working tree is clean
// ─────────────────────────────────────────────────────────────────────────────
let isClean = false;
try {
  const status = execSync("git status --porcelain", {
    cwd: rootDir,
    encoding: "utf-8",
  }).trim();
  isClean = status === "";
} catch (e) {
  isClean = false;
}

allPassed =
  check(
    "Working tree clean",
    isClean,
    "Uncommitted changes detected. Commit or stash first."
  ) && allPassed;

// ─────────────────────────────────────────────────────────────────────────────
// Check 3: v1 snapshot env file exists
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nv1 Snapshot configuration:");
const v1EnvFile = ".env.v1.dev.snapshot";
const v1EnvPath = resolve(rootDir, v1EnvFile);
const v1EnvExists = existsSync(v1EnvPath);

allPassed =
  check(
    `File exists: ${v1EnvFile}`,
    v1EnvExists,
    `Create from template: cp ${v1EnvFile}.example ${v1EnvFile}`
  ) && allPassed;

// ─────────────────────────────────────────────────────────────────────────────
// Check 4: V1_DEV_SNAPSHOT_DIRECT_URL is set
// ─────────────────────────────────────────────────────────────────────────────
const v1Env = parseEnvFile(v1EnvPath);
const v1Url = v1Env ? v1Env["V1_DEV_SNAPSHOT_DIRECT_URL"] : null;
const v1UrlSet = v1Url && v1Url.length > 0;

allPassed =
  check(
    "V1_DEV_SNAPSHOT_DIRECT_URL is set",
    v1UrlSet,
    `Edit ${v1EnvFile} and set V1_DEV_SNAPSHOT_DIRECT_URL`
  ) && allPassed;

// ─────────────────────────────────────────────────────────────────────────────
// Check 4b: V1_DEV_SNAPSHOT_DIRECT_URL is a valid direct URL
// ─────────────────────────────────────────────────────────────────────────────
if (v1UrlSet) {
  const v1UrlValidation = validateDirectUrl(v1Url, "V1_DEV_SNAPSHOT_DIRECT_URL");
  allPassed =
    check(
      "V1_DEV_SNAPSHOT_DIRECT_URL is direct (not pooler)",
      v1UrlValidation.valid,
      v1UrlValidation.reason
    ) && allPassed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 5: v2 dev env file exists
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nv2 Dev configuration:");
const v2EnvFile = ".env.v2.dev";
const v2EnvPath = resolve(rootDir, v2EnvFile);
const v2EnvExists = existsSync(v2EnvPath);

allPassed =
  check(
    `File exists: ${v2EnvFile}`,
    v2EnvExists,
    `Create from template: cp ${v2EnvFile}.example ${v2EnvFile}`
  ) && allPassed;

// ─────────────────────────────────────────────────────────────────────────────
// Check 6: DATABASE_DIRECT_URL (v2 dev) is set
// ─────────────────────────────────────────────────────────────────────────────
const v2Env = parseEnvFile(v2EnvPath);
const v2DirectUrl = v2Env ? v2Env["DATABASE_DIRECT_URL"] : null;
const v2UrlSet = v2DirectUrl && v2DirectUrl.length > 0;

allPassed =
  check(
    "DATABASE_DIRECT_URL (v2 dev) is set",
    v2UrlSet,
    `Edit ${v2EnvFile} and set DATABASE_DIRECT_URL`
  ) && allPassed;

// ─────────────────────────────────────────────────────────────────────────────
// Check 6b: DATABASE_DIRECT_URL (v2 dev) is a valid direct URL
// ─────────────────────────────────────────────────────────────────────────────
if (v2UrlSet) {
  const v2UrlValidation = validateDirectUrl(v2DirectUrl, "DATABASE_DIRECT_URL");
  allPassed =
    check(
      "DATABASE_DIRECT_URL (v2 dev) is direct (not pooler)",
      v2UrlValidation.valid,
      v2UrlValidation.reason
    ) && allPassed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 7: pg_dump available
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nTools:");
let pgDumpAvailable = false;
try {
  execSync("pg_dump --version", { encoding: "utf-8", stdio: "pipe" });
  pgDumpAvailable = true;
} catch (e) {
  pgDumpAvailable = false;
}

allPassed =
  check(
    "pg_dump available",
    pgDumpAvailable,
    "Install PostgreSQL client tools (pg_dump, psql)"
  ) && allPassed;

// ─────────────────────────────────────────────────────────────────────────────
// Check 8: psql available
// ─────────────────────────────────────────────────────────────────────────────
let psqlAvailable = false;
try {
  execSync("psql --version", { encoding: "utf-8", stdio: "pipe" });
  psqlAvailable = true;
} catch (e) {
  psqlAvailable = false;
}

allPassed =
  check(
    "psql available",
    psqlAvailable,
    "Install PostgreSQL client tools (pg_dump, psql)"
  ) && allPassed;

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

if (allPassed) {
  console.log("✓ All preflight checks PASSED");
  console.log("\nReady to run:");
  console.log("  npm run db:v2:dump:v1:dev:snapshot");
  console.log("  npm run db:v2:import:dev:data");
  console.log("  npm run db:v2:postimport:dev");
  console.log("  npm run db:v2:validate:dev");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(0);
} else {
  console.log("✗ Preflight checks FAILED");
  console.log("\nFix the issues above before proceeding.");
  console.log("\nQuick setup commands:");
  console.log("  cp .env.v1.dev.snapshot.example .env.v1.dev.snapshot");
  console.log("  # Edit .env.v1.dev.snapshot and set V1_DEV_SNAPSHOT_DIRECT_URL");
  console.log("\nSee: docs/runbooks/DB_V1_TO_V2_DATA_MOVE_OPTION_B.md");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(1);
}
