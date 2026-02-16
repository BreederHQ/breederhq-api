// scripts/cleanup-all-provider-data.ts
// Cleanup ALL provider profiles and listings from dev database
// Run with: npx tsx scripts/cleanup-all-provider-data.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n🧹 Cleaning up ALL provider data from dev database\n");

  // Find all provider listings
  const listings = await prisma.mktListingBreederService.findMany({
    where: { sourceType: "PROVIDER" },
    select: { id: true, title: true, providerId: true, status: true, coverImageUrl: true, images: true },
  });

  console.log(`Found ${listings.length} provider listing(s):`);
  listings.forEach((l) => {
    console.log(`  - [${l.id}] ${l.title} (status: ${l.status})`);
    if (l.coverImageUrl) console.log(`    Cover: ${l.coverImageUrl}`);
    if (l.images && Array.isArray(l.images) && l.images.length > 0) {
      console.log(`    Images: ${JSON.stringify(l.images)}`);
    }
  });

  // Delete all provider listings
  if (listings.length > 0) {
    const deleteListingsResult = await prisma.mktListingBreederService.deleteMany({
      where: { sourceType: "PROVIDER" },
    });
    console.log(`\n🗑️  Deleted ${deleteListingsResult.count} provider listing(s)`);
  }

  // Find all provider profiles
  const profiles = await prisma.mktServiceProviderProfile.findMany({
    select: {
      id: true,
      businessName: true,
      userId: true,
      logoUrl: true,
      coverImageUrl: true,
      user: { select: { email: true } }
    },
  });

  console.log(`\nFound ${profiles.length} provider profile(s):`);
  profiles.forEach((p) => {
    console.log(`  - [${p.id}] ${p.businessName} (user: ${p.user?.email || p.userId})`);
    if (p.logoUrl) console.log(`    Logo: ${p.logoUrl}`);
    if (p.coverImageUrl) console.log(`    Cover: ${p.coverImageUrl}`);
  });

  // Delete all provider profiles
  if (profiles.length > 0) {
    const deleteProfilesResult = await prisma.mktServiceProviderProfile.deleteMany({});
    console.log(`\n🗑️  Deleted ${deleteProfilesResult.count} provider profile(s)`);
  }

  console.log("\n✅ All provider data cleaned up\n");
  console.log("⚠️  Note: S3 images still exist - manual cleanup required if needed\n");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
