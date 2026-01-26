import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Get one active provider with all fields to see what might be missing
  const provider = await prisma.marketplaceProvider.findFirst({
    where: {
      status: 'active',
      businessName: 'Rivendell Breeders'
    }
  });
  console.log('Rivendell Provider:');
  console.log(JSON.stringify(provider, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 2));

  // Also check programs
  const programs = await prisma.mktListingBreedingProgram.findMany({
    where: {
      tenantId: provider?.tenantId ?? undefined,
      status: 'LIVE'
    }
  });
  console.log('\nPrograms for this tenant:');
  console.log(JSON.stringify(programs, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
