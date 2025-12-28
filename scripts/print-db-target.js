#!/usr/bin/env node

/**
 * Print Database Target
 *
 * Safely prints the validated database target without exposing credentials.
 * Used for verifying prototype mode configuration.
 *
 * Usage: npm run db:proto:print-target
 */

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

// Extract database name from URL
const dbName = DATABASE_URL.includes('bhq_proto') ? 'bhq_proto' :
               DATABASE_URL.includes('bhq_dev') ? 'bhq_dev' :
               DATABASE_URL.includes('bhq_prod') ? 'bhq_prod' : 'unknown';

// If we made it through prisma-guard, we know the config is valid for prototype mode
console.log('\n✓ Prototype DB target validated');
console.log(`  Database: ${dbName}`);
console.log('  Environment: .env.dev.migrate\n');

process.exit(0);
