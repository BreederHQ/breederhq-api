/**
 * Seed entitlements for Hogwarts tenant (ID 87) for E2E testing
 *
 * Usage:
 *   npx tsx scripts/seed-hogwarts-entitlements.ts
 */

import { PrismaClient, EntitlementKey } from "@prisma/client";

const prisma = new PrismaClient();

const HOGWARTS_TENANT_ID = 87;

async function main() {
  console.log("═".repeat(60));
  console.log("Seeding Entitlements for Hogwarts Tenant");
  console.log("═".repeat(60));
  console.log(`\nTarget tenant: ${HOGWARTS_TENANT_ID}\n`);

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: HOGWARTS_TENANT_ID },
  });

  if (!tenant) {
    console.error(`❌ Tenant ${HOGWARTS_TENANT_ID} not found!`);
    process.exit(1);
  }

  console.log(`✓ Tenant found: ${tenant.name}\n`);

  // Step 1: Find or create the E2E test product with high quotas
  let product = await prisma.product.findFirst({
    where: { stripeProductId: "test_e2e_unlimited" },
  });

  if (!product) {
    console.log("Creating E2E test product...");
    product = await prisma.product.create({
      data: {
        name: "E2E Test Plan (Unlimited)",
        description: "Test product with high quotas for E2E testing",
        type: "SUBSCRIPTION",
        stripeProductId: "test_e2e_unlimited",
        active: true,
        priceUSD: 0, // Free for E2E testing
      },
    });
    console.log(`✓ Created product: ${product.id} - ${product.name}`);
  } else {
    console.log(`ℹ Using existing product: ${product.id} - ${product.name}`);
  }

  // Step 2: Define entitlements with high quotas (null = unlimited feature access)
  const entitlements: Array<{ key: EntitlementKey; valueLimit: number | null }> = [
    { key: "ANIMAL_QUOTA", valueLimit: 10000 },
    { key: "CONTACT_QUOTA", valueLimit: 10000 },
    { key: "PORTAL_USER_QUOTA", valueLimit: 1000 },
    { key: "BREEDING_PLAN_QUOTA", valueLimit: 10000 },
    { key: "STORAGE_QUOTA_GB", valueLimit: 100 },
    { key: "MARKETPLACE_LISTING_QUOTA", valueLimit: 100 },
    { key: "SMS_QUOTA", valueLimit: 1000 },
    { key: "BREEDING_ACCESS", valueLimit: null },
    { key: "MARKETPLACE_ACCESS", valueLimit: null },
    { key: "ADVANCED_GENETICS", valueLimit: null },
  ];

  console.log("\nUpserting product entitlements...");

  for (const ent of entitlements) {
    try {
      await prisma.productEntitlement.upsert({
        where: {
          productId_entitlementKey: {
            productId: product.id,
            entitlementKey: ent.key,
          },
        },
        create: {
          productId: product.id,
          entitlementKey: ent.key,
          limitValue: ent.valueLimit,
        },
        update: {
          limitValue: ent.valueLimit,
        },
      });
      console.log(`  ✓ ${ent.key}: ${ent.valueLimit ?? "unlimited access"}`);
    } catch (e: any) {
      console.log(`  ⚠ ${ent.key}: ${e.message}`);
    }
  }

  // Step 3: Check if subscription exists for tenant
  let subscription = await prisma.subscription.findFirst({
    where: { tenantId: HOGWARTS_TENANT_ID },
    orderBy: { createdAt: "desc" },
    include: { product: true },
  });

  if (!subscription) {
    console.log("\nCreating subscription...");
    subscription = await prisma.subscription.create({
      data: {
        tenantId: HOGWARTS_TENANT_ID,
        productId: product.id,
        status: "ACTIVE",
        stripeSubscriptionId: "test_hogwarts_subscription",
        stripeCustomerId: "test_hogwarts_customer",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        priceId: "test_unlimited",
      },
      include: { product: true },
    });
    console.log(`✓ Created subscription: ${subscription.id}`);
  } else {
    console.log(`\nℹ Using existing subscription: ${subscription.id}`);
    console.log(`  Current product: ${subscription.product.name} (ID: ${subscription.productId})`);

    // Update subscription to use our E2E test product if different
    if (subscription.productId !== product.id) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { productId: product.id },
      });
      console.log(`✓ Updated subscription to use E2E test product`);
    }

    // Ensure subscription is active
    if (subscription.status !== "ACTIVE") {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "ACTIVE" },
      });
      console.log(`✓ Updated subscription status to ACTIVE`);
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log("DONE - Hogwarts tenant is ready for E2E testing");
  console.log("  Tenant ID: " + HOGWARTS_TENANT_ID);
  console.log("  Product: " + product.name);
  console.log("  Subscription: " + subscription.id + " (ACTIVE)");
  console.log("═".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
