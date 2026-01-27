import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Find ALL tenants with their email slugs
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      inboundEmailSlug: true
    },
    orderBy: { id: 'asc' }
  });

  console.log('All tenants with inboundEmailSlug status:\n');
  for (const t of tenants) {
    const status = t.inboundEmailSlug ? `✓ ${t.inboundEmailSlug}` : '✗ NULL';
    console.log(`  ID: ${t.id.toString().padStart(3)} | ${t.name.padEnd(35)} | slug: ${(t.slug || 'NULL').padEnd(30)} | email: ${status}`);
  }

  // Count
  const withSlug = tenants.filter(t => t.inboundEmailSlug).length;
  const withoutSlug = tenants.filter(t => !t.inboundEmailSlug).length;
  console.log(`\nSummary: ${withSlug} with email slug, ${withoutSlug} without`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
