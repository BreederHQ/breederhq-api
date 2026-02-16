// scripts/fix-marketplace-user-tenant-links.ts
// Fixes marketplace users who are platform breeders but don't have tenantId linked
//
// This is a DATA MIGRATION script that should be run:
// 1. On DEV database after deploying
// 2. On PROD database when ready
//
// Run with: npx tsx scripts/fix-marketplace-user-tenant-links.ts
// Dry run:  npx tsx scripts/fix-marketplace-user-tenant-links.ts --dry-run

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n🔗 Fixing Marketplace User Tenant Links${isDryRun ? " (DRY RUN)" : ""}\n`);

  // 1. Find all platform users with active subscriptions
  const platformUsersWithSubs = await prisma.user.findMany({
    where: {
      tenantMemberships: {
        some: {
          tenant: {
            subscriptions: {
              some: { status: { in: ["ACTIVE", "TRIAL"] } },
            },
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      tenantMemberships: {
        where: {
          tenant: {
            subscriptions: {
              some: { status: { in: ["ACTIVE", "TRIAL"] } },
            },
          },
        },
        include: {
          tenant: {
            select: { id: true, name: true },
          },
        },
        take: 1, // Use first active tenant if multiple
      },
    },
  });

  console.log(`Found ${platformUsersWithSubs.length} platform users with active subscriptions\n`);

  // 2. Check which ones have marketplace users without tenantId
  const toFix: Array<{
    email: string;
    mktUserId: number;
    tenantId: number;
    tenantName: string;
  }> = [];

  for (const pu of platformUsersWithSubs) {
    const tenant = pu.tenantMemberships[0]?.tenant;
    if (!tenant) continue;

    const mktUser = await prisma.marketplaceUser.findFirst({
      where: { email: pu.email },
      select: { id: true, tenantId: true },
    });

    if (mktUser && !mktUser.tenantId) {
      toFix.push({
        email: pu.email,
        mktUserId: mktUser.id,
        tenantId: tenant.id,
        tenantName: tenant.name,
      });
    }
  }

  if (toFix.length === 0) {
    console.log("✅ All marketplace users already have correct tenant links!\n");
    return;
  }

  console.log(`Found ${toFix.length} marketplace users needing tenant link fix:\n`);
  for (const fix of toFix) {
    console.log(`  📧 ${fix.email}`);
    console.log(`     Marketplace User ID: ${fix.mktUserId}`);
    console.log(`     → Link to Tenant: ${fix.tenantName} (ID: ${fix.tenantId})\n`);
  }

  // 3. Apply fixes
  if (isDryRun) {
    console.log("🔍 DRY RUN - No changes made. Run without --dry-run to apply fixes.\n");
    return;
  }

  console.log("Applying fixes...\n");

  let fixed = 0;
  for (const fix of toFix) {
    await prisma.marketplaceUser.update({
      where: { id: fix.mktUserId },
      data: { tenantId: fix.tenantId },
    });
    console.log(`  ✅ Fixed: ${fix.email} → ${fix.tenantName}`);
    fixed++;
  }

  console.log(`\n🎉 Successfully linked ${fixed} marketplace users to their tenants!\n`);
  console.log("Users will now be recognized as breeders when they log in.\n");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
