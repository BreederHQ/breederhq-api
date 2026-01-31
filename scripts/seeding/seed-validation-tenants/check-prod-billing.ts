import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  console.log('=== PROD BILLING ANALYSIS ===\n');

  const billingAccounts = await prisma.billingAccount.findMany({
    include: { tenant: { select: { id: true, name: true } } }
  });
  console.log('Billing accounts:', billingAccounts.length);
  for (const b of billingAccounts) {
    console.log(`  - Tenant ${b.tenant.id} (${b.tenant.name})`);
  }

  const subscriptions = await prisma.subscription.findMany({
    include: {
      tenant: { select: { id: true, name: true } },
      product: { select: { name: true } }
    }
  });
  console.log('\nSubscriptions:', subscriptions.length);
  for (const s of subscriptions) {
    console.log(`  - Tenant ${s.tenant.id} (${s.tenant.name}): ${s.product.name}, status=${s.status}`);
  }

  const tenantsWithoutSub = await prisma.tenant.findMany({
    where: { subscriptions: { none: {} } },
    select: { id: true, name: true, slug: true }
  });
  console.log('\nTenants WITHOUT subscription:', tenantsWithoutSub.length);
  for (const t of tenantsWithoutSub) {
    console.log(`  - Tenant ${t.id}: ${t.name} (${t.slug || 'no slug'})`);
  }

  const products = await prisma.product.count();
  console.log('\nProducts available:', products);
}

check().catch(console.error).finally(() => prisma.$disconnect());
