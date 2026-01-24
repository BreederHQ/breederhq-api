import { PrismaClient } from '@prisma/client';

async function checkMigrations() {
  const prisma = new PrismaClient();

  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, checksum, started_at, finished_at, applied_steps_count
      FROM _prisma_migrations
      ORDER BY finished_at DESC
      LIMIT 5
    `;

    console.log('Recent migrations:');
    console.log(JSON.stringify(migrations, null, 2));
  } catch (e) {
    console.error('Error checking migrations:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrations();
