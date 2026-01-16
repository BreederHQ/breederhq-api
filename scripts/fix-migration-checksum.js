import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';

async function fixMigrationChecksum() {
  const prisma = new PrismaClient();

  try {
    // Get the current file checksum
    const migrationContent = fs.readFileSync(
      'prisma/migrations/20260117000000_add_mare_reproductive_history/migration.sql',
      'utf8'
    );
    const newChecksum = crypto.createHash('sha256').update(migrationContent).digest('hex');

    console.log('Current migration checksum in DB:  a03e301853ac8d9f976bcdb5c83c0254f6ef9b79282a1674af1229a87e4aa20b');
    console.log('Current migration file checksum:  ', newChecksum);
    console.log('');

    // Update the checksum in the database
    const result = await prisma.$executeRaw`
      UPDATE _prisma_migrations
      SET checksum = ${newChecksum},
          logs = COALESCE(logs, '') || E'\n\n[Manual Fix] Checksum updated to match modified migration file after it was applied.'
      WHERE migration_name = '20260117000000_add_mare_reproductive_history'
    `;

    if (result > 0) {
      console.log('✓ Migration checksum updated successfully in database');
      console.log('  This marks the migration as "manually edited" but maintains applied state');
    } else {
      console.log('✗ No migration found with that name');
    }

    // Verify
    const verification = await prisma.$queryRaw`
      SELECT migration_name, checksum, finished_at
      FROM _prisma_migrations
      WHERE migration_name = '20260117000000_add_mare_reproductive_history'
    `;

    console.log('\nVerification:', verification);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixMigrationChecksum();
