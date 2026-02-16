/**
 * Cleanup Orphaned Marketplace Images
 *
 * This script identifies and optionally deletes S3 images that are not referenced
 * in the database. This handles the case where image uploads succeed but the
 * database save fails, leaving orphaned files in S3.
 *
 * Usage:
 *   npx tsx scripts/cleanup-orphaned-marketplace-images.ts          # Dry run (report only)
 *   npx tsx scripts/cleanup-orphaned-marketplace-images.ts --delete # Actually delete orphans
 *
 * Environment variables required:
 *   - DATABASE_URL (Prisma connection)
 *   - AWS_REGION (default: us-east-1)
 *   - AWS_ACCESS_KEY_ID
 *   - AWS_SECRET_ACCESS_KEY
 *   - S3_BUCKET
 *   - CDN_DOMAIN (optional)
 */

import { PrismaClient } from "@prisma/client";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// ===========================================================================
// Configuration
// ===========================================================================

const prisma = new PrismaClient();
const BUCKET = process.env.S3_BUCKET || "breederhq-dev-media";
const REGION = process.env.AWS_REGION || "us-east-1";
const CDN_DOMAIN = process.env.CDN_DOMAIN;
const DRY_RUN = !process.argv.includes("--delete");

// S3 prefixes to scan for marketplace images
const S3_PREFIXES = ["providers/"];

const s3 = new S3Client({ region: REGION });

// ===========================================================================
// URL Parsing Utilities
// ===========================================================================

/**
 * Extract S3 storage key from a URL (CDN or direct S3 format)
 */
function extractStorageKey(url: string | null): string | null {
  if (!url) return null;

  // CDN format: https://cdn.example.com/providers/123/photo.jpg
  if (CDN_DOMAIN && url.includes(CDN_DOMAIN)) {
    const match = url.match(new RegExp(`${CDN_DOMAIN}/(.+)$`));
    if (match) return decodeURIComponent(match[1]);
  }

  // Direct S3 format: https://bucket.s3.region.amazonaws.com/key
  // or: https://bucket.s3-region.amazonaws.com/key
  const s3Match = url.match(/s3[.-].*?\.amazonaws\.com\/(.+)$/);
  if (s3Match) return decodeURIComponent(s3Match[1]);

  // CloudFront or other CDN: https://xxx.cloudfront.net/key
  const cfMatch = url.match(/cloudfront\.net\/(.+)$/);
  if (cfMatch) return decodeURIComponent(cfMatch[1]);

  // Simple path extraction as fallback (assumes key is after domain)
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.startsWith("/")) return decodeURIComponent(path.slice(1));
  } catch {
    // Not a valid URL
  }

  return null;
}

/**
 * Extract image URLs from a JSON images array field
 */
function extractImagesFromJson(imagesJson: unknown): string[] {
  if (!imagesJson) return [];

  // Handle array of strings
  if (Array.isArray(imagesJson)) {
    return imagesJson.filter((url): url is string => typeof url === "string");
  }

  // Handle JSON string that needs parsing
  if (typeof imagesJson === "string") {
    try {
      const parsed = JSON.parse(imagesJson);
      if (Array.isArray(parsed)) {
        return parsed.filter((url): url is string => typeof url === "string");
      }
    } catch {
      // Not valid JSON
    }
  }

  return [];
}

// ===========================================================================
// Database Queries
// ===========================================================================

/**
 * Fetch all image URLs referenced in the marketplace database
 */
async function fetchReferencedUrls(): Promise<Set<string>> {
  const urls = new Set<string>();

  console.log("\n📊 Fetching referenced URLs from database...");

  // 1. MarketplaceProvider images
  const providers = await prisma.marketplaceProvider.findMany({
    select: {
      id: true,
      logoUrl: true,
      coverImageUrl: true,
    },
  });

  for (const provider of providers) {
    if (provider.logoUrl) {
      const key = extractStorageKey(provider.logoUrl);
      if (key) urls.add(key);
    }
    if (provider.coverImageUrl) {
      const key = extractStorageKey(provider.coverImageUrl);
      if (key) urls.add(key);
    }
  }
  console.log(`   ✓ MarketplaceProvider: ${providers.length} records checked`);

  // 2. MktListingBreederService images
  const services = await prisma.mktListingBreederService.findMany({
    select: {
      id: true,
      images: true,
      coverImageUrl: true,
    },
  });

  for (const service of services) {
    if (service.coverImageUrl) {
      const key = extractStorageKey(service.coverImageUrl);
      if (key) urls.add(key);
    }
    const imageUrls = extractImagesFromJson(service.images);
    for (const url of imageUrls) {
      const key = extractStorageKey(url);
      if (key) urls.add(key);
    }
  }
  console.log(`   ✓ MktListingBreederService: ${services.length} records checked`);

  // 3. MktListingBreedingProgram images (coverImageUrl only, no images array)
  try {
    const programs = await prisma.mktListingBreedingProgram.findMany({
      select: {
        id: true,
        coverImageUrl: true,
      },
    });

    for (const program of programs) {
      if (program.coverImageUrl) {
        const key = extractStorageKey(program.coverImageUrl);
        if (key) urls.add(key);
      }
    }
    console.log(`   ✓ MktListingBreedingProgram: ${programs.length} records checked`);
  } catch {
    // Table may not exist in all environments
    console.log(`   ⚠ MktListingBreedingProgram: skipped (table may not exist)`);
  }

  // 4. MktListingIndividualAnimal images (coverImageUrl only, no images array)
  try {
    const individuals = await prisma.mktListingIndividualAnimal.findMany({
      select: {
        id: true,
        coverImageUrl: true,
      },
    });

    for (const individual of individuals) {
      if (individual.coverImageUrl) {
        const key = extractStorageKey(individual.coverImageUrl);
        if (key) urls.add(key);
      }
    }
    console.log(`   ✓ MktListingIndividualAnimal: ${individuals.length} records checked`);
  } catch {
    console.log(`   ⚠ MktListingIndividualAnimal: skipped (table may not exist)`);
  }

  // 5. MktListingBreedingBooking images (coverImageUrl only)
  try {
    const bookings = await prisma.mktListingBreedingBooking.findMany({
      select: {
        id: true,
        coverImageUrl: true,
      },
    });

    for (const booking of bookings) {
      if (booking.coverImageUrl) {
        const key = extractStorageKey(booking.coverImageUrl);
        if (key) urls.add(key);
      }
    }
    console.log(`   ✓ MktListingBreedingBooking: ${bookings.length} records checked`);
  } catch {
    console.log(`   ⚠ MktListingBreedingBooking: skipped (table may not exist)`);
  }

  // 6. MktListingAnimalProgram images (coverImageUrl only)
  try {
    const animalPrograms = await prisma.mktListingAnimalProgram.findMany({
      select: {
        id: true,
        coverImageUrl: true,
      },
    });

    for (const program of animalPrograms) {
      if (program.coverImageUrl) {
        const key = extractStorageKey(program.coverImageUrl);
        if (key) urls.add(key);
      }
    }
    console.log(`   ✓ MktListingAnimalProgram: ${animalPrograms.length} records checked`);
  } catch {
    console.log(`   ⚠ MktListingAnimalProgram: skipped (table may not exist)`);
  }

  console.log(`\n   Total unique image keys in DB: ${urls.size}`);
  return urls;
}

// ===========================================================================
// S3 Operations
// ===========================================================================

/**
 * List all objects in S3 under the given prefixes
 */
async function listS3Objects(prefixes: string[]): Promise<string[]> {
  const allKeys: string[] = [];

  console.log("\n📦 Scanning S3 bucket for marketplace images...");

  for (const prefix of prefixes) {
    let continuationToken: string | undefined;
    let count = 0;

    do {
      const response = await s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            allKeys.push(obj.Key);
            count++;
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log(`   ✓ Prefix "${prefix}": ${count} objects found`);
  }

  console.log(`\n   Total S3 objects: ${allKeys.length}`);
  return allKeys;
}

/**
 * Delete an S3 object
 */
async function deleteS3Object(key: string): Promise<boolean> {
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );
    return true;
  } catch (err: any) {
    console.error(`   ❌ Failed to delete ${key}: ${err.message}`);
    return false;
  }
}

// ===========================================================================
// Main Cleanup Logic
// ===========================================================================

async function main() {
  console.log("═".repeat(70));
  console.log(" S3 Orphaned Marketplace Images Cleanup Script");
  console.log("═".repeat(70));
  console.log(`\n🔧 Configuration:`);
  console.log(`   Bucket: ${BUCKET}`);
  console.log(`   Region: ${REGION}`);
  console.log(`   CDN Domain: ${CDN_DOMAIN || "(not configured)"}`);
  console.log(`   Mode: ${DRY_RUN ? "🔍 DRY RUN (report only)" : "🗑️  DELETE MODE"}`);

  // Step 1: Fetch all referenced URLs from database
  const referencedKeys = await fetchReferencedUrls();

  // Step 2: List all S3 objects
  const s3Keys = await listS3Objects(S3_PREFIXES);

  // Step 3: Find orphaned objects (in S3 but not in DB)
  const orphanedKeys = s3Keys.filter((key) => !referencedKeys.has(key));

  console.log("\n" + "─".repeat(70));
  console.log(" Analysis Results");
  console.log("─".repeat(70));
  console.log(`\n   📊 Summary:`);
  console.log(`      S3 objects scanned:     ${s3Keys.length}`);
  console.log(`      DB references found:    ${referencedKeys.size}`);
  console.log(`      Orphaned objects:       ${orphanedKeys.length}`);

  if (orphanedKeys.length === 0) {
    console.log("\n✅ No orphaned images found! Your S3 bucket is clean.");
    return;
  }

  // Calculate potential savings (estimate based on average image size)
  const estimatedSizeBytes = orphanedKeys.length * 500 * 1024; // ~500KB average
  const estimatedSizeMB = (estimatedSizeBytes / (1024 * 1024)).toFixed(2);
  console.log(`      Estimated space:        ~${estimatedSizeMB} MB`);

  // Step 4: Report or delete orphaned objects
  console.log("\n" + "─".repeat(70));
  console.log(DRY_RUN ? " Orphaned Files (would be deleted)" : " Deleting Orphaned Files");
  console.log("─".repeat(70));

  // Show first 20 orphaned keys as sample
  const sampleKeys = orphanedKeys.slice(0, 20);
  console.log(`\n   Sample of orphaned files (showing ${sampleKeys.length} of ${orphanedKeys.length}):\n`);
  for (const key of sampleKeys) {
    console.log(`   • ${key}`);
  }
  if (orphanedKeys.length > 20) {
    console.log(`   ... and ${orphanedKeys.length - 20} more`);
  }

  if (DRY_RUN) {
    console.log("\n" + "─".repeat(70));
    console.log(" Dry Run Complete");
    console.log("─".repeat(70));
    console.log(`\n⚠️  No files were deleted. To delete orphaned files, run:`);
    console.log(`   npx tsx scripts/cleanup-orphaned-marketplace-images.ts --delete\n`);
    return;
  }

  // Delete orphaned objects
  console.log(`\n🗑️  Deleting ${orphanedKeys.length} orphaned files...`);
  let deletedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < orphanedKeys.length; i++) {
    const key = orphanedKeys[i];
    const success = await deleteS3Object(key);
    if (success) {
      deletedCount++;
    } else {
      failedCount++;
    }

    // Progress indicator every 100 files
    if ((i + 1) % 100 === 0) {
      console.log(`   Progress: ${i + 1}/${orphanedKeys.length} processed`);
    }
  }

  console.log("\n" + "─".repeat(70));
  console.log(" Deletion Complete");
  console.log("─".repeat(70));
  console.log(`\n   ✅ Successfully deleted: ${deletedCount}`);
  console.log(`   ❌ Failed to delete:     ${failedCount}`);
  console.log(`   💾 Estimated space freed: ~${estimatedSizeMB} MB\n`);
}

// ===========================================================================
// Entry Point
// ===========================================================================

main()
  .catch((e) => {
    console.error("\n❌ Script failed with error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
