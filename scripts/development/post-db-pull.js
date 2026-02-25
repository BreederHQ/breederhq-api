#!/usr/bin/env node

/**
 * Post-DB-Pull Cleanup
 *
 * Runs after `prisma db pull` to fix known issues in the introspected schema.
 * Each fix addresses a mismatch between what the DB produces and what Prisma validates.
 *
 * Current fixes:
 *   1. Remove dbmate's schema_migrations table (managed by dbmate, not Prisma)
 *   2. Fix @@unique field order to match @relation field order (Prisma one-to-one validation)
 *   3. Add @@ignore to models with DB-level comments (suppresses Prisma migration warnings)
 *
 * Usage: node scripts/development/post-db-pull.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const SCHEMA_PATH = resolve(process.cwd(), 'prisma/schema.prisma');

let content = readFileSync(SCHEMA_PATH, 'utf-8');
const original = content;
const fixes = [];

// ── Fix 1: Remove the schema_migrations model block that dbmate creates ──
content = content.replace(
  /\n*model schema_migrations \{[^}]*\}\n*/g,
  '\n'
);
if (content !== original) {
  fixes.push('Removed schema_migrations model');
}

// ── Fix 2: Align @@unique field order with @relation field order ──────────
// Prisma requires that one-to-one relations have a @@unique whose field order
// matches the @relation(fields: [...]) order. `prisma db pull` introspects
// the unique constraint in DB catalog order (often [tenantId, X]) while the
// relation fields may be [X, tenantId]. This causes P1012 validation errors.
//
// Strategy: For every @relation with compound fields, find any @@unique in the
// same model that contains exactly the same fields but in different order, and
// reorder the @@unique to match.

const modelBlockRegex = /model\s+\w+\s*\{[^}]*\}/g;
content = content.replace(modelBlockRegex, (modelBlock) => {
  // Extract all compound @relation field lists in this model
  const relationRegex = /@relation\(fields:\s*\[([^\]]+)\]/g;
  const relations = [];
  let match;
  while ((match = relationRegex.exec(modelBlock)) !== null) {
    const fields = match[1].split(',').map(f => f.trim());
    if (fields.length > 1) {
      relations.push(fields);
    }
  }
  if (relations.length === 0) return modelBlock;

  let patched = modelBlock;
  for (const relFields of relations) {
    const relSet = new Set(relFields);

    // Find @@unique constraints with same fields in different order
    const uniqueRegex = /@@unique\(\[([^\]]+)\]([^)]*)\)/g;
    patched = patched.replace(uniqueRegex, (uniqueMatch, fieldListStr, rest) => {
      const uniqueFields = fieldListStr.split(',').map(f => f.trim());
      if (uniqueFields.length !== relFields.length) return uniqueMatch;

      const sameFields = uniqueFields.length === relSet.size &&
        uniqueFields.every(f => relSet.has(f));

      if (!sameFields) return uniqueMatch;

      // Already in the right order?
      if (uniqueFields.every((f, i) => f === relFields[i])) return uniqueMatch;

      fixes.push(`Reordered @@unique([${uniqueFields.join(', ')}]) → [${relFields.join(', ')}]`);
      return `@@unique([${relFields.join(', ')}]${rest})`;
    });
  }
  return patched;
});

// ── Fix 3: Add @@ignore to models Prisma can't fully support ──────────────
// Reasons a model may need @@ignore:
//   • DB-level COMMENT ON TABLE/COLUMN metadata (entity_activity, entity_audit_log)
//   • Unsupported column types like pgvector (HelpArticleEmbedding)
// Since we use dbmate (not Prisma Migrate), these warnings are irrelevant.
// @@ignore silences them. The tables remain fully usable via $queryRaw
// and $executeRawUnsafe — only the generated Prisma Client types are skipped.
const MODELS_TO_IGNORE = ['entity_activity', 'entity_audit_log', 'HelpArticleEmbedding'];

for (const modelName of MODELS_TO_IGNORE) {
  const modelPattern = new RegExp(`(model ${modelName}\\s*\\{)([\\s\\S]*?)(\\n\\})`);
  content = content.replace(modelPattern, (match, open, body, close) => {
    if (body.includes('@@ignore')) return match;
    fixes.push(`Added @@ignore to ${modelName} (suppresses DB comment warning)`);
    return `${open}${body}\n\n  @@ignore${close}`;
  });
}

// ── Write & report ───────────────────────────────────────────────────────
if (content !== original) {
  writeFileSync(SCHEMA_PATH, content, 'utf-8');
  for (const fix of fixes) {
    console.log(`✓ ${fix}`);
  }
} else {
  console.log('ℹ Schema already clean — no post-pull fixes needed');
}
