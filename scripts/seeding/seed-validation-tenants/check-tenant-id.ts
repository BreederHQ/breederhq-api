import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const providers = await prisma.marketplaceProvider.findMany({
    where: { status: 'active' }
  });
  console.log('Active MarketplaceProviders:', providers.length);
  for (const p of providers) {
    console.log(`  ${p.businessName} | tenantId: ${p.tenantId} | active: ${p.activeListings} | total: ${p.totalListings}`);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
