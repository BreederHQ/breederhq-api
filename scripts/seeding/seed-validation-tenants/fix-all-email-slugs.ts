import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
import { assignUniqueSlug } from '../../../src/services/inbound-email-service.js';

const prisma = new PrismaClient();

async function fixAllEmailSlugs() {
  console.log('Finding ALL tenants missing inboundEmailSlug...\n');

  const tenantsWithoutSlug = await prisma.tenant.findMany({
    where: { inboundEmailSlug: null },
    select: { id: true, name: true, slug: true }
  });

  console.log(`Found ${tenantsWithoutSlug.length} tenants missing inboundEmailSlug:\n`);

  for (const tenant of tenantsWithoutSlug) {
    console.log(`  Tenant ${tenant.id}: ${tenant.name} (slug: ${tenant.slug || 'NULL'})`);
  }

  if (tenantsWithoutSlug.length === 0) {
    console.log('All tenants already have inboundEmailSlug!');
    return;
  }

  console.log('\nPopulating email slugs...\n');

  for (const tenant of tenantsWithoutSlug) {
    const inboundEmailSlug = await assignUniqueSlug(tenant.name, prisma);

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { inboundEmailSlug }
    });

    console.log(`  ✓ Tenant ${tenant.id} (${tenant.name}) -> ${inboundEmailSlug}@mail.breederhq.com`);
  }

  console.log('\nDone! All tenants now have inboundEmailSlug.');
}

fixAllEmailSlugs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
