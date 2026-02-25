import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const user = await (prisma as any).user.findUnique({
  where: { email: 'demo-kvs@breederhq.com' },
  select: { id: true, defaultTenantId: true },
});
console.log('User defaultTenantId:', user?.defaultTenantId);

const membership = await (prisma as any).tenantMembership.findFirst({
  where: { userId: user?.id },
  select: { tenantId: true, membershipRole: true, membershipStatus: true },
});
console.log('Membership:', JSON.stringify(membership));

const sub = await (prisma as any).subscription.findFirst({
  where: { tenantId: user?.defaultTenantId },
  include: {
    product: {
      include: { entitlements: { where: { entitlementKey: 'AI_ASSISTANT' } } },
    },
  },
});
console.log('Subscription status:', sub?.status);
console.log('AI_ASSISTANT:', sub?.product?.entitlements?.[0]?.entitlementKey ?? 'MISSING');

await prisma.$disconnect();
