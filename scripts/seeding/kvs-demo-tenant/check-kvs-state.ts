import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const user = await (prisma as any).user.findUnique({ 
    where: { email: 'demo-kvs@breederhq.com' }, 
    select: { id: true, defaultTenantId: true, email: true } 
  });
  console.log('USER:', JSON.stringify(user));

  if (user) {
    const mem = await (prisma as any).tenantMembership.findMany({ 
      where: { userId: user.id }, 
      select: { tenantId: true, membershipRole: true, membershipStatus: true } 
    });
    console.log('MEMBERSHIPS:', JSON.stringify(mem));
    
    const subs = await (prisma as any).subscription.findMany({ 
      where: { tenantId: user.defaultTenantId ?? 0 }, 
      include: { product: { select: { name: true, entitlements: { select: { entitlementKey: true } } } } } 
    });
    console.log('SUBSCRIPTION COUNT:', subs.length);
    if (subs.length > 0) {
      const s = subs[0];
      console.log('STATUS:', s.status, '| TENANT_ID:', s.tenantId);
      console.log('PRODUCT:', s.product?.name);
      const keys = s.product?.entitlements?.map((e: any) => e.entitlementKey) ?? [];
      console.log('HAS_AI_ASSISTANT:', keys.includes('AI_ASSISTANT'));
    }
  }
  await prisma.$disconnect();
}

check().catch(console.error);
