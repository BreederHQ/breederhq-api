#!/usr/bin/env node

/**
 * Prisma Safety Guard
 *
 * Enforces safe database operations during development.
 * Supports both:
 *   - v1 db push workflow (bhq_dev, bhq_prod databases)
 *   - v2 migrate workflow (Neon v2 development/production branches)
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
const isV2DevScript = npmScript === 'db:v2:dev:status' || npmScript === 'db:v2:dev:migrate';
const isV2ProdScript = npmScript === 'db:v2:prod:deploy';

function exitWithError(message) {
  console.error('\n❌ PRISMA GUARD: OPERATION BLOCKED\n');
  console.error(message);
  console.error('\n');
  process.exit(1);
}

function sanitizeDbLabel(url) {
  if (!url) return 'unknown';
  // v1 databases
  if (url.includes('bhq_prod')) return 'v1:bhq_prod';
  if (url.includes('bhq_dev')) return 'v1:bhq_dev';
  if (url.includes('bhq_proto')) return 'v1:bhq_proto';
  // v2 Neon branches (detect by endpoint pattern or role)
  if (url.includes('bhq_migrator') || url.includes('bhq_app')) {
    // Check for branch indicators in Neon URLs
    if (url.includes('development') || url.includes('dev')) return 'v2:development';
    if (url.includes('production') || url.includes('prod')) return 'v2:production';
    return 'v2:unknown-branch';
  }
  return 'unknown';
}

// REQUIRED: DATABASE_URL must be set
if (!DATABASE_URL) {
  exitWithError(
    'DATABASE_URL is not set.\n' +
    'Ensure you are using the correct environment file:\n' +
    '  v1 workflow: npx dotenv -e .env.dev.migrate --override -- <command>\n' +
    '  v2 workflow: node scripts/run-with-env.js .env.v2.dev <command>'
  );
}

// Detect database type from URL
const isProdDatabase = DATABASE_URL.includes('bhq_prod') ||
  (DATABASE_URL.includes('production') && (DATABASE_URL.includes('bhq_migrator') || DATABASE_URL.includes('bhq_app')));
const isDevDatabase = DATABASE_URL.includes('bhq_dev') ||
  (DATABASE_URL.includes('development') && (DATABASE_URL.includes('bhq_migrator') || DATABASE_URL.includes('bhq_app')));
const isV2Database = DATABASE_URL.includes('bhq_migrator') || DATABASE_URL.includes('bhq_app');
const dbLabel = sanitizeDbLabel(DATABASE_URL);

// Detect NODE_ENV
const isNodeEnvProduction = process.env.NODE_ENV === 'production';

// ═══════════════════════════════════════════════════════════════════════════
// ABSOLUTE BLOCK: Never allow dangerous operations when NODE_ENV=production
// ═══════════════════════════════════════════════════════════════════════════
if (isNodeEnvProduction) {
  if (fullCommand.startsWith('migrate dev') || fullCommand.startsWith('db push')) {
    exitWithError(
      `BLOCKED: "${fullCommand}" not allowed when NODE_ENV=production.\n\n` +
      'Production deployments should use:\n' +
      '  prisma migrate deploy (applies existing migrations)\n\n' +
      'Never run migrate dev or db push against production.'
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// v2 Migrate Workflow Rules
// ═══════════════════════════════════════════════════════════════════════════
if (isV2Database) {
  // v2 dev: allow migrate dev, migrate status
  if (isV2DevScript) {
    if (!isDevDatabase) {
      exitWithError(
        `BLOCKED: v2 dev scripts require a v2 development database.\n\n` +
        `Script: ${npmScript}\n` +
        `Current database: ${dbLabel}\n\n` +
        'Ensure .env.v2.dev points to the Neon v2 development branch.'
      );
    }
    // Allow migrate dev and migrate status for v2 dev
    if (fullCommand.startsWith('migrate dev') || fullCommand.startsWith('migrate status')) {
      // Allowed - proceed
    } else if (fullCommand.startsWith('db push')) {
      exitWithError(
        `BLOCKED: "db push" not allowed in v2 workflow.\n\n` +
        'The v2 workflow uses Prisma Migrate exclusively:\n' +
        '  npm run db:v2:dev:migrate   (create/apply migrations)\n' +
        '  npm run db:v2:dev:status    (check migration status)'
      );
    }
  }

  // v2 prod: only allow migrate deploy
  if (isV2ProdScript) {
    if (!isProdDatabase) {
      exitWithError(
        `BLOCKED: v2 prod scripts require a v2 production database.\n\n` +
        `Script: ${npmScript}\n` +
        `Current database: ${dbLabel}\n\n` +
        'Ensure .env.v2.prod points to the Neon v2 production branch.'
      );
    }
    if (!fullCommand.startsWith('migrate deploy')) {
      exitWithError(
        `BLOCKED: Only "migrate deploy" allowed for v2 production.\n\n` +
        `Attempted: ${fullCommand}\n\n` +
        'Production migrations must use migrate deploy to apply existing migrations.'
      );
    }
    if (fullCommand.startsWith('migrate dev')) {
      exitWithError(
        `BLOCKED: "migrate dev" NEVER allowed against production.\n\n` +
        'Use migrate deploy to apply migrations to production:\n' +
        '  npm run db:v2:prod:deploy'
      );
    }
  }

  // Block migrate dev against any production database
  if (isProdDatabase && fullCommand.startsWith('migrate dev')) {
    exitWithError(
      `BLOCKED: "migrate dev" NEVER allowed against production.\n\n` +
      `Database: ${dbLabel}\n\n` +
      'Use migrate deploy to apply migrations to production.'
    );
  }

  // Block db push in v2 workflow entirely
  if (fullCommand.startsWith('db push') && isV2Database) {
    // Only block if this is a v2 script context
    if (isV2DevScript || isV2ProdScript) {
      exitWithError(
        `BLOCKED: "db push" not allowed in v2 workflow.\n\n` +
        'The v2 workflow uses Prisma Migrate:\n' +
        '  Development: npm run db:v2:dev:migrate\n' +
        '  Production:  npm run db:v2:prod:deploy'
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// v1 db push Workflow Rules (preserved from original)
// ═══════════════════════════════════════════════════════════════════════════
if (!isV2Database && !isV2DevScript && !isV2ProdScript) {
  // v1 PRODUCTION ALLOWLIST
  const isProdMigrateDiff = isProdDatabase && fullCommand.startsWith('migrate diff');
  const isProdControlledApply =
    isProdDatabase &&
    fullCommand.startsWith('db execute') &&
    commandArgs.includes('--file') &&
    commandArgs.some(arg => arg.includes('prisma_prod_align.sql'));

  // ABSOLUTE BLOCK: v1 prod operations (except allowlist)
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

  // ABSOLUTE BLOCK: v1 migrate commands (except migrate diff)
  if (prismaCommand === 'migrate' && prismaSubcommand !== 'diff') {
    exitWithError(
      `BLOCKED: Prisma Migrate not allowed in v1 db push workflow.\n\n` +
      'v1 uses "prisma db push" exclusively.\n' +
      'For Prisma Migrate, use v2 workflow:\n' +
      '  npm run db:v2:dev:migrate\n\n' +
      'See: docs/runbooks/NEON_V2_MIGRATE_SAFE_CUTOVER.md'
    );
  }

  // ABSOLUTE BLOCK: db push against v1 production
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

  // ABSOLUTE BLOCK: db pull
  if (fullCommand === 'db pull') {
    exitWithError(
      `BLOCKED: "prisma db pull" not allowed.\n\n` +
      'Schema.prisma is the ONLY source of truth.\n' +
      'Pulling from database would overwrite schema.prisma.'
    );
  }

  // ENFORCE: v1 db:dev:* scripts must target bhq_dev
  if (isDevScript && !isDevDatabase) {
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

// ═══════════════════════════════════════════════════════════════════════════
// All checks passed - execute command
// ═══════════════════════════════════════════════════════════════════════════
console.log('✓ Prisma guard: Safety checks passed');
console.log(`  Database: ${dbLabel}`);
console.log(`  Command: ${fullCommand}\n`);

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
