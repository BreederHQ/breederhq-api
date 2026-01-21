#!/usr/bin/env node

/**
 * v1-blocked.js - Blocks legacy v1 database commands
 *
 * This script is called by deprecated v1 npm scripts to provide
 * clear guidance on the new v2 workflow.
 *
 * Usage: node scripts/v1-blocked.js <script-name>
 */

const scriptName = process.argv[2] || process.env.npm_lifecycle_event || 'unknown';

console.error('\n' + '═'.repeat(70));
console.error('❌ BLOCKED: v1 Database Workflow Disabled');
console.error('═'.repeat(70));
console.error(`\nScript: ${scriptName}\n`);
console.error('v1 databases are now READ-ONLY and accessible only via snapshot dumps.');
console.error('All schema changes and migrations must use the v2 workflow.\n');

// Provide specific guidance based on script name
const guidance = {
  'db:dev:push': [
    'Use instead:',
    '  npm run db:v2:dev:migrate   # Create and apply migrations',
    '  npm run db:v2:dev:status    # Check migration status'
  ],
  'db:dev:reset': [
    'Use instead:',
    '  npm run db:v2:dev:migrate   # For schema changes',
    '',
    'For a full reset, recreate the v2 dev branch in Neon console.'
  ],
  'db:dev:sync': [
    'Use instead:',
    '  npm run db:v2:dev:migrate   # Apply schema changes',
    '  npm run db:gen              # Generate Prisma client'
  ],
  'db:dev:print-target': [
    'Use instead:',
    '  npm run db:v2:dev:status    # Check current database status'
  ],
  'db:prod:align:diff': [
    'Use instead:',
    '  npm run db:v2:prod:status   # Check prod migration status',
    '',
    'Schema alignment is no longer needed. v2 uses Prisma Migrate.'
  ],
  'db:prod:align:apply': [
    'Use instead:',
    '  npm run db:v2:prod:deploy   # Deploy migrations to prod',
    '',
    'Direct SQL execution is no longer supported.'
  ],
  'db:prod:align:verify': [
    'Use instead:',
    '  npm run db:v2:prod:status   # Verify migration status'
  ]
};

const scriptGuidance = guidance[scriptName] || [
  'Use the v2 workflow:',
  '  npm run db:v2:dev:status    # Dev status',
  '  npm run db:v2:dev:migrate   # Dev migrations',
  '  npm run db:v2:prod:status   # Prod status',
  '  npm run db:v2:prod:deploy   # Prod deployment'
];

console.error('GUIDANCE:');
scriptGuidance.forEach(line => console.error(`  ${line}`));

console.error('\nDOCUMENTATION:');
console.error('  See: docs/runbooks/DB_WORKFLOW_LOCKOUT.md');
console.error('  See: docs/runbooks/DB_V1_TO_V2_DATA_MOVE_OPTION_B.md');

console.error('\nTO DUMP v1 DATA (read-only):');
console.error('  npm run db:v2:dump:v1:dev:snapshot   # Dump v1 dev');
console.error('  npm run db:v2:dump:v1:prod:snapshot  # Dump v1 prod');

console.error('\n' + '═'.repeat(70) + '\n');

process.exit(1);
