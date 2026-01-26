import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Get validation tenants
  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { slug: { startsWith: 'dev-' } },
        { slug: { startsWith: 'prod-' } }
      ]
    },
    select: { id: true, slug: true, name: true }
  });

  console.log('=== Validation Tenants ===');
  for (const t of tenants) {
    console.log(`\n[${t.slug}] (ID: ${t.id})`);

    // Check MarketplaceProvider for this tenant
    const provider = await prisma.marketplaceProvider.findFirst({
      where: { tenantId: t.id }
    });
    if (provider) {
      console.log(`  Provider: ${provider.businessName} | status: ${provider.status}`);
    } else {
      console.log(`  Provider: NONE`);
    }

    // Check breeding programs for this tenant
    const programs = await prisma.mktListingBreedingProgram.findMany({
      where: { tenantId: t.id },
      select: { name: true, status: true, slug: true }
    });
    if (programs.length > 0) {
      console.log(`  Programs:`);
      for (const p of programs) {
        console.log(`    - ${p.name} | status: ${p.status}`);
      }
    } else {
      console.log(`  Programs: NONE`);
    }
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
