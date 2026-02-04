#!/usr/bin/env node
/**
 * Fix migration checksum after editing an already-applied migration.
 *
 * When a migration SQL file is modified after being applied, Prisma detects
 * a checksum mismatch and demands a full database reset. This script safely
 * updates the checksum record without touching any data.
 *
 * Usage:
 *   node scripts/development/fix-migration-checksum.mjs <migration_name>
 *
 * Example:
 *   node scripts/development/fix-migration-checksum.mjs 20260204161949_remove_stallion_booking
 */

import { spawn as nodeSpawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const migrationName = process.argv[2];

if (!migrationName) {
  console.error('\n❌ Usage: node scripts/development/fix-migration-checksum.mjs <migration_name>');
  console.error('   Example: node scripts/development/fix-migration-checksum.mjs 20260204161949_remove_stallion_booking\n');
  process.exit(1);
}

// Verify migration exists
const migrationDir = resolve('prisma/migrations', migrationName);
const migrationFile = resolve(migrationDir, 'migration.sql');

if (!existsSync(migrationFile)) {
  console.error(`\n❌ Migration not found: ${migrationFile}`);
  console.error('   Check the migration name and make sure you are in the breederhq-api directory.\n');
  process.exit(1);
}

// Parse .env file
function parseEnvFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

// Run a command, optionally piping input to stdin
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = nodeSpawn(command, args, {
      env: options.env || process.env,
      shell: true,
      stdio: options.input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    });
    if (options.input) {
      proc.stdin.write(options.input);
      proc.stdin.end();
    }
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

async function main() {
  const envPath = resolve('.env.dev.migrate');
  if (!existsSync(envPath)) {
    console.error('\n❌ .env.dev.migrate not found. Run this from the breederhq-api root.\n');
    process.exit(1);
  }

  const fileEnv = parseEnvFile(envPath);
  const env = { ...process.env, ...fileEnv };

  console.log(`\n🔧 Fixing checksum for migration: ${migrationName}`);
  console.log('━'.repeat(60));

  // Step 1: Delete the stale migration record
  console.log('\nStep 1: Removing stale migration record...');
  const deleteSql = `DELETE FROM "_prisma_migrations" WHERE migration_name = '${migrationName}';\n`;

  await run('npx', ['prisma', 'db', 'execute', '--stdin', '--schema=prisma/schema.prisma'], {
    env,
    input: deleteSql,
  });
  console.log('✓ Stale record removed');

  // Step 2: Re-resolve as applied (Prisma computes the correct checksum from the file)
  console.log('\nStep 2: Re-resolving migration with updated checksum...');
  await run('npx', ['prisma', 'migrate', 'resolve', '--applied', migrationName, '--schema=prisma/schema.prisma'], {
    env,
  });
  console.log('✓ Migration re-resolved with correct checksum');

  console.log('\n' + '━'.repeat(60));
  console.log('✅ Done! Now run: npm run db:dev:migrate\n');
}

main().catch((err) => {
  console.error(`\n❌ Failed: ${err.message}`);
  process.exit(1);
});
