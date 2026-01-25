/**
 * Script: Remove All Quota Restrictions from Production Tenants
 * Purpose: Set all quota limits to unlimited (NULL) for all tenants
 * Date: 2026-01-25
 *
 * Usage:
 *   npm run script:remove-quotas
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting quota removal process...\n");

  try {
    // ────────────────────────────────────────────────────────────────────────────
    // Step 1: Update ProductEntitlements to remove quota limits
    // ────────────────────────────────────────────────────────────────────────────
    console.log("📦 Step 1: Updating ProductEntitlements...");

    const quotaKeys = [
      "ANIMAL_QUOTA",
      "CONTACT_QUOTA",
      "PORTAL_USER_QUOTA",
      "BREEDING_PLAN_QUOTA",
      "MARKETPLACE_LISTING_QUOTA",
      "STORAGE_QUOTA_GB",
      "SMS_QUOTA",
    ];

    const productEntitlementsResult = await prisma.$executeRaw`
      UPDATE "ProductEntitlement"
      SET "limitValue" = NULL
      WHERE "entitlementKey" IN (
        'ANIMAL_QUOTA',
        'CONTACT_QUOTA',
        'PORTAL_USER_QUOTA',
        'BREEDING_PLAN_QUOTA',
        'MARKETPLACE_LISTING_QUOTA',
        'STORAGE_QUOTA_GB',
        'SMS_QUOTA'
      )
    `;

    console.log(`   ✅ Updated ${productEntitlementsResult} ProductEntitlement records\n`);

    // ────────────────────────────────────────────────────────────────────────────
    // Step 2: Update UsageSnapshot to remove quota limits for all tenants
    // ────────────────────────────────────────────────────────────────────────────
    console.log("📊 Step 2: Updating UsageSnapshots...");

    const usageMetricKeys = [
      "ANIMAL_COUNT",
      "CONTACT_COUNT",
      "PORTAL_USER_COUNT",
      "BREEDING_PLAN_COUNT",
      "MARKETPLACE_LISTING_COUNT",
      "STORAGE_BYTES",
      "SMS_SENT",
    ];

    const usageSnapshotsResult = await prisma.$executeRaw`
      UPDATE "UsageSnapshot"
      SET "limit" = NULL
      WHERE "metricKey" IN (
        'ANIMAL_COUNT',
        'CONTACT_COUNT',
        'PORTAL_USER_COUNT',
        'BREEDING_PLAN_COUNT',
        'MARKETPLACE_LISTING_COUNT',
        'STORAGE_BYTES',
        'SMS_SENT'
      )
    `;

    console.log(`   ✅ Updated ${usageSnapshotsResult} UsageSnapshot records\n`);

    // ────────────────────────────────────────────────────────────────────────────
    // Step 3: Verification
    // ────────────────────────────────────────────────────────────────────────────
    console.log("🔍 Step 3: Verifying changes...\n");

    // Check ProductEntitlements
    const productEntitlements = await prisma.$queryRaw<
      Array<{
        product_name: string;
        entitlementKey: string;
        limitValue: number | null;
      }>
    >`
      SELECT
        p."name" as product_name,
        pe."entitlementKey",
        pe."limitValue"
      FROM "ProductEntitlement" pe
      JOIN "Product" p ON p."id" = pe."productId"
      WHERE pe."entitlementKey" IN (
        'ANIMAL_QUOTA',
        'CONTACT_QUOTA',
        'PORTAL_USER_QUOTA',
        'BREEDING_PLAN_QUOTA',
        'MARKETPLACE_LISTING_QUOTA',
        'STORAGE_QUOTA_GB',
        'SMS_QUOTA'
      )
      ORDER BY p."name", pe."entitlementKey"
    `;

    console.log("   📦 ProductEntitlements:");
    if (productEntitlements.length === 0) {
      console.log("      ℹ️  No quota entitlements found in products");
    } else {
      for (const pe of productEntitlements) {
        console.log(
          `      ${pe.product_name} → ${pe.entitlementKey}: ${
            pe.limitValue === null ? "∞ (unlimited)" : pe.limitValue
          }`
        );
      }
    }

    // Check UsageSnapshots
    const usageSnapshots = await prisma.$queryRaw<
      Array<{
        tenant_name: string;
        metricKey: string;
        currentValue: number;
        limit: number | null;
      }>
    >`
      SELECT
        t."name" as tenant_name,
        us."metricKey",
        us."currentValue",
        us."limit"
      FROM "UsageSnapshot" us
      JOIN "Tenant" t ON t."id" = us."tenantId"
      WHERE us."metricKey" IN (
        'ANIMAL_COUNT',
        'CONTACT_COUNT',
        'PORTAL_USER_COUNT',
        'BREEDING_PLAN_COUNT',
        'MARKETPLACE_LISTING_COUNT',
        'STORAGE_BYTES',
        'SMS_SENT'
      )
      ORDER BY t."name", us."metricKey"
    `;

    console.log("\n   📊 UsageSnapshots (sample of 10):");
    if (usageSnapshots.length === 0) {
      console.log("      ℹ️  No usage snapshots found");
    } else {
      for (const us of usageSnapshots.slice(0, 10)) {
        console.log(
          `      ${us.tenant_name} → ${us.metricKey}: ${us.currentValue}/${
            us.limit === null ? "∞" : us.limit
          }`
        );
      }
      if (usageSnapshots.length > 10) {
        console.log(`      ... and ${usageSnapshots.length - 10} more`);
      }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Summary
    // ────────────────────────────────────────────────────────────────────────────
    console.log("\n" + "=".repeat(80));
    console.log("✅ QUOTA REMOVAL COMPLETE");
    console.log("=".repeat(80));
    console.log("\nResults Summary:");
    console.log(`   • Updated ${productEntitlementsResult} ProductEntitlement records`);
    console.log(`   • Updated ${usageSnapshotsResult} UsageSnapshot records`);
    console.log("\nAll quota limits have been set to unlimited (NULL) for:");
    console.log("   • Animals");
    console.log("   • Contacts");
    console.log("   • Portal Users");
    console.log("   • Breeding Plans");
    console.log("   • Marketplace Listings");
    console.log("   • Storage (GB)");
    console.log("   • SMS messages");
    console.log("\n🎉 All production tenants can now create unlimited resources!\n");
  } catch (error) {
    console.error("\n❌ Error removing quotas:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
