#!/usr/bin/env node

/**
 * One-time fix: Create dbmate's schema_migrations table and mark the
 * baseline as applied. Use after resetting a NeonDB branch to a
 * pre-dbmate snapshot.
 *
 * Usage: node scripts/development/run-with-env.js .env.dev.migrate node scripts/development/fix-baseline.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  // Create schema_migrations table if it doesn't exist (dbmate's tracking table)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version VARCHAR(128) PRIMARY KEY NOT NULL
    )
  `);
  console.log('✓ schema_migrations table ready');

  // Mark baseline as applied (tables already exist from Prisma era)
  await prisma.$executeRawUnsafe(
    "INSERT INTO public.schema_migrations (version) VALUES ('20260216185145') ON CONFLICT DO NOTHING"
  );
  console.log('✓ Baseline migration marked as applied');

  console.log('\nDone. Now run: npm run db:dev:sync');
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
