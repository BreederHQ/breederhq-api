#!/usr/bin/env node

/**
 * Preflight Migration Check
 *
 * Validates migration SQL files before dbmate applies them.
 * Catches naming convention errors that would cause SQL failures.
 *
 * Primary check: public schema tables MUST be double-quoted PascalCase.
 *   Wrong:  FROM public.tenants         (unquoted, lowercase)
 *   Right:  FROM public."Tenant"        (quoted, PascalCase)
 *   Also:   FROM "public"."Tenant"      (also correct)
 *
 * Usage: node scripts/development/preflight-migration-check.js
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const MIGRATIONS_DIR = resolve(process.cwd(), 'db/migrations');
const SCHEMA_PATH = resolve(process.cwd(), 'prisma/schema.prisma');

// Skip the baseline — it's already applied and 27k lines
const BASELINE_FILENAME = '20260216185145_baseline.sql';

// ─── Parse prisma/schema.prisma to build table name registry ─────────────────

function buildTableRegistry(schemaPath) {
  const content = readFileSync(schemaPath, 'utf-8');
  const registry = {
    public: new Map(),      // lowercase → PascalCase (canonical name)
    marketplace: new Map(), // lowercase → snake_case (canonical name)
  };

  // Match model blocks: model ModelName { ... }
  const modelRegex = /^model\s+(\w+)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gm;
  let match;

  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1];
    const body = match[2];

    // Skip Prisma internal tracking model
    if (modelName === 'schema_migrations') continue;

    // Determine schema
    const schemaMatch = body.match(/@@schema\("(\w+)"\)/);
    const schema = schemaMatch ? schemaMatch[1] : 'public';

    // Actual table name (may be overridden by @@map)
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const tableName = mapMatch ? mapMatch[1] : modelName;

    if (schema === 'public') {
      registry.public.set(tableName.toLowerCase(), tableName);
    } else if (schema === 'marketplace') {
      registry.marketplace.set(tableName.toLowerCase(), tableName);
    }
  }

  return registry;
}

// ─── Validate a single migration file ────────────────────────────────────────

function validateFile(filename, filepath, registry) {
  const errors = [];
  const content = readFileSync(filepath, 'utf-8');

  // Strip SQL comments (-- line comments) to avoid false positives
  const sql = content.replace(/--[^\n]*/g, '');

  // Find all occurrences of:  public.word  or  public . word  (unquoted table after public schema)
  // This catches: FROM public.tenants, REFERENCES public.tenants, etc.
  // It does NOT catch: public."Tenant" (quoted, correct) or "public"."Tenant" (also correct)
  const UNQUOTED_PUBLIC_REF = /\bpublic\s*\.\s*([a-zA-Z_]\w*)(?!\s*")/g;

  let match;
  while ((match = UNQUOTED_PUBLIC_REF.exec(sql)) !== null) {
    const rawName = match[1];
    const lower = rawName.toLowerCase();

    // Only flag if this name matches a known public schema table
    if (registry.public.has(lower)) {
      const canonical = registry.public.get(lower);
      const lineNum = sql.slice(0, match.index).split('\n').length;

      // Get context: surrounding SQL fragment
      const contextStart = Math.max(0, match.index - 30);
      const contextEnd = Math.min(sql.length, match.index + match[0].length + 30);
      const context = sql.slice(contextStart, contextEnd).replace(/\s+/g, ' ').trim();

      errors.push({
        line: lineNum,
        found: `public.${rawName}`,
        expected: `public."${canonical}"`,
        context,
      });
    }
  }

  // Also catch: schema-unqualified unquoted references to known public tables
  // e.g.: FROM tenants (no schema prefix, no quotes) — also wrong for public tables
  // This is lower confidence so we only flag if it's clearly a known public table
  // and not inside a CREATE TABLE or type definition (where the name is being defined)
  const CREATE_PATTERN = /CREATE\s+(?:TABLE|TYPE|INDEX|SEQUENCE|FUNCTION)/gi;
  const createPositions = new Set();
  let cm;
  while ((cm = CREATE_PATTERN.exec(sql)) !== null) {
    // Mark the next ~80 chars after a CREATE statement as "defining" context
    for (let i = cm.index; i < Math.min(sql.length, cm.index + 80); i++) {
      createPositions.add(i);
    }
  }

  return errors;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(MIGRATIONS_DIR)) {
    console.log('✓ Preflight: No migrations directory found — skipping.');
    return;
  }

  if (!existsSync(SCHEMA_PATH)) {
    console.warn('⚠️  Preflight: prisma/schema.prisma not found — skipping table name validation.');
    console.warn('   Run "npm run db:pull" first to generate the schema file.');
    return;
  }

  // Get non-baseline migration files
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && /^\d{14}_/.test(f) && f !== BASELINE_FILENAME)
    .sort();

  if (files.length === 0) {
    console.log('✓ Preflight: No migrations to validate (only baseline exists).');
    return;
  }

  const registry = buildTableRegistry(SCHEMA_PATH);
  const publicTableCount = registry.public.size;
  const marketplaceTableCount = registry.marketplace.size;

  console.log(`\n🔍 Preflight: Validating ${files.length} migration file(s) against schema`);
  console.log(`   Registry: ${publicTableCount} public tables, ${marketplaceTableCount} marketplace tables`);

  const allErrors = [];

  for (const filename of files) {
    const filepath = join(MIGRATIONS_DIR, filename);
    const fileErrors = validateFile(filename, filepath, registry);

    for (const err of fileErrors) {
      allErrors.push({ filename, ...err });
    }
  }

  if (allErrors.length === 0) {
    console.log(`✓ Preflight: All ${files.length} migration(s) passed — no naming errors found.\n`);
    return;
  }

  // Report errors
  console.error(`\n${'═'.repeat(68)}`);
  console.error(`❌ PREFLIGHT FAILED — ${allErrors.length} table naming error(s) found`);
  console.error(`${'═'.repeat(68)}\n`);

  for (const err of allErrors) {
    console.error(`  File:     ${err.filename}`);
    console.error(`  Line:     ~${err.line}`);
    console.error(`  Found:    ${err.found}`);
    console.error(`  Expected: ${err.expected}`);
    console.error(`  Context:  ...${err.context}...`);
    console.error('');
  }

  console.error(`${'═'.repeat(68)}`);
  console.error('');
  console.error('Public schema tables MUST use double-quoted PascalCase:');
  console.error('  ❌  public.tenant, public.tenants, public.Tenant');
  console.error('  ✅  public."Tenant", "public"."Tenant"');
  console.error('');
  console.error('Known public schema tables:');

  const knownTables = [...registry.public.values()].sort();
  for (let i = 0; i < knownTables.length; i += 4) {
    const row = knownTables.slice(i, i + 4).map(t => `"${t}"`).join('  ');
    console.error(`  ${row}`);
  }

  console.error('');
  console.error('Fix the SQL in the migration file(s) above, then retry db:dev:sync.');
  console.error(`${'═'.repeat(68)}\n`);

  process.exit(1);
}

main();
