#!/usr/bin/env node

/**
 * Prisma Safety Guard - Dev DB Push Workflow
 *
 * Enforces safe database operations during db push workflow phase.
 * Migrations are paused - all schema changes use db push only.
 *
 * Usage: node scripts/prisma-guard.js -- prisma <command> [args...]
 */

import { spawn } from 'child_process';

const DATABASE_URL = process.env.DATABASE_URL;
const args = process.argv.slice(2);

// Remove the '--' separator if present
const commandArgs = args[0] === '--' ? args.slice(1) : args;

// Extract prisma command (e.g., 'migrate', 'db', 'studio')
const prismaCommand = commandArgs[1];
const prismaSubcommand = commandArgs[2];

// Combine for easier checking
const fullCommand = `${prismaCommand} ${prismaSubcommand || ''}`.trim();

// Detect script mode from npm script name
const npmScript = process.env.npm_lifecycle_event || '';
const isDevScript = npmScript.startsWith('db:dev:');

function exitWithError(message) {
  console.error('\n❌ PRISMA GUARD: OPERATION BLOCKED\n');
  console.error(message);
  console.error('\n');
  process.exit(1);
}

function sanitizeDbLabel(url) {
  if (!url) return 'unknown';
  if (url.includes('bhq_prod')) return 'bhq_prod';
  if (url.includes('bhq_dev')) return 'bhq_dev';
  if (url.includes('bhq_proto')) return 'bhq_proto';
  return 'unknown';
}

// REQUIRED: DATABASE_URL must be set
if (!DATABASE_URL) {
  exitWithError(
    'DATABASE_URL is not set.\n' +
    'Ensure you are using dotenv to load the correct environment file:\n' +
    '  npx dotenv -e .env.dev.migrate --override -- <command>'
  );
}

// Detect database type from URL
const isProdDatabase = DATABASE_URL.includes('bhq_prod');
const isDevDatabase = DATABASE_URL.includes('bhq_dev');
const dbLabel = sanitizeDbLabel(DATABASE_URL);

// ABSOLUTE BLOCK 1: Never allow ANY operation against production
if (isProdDatabase) {
  exitWithError(
    `BLOCKED: Operation "${fullCommand}" attempted against PRODUCTION database.\n\n` +
    'NO operations are allowed against bhq_prod.\n' +
    'Production must only be accessed through controlled deployment pipelines.\n\n' +
    `Database detected: ${dbLabel}`
  );
}

// ABSOLUTE BLOCK 2: Block ALL prisma migrate commands during this phase
if (prismaCommand === 'migrate') {
  exitWithError(
    `BLOCKED: Prisma Migrate not allowed during db push workflow phase.\n\n` +
    'Migrations are paused. Use "prisma db push" exclusively.\n' +
    'Schema changes go directly to schema.prisma.\n\n' +
    'Use:\n' +
    '  npm run db:dev:push   (apply schema changes)\n' +
    '  npm run db:dev:reset  (reset database)\n\n' +
    'See: docs/runbooks/DEV_DB_WORKFLOW_DB_PUSH_ONLY.md'
  );
}

// ABSOLUTE BLOCK 3: Block prisma db pull
if (fullCommand === 'db pull') {
  exitWithError(
    `BLOCKED: "prisma db pull" not allowed during db push workflow phase.\n\n` +
    'Schema.prisma is the ONLY source of truth.\n' +
    'Pulling from database would overwrite schema.prisma.\n\n' +
    'See: docs/runbooks/DEV_DB_WORKFLOW_DB_PUSH_ONLY.md'
  );
}

// ENFORCE: db:dev:* scripts must target bhq_dev
if (isDevScript) {
  if (!isDevDatabase) {
    exitWithError(
      `BLOCKED: db:dev:* scripts require bhq_dev database.\n\n` +
      `Script: ${npmScript}\n` +
      `Current database: ${dbLabel}\n\n` +
      'db:dev:push and db:dev:reset can ONLY be used with bhq_dev.\n' +
      'Update DATABASE_URL in .env.dev.migrate to point to bhq_dev.\n\n' +
      'See: docs/runbooks/DEV_DB_WORKFLOW_DB_PUSH_ONLY.md'
    );
  }
}

// All checks passed
console.log('✓ Prisma guard: Safety checks passed');
console.log(`  Database: ${dbLabel}`);
console.log(`  Command: ${fullCommand}\n`);

// Execute the actual prisma command
const prisma = spawn(commandArgs[0], commandArgs.slice(1), {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

prisma.on('exit', (code) => {
  process.exit(code || 0);
});

prisma.on('error', (err) => {
  console.error('Failed to start Prisma command:', err);
  process.exit(1);
});
