import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const sub = await prisma.subscription.findFirst({
  where: { tenant: { slug: 'kvs-demo' } },
  include: {
    product: {
      include: { entitlements: { select: { entitlementKey: true, limitValue: true } } },
    },
  },
});

if (!sub) { console.log('No subscription found for kvs-demo'); process.exit(1); }

console.log(`Tenant:  ${sub.tenantId}`);
console.log(`Product: ${sub.product.name}`);
console.log(`Status:  ${sub.status}`);
console.log(`Entitlements (${sub.product.entitlements.length}):`);
for (const e of sub.product.entitlements) {
  const hasAi = e.entitlementKey === 'AI_ASSISTANT';
  console.log(`  ${hasAi ? '⭐' : '  '} ${e.entitlementKey} → ${e.limitValue ?? 'unlimited'}`);
}
await prisma.$disconnect();
