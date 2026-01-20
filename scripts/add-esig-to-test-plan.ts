import '../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find the E2E Test Plan product
  const testPlan = await prisma.product.findFirst({
    where: { name: 'E2E Test Plan (Unlimited)' },
  });

  if (!testPlan) {
    console.log('❌ E2E Test Plan product not found');
    return;
  }

  console.log('Found product:', testPlan.name, '(ID:', testPlan.id + ')');

  // Add E_SIGNATURES entitlement if not exists
  const existing = await prisma.productEntitlement.findUnique({
    where: {
      productId_entitlementKey: {
        productId: testPlan.id,
        entitlementKey: 'E_SIGNATURES',
      },
    },
  });

  if (existing) {
    console.log('✓ E_SIGNATURES entitlement already exists');
    return;
  }

  await prisma.productEntitlement.create({
    data: {
      productId: testPlan.id,
      entitlementKey: 'E_SIGNATURES',
      limitValue: null, // unlimited
    },
  });

  console.log('✓ Added E_SIGNATURES entitlement to E2E Test Plan');
}

main().finally(() => prisma.$disconnect());
