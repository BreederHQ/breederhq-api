#!/usr/bin/env node
/**
 * scripts/development/boot-dev.js
 *
 * Dev startup bootstrap that fetches secrets from AWS Secrets Manager,
 * exactly like boot-with-secrets.js does for deployed environments.
 *
 * Flow:
 *   1. Load .env.dev for local-only vars (PORT, NODE_ENV, APP_URL, etc.)
 *   2. Fetch all secrets from AWS Secrets Manager (same secret the deployed env uses)
 *   3. Merge secrets into env (SM values override .env.dev values)
 *   4. Run preflight checks
 *   5. Start tsx watch for hot-reload dev server
 *
 * Prerequisites:
 *   - AWS CLI configured: aws configure --profile dev
 *   - .env.dev must have USE_SECRETS_MANAGER=true and AWS_SECRET_NAME set
 *
 * Usage:
 *   npm run dev          (reads .env.dev, fetches from SM, starts tsx watch)
 */

import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { execSync, spawn } from "child_process";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const ENV_FILE = resolve(ROOT, ".env.dev");

// ── Step 1: Load .env.dev ─────────────────────────────────────────────────
function loadEnvFile(filePath) {
  let content;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`❌ Could not read ${filePath}`);
    process.exit(1);
  }

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.substring(0, eqIdx);
    const value = trimmed.substring(eqIdx + 1);

    // Don't override existing env vars (shell takes precedence)
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * Detect if an error is due to expired/missing SSO credentials.
 */
function isSsoTokenError(error) {
  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("token has expired") ||
    msg.includes("refresh failed") ||
    msg.includes("sso") ||
    msg.includes("the security token included in the request is expired") ||
    error.name === "ExpiredTokenException" ||
    error.name === "UnrecognizedClientException" ||
    error.name === "CredentialsProviderError"
  );
}

/**
 * Fetch secrets from SM with automatic SSO re-login on token expiry.
 */
async function fetchSecrets(secretName, region) {
  const client = new SecretsManagerClient({ region });

  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    if (!response.SecretString) {
      throw new Error("Secret value is empty");
    }

    const secrets = JSON.parse(response.SecretString);
    console.log(`✓ ${secrets ? Object.keys(secrets).length : 0} secrets loaded from AWS Secrets Manager`);
    return secrets;
  } catch (error) {
    if (!isSsoTokenError(error)) {
      // Non-SSO error — fail immediately
      console.error(`❌ Failed to fetch secrets: ${error.message}`);
      console.error("");
      console.error("Troubleshooting:");
      console.error("  1. Configure AWS CLI: aws configure --profile dev");
      console.error("  2. Check IAM permissions for secretsmanager:GetSecretValue");
      console.error("");
      console.error("To skip SM and use .env.dev values directly:");
      console.error("  Set USE_SECRETS_MANAGER=false in .env.dev");
      process.exit(1);
    }

    // SSO token expired — auto-login
    const profile = process.env.AWS_PROFILE || "dev";
    console.log(`⚠️  AWS SSO token expired. Opening browser to re-authenticate...`);

    try {
      execSync(`aws sso login --profile ${profile}`, {
        stdio: "inherit", // shows browser prompt in terminal
      });
      console.log(`✓ SSO login successful. Retrying secret fetch...`);
    } catch {
      console.error("❌ SSO login failed or was cancelled.");
      console.error("To skip SM: set USE_SECRETS_MANAGER=false in .env.dev");
      process.exit(1);
    }

    // Retry with fresh credentials
    const retryClient = new SecretsManagerClient({ region });
    try {
      const response = await retryClient.send(
        new GetSecretValueCommand({ SecretId: secretName })
      );

      if (!response.SecretString) {
        throw new Error("Secret value is empty");
      }

      const secrets = JSON.parse(response.SecretString);
      console.log(`✓ ${Object.keys(secrets).length} secrets loaded from AWS Secrets Manager`);
      return secrets;
    } catch (retryError) {
      console.error(`❌ Failed to fetch secrets after SSO login: ${retryError.message}`);
      process.exit(1);
    }
  }
}

async function main() {
  // Load local env file first (for PORT, NODE_ENV, APP_URL, feature flags, etc.)
  loadEnvFile(ENV_FILE);

  const useSecretsManager = process.env.USE_SECRETS_MANAGER === "true";

  if (useSecretsManager) {
    // ── Step 2: Fetch secrets from AWS Secrets Manager ──────────────────
    const secretName = process.env.AWS_SECRET_NAME || `breederhq-api/${process.env.NODE_ENV || "development"}`;
    const region = process.env.AWS_SECRETS_MANAGER_REGION || "us-east-2";

    console.log(`🔐 Fetching secrets from AWS Secrets Manager: ${secretName}`);

    const secrets = await fetchSecrets(secretName, region);

    // SM secrets override .env.dev values
    Object.assign(process.env, secrets);
  } else {
    console.log("ℹ️  Secrets Manager disabled — using .env.dev values directly");
  }

  // ── Step 3: Run preflight checks ───────────────────────────────────────
  console.log("🔍 Running preflight checks...");
  try {
    execSync("node scripts/development/preflight-env.js", {
      stdio: "inherit",
      env: process.env,
    });
  } catch {
    console.error("❌ Preflight check failed");
    process.exit(1);
  }

  // ── Step 4: Start dev server with tsx watch ────────────────────────────
  console.log("🚀 Starting dev server (tsx watch)...");

  // Suppress DEP0040 (punycode) — comes from firebase-admin's transitive dep
  // chain: google-gax → node-fetch@2 → whatwg-url@5 → tr46@0.0.3 → punycode.
  // Not fixable without breaking node-fetch@2 compatibility. Suppressed only
  // in the child tsx process; boot-dev.js itself is unaffected.
  const childEnv = { ...process.env };
  const existingNodeOptions = childEnv.NODE_OPTIONS || "";
  childEnv.NODE_OPTIONS = [existingNodeOptions, "--no-deprecation"]
    .filter(Boolean)
    .join(" ");

  const server = spawn("npx tsx watch src/server.ts", {
    stdio: "inherit",
    env: childEnv,
    cwd: ROOT,
    shell: true,
  });

  // Forward termination signals
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
  console.error(`❌ Dev boot failed: ${error.message}`);
  process.exit(1);
});
