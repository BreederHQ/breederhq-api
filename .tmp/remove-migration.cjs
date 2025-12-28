const { Client } = require('pg');

async function removeMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const result = await client.query(
      `DELETE FROM _prisma_migrations WHERE migration_name = $1 RETURNING *`,
      ['20251014074659_baseline_repair_complete_schema']
    );

    if (result.rowCount > 0) {
      console.log(`Removed migration: ${result.rows[0].migration_name}`);
    } else {
      console.log('Migration not found in database');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

removeMigration();
