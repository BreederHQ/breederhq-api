/**
 * List parties in tenant 4
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listParties() {
  const tenantId = 4;

  const parties = await prisma.party.findMany({
    where: { tenantId },
    take: 5,
    select: {
      id: true,
      type: true,
      name: true,
      email: true,
    },
  });

  console.log(`\nFound ${parties.length} parties in tenant ${tenantId}:\n`);
  parties.forEach((p) => {
    console.log(`  ID: ${p.id}, Type: ${p.type}, Name: ${p.name}, Email: ${p.email}`);
  });

  await prisma.$disconnect();
}

listParties().catch(console.error);
