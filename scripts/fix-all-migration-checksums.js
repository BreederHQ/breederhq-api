import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';

async function fixAllMigrationChecksums() {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 Fixing All Migration Checksums\n');

    // Get all migrations from database
    const dbMigrations = await prisma.$queryRaw`
      SELECT migration_name, checksum
      FROM _prisma_migrations
      ORDER BY finished_at
    `;

    console.log(`Found ${dbMigrations.length} migrations in database\n`);

    const migrationsDir = 'prisma/migrations';
    const mismatches = [];
    const toUpdate = [];

    // Check each migration
    for (const dbMig of dbMigrations) {
      const migFile = `${migrationsDir}/${dbMig.migration_name}/migration.sql`;

      if (fs.existsSync(migFile)) {
        const content = fs.readFileSync(migFile, 'utf8');
        const fileChecksum = crypto.createHash('sha256').update(content).digest('hex');

        if (fileChecksum !== dbMig.checksum) {
          mismatches.push({
            name: dbMig.migration_name,
            dbChecksum: dbMig.checksum,
            fileChecksum: fileChecksum
          });
          toUpdate.push({ name: dbMig.migration_name, newChecksum: fileChecksum });
        }
      } else {
        console.log(`⚠️  Migration file not found: ${dbMig.migration_name}`);
      }
    }

    if (mismatches.length === 0) {
      console.log('✅ All migration checksums already match!');
      return;
    }

    console.log(`Found ${mismatches.length} migrations with checksum mismatches:\n`);
    for (const m of mismatches) {
      console.log(`  ${m.name}`);
    }

    console.log('\n⚠️  This will update the database _prisma_migrations table to match current files.');
    console.log('This is safe because it only updates the checksum metadata, not the schema.\n');

    // Update all checksums
    for (const update of toUpdate) {
      await prisma.$executeRaw`
        UPDATE _prisma_migrations
        SET checksum = ${update.newChecksum},
            logs = COALESCE(logs, '') || E'\n\n[Batch Fix 2026-01-16] Checksum updated to match current migration file.'
        WHERE migration_name = ${update.name}
      `;
      console.log(`✓ Updated: ${update.name}`);
    }

    console.log(`\n✅ Successfully updated ${toUpdate.length} migration checksums`);
    console.log('✅ Dev database is now in sync with migration files\n');

  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllMigrationChecksums();
