/**
 * Script: Check Quota Status in Database
 * Purpose: Investigate current quota configuration
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking quota status in database...\n");

  try {
    // Check Products
    const products = await prisma.product.findMany({
      include: {
        entitlements: true,
      },
    });

    console.log(`📦 Products: ${products.length} found`);
    for (const product of products) {
      console.log(`   - ${product.name} (ID: ${product.id}, Active: ${product.active})`);
      console.log(`     Entitlements: ${product.entitlements.length}`);
      for (const ent of product.entitlements) {
        console.log(
          `       • ${ent.entitlementKey}: ${ent.limitValue === null ? "∞" : ent.limitValue}`
        );
      }
    }

    // Check Subscriptions
    const subscriptions = await prisma.subscription.findMany({
      include: {
        tenant: true,
        product: true,
      },
    });

    console.log(`\n📋 Subscriptions: ${subscriptions.length} found`);
    for (const sub of subscriptions) {
      console.log(
        `   - ${sub.tenant?.name || "Unknown"} → ${sub.product?.name || "Unknown"} (Status: ${sub.status})`
      );
    }

    // Check Usage Snapshots
    const usageSnapshots = await prisma.usageSnapshot.findMany({
      include: {
        tenant: true,
      },
    });

    console.log(`\n📊 Usage Snapshots: ${usageSnapshots.length} found`);
    const quotaMetrics = usageSnapshots.filter((us) =>
      [
        "ANIMAL_COUNT",
        "CONTACT_COUNT",
        "PORTAL_USER_COUNT",
        "BREEDING_PLAN_COUNT",
        "MARKETPLACE_LISTING_COUNT",
        "STORAGE_BYTES",
        "SMS_SENT",
      ].includes(us.metricKey as string)
    );

    console.log(`\n📊 Quota-related Usage Snapshots: ${quotaMetrics.length} found`);
    for (const us of quotaMetrics.slice(0, 20)) {
      console.log(
        `   - ${us.tenant?.name || "Unknown"} → ${us.metricKey}: ${us.currentValue}/${us.limit === null ? "∞" : us.limit}`
      );
    }
    if (quotaMetrics.length > 20) {
      console.log(`   ... and ${quotaMetrics.length - 20} more`);
    }

    // Check all tenants
    const tenants = await prisma.tenant.findMany();
    console.log(`\n👥 Tenants: ${tenants.length} found`);
    for (const tenant of tenants.slice(0, 10)) {
      console.log(`   - ${tenant.name} (ID: ${tenant.id})`);
    }
    if (tenants.length > 10) {
      console.log(`   ... and ${tenants.length - 10} more`);
    }
  } catch (error) {
    console.error("\n❌ Error checking quota status:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
