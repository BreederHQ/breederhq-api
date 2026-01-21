import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, defaultTenantId: true },
    take: 20
  });
  console.log('Users:');
  users.forEach(u => console.log(`  ${u.email} -> tenantId: ${u.defaultTenantId}`));
  
  console.log('\nTenants:');
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true },
    take: 20
  });
  tenants.forEach(t => console.log(`  ID ${t.id}: ${t.name} (${t.slug})`));
}

main().finally(() => prisma.$disconnect());
