/**
 * Make Test User Unlimited
 *
 * Sets up luke.skywalker@tester.com as a super admin with unlimited quotas:
 * 1. Sets isSuperAdmin = true on the user
 * 2. Assigns a Pro (Monthly) subscription to their tenant (unlimited quotas)
 *
 * Usage:
 *   npx tsx scripts/make-test-user-unlimited.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEST_EMAIL = "luke.skywalker@tester.local";

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Make Test User Unlimited");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Step 1: Find the user
  console.log(`Step 1: Finding user ${TEST_EMAIL}...`);

  const user = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
    select: { id: true, email: true, isSuperAdmin: true },
  });

  if (!user) {
    console.error(`  ❌ User not found: ${TEST_EMAIL}`);
    process.exit(1);
  }

  console.log(`  ✓ Found user: ${user.email} (id: ${user.id})`);
  console.log(`  ✓ Current isSuperAdmin: ${user.isSuperAdmin}`);

  // Step 2: Set as super admin
  console.log("\nStep 2: Setting user as super admin...");

  if (!user.isSuperAdmin) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isSuperAdmin: true },
    });
    console.log("  ✓ Set isSuperAdmin = true");
  } else {
    console.log("  ✓ Already a super admin");
  }

  // Step 3: Find user's tenant(s)
  console.log("\nStep 3: Finding user's tenant memberships...");

  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: user.id },
    include: { tenant: { select: { id: true, name: true } } },
  });

  if (memberships.length === 0) {
    console.error("  ❌ User has no tenant memberships");
    process.exit(1);
  }

  console.log(`  ✓ Found ${memberships.length} membership(s):`);
  for (const m of memberships) {
    console.log(`    - Tenant ${m.tenant.id}: ${m.tenant.name} (role: ${m.role})`);
  }

  // Step 4: Find Pro (Monthly) product
  console.log("\nStep 4: Finding Pro (Monthly) product...");

  const proProduct = await prisma.product.findFirst({
    where: { name: "Pro (Monthly)" },
  });

  if (!proProduct) {
    console.error("  ❌ Pro (Monthly) product not found. Run seed-subscription-products.ts first.");
    process.exit(1);
  }

  console.log(`  ✓ Found product: ${proProduct.name} (id: ${proProduct.id})`);

  // Step 5: Create/update subscription for each tenant
  console.log("\nStep 5: Assigning Pro subscription to tenant(s)...");

  for (const membership of memberships) {
    const tenantId = membership.tenant.id;

    // Check for existing subscription
    const existingSub = await prisma.subscription.findFirst({
      where: { tenantId },
      include: { product: { select: { name: true } } },
    });

    if (existingSub) {
      if (existingSub.productId === proProduct.id && existingSub.status === "ACTIVE") {
        console.log(`  ✓ Tenant ${tenantId} already has Pro (Monthly) subscription`);
        continue;
      }

      // Update existing subscription
      await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          productId: proProduct.id,
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        },
      });
      console.log(`  ✓ Updated tenant ${tenantId} subscription to Pro (Monthly)`);
    } else {
      // Create new subscription
      await prisma.subscription.create({
        data: {
          tenantId,
          productId: proProduct.id,
          status: "ACTIVE",
          amountCents: 0, // Free for test users
          billingInterval: "MONTHLY",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        },
      });
      console.log(`  ✓ Created Pro (Monthly) subscription for tenant ${tenantId}`);
    }
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Summary");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log(`User: ${TEST_EMAIL}`);
  console.log(`  - isSuperAdmin: true`);
  console.log(`  - Subscription: Pro (Monthly) - UNLIMITED quotas`);
  console.log("\n✅ Test user setup completed!");
  console.log("\nThe user now has:");
  console.log("  • Unlimited animals");
  console.log("  • Unlimited contacts");
  console.log("  • Unlimited portal users");
  console.log("  • Unlimited marketplace listings");
  console.log("  • Unlimited breeding plans");
  console.log("  • 500GB storage");
}

main()
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
