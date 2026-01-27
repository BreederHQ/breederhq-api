import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Check organizations for tenant 4 (Tatooine)
  const orgs = await prisma.organization.findMany({
    where: { tenantId: 4 },
    select: {
      id: true,
      name: true,
      partyId: true,
      party: {
        select: { id: true, type: true }
      }
    }
  });

  console.log('Organizations for tenant 4 (Tatooine):\n');
  for (const org of orgs) {
    const partyStatus = org.partyId ? `✓ Party ID: ${org.partyId}` : '✗ NO PARTY';
    console.log(`  Org ID: ${org.id} | ${org.name} | ${partyStatus}`);
  }

  // Also check all validation tenants
  console.log('\n\nAll validation tenant organizations:\n');
  const allOrgs = await prisma.organization.findMany({
    where: {
      tenant: {
        OR: [
          { slug: { startsWith: 'dev-' } },
          { slug: { startsWith: 'prod-' } },
          { slug: 'tattoine-cuddly-buggers' }
        ]
      }
    },
    include: {
      tenant: { select: { id: true, name: true, slug: true } }
    },
    orderBy: { tenantId: 'asc' }
  });

  for (const org of allOrgs) {
    const partyStatus = org.partyId ? `✓ ${org.partyId}` : '✗ NULL';
    console.log(`  Tenant ${org.tenant.id} (${org.tenant.slug}) | Org: ${org.name.padEnd(30)} | partyId: ${partyStatus}`);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
