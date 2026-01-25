/**
 * Quick script to check what users exist in tenant #4
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Checking users in tenant #4...\n');

  const memberships = await db.tenantMembership.findMany({
    where: { tenantId: 4 },
    include: {
      user: true,
    },
  });

  console.log(`Found ${memberships.length} users in tenant #4:\n`);

  memberships.forEach((m) => {
    console.log(`- ${m.user.email} (${m.user.firstName} ${m.user.lastName}) - Role: ${m.role}`);
  });

  await db.$disconnect();
}

main();
