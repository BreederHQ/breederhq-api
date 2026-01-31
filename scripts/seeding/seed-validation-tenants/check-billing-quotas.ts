import '../../../prisma/seed/seed-env-bootstrap';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  console.log('=== BILLING & SUBSCRIPTION ANALYSIS ===\n');

  // 1. Check BillingAccount records
  console.log('1. BILLING ACCOUNTS:');
  const billingAccounts = await prisma.billingAccount.findMany({
    include: {
      tenant: { select: { id: true, name: true, slug: true } }
    }
  });
  console.log(`   Total: ${billingAccounts.length}`);
  for (const b of billingAccounts) {
    console.log(`   - Tenant ${b.tenant.id} (${b.tenant.name}): stripeCustomerId=${b.stripeCustomerId ? 'SET' : 'NULL'}, plan=${b.plan || 'NULL'}`);
  }

  // 2. Check tenants WITHOUT billing accounts
  console.log('\n2. TENANTS WITHOUT BILLING ACCOUNT:');
  const tenantsWithoutBilling = await prisma.tenant.findMany({
    where: {
      billing: null
    },
    select: { id: true, name: true, slug: true }
  });
  console.log(`   Total: ${tenantsWithoutBilling.length}`);
  for (const t of tenantsWithoutBilling) {
    console.log(`   - Tenant ${t.id}: ${t.name} (${t.slug || 'no slug'})`);
  }

  // 3. Check Product records (subscription plans)
  console.log('\n3. PRODUCTS (SUBSCRIPTION PLANS):');
  const products = await prisma.product.findMany({
    include: {
      entitlements: true
    },
    orderBy: { sortOrder: 'asc' }
  });
  console.log(`   Total: ${products.length}`);
  for (const p of products) {
    console.log(`   - ${p.id}: ${p.name} (${p.type}) - active=${p.active}, price=$${p.priceUSD / 100}/${p.billingInterval}`);
    for (const e of p.entitlements) {
      console.log(`     • ${e.entitlementKey}: limit=${e.limitValue ?? 'unlimited'}`);
    }
  }

  // 4. Check Subscription records
  console.log('\n4. SUBSCRIPTIONS:');
  const subscriptions = await prisma.subscription.findMany({
    include: {
      tenant: { select: { id: true, name: true } },
      product: { select: { name: true } }
    }
  });
  console.log(`   Total: ${subscriptions.length}`);
  for (const s of subscriptions) {
    console.log(`   - Tenant ${s.tenant.id} (${s.tenant.name}): ${s.product.name}, status=${s.status}, trialEnd=${s.trialEnd?.toISOString() || 'NULL'}`);
  }

  // 5. Check tenants WITHOUT subscriptions
  console.log('\n5. TENANTS WITHOUT SUBSCRIPTION:');
  const tenantsWithoutSub = await prisma.tenant.findMany({
    where: {
      subscriptions: { none: {} }
    },
    select: { id: true, name: true, slug: true }
  });
  console.log(`   Total: ${tenantsWithoutSub.length}`);
  for (const t of tenantsWithoutSub) {
    console.log(`   - Tenant ${t.id}: ${t.name} (${t.slug || 'no slug'})`);
  }

  // 6. Check UsageSnapshot records
  console.log('\n6. USAGE SNAPSHOTS:');
  const snapshots = await prisma.usageSnapshot.findMany({
    include: {
      tenant: { select: { id: true, name: true } }
    },
    orderBy: { snapshotAt: 'desc' },
    take: 20
  });
  console.log(`   Total (showing latest 20): ${snapshots.length}`);
  for (const s of snapshots) {
    console.log(`   - Tenant ${s.tenant.id} (${s.tenant.name}): ${s.metricKey}=${s.value} @ ${s.snapshotAt.toISOString()}`);
  }

  // 7. Check UsageRecord counts per tenant
  console.log('\n7. USAGE RECORDS BY TENANT:');
  const usageByTenant = await prisma.usageRecord.groupBy({
    by: ['tenantId'],
    _count: { id: true }
  });
  console.log(`   Tenants with usage records: ${usageByTenant.length}`);
  for (const u of usageByTenant) {
    const tenant = await prisma.tenant.findUnique({ where: { id: u.tenantId }, select: { name: true } });
    console.log(`   - Tenant ${u.tenantId} (${tenant?.name || 'unknown'}): ${u._count.id} records`);
  }

  // 8. Summary
  console.log('\n=== SUMMARY ===');
  const totalTenants = await prisma.tenant.count();
  console.log(`Total tenants: ${totalTenants}`);
  console.log(`With billing account: ${billingAccounts.length}`);
  console.log(`Without billing account: ${tenantsWithoutBilling.length}`);
  console.log(`With subscription: ${subscriptions.length}`);
  console.log(`Without subscription: ${tenantsWithoutSub.length}`);
  console.log(`Products available: ${products.length}`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
