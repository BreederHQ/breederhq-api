import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixStats() {
  // Get all active providers
  const providers = await prisma.marketplaceProvider.findMany({
    where: { status: 'active' }
  });

  console.log(`Found ${providers.length} active providers`);

  for (const provider of providers) {
    // Count LIVE programs for this tenant
    const livePrograms = await prisma.mktListingBreedingProgram.count({
      where: {
        tenantId: provider.tenantId ?? undefined,
        status: 'LIVE'
      }
    });

    // Count all programs for this tenant
    const totalPrograms = await prisma.mktListingBreedingProgram.count({
      where: {
        tenantId: provider.tenantId ?? undefined
      }
    });

    if (livePrograms > 0 || totalPrograms > 0) {
      await prisma.marketplaceProvider.update({
        where: { id: provider.id },
        data: {
          activeListings: livePrograms,
          totalListings: totalPrograms
        }
      });
      console.log(`  Updated ${provider.businessName}: activeListings=${livePrograms}, totalListings=${totalPrograms}`);
    }
  }

  console.log('\nDone!');
}

fixStats().catch(console.error).finally(() => prisma.$disconnect());
