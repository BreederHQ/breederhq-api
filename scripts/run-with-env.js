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
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, basename, join } from 'path';
import { createInterface } from 'readline';

// ═══════════════════════════════════════════════════════════════════════
// Migration Ordering Validator
// Ensures migrations don't reference tables/types before they're created
// ═══════════════════════════════════════════════════════════════════════

function validateMigrationOrdering(migrationsDir) {
  const violations = [];
  const createdEntities = new Map(); // entity name -> { timestamp, migration }

  // Get all migration folders sorted by timestamp
  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^\d{14}_/.test(e.name))
    .map(e => ({
      name: e.name,
      timestamp: e.name.substring(0, 14),
      path: join(migrationsDir, e.name),
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Regex patterns
  const CREATE_TABLE_REGEX = /CREATE TABLE\s+"(\w+)"/gi;
  const CREATE_TYPE_REGEX = /CREATE TYPE\s+"(\w+)"/gi;
  const REFERENCES_REGEX = /REFERENCES\s+"(\w+)"/gi;

  // First pass: collect all created entities
  for (const migration of migrations) {
    const sqlPath = join(migration.path, 'migration.sql');
    if (!existsSync(sqlPath)) continue;

    const sql = readFileSync(sqlPath, 'utf-8');
    let match;

    // Reset regex state
    CREATE_TABLE_REGEX.lastIndex = 0;
    CREATE_TYPE_REGEX.lastIndex = 0;

    while ((match = CREATE_TABLE_REGEX.exec(sql)) !== null) {
      createdEntities.set(match[1], { timestamp: migration.timestamp, migration: migration.name });
    }
    while ((match = CREATE_TYPE_REGEX.exec(sql)) !== null) {
      createdEntities.set(match[1], { timestamp: migration.timestamp, migration: migration.name });
    }
  }

  // Second pass: check for forward references
  for (const migration of migrations) {
    const sqlPath = join(migration.path, 'migration.sql');
    if (!existsSync(sqlPath)) continue;

    const sql = readFileSync(sqlPath, 'utf-8');
    let match;

    // Reset regex state
    REFERENCES_REGEX.lastIndex = 0;

    while ((match = REFERENCES_REGEX.exec(sql)) !== null) {
      const refTable = match[1];
      const creator = createdEntities.get(refTable);

      if (creator && creator.timestamp > migration.timestamp) {
        violations.push({
          migration: migration.name,
          message: `References table "${refTable}" before it exists`,
          detail: `"${refTable}" created in ${creator.migration} (${creator.timestamp}) but referenced in ${migration.name} (${migration.timestamp})`,
          fix: `Rename folder to timestamp > ${creator.timestamp} (e.g., ${creator.timestamp.substring(0, 8)}${String(parseInt(creator.timestamp.substring(8)) + 1000).padStart(6, '0')}_${migration.name.split('_').slice(1).join('_')})`,
        });
      }
    }
  }

  return violations;
}

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

// BLOCK: prisma db push - NEVER allowed, use migrations instead
const fullCommand = [command, ...commandArgs].join(' ').toLowerCase();
if (fullCommand.includes('db push')) {
  console.error(`
═══════════════════════════════════════════════════════════════════════
🚫 BLOCKED: prisma db push is FORBIDDEN
═══════════════════════════════════════════════════════════════════════

"db push" applies schema changes directly to the database WITHOUT creating
migration files. This causes:

  ❌ Dev/prod schema drift (prod won't have the changes)
  ❌ Lost migration history (no way to track what changed)
  ❌ Shadow database conflicts on next migrate dev
  ❌ Team sync issues (others won't get your changes)

INSTEAD, use the proper migration workflow:

  npm run db:dev:migrate     # Creates migration + applies it
  npm run db:prod:deploy     # Applies existing migrations to prod

If you're prototyping and want to iterate quickly:
  1. Make changes to schema.prisma
  2. Run: npm run db:dev:migrate
  3. If unhappy, edit migration SQL before committing

DOCUMENTATION:
  See: docs/runbooks/PRISMA_MIGRATION_WORKFLOW.md

═══════════════════════════════════════════════════════════════════════
`);
  process.exit(1);
}

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
const isMigrateCommand = command.includes('migrate') || commandArgs.some(arg =>
  arg === 'migrate' || arg.includes('migrate')
);

// ═══════════════════════════════════════════════════════════════════════
// GUARDRAIL: Validate migration ordering before running migrations
// ═══════════════════════════════════════════════════════════════════════
if (isMigrateCommand) {
  const migrationsDir = resolve(process.cwd(), 'prisma/migrations');
  if (existsSync(migrationsDir)) {
    // Validate migration ordering (tables must be created before referenced)
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
        console.error(`  Fix:       ${v.fix}`);
        console.error('');
      }
      console.error(`
TO FIX:
  Rename the migration folder to have a timestamp AFTER the migration
  that creates the table/type it depends on.

  Example: mv prisma/migrations/20260109143000_foo prisma/migrations/20260109180000_foo

PREVENTION:
  - ALWAYS use 'npm run db:dev:migrate' to create migrations
  - NEVER manually create migration folders
  - NEVER hand-pick timestamps

═══════════════════════════════════════════════════════════════════════
`);
      process.exit(1);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// GUARDRAIL: Check for duplicate migration names before running migrations
// ═══════════════════════════════════════════════════════════════════════
if (isMigrateCommand) {
  const migrationsDir = resolve(process.cwd(), 'prisma/migrations');
  if (existsSync(migrationsDir)) {
    const migrationFolders = readdirSync(migrationsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    // Extract migration names (everything after the timestamp_)
    const migrationNames = migrationFolders
      .filter(f => /^\d{14}_/.test(f)) // Only folders matching YYYYMMDDHHMMSS_name
      .map(f => {
        const match = f.match(/^\d{14}_(.+)$/);
        return match ? { folder: f, name: match[1] } : null;
      })
      .filter(Boolean);

    // Find duplicates by name
    const nameCount = {};
    for (const m of migrationNames) {
      nameCount[m.name] = (nameCount[m.name] || []);
      nameCount[m.name].push(m.folder);
    }

    const duplicates = Object.entries(nameCount).filter(([_, folders]) => folders.length > 1);

    if (duplicates.length > 0) {
      console.error(`
═══════════════════════════════════════════════════════════════════════
🚫 BLOCKED: Duplicate Migration Names Detected
═══════════════════════════════════════════════════════════════════════

Multiple migration folders have the same name (different timestamps):
`);
      for (const [name, folders] of duplicates) {
        console.error(`  "${name}":`);
        for (const folder of folders) {
          console.error(`    - ${folder}`);
        }
      }
      console.error(`
This causes shadow database failures because the same types/tables
are created multiple times.

TO FIX:
  1. Determine which migration should be kept (usually the first one)
  2. Delete the duplicate migration folder(s)
  3. If migrations were already applied to a database, you may need to
     clean up the _prisma_migrations table

PREVENTION:
  - Always use 'npm run db:dev:migrate' to create migrations
  - NEVER manually create migration folders with backdated timestamps
  - NEVER copy/rename existing migration folders

═══════════════════════════════════════════════════════════════════════
`);
      process.exit(1);
    }
  }
}

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

// ═══════════════════════════════════════════════════════════════════════
// GUARDRAIL: Interactive confirmation for destructive migration commands
// This blocks AI tools (Claude Code, Codex, etc.) from running migrations
// ═══════════════════════════════════════════════════════════════════════
const DESTRUCTIVE_COMMANDS = [
  'migrate dev',
  'migrate deploy',
  'migrate resolve',
  'migrate reset',
  'db execute',
];

const isDestructiveCommand = DESTRUCTIVE_COMMANDS.some(cmd => fullCommand.includes(cmd));

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
}

main();
