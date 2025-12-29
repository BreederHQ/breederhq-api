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

// PRODUCTION ALLOWLIST: Only specific read-only diff and controlled apply operations
const isProdMigrateDiff = isProdDatabase && fullCommand.startsWith('migrate diff');
const isProdControlledApply =
  isProdDatabase &&
  fullCommand.startsWith('db execute') &&
  commandArgs.includes('--file') &&
  commandArgs.some(arg => arg.includes('prisma_prod_align.sql'));

// ABSOLUTE BLOCK 1: Never allow operations against production EXCEPT allowlisted commands
if (isProdDatabase && !isProdMigrateDiff && !isProdControlledApply) {
  exitWithError(
    `BLOCKED: Operation "${fullCommand}" attempted against PRODUCTION database.\n\n` +
    'Only read-only diff and controlled alignment operations are allowed against bhq_prod:\n' +
    '  - prisma migrate diff (via npm run db:prod:align:diff)\n' +
    '  - prisma db execute --file prisma_prod_align.sql (via npm run db:prod:align:apply)\n\n' +
    'ALL other operations blocked.\n' +
    'See: docs/runbooks/PROD_SCHEMA_ALIGNMENT_DB_PUSH_ONLY.md\n\n' +
    `Database detected: ${dbLabel}\n` +
    `Script: ${npmScript || 'none'}`
  );
}

// ABSOLUTE BLOCK 2: Block ALL prisma migrate commands EXCEPT migrate diff for prod alignment
if (prismaCommand === 'migrate' && prismaSubcommand !== 'diff') {
  exitWithError(
    `BLOCKED: Prisma Migrate not allowed during db push workflow phase.\n\n` +
    'Migrations are paused. Use "prisma db push" exclusively.\n' +
    'Schema changes go directly to schema.prisma.\n\n' +
    'Use:\n' +
    '  npm run db:dev:push   (apply schema changes)\n' +
    '  npm run db:dev:reset  (reset database)\n\n' +
    'Exception: "prisma migrate diff" is allowed for prod alignment only.\n' +
    'See: docs/runbooks/DEV_DB_WORKFLOW_DB_PUSH_ONLY.md'
  );
}

// ABSOLUTE BLOCK 3: Block prisma db push against production
if (fullCommand.startsWith('db push') && isProdDatabase) {
  exitWithError(
    `BLOCKED: "prisma db push" NEVER allowed against production.\n\n` +
    'Production schema changes must use controlled SQL alignment:\n' +
    '  1. npm run db:prod:align:diff (generate SQL)\n' +
    '  2. Review prisma_prod_align.sql\n' +
    '  3. npm run db:prod:align:apply (execute SQL)\n\n' +
    'See: docs/runbooks/PROD_SCHEMA_ALIGNMENT_DB_PUSH_ONLY.md'
  );
}

// ABSOLUTE BLOCK 4: Block prisma db pull
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
