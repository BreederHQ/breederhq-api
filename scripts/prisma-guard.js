#!/usr/bin/env node

/**
 * Prisma Safety Guard
 *
 * Prevents accidental database operations against production.
 * Enforces prototype mode constraints when using .env.proto.
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

// Detect prototype mode from env file in command line
const envFileArg = process.argv.find(arg => arg.includes('.env'));
const isPrototypeMode = envFileArg && envFileArg.includes('proto');

// List of dangerous dev commands that should never run against prod
const DEV_ONLY_COMMANDS = [
  'migrate dev',
  'db push',
  'migrate reset',
  'db seed'
];

// Commands allowed against prod
const PROD_ALLOWED_COMMANDS = [
  'migrate deploy',
  'migrate resolve',
  'migrate status'
];

function exitWithError(message) {
  console.error('\n❌ PRISMA GUARD: OPERATION BLOCKED\n');
  console.error(message);
  console.error('\n');
  process.exit(1);
}

// Check if DATABASE_URL is set
if (!DATABASE_URL) {
  exitWithError(
    'DATABASE_URL is not set.\n' +
    'Ensure you are using dotenv to load the correct environment file:\n' +
    '  npx dotenv -e .env.dev.migrate -- <command>'
  );
}

// Check if DATABASE_URL contains prod database name
const isProdDatabase = DATABASE_URL.includes('bhq_prod');
const isProtoDatabase = DATABASE_URL.includes('bhq_proto');

// ABSOLUTE BLOCK: Never allow ANY operation against production
if (isProdDatabase) {
  exitWithError(
    `BLOCKED: Operation "${fullCommand}" attempted against PRODUCTION database.\n\n` +
    'NO operations are allowed against bhq_prod from this guard.\n' +
    'Production must only be accessed through controlled deployment pipelines.\n\n' +
    'Current DATABASE_URL contains: bhq_prod'
  );
}

// PROTOTYPE MODE: Block migrate commands, allow only db push
if (isPrototypeMode) {
  if (prismaCommand === 'migrate') {
    exitWithError(
      `BLOCKED: Prisma Migrate not allowed in prototype mode.\n\n` +
      'Prototype mode uses "prisma db push" exclusively.\n' +
      'Migrations are frozen. Schema changes go directly to schema.prisma.\n\n' +
      'Use:\n' +
      '  npm run db:proto:push   (apply schema changes)\n' +
      '  npm run db:proto:reset  (reset database)'
    );
  }

  if (!isProtoDatabase) {
    exitWithError(
      `BLOCKED: Prototype mode env file (.env.proto) loaded but DATABASE_URL does not point to bhq_proto.\n\n` +
      'Prototype mode requires DATABASE_URL to contain "bhq_proto".\n' +
      'Check your .env.proto file.'
    );
  }
}

// Block dev commands against prod (legacy check, redundant with absolute block above)
if (isProdDatabase && DEV_ONLY_COMMANDS.some(cmd => fullCommand.startsWith(cmd))) {
  exitWithError(
    `Attempted to run "${fullCommand}" against PRODUCTION database.\n\n` +
    'Dev commands like "migrate dev" and "db push" are not allowed against bhq_prod.\n' +
    'Production databases should only use "migrate deploy".\n\n' +
    'If you intended to work on dev, use:\n' +
    '  npx dotenv -e .env.dev.migrate -- npm run <script>'
  );
}

// Block prod deploy commands against dev when using prod env file
// (This catches mistakes where someone runs prod script with wrong env)
const isDevDatabase = DATABASE_URL.includes('bhq_dev');
if (isDevDatabase && fullCommand.startsWith('migrate deploy')) {
  console.warn('\n⚠️  WARNING: Running "migrate deploy" against DEV database.');
  console.warn('This is unusual. Normally you would use "migrate dev" for development.\n');
  // Allow but warn - sometimes this is intentional for testing
}

// All checks passed
console.log('✓ Prisma guard: Safety checks passed');
console.log(`  Mode: ${isPrototypeMode ? 'PROTOTYPE' : 'normal'}`);
console.log(`  Database: ${isProdDatabase ? 'bhq_prod' : isDevDatabase ? 'bhq_dev' : isProtoDatabase ? 'bhq_proto' : 'other'}`);
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
