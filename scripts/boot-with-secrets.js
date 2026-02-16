#!/usr/bin/env node
/**
 * scripts/boot-with-secrets.js
 *
 * Startup bootstrap for deployed environments using AWS Secrets Manager.
 *
 * Problem: dbmate runs BEFORE the Node.js app boots, so it can't access
 * secrets from AWS Secrets Manager. This script fetches secrets first,
 * then runs the full startup chain with secrets available as env vars.
 *
 * Flow:
 *   1. Fetch all secrets from AWS Secrets Manager
 *   2. Run dbmate migrations (using DATABASE_DIRECT_URL for non-pooled connection)
 *   3. Run preflight environment checks
 *   4. Start the application server
 *
 * Required env vars (set in hosting platform):
 *   - AWS_SECRET_NAME (e.g., breederhq-api/prod-prototype)
 *   - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (Render/non-AWS platforms)
 *     OR instance role (Elastic Beanstalk)
 *   - AWS_REGION (defaults to us-east-2)
 *   - NODE_ENV
 *
 * Usage:
 *   node scripts/boot-with-secrets.js
 */

import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { execSync, spawn } from "child_process";

async function main() {
  const secretName = process.env.AWS_SECRET_NAME || `breederhq-api/${process.env.NODE_ENV || "development"}`;
  const region = process.env.AWS_REGION || "us-east-2";

  // ── Step 1: Fetch secrets from AWS Secrets Manager ──────────────────
  console.log(`🔐 Fetching secrets from AWS Secrets Manager: ${secretName}`);

  const client = new SecretsManagerClient({ region });

  let secrets;
  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    if (!response.SecretString) {
      throw new Error("Secret value is empty");
    }

    secrets = JSON.parse(response.SecretString);
    const keyCount = Object.keys(secrets).length;
    console.log(`✓ ${keyCount} secrets loaded from AWS Secrets Manager`);
  } catch (error) {
    console.error("❌ Failed to fetch secrets:", error.message);
    process.exit(1);
  }

  // Merge secrets into environment for all child processes.
  // Secrets override Render env vars where both exist.
  const mergedEnv = { ...process.env, ...secrets };

  // ── Step 2: Run database migrations ─────────────────────────────────
  // dbmate needs a DIRECT (non-pooled) connection URL for migrations.
  const migrationUrl = secrets.DATABASE_DIRECT_URL || secrets.DATABASE_URL;

  if (!migrationUrl) {
    console.error("❌ No DATABASE_DIRECT_URL or DATABASE_URL found in secrets");
    process.exit(1);
  }

  console.log("🗄️  Running database migrations...");
  try {
    execSync("npx dbmate --migrations-dir db/migrations migrate", {
      stdio: "inherit",
      // Override DATABASE_URL with the DIRECT url for dbmate
      env: { ...mergedEnv, DATABASE_URL: migrationUrl },
    });
    console.log("✓ Migrations complete");
  } catch {
    console.error("❌ Migration failed");
    process.exit(1);
  }

  // ── Step 3: Run preflight environment checks ───────────────────────
  console.log("🔍 Running preflight checks...");
  try {
    execSync("node scripts/development/preflight-env.js", {
      stdio: "inherit",
      env: mergedEnv,
    });
  } catch {
    console.error("❌ Preflight check failed");
    process.exit(1);
  }

  // ── Step 4: Start the server ────────────────────────────────────────
  console.log("🚀 Starting server...");
  const server = spawn("node", ["dist/server.js"], {
    stdio: "inherit",
    env: mergedEnv,
  });

  // Forward termination signals to the server process
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    process.on(signal, () => {
      server.kill(signal);
    });
  }

  server.on("exit", (code, signal) => {
    process.exit(signal ? 0 : (code ?? 1));
  });
}

main().catch((error) => {
  console.error("❌ Boot failed:", error.message);
  process.exit(1);
});
