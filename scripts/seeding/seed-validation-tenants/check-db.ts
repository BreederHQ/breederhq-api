import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const result = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  console.log('Connected to database:', result[0]?.current_database);

  // Also show the DATABASE_URL host (masked)
  const dbUrl = process.env.DATABASE_URL || '';
  const match = dbUrl.match(/@([^:\/]+)/);
  console.log('Database host:', match ? match[1] : 'unknown');
}

check().catch(console.error).finally(() => prisma.$disconnect());
