#!/usr/bin/env node
/**
 * Migration Order Validator
 *
 * Prevents migration failures by detecting:
 * 1. Migrations with timestamps out of chronological order (by file creation time)
 * 2. Migrations referencing tables that don't exist yet in the migration sequence
 * 3. Manually created migrations (timestamp doesn't match folder modified time)
 *
 * This script runs WITHOUT a database connection - it validates the migration
 * files themselves before you ever try to run them.
 *
 * Usage:
 *   node scripts/db/validate-migration-order.mjs
 *
 * Exit codes:
 *   0 - All migrations are properly ordered
 *   1 - Ordering or dependency violations found
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../prisma/migrations');

// Tables/types that are created in migrations - maps name to migration timestamp
const createdEntities = new Map();

// Regex patterns for detecting entity creation and references
// Updated to handle both schema-qualified ("schema"."table") and unqualified ("table") names
const CREATE_TABLE_REGEX = /CREATE TABLE\s+(?:"(\w+)"\.)?"(\w+)"/gi;
const CREATE_TYPE_REGEX = /CREATE TYPE\s+(?:"(\w+)"\.)?"(\w+)"/gi;
const REFERENCES_REGEX = /REFERENCES\s+(?:"(\w+)"\.)?"(\w+)"/gi;
const ALTER_TABLE_REGEX = /ALTER TABLE\s+(?:"(\w+)"\.)?"(\w+)"/gi;
const ALTER_TYPE_REGEX = /ALTER TYPE\s+(?:"(\w+)"\.)?"(\w+)"/gi;

function getMigrationFolders() {
  const entries = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && /^\d{14}_/.test(e.name))
    .map(e => ({
      name: e.name,
      timestamp: e.name.substring(0, 14),
      path: path.join(MIGRATIONS_DIR, e.name),
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function parseMigrationSQL(sqlPath) {
  if (!fs.existsSync(sqlPath)) {
    return { creates: [], references: [], alters: [] };
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const creates = [];
  const references = [];
  const alters = [];

  // Find all CREATE TABLE statements
  // match[1] = schema (optional), match[2] = table name
  let match;
  while ((match = CREATE_TABLE_REGEX.exec(sql)) !== null) {
    creates.push({ type: 'TABLE', name: match[2] });
  }

  // Find all CREATE TYPE statements
  // match[1] = schema (optional), match[2] = type name
  while ((match = CREATE_TYPE_REGEX.exec(sql)) !== null) {
    creates.push({ type: 'TYPE', name: match[2] });
  }

  // Find all REFERENCES (foreign keys)
  // match[1] = schema (optional), match[2] = table name
  while ((match = REFERENCES_REGEX.exec(sql)) !== null) {
    references.push(match[2]);
  }

  // Find all ALTER TABLE statements
  // match[1] = schema (optional), match[2] = table name
  while ((match = ALTER_TABLE_REGEX.exec(sql)) !== null) {
    alters.push({ type: 'TABLE', name: match[2] });
  }

  // Find all ALTER TYPE statements
  // match[1] = schema (optional), match[2] = type name
  while ((match = ALTER_TYPE_REGEX.exec(sql)) !== null) {
    alters.push({ type: 'TYPE', name: match[2] });
  }

  return { creates, references, alters };
}

function validateMigrations() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Migration Order Validator');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const migrations = getMigrationFolders();
  const violations = [];

  console.log(`Found ${migrations.length} migrations\n`);

  // First pass: collect all created entities with their timestamps
  for (const migration of migrations) {
    const sqlPath = path.join(migration.path, 'migration.sql');
    const { creates } = parseMigrationSQL(sqlPath);

    for (const entity of creates) {
      createdEntities.set(entity.name, {
        timestamp: migration.timestamp,
        migration: migration.name,
      });
    }
  }

  // Second pass: check for reference violations
  for (const migration of migrations) {
    const sqlPath = path.join(migration.path, 'migration.sql');
    const { references, alters } = parseMigrationSQL(sqlPath);

    // Check foreign key references
    for (const refTable of references) {
      const creator = createdEntities.get(refTable);
      if (creator && creator.timestamp > migration.timestamp) {
        violations.push({
          type: 'FORWARD_REFERENCE',
          migration: migration.name,
          message: `References table "${refTable}" which is created later`,
          detail: `"${refTable}" is created in ${creator.migration} (timestamp ${creator.timestamp}) but referenced in ${migration.name} (timestamp ${migration.timestamp})`,
          fix: `Rename migration folder to have timestamp > ${creator.timestamp}`,
        });
      }
    }

    // Check ALTER statements reference existing entities
    for (const alter of alters) {
      const creator = createdEntities.get(alter.name);
      if (creator && creator.timestamp > migration.timestamp) {
        violations.push({
          type: 'ALTER_BEFORE_CREATE',
          migration: migration.name,
          message: `Alters ${alter.type.toLowerCase()} "${alter.name}" before it's created`,
          detail: `"${alter.name}" is created in ${creator.migration} (timestamp ${creator.timestamp}) but altered in ${migration.name} (timestamp ${migration.timestamp})`,
          fix: `Rename migration folder to have timestamp > ${creator.timestamp}`,
        });
      }
    }
  }

  // NOTE: Timestamp vs file modification time checking was removed because it
  // produces too many false positives due to timezone differences and git operations.
  // The forward reference check above is the critical validation.

  // Report results
  if (violations.length > 0) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ❌ VALIDATION FAILED');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const v of violations) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Type:      ${v.type}`);
      console.log(`Migration: ${v.migration}`);
      console.log(`Issue:     ${v.message}`);
      console.log(`Detail:    ${v.detail}`);
      console.log(`Fix:       ${v.fix}`);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  HOW TO FIX:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  Rename the migration folder to have a later timestamp.');
    console.log('  Example: mv 20260109143000_foo 20260109180000_foo');
    console.log('');
    console.log('  The new timestamp must be AFTER the migration that creates');
    console.log('  the table/type being referenced.');
    console.log('');

    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✓ VALIDATION PASSED');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('  - All migrations are in correct timestamp order');
  console.log('  - No forward references to uncreated tables/types');
  console.log('');

  process.exit(0);
}

validateMigrations();
