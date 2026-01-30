// prisma/seed/seed-features.ts
// Seeds feature flags for the platform.
// This script is idempotent - it can be run multiple times safely.
//
// Usage:
//   npm run db:dev:seed:features
//
// Or directly:
//   node scripts/run-with-env.js .env.dev.migrate npx tsx prisma/seed/seed-features.ts

import "./seed-env-bootstrap.js";
import { PrismaClient, FeatureModule, EntitlementKey } from "@prisma/client";

const prisma = new PrismaClient();

interface FeatureConfig {
  key: string;
  name: string;
  description: string;
  module: FeatureModule;
  entitlementKey: EntitlementKey;
  uiHint: string;
  isActive: boolean;
}

const FEATURES: FeatureConfig[] = [
  // P3.1: Horse Stallion Revenue feature flag
  {
    key: "HORSE_STALLION_REVENUE",
    name: "Stallion Revenue Dashboard",
    description:
      "Revenue tracking widget, booking utilization, and related KPI tiles for horse breeders",
    module: "DASHBOARD",
    entitlementKey: "BREEDING_PLANS", // Available to users with breeding plans access
    uiHint:
      "Horse Dashboard > Stallion Revenue widget, Foals YTD tile, Season Bookings tile",
    isActive: true,
  },

  // P3.2: Horse Enhanced Ownership feature flag
  {
    key: "HORSE_ENHANCED_OWNERSHIP",
    name: "Enhanced Ownership Management",
    description:
      "Multi-owner support with roles, temporal tracking, and owner notifications",
    module: "ANIMALS",
    entitlementKey: "PLATFORM_ACCESS", // Available to all platform users
    uiHint: "Animal Details > Ownership section, Owner editor modal",
    isActive: true,
  },
];

async function seedFeatures() {
  console.log("🌱 Seeding feature flags...");

  for (const featureConfig of FEATURES) {
    // Check if feature already exists by key
    let feature = await prisma.feature.findUnique({
      where: { key: featureConfig.key },
    });

    if (feature) {
      // Update existing feature
      feature = await prisma.feature.update({
        where: { id: feature.id },
        data: {
          name: featureConfig.name,
          description: featureConfig.description,
          module: featureConfig.module,
          entitlementKey: featureConfig.entitlementKey,
          uiHint: featureConfig.uiHint,
          isActive: featureConfig.isActive,
        },
      });
      console.log(`  ✓ Updated: ${feature.key} (${feature.module})`);
    } else {
      // Create new feature
      feature = await prisma.feature.create({
        data: {
          key: featureConfig.key,
          name: featureConfig.name,
          description: featureConfig.description,
          module: featureConfig.module,
          entitlementKey: featureConfig.entitlementKey,
          uiHint: featureConfig.uiHint,
          isActive: featureConfig.isActive,
        },
      });
      console.log(`  ✓ Created: ${feature.key} (${feature.module})`);
    }
  }

  console.log("\n✅ Feature flags seeded successfully!");

  // Print summary
  const featureCount = await prisma.feature.count();
  const activeCount = await prisma.feature.count({
    where: { isActive: true },
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Total features: ${featureCount}`);
  console.log(`   Active features: ${activeCount}`);
}

async function main() {
  try {
    await seedFeatures();
  } catch (error) {
    console.error("❌ Error seeding features:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
