import { db } from './src/db';

async function findPaintedLady() {
  const result = await db.query(
    "SELECT id, name, breed, species FROM animals WHERE name ILIKE '%Painted Lady%' LIMIT 5"
  );
  console.log(JSON.stringify(result.rows, null, 2));
  process.exit(0);
}

findPaintedLady().catch(console.error);
