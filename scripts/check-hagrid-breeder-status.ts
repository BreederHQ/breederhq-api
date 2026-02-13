// scripts/check-hagrid-breeder-status.ts
// Check and fix Hagrid's breeder status in marketplace
// Run with: npx tsx scripts/check-hagrid-breeder-status.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "hagrid.dev@hogwarts.local";

  console.log(`\n🔍 Checking breeder status for: ${email}\n`);

  // 1. Find platform user
  const platformUser = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      tenantMemberships: {
        select: {
          role: true,
          tenant: {
            select: {
              id: true,
              name: true,
              subscriptions: {
                where: { status: "active" },
                select: { id: true, plan: true, status: true },
              },
            },
          },
        },
      },
    },
  });

  if (!platformUser) {
    console.log(`❌ Platform user not found: ${email}`);
    return;
  }

  console.log(`✅ Platform User: ${platformUser.firstName} ${platformUser.lastName} (${platformUser.id})`);
  console.log(`   Tenant memberships: ${platformUser.tenantMemberships.length}`);

  for (const tm of platformUser.tenantMemberships) {
    console.log(`   - Tenant: ${tm.tenant.name} (${tm.tenant.id}), Role: ${tm.role}`);
    console.log(`     Subscriptions: ${tm.tenant.subscriptions.length}`);
    for (const sub of tm.tenant.subscriptions) {
      console.log(`       - ${sub.plan} (${sub.status})`);
    }
  }

  const hasActiveSubscription = platformUser.tenantMemberships.some(
    (tm) => tm.tenant.subscriptions.length > 0
  );
  console.log(`\n   Has active subscription: ${hasActiveSubscription}`);

  // 2. Find marketplace user
  const marketplaceUser = await prisma.marketplaceUser.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      tenantId: true,
      platformUserId: true,
    },
  });

  if (!marketplaceUser) {
    console.log(`\n❌ Marketplace user not found: ${email}`);
    console.log(`   (User may need to log into marketplace first)`);
    return;
  }

  console.log(`\n✅ Marketplace User: ${marketplaceUser.id}`);
  console.log(`   tenantId: ${marketplaceUser.tenantId || "(not linked)"}`);
  console.log(`   platformUserId: ${marketplaceUser.platformUserId || "(not linked)"}`);

  // 3. Check if fix is needed
  const primaryTenant = platformUser.tenantMemberships.find(
    (tm) => tm.tenant.subscriptions.length > 0
  )?.tenant;

  if (!marketplaceUser.tenantId && primaryTenant) {
    console.log(`\n⚠️  ISSUE: Marketplace user not linked to tenant!`);
    console.log(`   Should be linked to: ${primaryTenant.name} (${primaryTenant.id})`);

    // Fix it
    await prisma.marketplaceUser.update({
      where: { id: marketplaceUser.id },
      data: {
        tenantId: primaryTenant.id,
        platformUserId: platformUser.id,
      },
    });

    console.log(`\n✅ FIXED: Linked marketplace user to tenant and platform user`);
  } else if (marketplaceUser.tenantId) {
    console.log(`\n✅ Marketplace user already linked to tenant`);
  } else {
    console.log(`\n⚠️  No active subscription found - cannot be marked as breeder`);
  }

  // Also check if platformUserId is linked
  if (!marketplaceUser.platformUserId && platformUser) {
    await prisma.marketplaceUser.update({
      where: { id: marketplaceUser.id },
      data: { platformUserId: platformUser.id },
    });
    console.log(`✅ FIXED: Linked marketplace user to platform user`);
  }

  console.log(`\n🎉 Done! Hagrid should now be recognized as a breeder.\n`);
  console.log(`   Next steps:`);
  console.log(`   1. Log out of marketplace`);
  console.log(`   2. Clear cookies for marketplace domain`);
  console.log(`   3. Log back in via SSO from platform`);
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
