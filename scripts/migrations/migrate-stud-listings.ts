/**
 * Data Migration: MktListingBreederService (STUD_SERVICES) → BreedingListing
 *
 * Migrates legacy stud service listings to the new BreedingListing model.
 * Run this BEFORE migrating stallion bookings.
 *
 * Usage:
 *   npx tsx scripts/migrations/migrate-stud-listings.ts           # Run migration
 *   npx tsx scripts/migrations/migrate-stud-listings.ts --dry-run # Preview without writing
 */

import prisma from '../../src/prisma.js';

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');

async function generateListingNumber(): Promise<string> {
  // Generate globally unique listing number (not per-tenant)
  const count = await prisma.breedingListing.count();
  return `BL-${String(count + 1).padStart(6, '0')}`;
}

function mapListingStatus(status: string): string {
  const mapping: Record<string, string> = {
    'PUBLISHED': 'PUBLISHED',
    'LIVE': 'PUBLISHED',
    'DRAFT': 'DRAFT',
    'SOLD': 'ARCHIVED',
    'ARCHIVED': 'ARCHIVED',
    'INACTIVE': 'ARCHIVED',
  };
  return mapping[status] || 'DRAFT';
}

async function migrateStudListings() {
  console.log('Starting migration: MktListingBreederService → BreedingListing...');
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be written to the database\n');
  }

  try {
    // Find all stud service listings
    const studListings = await prisma.mktListingBreederService.findMany({
      where: {
        listingType: 'STUD_SERVICE',
      },
      include: {
        tenant: true,
        stallion: true,
      },
    });

    console.log(`Found ${studListings.length} stud listings to migrate`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const listing of studListings) {
      try {
        // Check if already migrated (has a corresponding BreedingListing)
        const existing = await prisma.breedingListing.findFirst({
          where: {
            tenantId: listing.tenantId,
            animalId: listing.stallionId || undefined,
          },
        });

        if (existing) {
          console.log(`Skipping listing ${listing.id} - already migrated`);
          skipped++;
          continue;
        }

        // Get the stallion
        const primaryAnimal = listing.stallion;

        if (!primaryAnimal) {
          console.warn(`Listing ${listing.id} has no stallion, skipping`);
          skipped++;
          continue;
        }

        // Generate new listing number
        const listingNumber = await generateListingNumber();

        if (isDryRun) {
          // Dry run: just report what would be done
          console.log(`[DRY RUN] Would migrate listing ${listing.id} → ${listingNumber}`);
          console.log(`  Animal: ${primaryAnimal.name} (${primaryAnimal.species})`);
          console.log(`  Status: ${(listing as any).status || 'DRAFT'} → ${mapListingStatus((listing as any).status || 'DRAFT')}`);
          migrated++;
        } else {
          // Create BreedingListing
          await prisma.breedingListing.create({
            data: {
              tenantId: listing.tenantId,
              listingNumber,

              // Animal
              animalId: primaryAnimal.id,
              species: primaryAnimal.species,
              breed: primaryAnimal.breed || null,
              sex: primaryAnimal.sex,

              // Intent
              intent: 'OFFERING',

              // Content
              headline: listing.title || `${primaryAnimal.name} - Stud Services`,
              description: listing.description || null,
              media: listing.images || [],

              // Pricing
              feeCents: listing.priceCents || 0,
              feeDirection: 'I_RECEIVE',
              feeNotes: null,

              // Availability - legacy model doesn't have these fields
              availableFrom: null,
              availableTo: null,
              seasonName: null,
              breedingMethods: [],
              maxBookings: null,
              currentBookings: 0,

              // Guarantee - legacy model doesn't have these
              guaranteeType: null,
              guaranteeTerms: null,

              // Requirements - legacy model doesn't have these
              requiresHealthTesting: false,
              requiredTests: [],
              requiresContract: true,
              additionalRequirements: null,

              // Status
              status: mapListingStatus(listing.status),
              publishedAt: listing.publishedAt || null,

              // Public marketplace
              publicEnabled: false, // Must be opted in manually
              publicSlug: listing.slug || null,

              // Inquiry settings
              acceptInquiries: true,

              // Metrics
              viewCount: listing.viewCount || 0,
              inquiryCount: listing.inquiryCount || 0,
              bookingCount: 0,

              // Location
              locationCity: listing.city || null,
              locationState: listing.state || null,
              locationCountry: listing.country || null,

              // Timestamps
              createdAt: listing.createdAt,
              updatedAt: listing.updatedAt,
            },
          });

          // Mark original listing as migrated (if migratedAt field exists)
          // await prisma.mktListingBreederService.update({
          //   where: { id: listing.id },
          //   data: { migratedAt: new Date() },
          // });

          migrated++;
          console.log(`✓ Migrated listing ${listing.id} → ${listingNumber}`);
        }
      } catch (err) {
        console.error(`✗ Failed to migrate listing ${listing.id}:`, err);
        errors++;
      }
    }

    console.log('\nMigration complete!');
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateStudListings();
