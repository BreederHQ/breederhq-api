#!/usr/bin/env node

/**
 * Run With Env - Secure Environment Loader for Database Commands
 *
 * Loads environment variables from a specified file and runs a command.
 * Redacts sensitive database URLs from all output.
 *
 * Usage: node scripts/run-with-env.js <env-file> <command> [args...]
 * Example: node scripts/run-with-env.js .env.dev.migrate npx dbmate --migrations-dir db/migrations migrate
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { createInterface } from 'readline';

// ═══════════════════════════════════════════════════════════════════════
// Migration Ordering Validator (dbmate format)
// Ensures migration files are in correct timestamp order
// ═══════════════════════════════════════════════════════════════════════

function validateMigrationOrdering(migrationsDir) {
  const violations = [];

  // Get all .sql migration files sorted by timestamp
  const migrations = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && /^\d{14}_/.test(f))
    .map(f => ({
      name: f,
      timestamp: f.substring(0, 14),
      path: join(migrationsDir, f),
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const createdEntities = new Map(); // entity name -> { timestamp, migration }

  // Regex patterns (support schema-qualified names like "schema"."table")
  const CREATE_TABLE_REGEX = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:"(\w+)"\.)?"(\w+)"/gi;
  const CREATE_TYPE_REGEX = /CREATE TYPE\s+(?:"(\w+)"\.)?"(\w+)"/gi;
  const REFERENCES_REGEX = /REFERENCES\s+(?:"(\w+)"\.)?"(\w+)"/gi;

  // First pass: collect all created entities
  for (const migration of migrations) {
    const sql = readFileSync(migration.path, 'utf-8');
    let match;

    CREATE_TABLE_REGEX.lastIndex = 0;
    CREATE_TYPE_REGEX.lastIndex = 0;

    while ((match = CREATE_TABLE_REGEX.exec(sql)) !== null) {
      createdEntities.set(match[2], { timestamp: migration.timestamp, migration: migration.name });
    }
    while ((match = CREATE_TYPE_REGEX.exec(sql)) !== null) {
      createdEntities.set(match[2], { timestamp: migration.timestamp, migration: migration.name });
    }
  }

  // Second pass: check for forward references
  for (const migration of migrations) {
    const sql = readFileSync(migration.path, 'utf-8');
    let match;

    REFERENCES_REGEX.lastIndex = 0;

    while ((match = REFERENCES_REGEX.exec(sql)) !== null) {
      const refTable = match[2];
      const creator = createdEntities.get(refTable);

      if (creator && creator.timestamp > migration.timestamp) {
        violations.push({
          migration: migration.name,
          message: `References table "${refTable}" before it exists`,
          detail: `"${refTable}" created in ${creator.migration} (${creator.timestamp}) but referenced in ${migration.name} (${migration.timestamp})`,
        });
      }
    }
  }

  return violations;
}

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node scripts/run-with-env.js <env-file> <command> [args...]');
  console.error('Example: node scripts/run-with-env.js .env.dev.migrate npx dbmate --migrations-dir db/migrations migrate');
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
  console.error(`  2. Fill in the DATABASE_URL value`);
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

const fullCommand = [command, ...commandArgs].join(' ').toLowerCase();

// ═══════════════════════════════════════════════════════════════════════
// GUARDRAILS: Prevent common misconfigurations
// ═══════════════════════════════════════════════════════════════════════

// BLOCK: prisma db push - NEVER allowed
if (fullCommand.includes('db push')) {
  console.error(`
═══════════════════════════════════════════════════════════════════════
🚫 BLOCKED: prisma db push is FORBIDDEN
═══════════════════════════════════════════════════════════════════════

"db push" applies schema changes directly to the database WITHOUT creating
migration files. Use dbmate migrations instead.

INSTEAD, use the proper migration workflow:

  npm run db:new <name>        # Create a new migration file
  npm run db:dev:up            # Apply pending migrations
  npm run db:prod:deploy       # Apply pending migrations to prod

═══════════════════════════════════════════════════════════════════════
`);
  process.exit(1);
}

// Detect if this is a migration command (dbmate or prisma)
const isDbmateCommand = fullCommand.includes('dbmate');
const isMigrateCommand = isDbmateCommand ||
  fullCommand.includes('migrate') ||
  commandArgs.some(arg => arg === 'migrate' || arg.includes('migrate'));

// Check for pooler URL when running migrations
if (isMigrateCommand) {
  const dbUrl = mergedEnv.DATABASE_URL || '';

  if (dbUrl.includes('-pooler')) {
    console.error(`
═══════════════════════════════════════════════════════════════════════
❌ BLOCKED: Pooler URL Detected for Migration
═══════════════════════════════════════════════════════════════════════

DATABASE_URL contains '-pooler'. Database migrations require a direct
connection (not pooled). Pooled connections through PgBouncer do not
support the transaction modes required for DDL operations.

ACTIONS:
  Set DATABASE_URL to use the direct (non-pooler) endpoint in ${envFile}

EXAMPLE:
  DATABASE_URL=postgresql://user:pass@host.neon.tech/db
                                      ^^^^ no -pooler

═══════════════════════════════════════════════════════════════════════
`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// GUARDRAIL: Validate migration ordering before running migrations
// ═══════════════════════════════════════════════════════════════════════
if (isMigrateCommand) {
  const migrationsDir = resolve(process.cwd(), 'db/migrations');
  if (existsSync(migrationsDir)) {
    const orderingViolations = validateMigrationOrdering(migrationsDir);
    if (orderingViolations.length > 0) {
      console.error(`
═══════════════════════════════════════════════════════════════════════
🚫 BLOCKED: Migration Ordering Violation Detected
═══════════════════════════════════════════════════════════════════════

Migrations reference tables/types that haven't been created yet:
`);
      for (const v of orderingViolations) {
        console.error(`  Migration: ${v.migration}`);
        console.error(`  Issue:     ${v.message}`);
        console.error(`  Detail:    ${v.detail}`);
        console.error('');
      }
      console.error(`
TO FIX:
  Ensure migrations are ordered so that tables/types are created
  before they are referenced by other migrations.

═══════════════════════════════════════════════════════════════════════
`);
      process.exit(1);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// GUARDRAIL: Interactive confirmation for destructive database commands
// This blocks AI tools (Claude Code, Codex, etc.) from running migrations
// ═══════════════════════════════════════════════════════════════════════
const DESTRUCTIVE_PATTERNS = [
  'dbmate migrate',     // Apply migrations
  'dbmate up',          // Create DB + apply migrations
  'dbmate rollback',    // Rollback last migration
  'dbmate down',        // Alias for rollback
  'dbmate drop',        // Drop the database
  'migrate dev',        // Prisma migrate dev (legacy, blocked)
  'migrate deploy',     // Prisma migrate deploy (legacy, blocked)
  'migrate reset',      // Prisma migrate reset (legacy, blocked)
];

const isDestructiveCommand = DESTRUCTIVE_PATTERNS.some(cmd => fullCommand.includes(cmd));

async function requireHumanConfirmation() {
  // Check if running in non-interactive mode (CI, piped input, AI tools)
  if (!process.stdin.isTTY) {
    // Allow CI environments with explicit bypass
    if (process.env.CI === 'true' && process.env.MIGRATION_CI_CONFIRMED === 'true') {
      console.log('\n✓ CI environment with MIGRATION_CI_CONFIRMED=true - proceeding\n');
      return true;
    }

    console.error(`
═══════════════════════════════════════════════════════════════════════
🚫 BLOCKED: Human Confirmation Required
═══════════════════════════════════════════════════════════════════════

This command requires interactive confirmation from a human operator.

Detected: Non-interactive terminal (stdin is not a TTY)

This safeguard prevents AI tools (Claude Code, Codex, Cursor, etc.) from
running database migrations without human oversight.

TO RUN THIS COMMAND:
  Run it directly in your terminal (not through an AI assistant)

FOR CI/CD PIPELINES:
  Set both CI=true and MIGRATION_CI_CONFIRMED=true environment variables

═══════════════════════════════════════════════════════════════════════
`);
    process.exit(1);
  }

  // Interactive confirmation
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const targetEnv = envFile.includes('prod') ? '🔴 PRODUCTION' : '🟡 DEVELOPMENT';

  return new Promise((resolve) => {
    console.log(`
═══════════════════════════════════════════════════════════════════════
⚠️  DATABASE MIGRATION CONFIRMATION
═══════════════════════════════════════════════════════════════════════

  Target: ${targetEnv}
  Command: ${command} ${commandArgs.join(' ')}

This will modify the database schema. Please confirm you want to proceed.
`);

    rl.question('Type "yes" to continue: ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'yes') {
        console.log('\n✓ Confirmed by human operator\n');
        resolve(true);
      } else {
        console.log('\n✗ Cancelled\n');
        process.exit(0);
      }
    });
  });
}

// Main execution
async function main() {
  // Require confirmation for destructive commands
  if (isDestructiveCommand) {
    await requireHumanConfirmation();
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
  // Join command + args into a single string to avoid DEP0190 warning
  // (Node 24 warns when shell: true is used with a separate args array)
  const fullCmd = [command, ...commandArgs].join(' ');
  const child = spawn(fullCmd, {
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
}

main();
