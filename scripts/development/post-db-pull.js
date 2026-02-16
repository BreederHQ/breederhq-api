#!/usr/bin/env node

/**
 * Post-DB-Pull Cleanup
 *
 * Runs after `prisma db pull` to remove dbmate's schema_migrations table
 * from the Prisma schema. This table is managed by dbmate, not Prisma.
 *
 * Usage: node scripts/development/post-db-pull.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const SCHEMA_PATH = resolve(process.cwd(), 'prisma/schema.prisma');

const content = readFileSync(SCHEMA_PATH, 'utf-8');

// Remove the schema_migrations model block that dbmate creates
// Pattern: model schema_migrations { ... }
const cleaned = content.replace(
  /\n*model schema_migrations \{[^}]*\}\n*/g,
  '\n'
);

if (cleaned !== content) {
  writeFileSync(SCHEMA_PATH, cleaned, 'utf-8');
  console.log('✓ Removed schema_migrations model from schema.prisma');
} else {
  console.log('ℹ No schema_migrations model found in schema.prisma (already clean)');
}
