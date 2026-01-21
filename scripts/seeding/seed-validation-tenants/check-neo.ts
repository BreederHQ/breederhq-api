// Quick script to check Neo's user and tenant membership
import { PrismaClient } from '@prisma/client';
import '../../prisma/seed/seed-env-bootstrap';

const prisma = new PrismaClient();

async function main() {
  // Find Neo's user
  const neo = await prisma.user.findUnique({
    where: { email: 'neo.prod@zion.local' },
  });

  console.log('Neo user ID:', neo?.id);

  // Find memberships separately using TenantMembership
  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: neo?.id },
    include: { tenant: true }
  });

  console.log('Memberships:');
  memberships.forEach(m => {
    console.log(`  - tenantId: ${m.tenantId} | tenant: ${m.tenant.name} | role: ${m.role}`);
  });

  // Also check if the tenant has the right ID
  const zion = await prisma.tenant.findFirst({
    where: { slug: 'prod-zion' }
  });
  console.log('\nZion tenant ID:', zion?.id);
  console.log('Zion tenant name:', zion?.name);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
