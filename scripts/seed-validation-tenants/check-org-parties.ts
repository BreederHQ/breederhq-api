// Quick script to check organization partyIds
import { PrismaClient } from '@prisma/client';
import '../../prisma/seed/seed-env-bootstrap';

const prisma = new PrismaClient();

async function main() {
  const env = process.env.CHECK_ENV || 'dev';
  const prefix = env === 'prod' ? 'prod-' : 'dev-';

  const orgs = await prisma.organization.findMany({
    where: {
      tenant: {
        slug: { startsWith: prefix }
      }
    },
    include: { tenant: true },
    orderBy: [{ tenantId: 'asc' }, { name: 'asc' }]
  });

  console.log(`\n${env.toUpperCase()} Organizations and their partyId:\n`);
  for (const o of orgs) {
    const status = o.partyId ? `partyId: ${o.partyId}` : '*** MISSING partyId ***';
    console.log(`  ${o.tenant.name.padEnd(25)} | ${o.name.padEnd(35)} | ${status}`);
  }
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
