import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  // Directly query what the API would query for tenant 101
  const tenantId = 101;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      inboundEmailSlug: true
    },
  });

  console.log('Tenant 101 query result:');
  console.log(JSON.stringify(tenant, null, 2));

  if (!tenant || !tenant.inboundEmailSlug) {
    console.log('\n❌ API would return 404 - not_found');
  } else {
    console.log('\n✓ API would return:');
    console.log({
      slug: tenant.inboundEmailSlug,
      email: `${tenant.inboundEmailSlug}@mail.breederhq.com`,
      isCustomized: false,
    });
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
