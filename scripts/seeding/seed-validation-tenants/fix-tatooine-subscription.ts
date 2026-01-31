import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient, SubscriptionStatus, BillingInterval } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  // Find Free Unlimited product
  const product = await prisma.product.findFirst({ where: { name: 'Free Unlimited' } });
  if (!product) {
    console.log('Product not found');
    return;
  }
  console.log(`Found product: ${product.name} (ID: ${product.id})`);

  // Check if Tatooine has subscription
  const existing = await prisma.subscription.findFirst({
    where: { tenantId: 4, status: { in: ['ACTIVE', 'TRIAL'] } }
  });
  if (existing) {
    console.log('Tatooine already has subscription');
    return;
  }

  // Create subscription
  const sub = await prisma.subscription.create({
    data: {
      tenantId: 4,
      productId: product.id,
      status: SubscriptionStatus.ACTIVE,
      amountCents: 0,
      billingInterval: BillingInterval.MONTHLY,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`Created subscription for Tatooine (ID: ${sub.id})`);
}

fix().catch(console.error).finally(() => prisma.$disconnect());
