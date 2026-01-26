import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Check MarketplaceProvider records (no tenant relation)
  const providers = await prisma.marketplaceProvider.findMany();
  console.log('MarketplaceProviders count:', providers.length);
  providers.forEach(p => {
    console.log('- ' + p.businessName + ' | userId: ' + p.userId + ' | status: ' + p.status + ' | listed: ' + p.listed);
  });

  // Check breeding program listings with tenant
  const programs = await prisma.mktListingBreedingProgram.findMany({
    include: {
      tenant: { select: { slug: true } }
    }
  });
  console.log('\nBreeding Programs count:', programs.length);
  programs.forEach(p => {
    console.log('- ' + p.name + ' | tenant: ' + (p.tenant?.slug || 'null') + ' | status: ' + p.status + ' | listed: ' + p.listed);
  });

  // Check ServiceProviderProfile records (main storefront model)
  const serviceProviders = await prisma.serviceProviderProfile.findMany({
    include: {
      tenant: { select: { slug: true, name: true } }
    }
  });
  console.log('\nServiceProviderProfiles count:', serviceProviders.length);
  serviceProviders.forEach(sp => {
    console.log('- ' + sp.businessName + ' | tenant: ' + (sp.tenant?.slug || 'null') + ' | status: ' + sp.status + ' | listed: ' + sp.listed);
  });

  // Check validation tenant slugs
  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { slug: { startsWith: 'dev-' } },
        { slug: { startsWith: 'prod-' } }
      ]
    },
    select: { id: true, slug: true, name: true }
  });
  console.log('\nValidation Tenants:', tenants.length);
  tenants.forEach(t => console.log('- ' + t.slug + ' (ID: ' + t.id + ')'));
}

check().catch(console.error).finally(() => prisma.$disconnect());
