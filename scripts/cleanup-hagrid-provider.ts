// scripts/cleanup-hagrid-provider.ts
// One-time cleanup script to remove provider data incorrectly created for breeder account
// Run with: npx ts-node scripts/cleanup-hagrid-provider.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "hadrig.dev@hogwarts.local";

  console.log(`\n🧹 Cleaning up provider data for: ${email}\n`);

  // Find the user
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!user) {
    console.log(`❌ User not found: ${email}`);
    return;
  }

  console.log(`Found user: ${user.firstName} ${user.lastName} (${user.id})`);

  // Find provider profile for this user
  const providerProfile = await prisma.mktServiceProviderProfile.findFirst({
    where: { userId: user.id },
    select: { id: true, businessName: true, userId: true },
  });

  if (!providerProfile) {
    console.log(`✅ No provider profile found for this user - nothing to clean up`);
    return;
  }

  console.log(`Found provider profile: ${providerProfile.businessName} (ID: ${providerProfile.id})`);

  // Find listings created by this provider
  const listings = await prisma.mktListingBreederService.findMany({
    where: { providerId: providerProfile.id },
    select: { id: true, title: true, status: true },
  });

  console.log(`Found ${listings.length} listing(s) to delete:`);
  listings.forEach((l) => console.log(`  - [${l.id}] ${l.title} (${l.status})`));

  // Delete listings first (foreign key constraint)
  if (listings.length > 0) {
    const deleteListingsResult = await prisma.mktListingBreederService.deleteMany({
      where: { providerId: providerProfile.id },
    });
    console.log(`\n🗑️  Deleted ${deleteListingsResult.count} listing(s)`);
  }

  // Delete the provider profile
  await prisma.mktServiceProviderProfile.delete({
    where: { id: providerProfile.id },
  });
  console.log(`🗑️  Deleted provider profile: ${providerProfile.businessName}`);

  console.log(`\n✅ Cleanup complete for ${email}\n`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
