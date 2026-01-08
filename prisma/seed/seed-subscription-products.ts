// prisma/seed/seed-subscription-products.ts
// Seeds subscription products (Pro, Enterprise) with their entitlements.
// This script is idempotent - it can be run multiple times safely.
//
// Usage:
//   npm run db:dev:seed:products
//
// Or directly:
//   node scripts/run-with-env.js .env.dev.migrate npx tsx prisma/seed/seed-subscription-products.ts

import "./seed-env-bootstrap.js";
import {
  PrismaClient,
  ProductType,
  BillingInterval,
  EntitlementKey,
} from "@prisma/client";

const prisma = new PrismaClient();

interface ProductConfig {
  name: string;
  description: string;
  type: ProductType;
  billingInterval: BillingInterval;
  priceUSD: number;
  sortOrder: number;
  features: string[];
  entitlements: {
    key: EntitlementKey;
    limitValue: number | null;
  }[];
}

const PRODUCTS: ProductConfig[] = [
  // Breeder Monthly
  {
    name: "Breeder (Monthly)",
    description: "Professional breeding management for small to medium operations",
    type: "SUBSCRIPTION",
    billingInterval: "MONTHLY",
    priceUSD: 3900, // $39.00
    sortOrder: 1,
    features: [
      "Up to 50 animals",
      "Up to 500 contacts",
      "Up to 25 portal users",
      "1 marketplace listing",
      "100GB storage",
      "Unlimited breeding plans",
      "Financial suite",
      "Document management",
      "Waitlist management",
      "Data export",
      "Email support (48hr response)",
    ],
    entitlements: [
      { key: "PLATFORM_ACCESS", limitValue: null },
      { key: "ANIMAL_QUOTA", limitValue: 50 },
      { key: "CONTACT_QUOTA", limitValue: 500 },
      { key: "PORTAL_USER_QUOTA", limitValue: 25 },
      { key: "MARKETPLACE_LISTING_QUOTA", limitValue: 1 },
      { key: "STORAGE_QUOTA_GB", limitValue: 100 },
      { key: "BREEDING_PLANS", limitValue: null },
      { key: "FINANCIAL_SUITE", limitValue: null },
      { key: "DOCUMENT_MANAGEMENT", limitValue: null },
      { key: "WAITLIST_MANAGEMENT", limitValue: null },
      { key: "DATA_EXPORT", limitValue: null },
    ],
  },

  // Breeder Yearly
  {
    name: "Breeder (Yearly)",
    description: "Professional breeding management - annual billing (save $78/year)",
    type: "SUBSCRIPTION",
    billingInterval: "YEARLY",
    priceUSD: 39000, // $390.00 (2 months free)
    sortOrder: 2,
    features: [
      "Up to 50 animals",
      "Up to 500 contacts",
      "Up to 25 portal users",
      "1 marketplace listing",
      "100GB storage",
      "Unlimited breeding plans",
      "Financial suite",
      "Document management",
      "Waitlist management",
      "Data export",
      "Email support (48hr response)",
      "Save $78 per year",
    ],
    entitlements: [
      { key: "PLATFORM_ACCESS", limitValue: null },
      { key: "ANIMAL_QUOTA", limitValue: 50 },
      { key: "CONTACT_QUOTA", limitValue: 500 },
      { key: "PORTAL_USER_QUOTA", limitValue: 25 },
      { key: "MARKETPLACE_LISTING_QUOTA", limitValue: 1 },
      { key: "STORAGE_QUOTA_GB", limitValue: 100 },
      { key: "BREEDING_PLANS", limitValue: null },
      { key: "FINANCIAL_SUITE", limitValue: null },
      { key: "DOCUMENT_MANAGEMENT", limitValue: null },
      { key: "WAITLIST_MANAGEMENT", limitValue: null },
      { key: "DATA_EXPORT", limitValue: null },
    ],
  },

  // Pro Monthly
  {
    name: "Pro (Monthly)",
    description: "Advanced features for large breeding operations",
    type: "SUBSCRIPTION",
    billingInterval: "MONTHLY",
    priceUSD: 9900, // $99.00
    sortOrder: 3,
    features: [
      "Unlimited animals",
      "Unlimited contacts",
      "Unlimited portal users",
      "Unlimited marketplace listings",
      "500GB storage",
      "Unlimited breeding plans",
      "Financial suite",
      "Document management",
      "Waitlist management",
      "Data export",
      "Advanced reporting & analytics",
      "API access",
      "Multi-location management",
      "E-signatures",
      "Priority support (24hr response)",
      "Custom integrations",
    ],
    entitlements: [
      { key: "PLATFORM_ACCESS", limitValue: null },
      { key: "ANIMAL_QUOTA", limitValue: null }, // null = unlimited
      { key: "CONTACT_QUOTA", limitValue: null },
      { key: "PORTAL_USER_QUOTA", limitValue: null },
      { key: "MARKETPLACE_LISTING_QUOTA", limitValue: null },
      { key: "STORAGE_QUOTA_GB", limitValue: 500 },
      { key: "BREEDING_PLANS", limitValue: null },
      { key: "FINANCIAL_SUITE", limitValue: null },
      { key: "DOCUMENT_MANAGEMENT", limitValue: null },
      { key: "WAITLIST_MANAGEMENT", limitValue: null },
      { key: "DATA_EXPORT", limitValue: null },
      { key: "ADVANCED_REPORTING", limitValue: null },
      { key: "API_ACCESS", limitValue: null },
      { key: "MULTI_LOCATION", limitValue: null },
      { key: "E_SIGNATURES", limitValue: null },
    ],
  },

  // Pro Yearly
  {
    name: "Pro (Yearly)",
    description: "Advanced features - annual billing (save $198/year)",
    type: "SUBSCRIPTION",
    billingInterval: "YEARLY",
    priceUSD: 99000, // $990.00 (2 months free)
    sortOrder: 4,
    features: [
      "Unlimited animals",
      "Unlimited contacts",
      "Unlimited portal users",
      "Unlimited marketplace listings",
      "500GB storage",
      "Unlimited breeding plans",
      "Financial suite",
      "Document management",
      "Waitlist management",
      "Data export",
      "Advanced reporting & analytics",
      "API access",
      "Multi-location management",
      "E-signatures",
      "Priority support (24hr response)",
      "Custom integrations",
      "Save $198 per year",
    ],
    entitlements: [
      { key: "PLATFORM_ACCESS", limitValue: null },
      { key: "ANIMAL_QUOTA", limitValue: null },
      { key: "CONTACT_QUOTA", limitValue: null },
      { key: "PORTAL_USER_QUOTA", limitValue: null },
      { key: "MARKETPLACE_LISTING_QUOTA", limitValue: null },
      { key: "STORAGE_QUOTA_GB", limitValue: 500 },
      { key: "BREEDING_PLANS", limitValue: null },
      { key: "FINANCIAL_SUITE", limitValue: null },
      { key: "DOCUMENT_MANAGEMENT", limitValue: null },
      { key: "WAITLIST_MANAGEMENT", limitValue: null },
      { key: "DATA_EXPORT", limitValue: null },
      { key: "ADVANCED_REPORTING", limitValue: null },
      { key: "API_ACCESS", limitValue: null },
      { key: "MULTI_LOCATION", limitValue: null },
      { key: "E_SIGNATURES", limitValue: null },
    ],
  },

  // Add-ons
  {
    name: "+10 Animal Slots",
    description: "Add 10 additional animal slots to your subscription",
    type: "ADD_ON",
    billingInterval: "MONTHLY",
    priceUSD: 500, // $5.00
    sortOrder: 10,
    features: ["+10 animal slots"],
    entitlements: [{ key: "ANIMAL_QUOTA", limitValue: 10 }],
  },

  {
    name: "+1 Marketplace Listing",
    description: "Add 1 additional marketplace listing to your subscription",
    type: "ADD_ON",
    billingInterval: "MONTHLY",
    priceUSD: 1000, // $10.00
    sortOrder: 11,
    features: ["+1 marketplace listing"],
    entitlements: [{ key: "MARKETPLACE_LISTING_QUOTA", limitValue: 1 }],
  },

  {
    name: "+10 Portal Users",
    description: "Add 10 additional portal user slots to your subscription",
    type: "ADD_ON",
    billingInterval: "MONTHLY",
    priceUSD: 500, // $5.00
    sortOrder: 12,
    features: ["+10 portal user slots"],
    entitlements: [{ key: "PORTAL_USER_QUOTA", limitValue: 10 }],
  },

  {
    name: "+25GB Storage",
    description: "Add 25GB of additional storage to your subscription",
    type: "ADD_ON",
    billingInterval: "MONTHLY",
    priceUSD: 1000, // $10.00
    sortOrder: 13,
    features: ["+25GB storage"],
    entitlements: [{ key: "STORAGE_QUOTA_GB", limitValue: 25 }],
  },

  {
    name: "Priority Support",
    description: "24-hour response time support",
    type: "ADD_ON",
    billingInterval: "MONTHLY",
    priceUSD: 2500, // $25.00
    sortOrder: 14,
    features: ["24-hour response time", "Priority ticket queue", "Phone support"],
    entitlements: [],
  },
];

async function seedProducts() {
  console.log("🌱 Seeding subscription products...");

  for (const productConfig of PRODUCTS) {
    // Check if product already exists by name
    let product = await prisma.product.findFirst({
      where: { name: productConfig.name },
    });

    if (product) {
      // Update existing product
      product = await prisma.product.update({
        where: { id: product.id },
        data: {
          description: productConfig.description,
          type: productConfig.type,
          billingInterval: productConfig.billingInterval,
          priceUSD: productConfig.priceUSD,
          sortOrder: productConfig.sortOrder,
          features: productConfig.features,
          active: true,
        },
      });
    } else {
      // Create new product
      product = await prisma.product.create({
        data: {
          name: productConfig.name,
          description: productConfig.description,
          type: productConfig.type,
          billingInterval: productConfig.billingInterval,
          priceUSD: productConfig.priceUSD,
          sortOrder: productConfig.sortOrder,
          features: productConfig.features,
          active: true,
        },
      });
    }

    console.log(`  ✓ ${product.name} (${product.type})`);

    // Create/update entitlements
    for (const entitlement of productConfig.entitlements) {
      await prisma.productEntitlement.upsert({
        where: {
          productId_entitlementKey: {
            productId: product.id,
            entitlementKey: entitlement.key,
          },
        },
        update: {
          limitValue: entitlement.limitValue,
        },
        create: {
          productId: product.id,
          entitlementKey: entitlement.key,
          limitValue: entitlement.limitValue,
        },
      });
    }

    if (productConfig.entitlements.length > 0) {
      console.log(
        `    → ${productConfig.entitlements.length} entitlements configured`
      );
    }
  }

  console.log("\n✅ Subscription products seeded successfully!");

  // Print summary
  const productCount = await prisma.product.count();
  const entitlementCount = await prisma.productEntitlement.count();

  console.log(`\n📊 Summary:`);
  console.log(`   Products: ${productCount}`);
  console.log(`   Entitlements: ${entitlementCount}`);
}

async function main() {
  try {
    await seedProducts();
  } catch (error) {
    console.error("❌ Error seeding products:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
