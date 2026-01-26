/**
 * Cleanup orphaned mktListingBreedingProgram records for tenant 4
 *
 * These records were created by the sync function but never deleted when
 * programs were removed from the profile's listedPrograms.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAMESPACE = "marketplace-profile";

async function main() {
  const tenantId = 4;

  console.log('='.repeat(60));
  console.log(`Cleaning up orphaned mktListingBreedingProgram for Tenant ${tenantId}`);
  console.log('='.repeat(60));

  // 1. Get current profile listedPrograms
  const setting = await prisma.tenantSetting.findUnique({
    where: { tenantId_namespace: { tenantId, namespace: NAMESPACE } },
    select: { data: true },
  });

  const profileData = setting?.data as any;
  const draftPrograms = profileData?.draft?.listedPrograms || [];
  const publishedPrograms = profileData?.published?.listedPrograms || [];

  // Merge draft and published programs (draft takes precedence if exists)
  const activePrograms = draftPrograms.length > 0 ? draftPrograms : publishedPrograms;

  console.log(`\nActive programs in profile: ${activePrograms.length}`);
  activePrograms.forEach((p: any, idx: number) => {
    console.log(`  ${idx + 1}. "${p.name}" (${p.species})`);
  });

  // Generate slugs for active programs
  const activeSlugs = new Set(
    activePrograms
      .filter((p: any) => p.name && p.name.trim().length >= 3)
      .map((p: any) => generateSlug(p.name))
  );

  console.log(`\nActive slugs: ${Array.from(activeSlugs).join(', ')}`);

  // 2. Get all mktListingBreedingProgram records for this tenant
  const mktListings = await prisma.mktListingBreedingProgram.findMany({
    where: { tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
    },
  });

  console.log(`\nmktListingBreedingProgram records: ${mktListings.length}`);

  // 3. Find orphaned records (not in active slugs)
  const orphanedRecords = mktListings.filter(l => !activeSlugs.has(l.slug));
  const validRecords = mktListings.filter(l => activeSlugs.has(l.slug));

  console.log(`\nValid records (matching profile): ${validRecords.length}`);
  validRecords.forEach((l, idx) => {
    console.log(`  ${idx + 1}. ID: ${l.id}, Slug: "${l.slug}", Name: "${l.name}"`);
  });

  console.log(`\nOrphaned records to delete: ${orphanedRecords.length}`);
  orphanedRecords.forEach((l, idx) => {
    console.log(`  ${idx + 1}. ID: ${l.id}, Slug: "${l.slug}", Name: "${l.name}"`);
  });

  if (orphanedRecords.length === 0) {
    console.log('\nNo orphaned records to delete. Exiting.');
    await prisma.$disconnect();
    return;
  }

  // 4. Delete orphaned records
  console.log('\nDeleting orphaned records...');

  const orphanedIds = orphanedRecords.map(l => l.id);
  const deleteResult = await prisma.mktListingBreedingProgram.deleteMany({
    where: {
      id: { in: orphanedIds },
      tenantId, // Safety: ensure we only delete for this tenant
    },
  });

  console.log(`\nDeleted ${deleteResult.count} orphaned records.`);

  // 5. Verify
  const remainingCount = await prisma.mktListingBreedingProgram.count({
    where: { tenantId },
  });

  console.log(`\nRemaining mktListingBreedingProgram records: ${remainingCount}`);
  console.log('='.repeat(60));
  console.log('Cleanup complete!');
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

main().catch(console.error);
