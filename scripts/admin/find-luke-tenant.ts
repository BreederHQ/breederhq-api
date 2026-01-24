import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'luke.skywalker@tester.com' },
    select: { 
      id: true,
      email: true,
      defaultTenantId: true
    }
  });
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  console.log('User:', user);
  
  if (user.defaultTenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.defaultTenantId },
      select: { id: true, name: true, slug: true }
    });
    console.log('Tenant:', tenant);
  }
}

main().finally(() => prisma.$disconnect());
