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

// Detect prototype mode from npm script name
const npmScript = process.env.npm_lifecycle_event || '';
const isPrototypeMode = npmScript.includes('proto');

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

// PROTOTYPE MODE: Strict invariants enforcement
if (isPrototypeMode) {
  // Block ALL prisma migrate commands
  if (prismaCommand === 'migrate') {
    exitWithError(
      `BLOCKED: Prisma Migrate not allowed in prototype mode.\n\n` +
      'Prototype mode uses "prisma db push" exclusively.\n' +
      'Migrations are frozen. Schema changes go directly to schema.prisma.\n\n' +
      'Use:\n' +
      '  npm run db:proto:push   (apply schema changes)\n' +
      '  npm run db:proto:reset  (reset database)\n\n' +
      'See: PROTOTYPE_MODE.md'
    );
  }

  // Block prisma db pull (can corrupt schema.prisma as source of truth)
  if (fullCommand === 'db pull') {
    exitWithError(
      `BLOCKED: "prisma db pull" not allowed in prototype mode.\n\n` +
      'Prototype mode: schema.prisma is the ONLY source of truth.\n' +
      'Pulling from database would overwrite schema.prisma.\n\n' +
      'See: PROTOTYPE_MODE.md'
    );
  }

  // Enforce bhq_proto database ONLY in prototype mode
  if (!isProtoDatabase) {
    const dbType = DATABASE_URL.includes('bhq_dev') ? 'bhq_dev' :
                   DATABASE_URL.includes('bhq_prod') ? 'bhq_prod' : 'unknown';
    exitWithError(
      `BLOCKED: Prototype mode requires bhq_proto database.\n\n` +
      'DATABASE_URL must contain "bhq_proto".\n' +
      `Current database: ${dbType}\n\n` +
      'To use prototype mode:\n' +
      '  1. Set DATABASE_URL in .env.dev.migrate to your bhq_proto connection string\n' +
      '  2. Keep this change local (do not commit)\n' +
      '  3. Run npm run db:proto:push or db:proto:reset\n\n' +
      'See: PROTOTYPE_MODE.md'
    );
  }
}

// INVERSE CHECK: Block db:proto:* scripts against non-prototype databases
const isDevDatabase = DATABASE_URL.includes('bhq_dev');

if (isPrototypeMode) {
  // Block if not bhq_proto
  if (!isProtoDatabase) {
    const dbType = isDevDatabase ? 'bhq_dev' :
                   isProdDatabase ? 'bhq_prod' : 'unknown';
    exitWithError(
      `BLOCKED: db:proto:* scripts require bhq_proto database.\n\n` +
      `Script: ${npmScript}\n` +
      `Current database: ${dbType}\n\n` +
      'db:proto:push and db:proto:reset can ONLY be used with bhq_proto.\n' +
      'To use prototype mode:\n' +
      '  1. Set DATABASE_URL in .env.dev.migrate to your bhq_proto connection string\n' +
      '  2. Keep this change local (do not commit)\n' +
      '  3. Run npm run db:proto:push or db:proto:reset\n\n' +
      'See: PROTOTYPE_MODE.md'
    );
  }

  // Explicitly block bhq_dev and bhq_prod
  if (isDevDatabase || isProdDatabase) {
    exitWithError(
      `BLOCKED: db:proto:* scripts cannot target bhq_dev or bhq_prod.\n\n` +
      `Script: ${npmScript}\n` +
      `Attempted database: ${isDevDatabase ? 'bhq_dev' : 'bhq_prod'}\n\n` +
      'Prototype scripts are designed for bhq_proto only.\n' +
      'Update DATABASE_URL in .env.dev.migrate to point to bhq_proto.\n\n' +
      'See: PROTOTYPE_MODE.md'
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
