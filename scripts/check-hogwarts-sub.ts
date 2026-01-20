import '../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'dev-hogwarts' },
    include: {
      subscriptions: {
        include: {
          product: {
            include: { entitlements: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  console.log('Tenant:', tenant?.name, '(ID:', tenant?.id + ')');
  console.log('Subscriptions:');
  for (const sub of tenant?.subscriptions || []) {
    console.log('  -', sub.product.name, '(Status:', sub.status + ')');
    const hasESig = sub.product.entitlements.some(e => e.entitlementKey === 'E_SIGNATURES');
    console.log('    Has E_SIGNATURES:', hasESig);
    console.log('    Entitlements:', sub.product.entitlements.map(e => e.entitlementKey).join(', '));
  }
}
main().finally(() => prisma.$disconnect());
