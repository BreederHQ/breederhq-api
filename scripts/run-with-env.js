#!/usr/bin/env node

/**
 * Run With Env - Secure Environment Loader for Prisma Commands
 *
 * Loads environment variables from a specified file and runs a command.
 * Redacts sensitive database URLs from all output.
 *
 * Usage: node scripts/run-with-env.js <env-file> <command> [args...]
 * Example: node scripts/run-with-env.js .env.dev.migrate prisma migrate status --schema=prisma/schema.prisma
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node scripts/run-with-env.js <env-file> <command> [args...]');
  console.error('Example: node scripts/run-with-env.js .env.dev.migrate prisma migrate status');
  process.exit(1);
}

const envFile = args[0];
const command = args[1];
const commandArgs = args.slice(2);

// Resolve env file path
const envPath = resolve(process.cwd(), envFile);

// Check if env file exists
if (!existsSync(envPath)) {
  console.error(`\n❌ Environment file not found: ${envFile}`);
  console.error(`\nExpected path: ${envPath}`);
  console.error(`\nTo create this file:`);
  console.error(`  1. Copy ${envFile}.example to ${envFile}`);
  console.error(`  2. Fill in the DATABASE_URL and DATABASE_DIRECT_URL values`);
  console.error(`\nSee docs/runbooks/NEON_V2_MIGRATE_SAFE_CUTOVER.md for details.\n`);
  process.exit(1);
}

// Parse env file
function parseEnvFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const env = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

// Load environment from file
const fileEnv = parseEnvFile(envPath);

// Merge with process.env (file values override)
const mergedEnv = { ...process.env, ...fileEnv };

// Sensitive keys to redact in any logging
const SENSITIVE_KEYS = ['DATABASE_URL', 'DATABASE_DIRECT_URL'];

// ═══════════════════════════════════════════════════════════════════════
// GUARDRAILS: Prevent common misconfigurations
// ═══════════════════════════════════════════════════════════════════════

// Check for forbidden SHADOW_DATABASE_URL (we use Prisma's auto-shadow)
if (mergedEnv.SHADOW_DATABASE_URL) {
  console.error(`
═══════════════════════════════════════════════════════════════════════
❌ BLOCKED: SHADOW_DATABASE_URL Detected
═══════════════════════════════════════════════════════════════════════

SHADOW_DATABASE_URL is set in your environment or ${envFile}.

This project uses Prisma's auto-shadow database feature. Prisma will
automatically create and drop shadow databases as needed during
\`prisma migrate dev\`.

ACTIONS:
  1. Remove SHADOW_DATABASE_URL from ${envFile}
  2. Remove shadowDatabaseUrl from prisma/schema.prisma (if present)
  3. Ensure DATABASE_DIRECT_URL uses a role with CREATE DATABASE privileges

DOCUMENTATION:
  See: docs/runbooks/PRISMA_MIGRATION_WORKFLOW.md

═══════════════════════════════════════════════════════════════════════
`);
  process.exit(1);
}

// Check for pooler URL in DATABASE_URL when running migrations
const isMigrateCommand = commandArgs.some(arg =>
  arg === 'migrate' || arg.includes('migrate')
);

if (isMigrateCommand) {
  const dbUrl = mergedEnv.DATABASE_URL || '';
  const directUrl = mergedEnv.DATABASE_DIRECT_URL || '';

  // Prisma uses DATABASE_DIRECT_URL for migrations when available
  // But warn if DATABASE_URL is a pooler and no direct URL is set
  if (dbUrl.includes('-pooler') && !directUrl) {
    console.error(`
═══════════════════════════════════════════════════════════════════════
❌ BLOCKED: Pooler URL Detected for Migration
═══════════════════════════════════════════════════════════════════════

DATABASE_URL contains '-pooler' but DATABASE_DIRECT_URL is not set.

Prisma migrations require a direct database connection (not pooled).
Pooled connections through PgBouncer do not support the transaction
modes required for DDL operations.

ACTIONS:
  1. Set DATABASE_DIRECT_URL to use the direct (non-pooler) endpoint
  2. DATABASE_URL can remain as the pooler URL for runtime queries

EXAMPLE:
  DATABASE_URL=postgresql://user:pass@host-pooler.neon.tech/db
  DATABASE_DIRECT_URL=postgresql://user:pass@host.neon.tech/db
                                            ^^^^ no -pooler

DOCUMENTATION:
  See: docs/runbooks/PRISMA_MIGRATION_WORKFLOW.md

═══════════════════════════════════════════════════════════════════════
`);
    process.exit(1);
  }
}

// Log status (redacted)
console.log(`\n🔧 run-with-env: Loading environment from ${envFile}`);
console.log('━'.repeat(60));

for (const key of SENSITIVE_KEYS) {
  const value = mergedEnv[key];
  if (value && value.trim()) {
    console.log(`  ${key}: [SET - REDACTED]`);
  } else {
    console.log(`  ${key}: [NOT SET]`);
  }
}

console.log('━'.repeat(60));
console.log(`Running: ${command} ${commandArgs.join(' ')}\n`);

// Spawn the command with merged environment
const child = spawn(command, commandArgs, {
  stdio: 'inherit',
  shell: true,
  env: mergedEnv,
  cwd: process.cwd()
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error(`\n❌ Failed to start command: ${err.message}`);
  process.exit(1);
});
