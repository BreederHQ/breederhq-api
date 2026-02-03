import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function query() {
  try {
    const listings = await prisma.mktListingService.findMany({
      where: {
        status: 'LIVE',
        deletedAt: null
      },
      select: {
        id: true,
        title: true,
        status: true,
        publishedAt: true,
        sourceType: true,
        providerId: true,
        tenantId: true,
        provider: {
          select: {
            id: true,
            businessName: true
          }
        },
        tenant: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { id: 'desc' }
    });

    console.log('\nLIVE Marketplace Service Listings (Unified):');
    console.log('============================================\n');

    listings.forEach(l => {
      const isProvider = l.sourceType === 'PROVIDER';
      const sourceName = isProvider
        ? l.provider?.businessName || 'N/A'
        : l.tenant?.name || 'N/A';
      const sourceId = isProvider ? l.providerId : l.tenantId;

      console.log(`ID: ${l.id}`);
      console.log(`Title: ${l.title}`);
      console.log(`Source: ${l.sourceType}`);
      console.log(`${isProvider ? 'Provider' : 'Breeder'}: ${sourceName} (ID: ${sourceId})`);
      console.log(`Published: ${l.publishedAt}`);
      console.log('---');
    });

    console.log(`\nTotal LIVE listings: ${listings.length}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

query();
