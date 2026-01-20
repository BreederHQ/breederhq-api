import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'luke.skywalker@tester.local' },
    include: { tenantMemberships: { include: { tenant: true } } }
  });
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  console.log('User:', user.email, 'ID:', user.id);
  console.log('Default Tenant ID:', user.defaultTenantId);
  console.log('Memberships:');
  user.tenantMemberships.forEach(m => {
    console.log(`  Tenant ${m.tenantId}: ${m.tenant.name} (role: ${m.role})`);
  });
}

main().finally(() => prisma.$disconnect());
