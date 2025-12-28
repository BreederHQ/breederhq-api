#!/usr/bin/env node

/**
 * Prototype Mode Regression Check
 *
 * Prevents accidental reintroduction of:
 * - New migration files during prototype mode
 * - Unguarded prisma migrate commands in package.json
 * - Direct prisma db push usage outside prototype scripts
 *
 * Usage: node scripts/check-prototype-mode.js
 * Exit codes: 0 = pass, 1 = violations found
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

let violations = [];

// Check 1: No new migration directories after prototype mode began (2025-12-28)
const PROTOTYPE_MODE_START = '20251228'; // YYYYMMDD format
const migrationsDir = join(repoRoot, 'prisma', 'migrations');

if (existsSync(migrationsDir)) {
  const migrationDirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => /^\d{14}_/.test(name)); // Match timestamp_name format

  const newMigrations = migrationDirs.filter(name => {
    const timestamp = name.substring(0, 8); // Extract YYYYMMDD
    return timestamp >= PROTOTYPE_MODE_START;
  });

  if (newMigrations.length > 0) {
    violations.push({
      rule: 'No new migrations during prototype mode',
      details: `Found ${newMigrations.length} migration(s) created after ${PROTOTYPE_MODE_START}:`,
      files: newMigrations.map(m => `  - prisma/migrations/${m}`)
    });
  }
}

// Check 2: package.json scripts must not contain unguarded prisma commands
const packageJsonPath = join(repoRoot, 'package.json');
if (existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};

  const dangerousPatterns = [
    { pattern: /prisma migrate(?! status)/, message: '"prisma migrate" must go through prisma-guard.js (except status)' },
    { pattern: /prisma db push(?!.*prisma-guard\.js)/, message: '"prisma db push" must go through prisma-guard.js' },
    { pattern: /prisma db pull(?!.*prisma-guard\.js)/, message: '"prisma db pull" must go through prisma-guard.js' },
  ];

  for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
    // Skip prototype scripts (already validated by guard)
    if (scriptName.includes('proto')) continue;

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(scriptCommand)) {
        violations.push({
          rule: 'All Prisma commands must use prisma-guard.js',
          details: `Script "${scriptName}" has unguarded Prisma command`,
          files: [`  package.json: "${scriptName}": "${scriptCommand}"`, `  Violation: ${message}`]
        });
      }
    }
  }
}

// Check 3: Ensure PROTOTYPE_MODE.md exists at repo root
const prototypeModeFile = join(repoRoot, 'PROTOTYPE_MODE.md');
if (!existsSync(prototypeModeFile)) {
  violations.push({
    rule: 'PROTOTYPE_MODE.md must exist at repo root',
    details: 'Missing prototype mode documentation',
    files: ['  Expected: PROTOTYPE_MODE.md']
  });
}

// Report results
if (violations.length === 0) {
  console.log('✓ Prototype mode checks passed');
  console.log('  No new migrations found');
  console.log('  No unguarded Prisma commands in package.json');
  console.log('  PROTOTYPE_MODE.md exists\n');
  process.exit(0);
} else {
  console.error('\n❌ PROTOTYPE MODE VIOLATIONS DETECTED\n');

  violations.forEach((v, idx) => {
    console.error(`${idx + 1}. ${v.rule}`);
    console.error(`   ${v.details}`);
    v.files.forEach(f => console.error(f));
    console.error('');
  });

  console.error('Prototype mode is active. Migrations are FROZEN.');
  console.error('See: PROTOTYPE_MODE.md\n');

  process.exit(1);
}
