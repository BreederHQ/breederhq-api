// prisma/seed/seed-dev-subscriptions.ts
// Seeds Pro subscriptions for development tenants to enable all features
// This allows E2E tests to use contract creation and other premium features
//
// Usage:
//   npm run db:dev:seed:subscriptions
//
// Or directly:
//   npx tsx prisma/seed/seed-dev-subscriptions.ts

import './seed-env-bootstrap';
import { PrismaClient, SubscriptionStatus, BillingInterval } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding development subscriptions...\n');

  // Find the Pro Monthly product (has E_SIGNATURES entitlement)
  const proProduct = await prisma.product.findFirst({
    where: { name: 'Pro (Monthly)' },
  });

  if (!proProduct) {
    console.log('⚠️  Pro product not found. Run seed-subscription-products.ts first.');
    console.log('   npm run db:dev:seed:products');
    return;
  }

  console.log(`✓ Found product: ${proProduct.name} (ID: ${proProduct.id})\n`);

  // Find all development tenants (e.g., dev-hogwarts, dev-tatooine)
  const devTenants = await prisma.tenant.findMany({
    where: {
      slug: { startsWith: 'dev-' },
    },
  });

  if (devTenants.length === 0) {
    console.log('⚠️  No development tenants found (slug starting with "dev-")');
    return;
  }

  console.log(`Found ${devTenants.length} development tenant(s):\n`);

  for (const tenant of devTenants) {
    // Check if subscription already exists
    const existingSub = await prisma.subscription.findFirst({
      where: {
        tenantId: tenant.id,
        status: { in: ['TRIAL', 'ACTIVE'] },
      },
    });

    if (existingSub) {
      console.log(`ℹ️  ${tenant.name} (${tenant.slug}) - already has subscription`);
      continue;
    }

    // Create a Pro subscription with ACTIVE status
    const subscription = await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        productId: proProduct.id,
        status: SubscriptionStatus.ACTIVE,
        amountCents: proProduct.priceUSD, // Use product price
        billingInterval: BillingInterval.MONTHLY,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      },
    });

    console.log(`✓ ${tenant.name} (${tenant.slug}) - created Pro subscription (ID: ${subscription.id})`);
  }

  console.log('\n✨ Development subscriptions seeded successfully!');

  // Print summary of entitlements
  const proEntitlements = await prisma.productEntitlement.findMany({
    where: { productId: proProduct.id },
  });

  console.log('\n📋 Pro plan includes these entitlements:');
  for (const ent of proEntitlements) {
    const limit = ent.limitValue === null ? 'unlimited' : ent.limitValue;
    console.log(`   - ${ent.entitlementKey}: ${limit}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
