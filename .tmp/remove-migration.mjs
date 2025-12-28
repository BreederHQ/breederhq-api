import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeMigration() {
  try {
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM _prisma_migrations WHERE migration_name = '20251014074659_baseline_repair_complete_schema' RETURNING *`
    );

    console.log(`Removed ${result} migration record(s)`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

removeMigration();
