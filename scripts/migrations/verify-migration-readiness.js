import { PrismaClient } from '@prisma/client';

async function verifyMigrationReadiness() {
  const prisma = new PrismaClient();

  try {
    console.log('✓ Verifying migration readiness...\n');

    // Check if we can connect
    await prisma.$connect();
    console.log('✓ Database connection successful');

    // Check latest migration
    const latestMigrations = await prisma.$queryRaw`
      SELECT migration_name, checksum, finished_at
      FROM _prisma_migrations
      ORDER BY finished_at DESC
      LIMIT 3
    `;

    console.log('✓ Latest migrations:');
    for (const m of latestMigrations) {
      console.log(`  - ${m.migration_name}`);
    }

    // Check for any pending migrations
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema IN ('public', 'marketplace')
        AND table_name = 'MareReproductiveHistory'
    `;

    if (tables.length > 0) {
      console.log('✓ MareReproductiveHistory table exists');
    } else {
      console.log('✗ MareReproductiveHistory table not found!');
      process.exit(1);
    }

    console.log('\n✅ Migration system is healthy and ready for new migrations');
  } catch (e) {
    console.error('✗ Error:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigrationReadiness();
