import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const user = await (prisma as any).user.findFirst({
  where: { email: 'demo-kvs@breederhq.com' },
  select: { id: true, email: true, defaultTenantId: true, tenantMemberships: { select: { tenantId: true } } },
});

console.log('User:', JSON.stringify(user, null, 2));

// Find current kvs-demo tenant
const tenant = await prisma.tenant.findFirst({ where: { slug: 'kvs-demo' }, select: { id: true, slug: true } });
console.log('Current tenant:', JSON.stringify(tenant));

await prisma.$disconnect();
