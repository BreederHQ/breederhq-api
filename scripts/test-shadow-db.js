import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import { readdir } from 'fs/promises';

async function testShadowDb() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Shadow DB Readiness Check\n');

    // Get all migrations from filesystem
    const migrationsDir = 'prisma/migrations';
    const migrationFolders = (await readdir(migrationsDir, { withFileTypes: true }))
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .filter(n => !n.startsWith('DRAFT_'))
      .sort();

    console.log(`Found ${migrationFolders.length} migration folders\n`);

    // Get all migrations from database
    const dbMigrations = await prisma.$queryRaw`
      SELECT migration_name, checksum
      FROM _prisma_migrations
      ORDER BY finished_at
    `;

    console.log(`Found ${dbMigrations.length} migrations in database\n`);

    // Verify checksums match
    let mismatches = 0;
    for (const dbMig of dbMigrations) {
      const migFile = `${migrationsDir}/${dbMig.migration_name}/migration.sql`;
      if (fs.existsSync(migFile)) {
        const content = fs.readFileSync(migFile, 'utf8');
        const fileChecksum = crypto.createHash('sha256').update(content).digest('hex');

        if (fileChecksum !== dbMig.checksum) {
          console.log(`❌ Checksum mismatch: ${dbMig.migration_name}`);
          console.log(`   DB:   ${dbMig.checksum}`);
          console.log(`   File: ${fileChecksum}\n`);
          mismatches++;
        }
      }
    }

    if (mismatches === 0) {
      console.log('✅ All migration checksums match between files and database');
      console.log('✅ Shadow DB should work correctly for future migrations');
      console.log('✅ You can proceed with `prisma migrate dev` safely\n');
    } else {
      console.log(`❌ Found ${mismatches} checksum mismatches`);
      console.log('⚠️  Run the fix-migration-checksum.js script to resolve\n');
      process.exit(1);
    }

  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testShadowDb();
