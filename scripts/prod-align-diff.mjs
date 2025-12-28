#!/usr/bin/env node

/**
 * Production Schema Alignment - Diff Generator
 *
 * Generates SQL diff from prod database to current schema.prisma
 * Writes output to prisma_prod_align.sql in repo root.
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

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
  '--script'
];

const prisma = spawn('node', args, {
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: false,
  env: process.env
});

let output = '';

prisma.stdout.on('data', (data) => {
  output += data.toString();
});

prisma.on('exit', (code) => {
  if (code === 0) {
    // Remove guard output (everything before first SQL comment or command)
    const sqlOnly = output.replace(/^[\s\S]*?(?=-- |CREATE |ALTER |DROP )/m, '');
    writeFileSync('prisma_prod_align.sql', sqlOnly, 'utf8');
    console.log('\n✓ SQL diff written to prisma_prod_align.sql');
    console.log('⚠️  REVIEW THE FILE BEFORE APPLYING\n');
    process.exit(0);
  } else {
    console.error('❌ Diff generation failed');
    process.exit(code || 1);
  }
});

prisma.on('error', (err) => {
  console.error('Failed to run prisma migrate diff:', err);
  process.exit(1);
});
