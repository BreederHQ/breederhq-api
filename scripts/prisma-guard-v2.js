#!/usr/bin/env node

/**
 * Prisma Guard v2 - Enforces v2-only database access
 *
 * This guard BLOCKS all v1 database writes and ensures only v2 workflows are used.
 * v1 databases are now snapshot-only and read-only.
 *
 * ALLOWED:
 *   - db:v2:* scripts (all v2 migration workflows)
 *   - db:studio (read-only inspection)
 *   - db:gen (local Prisma client generation)
 *   - db:v2:dump:v1:* (read-only snapshot dumps)
 *
 * BLOCKED:
 *   - Any prisma migrate outside db:v2:* context
 *   - Any prisma db push (deprecated in v2 workflow)
 *   - Any write operation targeting v1 databases
 *   - Legacy db:dev:*, db:prod:* scripts
 *
 * Usage: node scripts/prisma-guard-v2.js -- prisma <command> [args...]
 */

import { spawn } from 'child_process';

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_DIRECT_URL = process.env.DATABASE_DIRECT_URL;
const args = process.argv.slice(2);

// Remove the '--' separator if present
const commandArgs = args[0] === '--' ? args.slice(1) : args;

// Extract prisma command (e.g., 'migrate', 'db', 'studio')
const prismaCommand = commandArgs[1];
const prismaSubcommand = commandArgs[2];

// Combine for easier checking
const fullCommand = `${prismaCommand || ''} ${prismaSubcommand || ''}`.trim();

// Detect script context from npm script name
const npmScript = process.env.npm_lifecycle_event || '';

// ═══════════════════════════════════════════════════════════════════════════
// Script Classification
// ═══════════════════════════════════════════════════════════════════════════

// v2 scripts (ALLOWED)
const isV2Script = npmScript.startsWith('db:v2:');
const isV2DevScript = npmScript === 'db:v2:dev:status' || npmScript === 'db:v2:dev:migrate';
const isV2ProdScript = npmScript === 'db:v2:prod:deploy' || npmScript === 'db:v2:prod:status';
const isV2DumpScript = npmScript.startsWith('db:v2:dump:');
const isV2ImportScript = npmScript.startsWith('db:v2:import:');
const isV2PostImportScript = npmScript.startsWith('db:v2:postimport:');
const isV2ValidateScript = npmScript.startsWith('db:v2:validate:');

// Safe utility scripts (ALLOWED)
const isStudioScript = npmScript === 'db:studio';
const isGenScript = npmScript === 'db:gen' || npmScript === 'prisma:gen';
const isValidateScript = npmScript === 'prisma:validate';

// Legacy v1 scripts (BLOCKED)
const isLegacyDevScript = npmScript.startsWith('db:dev:') && !isV2Script;
const isLegacyProdScript = npmScript.startsWith('db:prod:') && !isV2Script;
const isLegacyScript = isLegacyDevScript || isLegacyProdScript;

// ═══════════════════════════════════════════════════════════════════════════
// Database Detection
// ═══════════════════════════════════════════════════════════════════════════

function sanitizeDbLabel(url) {
  if (!url) return 'unknown';
  // v1 databases (BLOCKED for writes)
  if (url.includes('bhq_prod')) return 'v1:bhq_prod';
  if (url.includes('bhq_dev')) return 'v1:bhq_dev';
  if (url.includes('bhq_proto')) return 'v1:bhq_proto';
  // v2 Neon databases (ALLOWED)
  if (url.includes('bhq_migrator') || url.includes('bhq_app')) {
    if (url.includes('development') || url.includes('dev')) return 'v2:development';
    if (url.includes('production') || url.includes('prod')) return 'v2:production';
    return 'v2:unknown-branch';
  }
  return 'unknown';
}

function isV1Database(url) {
  if (!url) return false;
  return url.includes('bhq_prod') || url.includes('bhq_dev') || url.includes('bhq_proto');
}

function isV2Database(url) {
  if (!url) return false;
  return url.includes('bhq_migrator') || url.includes('bhq_app');
}

const dbLabel = sanitizeDbLabel(DATABASE_URL);
const targetIsV1 = isV1Database(DATABASE_URL) || isV1Database(DATABASE_DIRECT_URL);
const targetIsV2 = isV2Database(DATABASE_URL) || isV2Database(DATABASE_DIRECT_URL);

// ═══════════════════════════════════════════════════════════════════════════
// Error Helpers
// ═══════════════════════════════════════════════════════════════════════════

function exitWithError(title, reason, guidance) {
  console.error('\n' + '═'.repeat(70));
  console.error('❌ PRISMA GUARD v2: OPERATION BLOCKED');
  console.error('═'.repeat(70));
  console.error(`\n${title}\n`);
  console.error('REASON:');
  console.error(`  ${reason}\n`);
  console.error('GUIDANCE:');
  guidance.forEach(line => console.error(`  ${line}`));
  console.error('\n' + '═'.repeat(70));
  console.error(`Script: ${npmScript || 'direct invocation'}`);
  console.error(`Database: ${dbLabel}`);
  console.error(`Command: ${fullCommand || 'none'}`);
  console.error('═'.repeat(70) + '\n');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK 1: Legacy v1 Scripts (Complete Lockout)
// ═══════════════════════════════════════════════════════════════════════════

if (isLegacyDevScript) {
  exitWithError(
    'Legacy v1 dev workflow is DISABLED',
    'db:dev:* scripts are no longer available. v1 databases are now read-only.',
    [
      'Use the v2 workflow instead:',
      '',
      '  npm run db:v2:dev:status   # Check migration status',
      '  npm run db:v2:dev:migrate  # Create/apply migrations',
      '',
      'See: docs/runbooks/DB_WORKFLOW_LOCKOUT.md'
    ]
  );
}

if (isLegacyProdScript) {
  exitWithError(
    'Legacy v1 prod workflow is DISABLED',
    'db:prod:* scripts are no longer available. v1 databases are now read-only.',
    [
      'Use the v2 workflow instead:',
      '',
      '  npm run db:v2:prod:status  # Check migration status',
      '  npm run db:v2:prod:deploy  # Deploy migrations',
      '',
      'See: docs/runbooks/DB_WORKFLOW_LOCKOUT.md'
    ]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK 2: Any Write Operation Targeting v1 Databases
// ═══════════════════════════════════════════════════════════════════════════

if (targetIsV1) {
  // Only allow read-only operations on v1
  const isReadOnlyCommand =
    fullCommand === 'studio' ||
    fullCommand === 'validate' ||
    fullCommand.startsWith('migrate status') ||
    fullCommand.startsWith('migrate diff');

  // Snapshot dumps are handled by separate scripts, not through this guard
  if (!isReadOnlyCommand && !isV2DumpScript) {
    exitWithError(
      'v1 Database Write BLOCKED',
      'v1 databases are now READ-ONLY. All writes must go to v2.',
      [
        'v1 databases can only be accessed via:',
        '  - npm run db:v2:dump:v1:dev:snapshot  (read-only export)',
        '  - npm run db:v2:dump:v1:prod:snapshot (read-only export)',
        '',
        'For schema changes, use v2:',
        '  npm run db:v2:dev:migrate',
        '',
        'See: docs/runbooks/DB_WORKFLOW_LOCKOUT.md'
      ]
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK 3: db push (Deprecated in v2 Workflow)
// ═══════════════════════════════════════════════════════════════════════════

if (fullCommand.startsWith('db push')) {
  exitWithError(
    '"prisma db push" is DISABLED',
    'The v2 workflow uses Prisma Migrate exclusively. db push is not allowed.',
    [
      'Use the migration workflow instead:',
      '',
      '  npm run db:v2:dev:migrate  # Development',
      '  npm run db:v2:prod:deploy  # Production',
      '',
      'See: docs/runbooks/DB_WORKFLOW_LOCKOUT.md'
    ]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK 4: prisma migrate Outside v2 Context
// ═══════════════════════════════════════════════════════════════════════════

if (prismaCommand === 'migrate' && !isV2Script) {
  // Allow migrate status and migrate diff for diagnostics
  if (prismaSubcommand !== 'status' && prismaSubcommand !== 'diff') {
    exitWithError(
      '"prisma migrate" Outside v2 Context',
      'Prisma migrate commands must be run through db:v2:* scripts.',
      [
        'Use the v2 scripts:',
        '',
        '  npm run db:v2:dev:status   # Check status',
        '  npm run db:v2:dev:migrate  # Create/apply migrations',
        '  npm run db:v2:prod:status  # Check prod status',
        '  npm run db:v2:prod:deploy  # Deploy to prod',
        '',
        'Direct prisma migrate invocation is blocked.',
        'See: docs/runbooks/DB_WORKFLOW_LOCKOUT.md'
      ]
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK 5: db pull (Never Allowed)
// ═══════════════════════════════════════════════════════════════════════════

if (fullCommand === 'db pull') {
  exitWithError(
    '"prisma db pull" is BLOCKED',
    'schema.prisma is the ONLY source of truth. Pulling from database is not allowed.',
    [
      'The Prisma schema is authoritative.',
      'Database schema is derived from schema.prisma, not the other way around.',
      '',
      'If you need to inspect the database schema:',
      '  npm run db:studio'
    ]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK 6: Ensure v2 Scripts Target v2 Databases
// ═══════════════════════════════════════════════════════════════════════════

if (isV2DevScript || isV2ProdScript) {
  if (!DATABASE_URL) {
    exitWithError(
      'DATABASE_URL Not Set',
      'v2 scripts require DATABASE_URL to be configured.',
      [
        'Ensure the correct .env file is loaded:',
        '  .env.v2.dev  for development',
        '  .env.v2.prod for production',
        '',
        'See: docs/runbooks/NEON_V2_MIGRATE_SAFE_CUTOVER.md'
      ]
    );
  }

  if (!targetIsV2) {
    exitWithError(
      'v2 Script Targeting Wrong Database',
      `Expected v2 database, but DATABASE_URL points to: ${dbLabel}`,
      [
        'v2 scripts must target v2 databases only.',
        '',
        'Check your environment file:',
        '  .env.v2.dev should have v2 development credentials',
        '  .env.v2.prod should have v2 production credentials',
        '',
        'See: docs/runbooks/NEON_V2_MIGRATE_SAFE_CUTOVER.md'
      ]
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK 7: Prevent migrate dev on Production
// ═══════════════════════════════════════════════════════════════════════════

if (fullCommand.startsWith('migrate dev')) {
  const isTargetingProd =
    (DATABASE_URL && DATABASE_URL.includes('production')) ||
    (DATABASE_URL && DATABASE_URL.includes('bhq_prod')) ||
    process.env.NODE_ENV === 'production';

  if (isTargetingProd) {
    exitWithError(
      '"migrate dev" Against Production BLOCKED',
      'migrate dev must NEVER run against production databases.',
      [
        'For production, use:',
        '  npm run db:v2:prod:deploy',
        '',
        'This applies migrations without interactive prompts.'
      ]
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ALLOWED: Pass through to Prisma
// ═══════════════════════════════════════════════════════════════════════════

// At this point, all checks passed
console.log('✓ Prisma guard v2: Safety checks passed');
console.log(`  Script: ${npmScript || 'direct'}`);
console.log(`  Database: ${dbLabel}`);
console.log(`  Command: ${fullCommand || 'none'}\n`);

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
