#!/usr/bin/env node

/**
 * Production Schema Alignment - Verification
 *
 * Checks if prod database matches current schema.prisma
 * Exit code 0 = in sync, non-zero = out of sync or error
 */

import { spawn } from 'child_process';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

// Use --from-schema-datasource to read URL from schema.prisma env vars
// This avoids shell quoting issues with complex connection strings
const args = [
  'scripts/prisma-guard.js',
  '--',
  'prisma',
  'migrate',
  'diff',
  '--from-schema-datasource',
  'prisma/schema.prisma',
  '--to-schema-datamodel',
  'prisma/schema.prisma',
  '--exit-code'
];

const prisma = spawn('node', args, {
  stdio: 'inherit',
  shell: false,
  env: process.env
});

prisma.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✓ Production database is in sync with schema.prisma\n');
    process.exit(0);
  } else if (code === 2) {
    console.error('\n❌ Production database is OUT OF SYNC with schema.prisma');
    console.error('Run: npm run db:prod:align:diff to see differences\n');
    process.exit(1);
  } else {
    console.error('\n❌ Verification failed with error\n');
    process.exit(code || 1);
  }
});

prisma.on('error', (err) => {
  console.error('Failed to run prisma migrate diff:', err);
  process.exit(1);
});
