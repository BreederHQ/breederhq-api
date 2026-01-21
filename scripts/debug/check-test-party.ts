import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check for existing party
  const party = await prisma.party.findFirst({
    where: { tenantId: 4 }
  });

  if (party) {
    console.log(`Found party: ${party.id} - ${party.name}`);
    process.exit(0);
  }

  // Create test party if none exists
  const newParty = await prisma.party.create({
    data: {
      tenantId: 4,
      name: 'E2E Test Buyer',
      type: 'PERSON',
    }
  });

  console.log(`Created test party: ${newParty.id} - ${newParty.name}`);
  process.exit(0);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
