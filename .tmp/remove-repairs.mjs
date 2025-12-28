import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeRepairMigrations() {
  try {
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM _prisma_migrations WHERE migration_name IN (
        '20251014074659_drop_old_breed_table',
        '20251014080000_replay_repair_pre_change',
        '20251014171258_replay_repair_pre_custom_breed'
      ) RETURNING migration_name`
    );

    console.log(`Removed repair migrations from database`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

removeRepairMigrations();
