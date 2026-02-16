// scripts/cleanup-provider-data-complete.ts
// Complete cleanup: Delete ALL provider profiles, listings, and related data
// Run with: npx tsx scripts/cleanup-provider-data-complete.ts

import { PrismaClient } from "@prisma/client";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const BUCKET = process.env.S3_BUCKET || "breederhq-dev-media";

async function deleteS3Object(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const match = url.match(/s3[.-].*?\.amazonaws\.com\/(.+)$/);
    if (!match) return false;
    const key = decodeURIComponent(match[1]);
    console.log(`    🗑️  Deleting S3: ${key}`);
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err: any) {
    console.log(`    ❌ S3 delete failed: ${err.message}`);
    return false;
  }
}

async function safeDelete(name: string, fn: () => Promise<{ count: number }>) {
  try {
    const result = await fn();
    console.log(`🗑️  Deleted ${result.count} ${name}`);
    return result.count;
  } catch (e: any) {
    console.log(`⚠️  Could not delete ${name}: ${e.message?.slice(0, 80) || 'Unknown error'}`);
    return 0;
  }
}

async function main() {
  console.log("\n🧹 COMPLETE CLEANUP: Provider data + S3 files\n");

  const s3UrlsToDelete: string[] = [];

  // 1. Delete provider listings
  const listings = await prisma.mktListingBreederService.findMany({
    where: { sourceType: "PROVIDER" },
    select: { id: true, coverImageUrl: true, images: true },
  });
  console.log(`📝 Found ${listings.length} provider listing(s)`);

  for (const l of listings) {
    if (l.coverImageUrl) s3UrlsToDelete.push(l.coverImageUrl);
    if (l.images && Array.isArray(l.images)) {
      for (const img of l.images) {
        if (typeof img === "string" && img.includes("s3")) s3UrlsToDelete.push(img);
      }
    }
  }

  await safeDelete("listings", () =>
    prisma.mktListingBreederService.deleteMany({ where: { sourceType: "PROVIDER" } })
  );

  // 2. Get provider profiles
  const profiles = await prisma.marketplaceProvider.findMany({
    select: { id: true, businessName: true, logoUrl: true, coverImageUrl: true },
  });
  console.log(`\n🏪 Found ${profiles.length} provider profile(s)`);
  const providerIds = profiles.map(p => p.id);

  for (const p of profiles) {
    if (p.logoUrl) s3UrlsToDelete.push(p.logoUrl);
    if (p.coverImageUrl) s3UrlsToDelete.push(p.coverImageUrl);
  }

  if (providerIds.length > 0) {
    // 3. Delete related data in FK order
    await safeDelete("invoices", () =>
      prisma.marketplaceInvoice.deleteMany({ where: { transaction: { providerId: { in: providerIds } } } })
    );

    await safeDelete("reviews", () =>
      prisma.marketplaceReview.deleteMany({ where: { transaction: { providerId: { in: providerIds } } } })
    );

    await safeDelete("transactions", () =>
      prisma.marketplaceTransaction.deleteMany({ where: { providerId: { in: providerIds } } })
    );

    // Try to delete inquiry data if model exists
    await safeDelete("inquiry messages", () =>
      (prisma as any).mktInquiryMessage?.deleteMany?.({ where: { thread: { providerId: { in: providerIds } } } }) ||
      Promise.resolve({ count: 0 })
    );

    await safeDelete("inquiry threads", () =>
      (prisma as any).mktInquiryThread?.deleteMany?.({ where: { providerId: { in: providerIds } } }) ||
      Promise.resolve({ count: 0 })
    );

    await safeDelete("saved items", () =>
      prisma.marketplaceSavedItem.deleteMany({ where: { itemType: "service" } })
    );

    await safeDelete("provider reports", () =>
      prisma.marketplaceProviderReport.deleteMany({ where: { providerId: { in: providerIds } } })
    );
  }

  // 4. Delete provider profiles
  await safeDelete("provider profiles", () => prisma.marketplaceProvider.deleteMany({}));

  // 5. Delete S3 files
  console.log(`\n☁️  Deleting ${s3UrlsToDelete.length} S3 file(s)...\n`);
  let s3Deleted = 0;
  for (const url of s3UrlsToDelete) {
    if (await deleteS3Object(url)) s3Deleted++;
  }

  console.log(`\n✅ CLEANUP COMPLETE`);
  console.log(`   S3 files deleted: ${s3Deleted}/${s3UrlsToDelete.length}\n`);
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
