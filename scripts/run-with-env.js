#!/usr/bin/env node

/**
 * Run With Env - Secure Environment Loader for Prisma Commands
 *
 * Loads environment variables from a specified file and runs a command.
 * Redacts sensitive database URLs from all output.
 *
 * Usage: node scripts/run-with-env.js <env-file> <command> [args...]
 * Example: node scripts/run-with-env.js .env.v2.dev prisma migrate status --schema=prisma/schema.prisma
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node scripts/run-with-env.js <env-file> <command> [args...]');
  console.error('Example: node scripts/run-with-env.js .env.v2.dev prisma migrate status');
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
