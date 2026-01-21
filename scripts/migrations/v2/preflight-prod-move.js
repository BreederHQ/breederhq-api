#!/usr/bin/env node
/**
 * preflight-prod-move.js - Preflight checks for v1 prod → v2 prod data migration
 *
 * Verifies all preconditions are met before running the data migration:
 * - On git branch 'main' (prod migrations require main)
 * - Working tree is clean
 * - .env.v1.prod.snapshot file exists
 * - V1_PROD_SNAPSHOT_DIRECT_URL is set
 * - .env.prod.migrate file exists
 * - DATABASE_DIRECT_URL (v2 prod) is set
 *
 * Usage: node scripts/db/v2/preflight-prod-move.js
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

/**
 * Check helper with optional error token for machine detection.
 * @param {string} name - Check name
 * @param {boolean} passed - Whether check passed
 * @param {string} message - Human-readable failure message
 * @param {string} [errorToken] - Optional machine-readable error token
 */
function check(name, passed, message, errorToken) {
  if (passed) {
    console.log(`  ✓ ${name}`);
    return true;
  } else {
    console.log(`  ✗ ${name}`);
    console.log(`    → ${message}`);
    if (errorToken) {
      console.log(`    [${errorToken}]`);
    }
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
console.log("Preflight: v1 Prod Snapshot → v2 Prod Data Migration");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

let allPassed = true;

// ─────────────────────────────────────────────────────────────────────────────
// Check 1: Git branch is 'main' (prod migrations require main)
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
    "On branch 'main'",
    currentBranch === "main",
    `Current branch is '${currentBranch}'. Switch to 'main' for prod migrations.`
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
const v1EnvFile = ".env.v1.prod.snapshot";
const v1EnvPath = resolve(rootDir, v1EnvFile);
const v1EnvExists = existsSync(v1EnvPath);

allPassed =
  check(
    `File exists: ${v1EnvFile}`,
    v1EnvExists,
    `Create from template: cp ${v1EnvFile}.example ${v1EnvFile}`,
    "ERR_MISSING_V1_SNAPSHOT_ENV_FILE"
  ) && allPassed;

// ─────────────────────────────────────────────────────────────────────────────
// Check 4: V1_PROD_SNAPSHOT_DIRECT_URL is set
// ─────────────────────────────────────────────────────────────────────────────
const v1Env = parseEnvFile(v1EnvPath);
const v1Url = v1Env ? v1Env["V1_PROD_SNAPSHOT_DIRECT_URL"] : null;
const v1UrlSet = v1Url && v1Url.length > 0;

allPassed =
  check(
    "V1_PROD_SNAPSHOT_DIRECT_URL is set",
    v1UrlSet,
    `Edit ${v1EnvFile} and set V1_PROD_SNAPSHOT_DIRECT_URL`,
    "ERR_MISSING_V1_SNAPSHOT_URL"
  ) && allPassed;

// ─────────────────────────────────────────────────────────────────────────────
// Check 4b: V1_PROD_SNAPSHOT_DIRECT_URL is a valid direct URL
// ─────────────────────────────────────────────────────────────────────────────
if (v1UrlSet) {
  const v1UrlValidation = validateDirectUrl(v1Url, "V1_PROD_SNAPSHOT_DIRECT_URL");
  allPassed =
    check(
      "V1_PROD_SNAPSHOT_DIRECT_URL is direct (not pooler)",
      v1UrlValidation.valid,
      v1UrlValidation.reason
    ) && allPassed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 5: v2 prod env file exists
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nv2 Prod configuration:");
const v2EnvFile = ".env.prod.migrate";
const v2EnvPath = resolve(rootDir, v2EnvFile);
const v2EnvExists = existsSync(v2EnvPath);

allPassed =
  check(
    `File exists: ${v2EnvFile}`,
    v2EnvExists,
    `Create from template: cp ${v2EnvFile}.example ${v2EnvFile}`
  ) && allPassed;

// ─────────────────────────────────────────────────────────────────────────────
// Check 6: DATABASE_DIRECT_URL (v2 prod) is set
// ─────────────────────────────────────────────────────────────────────────────
const v2Env = parseEnvFile(v2EnvPath);
const v2DirectUrl = v2Env ? v2Env["DATABASE_DIRECT_URL"] : null;
const v2UrlSet = v2DirectUrl && v2DirectUrl.length > 0;

allPassed =
  check(
    "DATABASE_DIRECT_URL (v2 prod) is set",
    v2UrlSet,
    `Edit ${v2EnvFile} and set DATABASE_DIRECT_URL`
  ) && allPassed;

// ─────────────────────────────────────────────────────────────────────────────
// Check 6b: DATABASE_DIRECT_URL (v2 prod) is a valid direct URL
// ─────────────────────────────────────────────────────────────────────────────
if (v2UrlSet) {
  const v2UrlValidation = validateDirectUrl(v2DirectUrl, "DATABASE_DIRECT_URL");
  allPassed =
    check(
      "DATABASE_DIRECT_URL (v2 prod) is direct (not pooler)",
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
  console.log("  npm run db:move:prod:dump");
  console.log("  npm run db:move:prod:import");
  console.log("  npm run db:move:prod:postimport");
  console.log("  npm run db:prod:validate");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(0);
} else {
  console.log("✗ Preflight checks FAILED");
  console.log("\nFix the issues above before proceeding.");
  console.log("\nQuick setup commands:");
  console.log("  cp .env.v1.prod.snapshot.example .env.v1.prod.snapshot");
  console.log("  # Edit .env.v1.prod.snapshot and set V1_PROD_SNAPSHOT_DIRECT_URL");
  console.log("\nSee: docs/runbooks/DB_V1_TO_V2_DATA_MOVE_OPTION_B.md");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(1);
}
