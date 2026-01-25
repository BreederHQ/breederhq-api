/**
 * Script: Create Unlimited Plan and Subscribe All Tenants
 * Purpose: Create a "Free Unlimited" product with no quota limits
 *          and subscribe all existing tenants to it
 * Date: 2026-01-25
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Creating unlimited plan for all tenants...\n");

  try {
    // ────────────────────────────────────────────────────────────────────────────
    // Step 1: Create "Free Unlimited" Product
    // ────────────────────────────────────────────────────────────────────────────
    console.log("📦 Step 1: Creating 'Free Unlimited' product...");

    const product = await prisma.product.upsert({
      where: { id: 1 }, // Use ID 1 for the unlimited plan
      create: {
        name: "Free Unlimited",
        description:
          "Unlimited access to all features (temporary - until subscription system is fully configured)",
        type: "SUBSCRIPTION",
        billingInterval: "MONTHLY",
        priceUSD: 0, // Free
        currency: "USD",
        active: true,
        sortOrder: 0,
        features: ["Unlimited Animals", "Unlimited Contacts", "Unlimited Breeding Plans"],
      },
      update: {
        name: "Free Unlimited",
        description:
          "Unlimited access to all features (temporary - until subscription system is fully configured)",
        active: true,
      },
    });

    console.log(`   ✅ Created product: ${product.name} (ID: ${product.id})\n`);

    // ────────────────────────────────────────────────────────────────────────────
    // Step 2: Add Unlimited Entitlements to Product
    // ────────────────────────────────────────────────────────────────────────────
    console.log("🔐 Step 2: Adding unlimited entitlements...");

    const quotaEntitlements = [
      { key: "ANIMAL_QUOTA", label: "Animals" },
      { key: "CONTACT_QUOTA", label: "Contacts" },
      { key: "PORTAL_USER_QUOTA", label: "Portal Users" },
      { key: "BREEDING_PLAN_QUOTA", label: "Breeding Plans" },
      { key: "MARKETPLACE_LISTING_QUOTA", label: "Marketplace Listings" },
      { key: "STORAGE_QUOTA_GB", label: "Storage" },
      { key: "SMS_QUOTA", label: "SMS" },
    ] as const;

    const featureEntitlements = [
      "PLATFORM_ACCESS",
      "MARKETPLACE_ACCESS",
      "PORTAL_ACCESS",
      "BREEDING_PLANS",
      "FINANCIAL_SUITE",
      "DOCUMENT_MANAGEMENT",
      "HEALTH_RECORDS",
      "WAITLIST_MANAGEMENT",
      "ADVANCED_REPORTING",
      "API_ACCESS",
      "MULTI_LOCATION",
      "E_SIGNATURES",
      "DATA_EXPORT",
      "GENETICS_STANDARD",
      "GENETICS_PRO",
    ] as const;

    let entitlementsCreated = 0;

    // Add quota entitlements (all unlimited)
    for (const { key, label } of quotaEntitlements) {
      await prisma.productEntitlement.upsert({
        where: {
          productId_entitlementKey: {
            productId: product.id,
            entitlementKey: key,
          },
        },
        create: {
          productId: product.id,
          entitlementKey: key,
          limitValue: null, // NULL = unlimited
        },
        update: {
          limitValue: null, // NULL = unlimited
        },
      });
      console.log(`   ✅ ${label}: ∞ (unlimited)`);
      entitlementsCreated++;
    }

    // Add feature entitlements (all enabled)
    for (const key of featureEntitlements) {
      await prisma.productEntitlement.upsert({
        where: {
          productId_entitlementKey: {
            productId: product.id,
            entitlementKey: key,
          },
        },
        create: {
          productId: product.id,
          entitlementKey: key,
          limitValue: null,
        },
        update: {
          limitValue: null,
        },
      });
      entitlementsCreated++;
    }

    console.log(`\n   ✅ Created ${entitlementsCreated} entitlements\n`);

    // ────────────────────────────────────────────────────────────────────────────
    // Step 3: Subscribe All Tenants to Free Unlimited Plan
    // ────────────────────────────────────────────────────────────────────────────
    console.log("👥 Step 3: Subscribing all tenants...");

    const tenants = await prisma.tenant.findMany();
    console.log(`   Found ${tenants.length} tenants\n`);

    let subscriptionsCreated = 0;

    for (const tenant of tenants) {
      // Check if tenant already has a subscription
      const existingSubscription = await prisma.subscription.findFirst({
        where: { tenantId: tenant.id },
      });

      if (existingSubscription) {
        console.log(`   ⏭️  ${tenant.name}: Already has subscription, skipping`);
        continue;
      }

      // Create subscription
      await prisma.subscription.create({
        data: {
          tenantId: tenant.id,
          productId: product.id,
          status: "ACTIVE",
          amountCents: 0,
          currency: "USD",
          billingInterval: "MONTHLY",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date("2099-12-31"), // Far future
        },
      });

      console.log(`   ✅ ${tenant.name}: Subscribed to Free Unlimited`);
      subscriptionsCreated++;
    }

    console.log(`\n   ✅ Created ${subscriptionsCreated} subscriptions\n`);

    // ────────────────────────────────────────────────────────────────────────────
    // Step 4: Verify & Update Usage Snapshots
    // ────────────────────────────────────────────────────────────────────────────
    console.log("📊 Step 4: Updating usage snapshots...");

    const usageSnapshots = await prisma.usageSnapshot.findMany();

    if (usageSnapshots.length > 0) {
      await prisma.usageSnapshot.updateMany({
        where: {
          metricKey: {
            in: [
              "ANIMAL_COUNT",
              "CONTACT_COUNT",
              "PORTAL_USER_COUNT",
              "BREEDING_PLAN_COUNT",
              "MARKETPLACE_LISTING_COUNT",
              "STORAGE_BYTES",
              "SMS_SENT",
            ],
          },
        },
        data: {
          limit: null, // Set to unlimited
        },
      });
      console.log(`   ✅ Updated ${usageSnapshots.length} usage snapshots\n`);
    } else {
      console.log(`   ℹ️  No usage snapshots found (will be created on first use)\n`);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Summary
    // ────────────────────────────────────────────────────────────────────────────
    console.log("=".repeat(80));
    console.log("✅ UNLIMITED PLAN SETUP COMPLETE");
    console.log("=".repeat(80));
    console.log("\nResults Summary:");
    console.log(`   • Created product: ${product.name}`);
    console.log(`   • Added ${entitlementsCreated} entitlements (all unlimited/enabled)`);
    console.log(`   • Subscribed ${subscriptionsCreated} tenants`);
    console.log("\nAll tenants now have unlimited access to:");
    console.log("   • Animals");
    console.log("   • Contacts");
    console.log("   • Portal Users");
    console.log("   • Breeding Plans");
    console.log("   • Marketplace Listings");
    console.log("   • Storage");
    console.log("   • SMS");
    console.log("   • All platform features");
    console.log("\n🎉 All production tenants can now create unlimited resources!\n");
  } catch (error) {
    console.error("\n❌ Error creating unlimited plan:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
