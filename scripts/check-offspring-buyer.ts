/**
 * Check if offspring has buyerPartyId set
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOffspring() {
  const ids = [293, 294];

  for (const id of ids) {
    const offspring = await prisma.offspring.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        buyerPartyId: true,
        placementState: true,
        financialState: true,
        contractId: true,
        placedAt: true,
        paidInFullAt: true,
        depositCents: true,
        lifeState: true,
        promotedAnimalId: true,
      },
    });

    console.log(`\nOffspring ${id}:`);
    if (offspring) {
      console.log(JSON.stringify(offspring, null, 2));
    } else {
      console.log("  NOT FOUND");
    }
  }

  await prisma.$disconnect();
}

checkOffspring().catch(console.error);
