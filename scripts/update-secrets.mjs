#!/usr/bin/env node
// scripts/update-secrets.mjs
// Updates AWS Secrets Manager secrets for breederhq dev and prod environments.
//
// ─── USAGE ───────────────────────────────────────────────────────────────────
//
//   node scripts/update-secrets.mjs --env dev
//   node scripts/update-secrets.mjs --env prod
//
// ─── HOW TO USE ──────────────────────────────────────────────────────────────
//
//  1. Find the key(s) you want to update in the UPDATES_SHARED, UPDATES_DEV,
//     or UPDATES_PROD section below.
//
//  2. Replace null with the new value (as a string).
//     Keys set to null are SKIPPED — existing value is preserved unchanged.
//
//  3. Run the command for the environment you want to update:
//       node scripts/update-secrets.mjs --env dev
//       node scripts/update-secrets.mjs --env prod
//
//  4. After running, reset all changed keys back to null so secrets aren't
//     left sitting in this file.
//
// ─── WHICH SECTION TO USE ────────────────────────────────────────────────────
//
//  UPDATES_SHARED  →  Keys that are the same value in both dev and prod
//                     (AI keys, payment keys, JWT secrets, etc.)
//
//  UPDATES_DEV     →  Keys that differ between envs — dev values
//  UPDATES_PROD    →  Keys that differ between envs — prod values
//                     (DATABASE_URL uses different Neon endpoints per env)
//
// ─────────────────────────────────────────────────────────────────────────────

import { execSync, spawnSync } from "node:child_process";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UPDATES — same value written to both dev and prod
// Set a key to null to leave it unchanged.
// ─────────────────────────────────────────────────────────────────────────────

const UPDATES_SHARED = {
  // ── AI / ML ──
  ANTHROPIC_API_KEY: null,
  VOYAGE_API_KEY: null,

  // ── Auth / Sessions ──
  JWT_SECRET: null,
  JWT_REFRESH_SECRET: null,
  COOKIE_SECRET: null,

  // ── Email ──
  RESEND_API_KEY: null,

  // ── Payments ──
  STRIPE_SECRET_KEY: null,
  STRIPE_PUBLISHABLE_KEY: null,
  STRIPE_WEBHOOK_SECRET: null,

  // ── NeonDB management (not connection — that's env-specific below) ──
  NEON_API_KEY: null,

  // ── Firebase ──
  FIREBASE_PROJECT_ID: null,
  FIREBASE_CLIENT_EMAIL: null,
  FIREBASE_PRIVATE_KEY: null,      // full PEM key string

  // ── Admin API ──
  ADMIN_TOKEN: null,               // Bearer token for CI/CD admin endpoints (help indexing, invites)
                                   // GitHub Actions secret: HELP_INDEX_TOKEN = same value

  // ── Help system feature flags ──
  HELP_AI_ENABLED: null,           // "true" or "false"
  HELP_RATE_LIMIT_PRO: null,       // daily query limit for Pro tier (e.g. "20")
  HELP_RATE_LIMIT_ENTERPRISE: null, // daily query limit for Enterprise tier (e.g. "100")
  HELP_BURST_LIMIT: null,          // queries per 60s window (e.g. "3")
};

// ─────────────────────────────────────────────────────────────────────────────
// ENV-SPECIFIC UPDATES — different values for dev vs prod
// Paste connection strings from NeonDB console after resetting passwords.
// ─────────────────────────────────────────────────────────────────────────────

const UPDATES_DEV = {
  // NeonDB — dev endpoint: ep-misty-frog-aeq6ti2j
  DATABASE_URL: null,         // postgresql://bhq_app:<pass>@ep-misty-frog-aeq6ti2j-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
  DATABASE_DIRECT_URL: null,  // postgresql://bhq_migrator:<pass>@ep-misty-frog-aeq6ti2j.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require

  // CDN / Storage
  CDN_DOMAIN: null,           // e.g. d15tdn3qa9of1k.cloudfront.net
  S3_BUCKET: null,
  S3_REGION: null,            // us-east-2

  // App URLs
  APP_URL: null,
  API_URL: null,

  // Misc
  NODE_ENV: null,
  PORT: null,
  AWS_SECRET_NAME: null,      // breederhq/dev-prototype
};

const UPDATES_PROD = {
  // NeonDB — prod endpoint: ep-dark-breeze-ael53qjx
  DATABASE_URL: null,         // postgresql://bhq_app:<pass>@ep-dark-breeze-ael53qjx-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
  DATABASE_DIRECT_URL: null,  // postgresql://bhq_migrator:<pass>@ep-dark-breeze-ael53qjx.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require

  // CDN / Storage
  CDN_DOMAIN: null,           // e.g. d21ngqll2l9ylo.cloudfront.net
  S3_BUCKET: null,
  S3_REGION: null,            // us-east-2

  // App URLs
  APP_URL: null,
  API_URL: null,

  // Misc
  NODE_ENV: null,
  PORT: null,
  AWS_SECRET_NAME: null,      // breederhq/prod-prototype
};

// ─────────────────────────────────────────────────────────────────────────────
// Repair corrupted JSON (PowerShell ConvertTo-Json mangling).
// Known key names are used as position delimiters when JSON.parse fails.
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_KEYS = [
  "DATABASE_URL", "DATABASE_DIRECT_URL",
  "JWT_SECRET", "JWT_REFRESH_SECRET", "COOKIE_SECRET",
  "ANTHROPIC_API_KEY", "VOYAGE_API_KEY",
  "RESEND_API_KEY", "SENDGRID_API_KEY",
  "STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET",
  "NEON_API_KEY", "S3_REGION", "S3_BUCKET", "CDN_DOMAIN",
  "ADMIN_TOKEN",
  "HELP_AI_ENABLED", "HELP_RATE_LIMIT_PRO", "HELP_RATE_LIMIT_ENTERPRISE", "HELP_BURST_LIMIT",
  "PORT", "NODE_ENV", "APP_URL", "API_URL", "AWS_SECRET_NAME", "AWS_REGION",
  "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY",
  "REDIS_URL",
];

function repairSecret(raw) {
  let inner = raw.trim();
  if (inner.startsWith("{")) inner = inner.slice(1);
  if (inner.endsWith("}")) inner = inner.slice(0, -1);

  const keyPositions = [];
  for (const key of KNOWN_KEYS) {
    const idx = inner.indexOf(key + ":");
    if (idx !== -1) keyPositions.push({ key, idx });
  }
  keyPositions.sort((a, b) => a.idx - b.idx);

  if (keyPositions.length === 0) {
    throw new Error("No known keys found in secret — cannot repair. Add key names to KNOWN_KEYS.");
  }

  const repaired = {};
  for (let i = 0; i < keyPositions.length; i++) {
    const { key, idx } = keyPositions[i];
    const valueStart = idx + key.length + 1;
    const valueEnd = i + 1 < keyPositions.length ? keyPositions[i + 1].idx - 1 : inner.length;
    let value = inner.slice(valueStart, valueEnd);
    value = value.replace(/^[\s,]+/, "").replace(/[\s,]+$/, "");
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Decode PowerShell \uXXXX unicode escapes (e.g. \u0026 → &)
    value = value.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
    repaired[key] = value;
  }
  return repaired;
}

// ─────────────────────────────────────────────────────────────────────────────

const env = process.argv.includes("--env")
  ? process.argv[process.argv.indexOf("--env") + 1]
  : "dev";

const SECRET_ID = env === "prod" ? "breederhq/prod-prototype" : "breederhq/dev-prototype";
const PROFILE = env === "prod" ? "prod" : "dev";

// Merge shared + env-specific updates
const UPDATES = { ...UPDATES_SHARED, ...(env === "prod" ? UPDATES_PROD : UPDATES_DEV) };

console.log(`\nUpdating ${SECRET_ID} (profile: ${PROFILE})\n`);

// Fetch current secret
const raw = execSync(
  `aws secretsmanager get-secret-value --secret-id ${SECRET_ID} --query SecretString --output text --profile ${PROFILE} --region us-east-2`,
  { encoding: "utf8" }
).trim();

let secret;
try {
  secret = JSON.parse(raw);
} catch (e) {
  console.log("⚠️  Secret is corrupted JSON — attempting repair...");
  secret = repairSecret(raw);
  console.log(`  Repaired: found keys: ${Object.keys(secret).join(", ")}\n`);
}

// Apply updates
let changed = 0;
for (const [key, value] of Object.entries(UPDATES)) {
  if (value === null) continue;
  secret[key] = value;
  console.log(`  updating ${key}`);
  changed++;
}

if (changed === 0) {
  console.log("No changes to apply. Set key values above and re-run.");
  process.exit(0);
}

// Write back
const result = spawnSync(
  "aws",
  [
    "secretsmanager", "update-secret",
    "--secret-id", SECRET_ID,
    "--secret-string", JSON.stringify(secret),
    "--profile", PROFILE,
    "--region", "us-east-2",
  ],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  console.error("\n❌ Failed:", result.stderr);
  process.exit(1);
}

console.log(`\n✅ Updated ${changed} key(s) in ${SECRET_ID}`);
console.log(`   Remember to reset changed values back to null in this file.\n`);
