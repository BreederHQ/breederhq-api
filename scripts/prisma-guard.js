#!/usr/bin/env node

/**
 * Prisma Safety Guard
 *
 * Prevents accidental database operations against production when running dev scripts.
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

// Block dev commands against prod
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
console.log(`  Database: ${isProdDatabase ? 'bhq_prod' : isDevDatabase ? 'bhq_dev' : 'other'}`);
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
