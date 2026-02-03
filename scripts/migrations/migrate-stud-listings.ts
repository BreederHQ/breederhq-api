/**
 * Data Migration: MktListingBreederService (STUD_SERVICES) → BreedingListing
 *
 * Migrates legacy stud service listings to the new BreedingListing model.
 * Run this BEFORE migrating stallion bookings.
 *
 * Usage: npx tsx scripts/migrations/migrate-stud-listings.ts
 */

import prisma from '../../src/prisma.js';

async function generateListingNumber(tenantId: number): Promise<string> {
  const count = await prisma.breedingListing.count({ where: { tenantId } });
  return `BL-${String(count + 1).padStart(6, '0')}`;
}

function mapListingStatus(status: string): string {
  const mapping: Record<string, string> = {
    'PUBLISHED': 'PUBLISHED',
    'DRAFT': 'DRAFT',
    'SOLD': 'ARCHIVED',
    'ARCHIVED': 'ARCHIVED',
    'INACTIVE': 'ARCHIVED',
  };
  return mapping[status] || 'DRAFT';
}

async function migrateStudListings() {
  console.log('Starting migration: MktListingBreederService → BreedingListing...');

  try {
    // Find all stud service listings
    const studListings = await prisma.mktListingBreederService.findMany({
      where: {
        // If there's a type field, filter by STUD_SERVICES
        // Otherwise, migrate all breeder service listings
      },
      include: {
        tenant: true,
        participants: {
          include: {
            animal: true,
          },
        },
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
            // Check if animal matches (if listing has participants)
            animalId: listing.participants[0]?.animalId,
          },
        });

        if (existing) {
          console.log(`Skipping listing ${listing.id} - already migrated`);
          skipped++;
          continue;
        }

        // Get the primary animal from participants
        const primaryAnimal = listing.participants[0]?.animal;

        if (!primaryAnimal) {
          console.warn(`Listing ${listing.id} has no animals, skipping`);
          skipped++;
          continue;
        }

        // Generate new listing number
        const listingNumber = await generateListingNumber(listing.tenantId);

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
            intent: 'offering',

            // Content
            headline: (listing as any).title || `${primaryAnimal.name} - Stud Services`,
            description: (listing as any).description || null,
            media: (listing as any).photos || [],

            // Pricing
            feeCents: (listing as any).bookingFeeCents || 0,
            feeDirection: 'i_receive',
            feeNotes: null,

            // Availability
            availableFrom: (listing as any).seasonStart || null,
            availableTo: (listing as any).seasonEnd || null,
            seasonName: (listing as any).seasonName || null,
            breedingMethods: (listing as any).breedingMethods || [],
            maxBookings: (listing as any).maxBookings || null,
            currentBookings: (listing as any).bookingsReceived || 0,

            // Guarantee
            guaranteeType: (listing as any).defaultGuaranteeType || null,
            guaranteeTerms: (listing as any).guaranteeTerms || null,

            // Requirements
            requiresHealthTesting: (listing as any).healthCertRequired || false,
            requiredTests: (listing as any).requiredTests || [],
            requiresContract: true,
            additionalRequirements: null,

            // Status
            status: mapListingStatus((listing as any).status || 'DRAFT'),
            publishedAt: (listing as any).publishedAt || null,

            // Public marketplace
            publicEnabled: false, // Must be opted in manually
            publicSlug: null,

            // Inquiry settings
            acceptInquiries: true,

            // Metrics (will be recalculated)
            viewCount: 0,
            inquiryCount: 0,
            bookingCount: (listing as any).bookingsReceived || 0,

            // Location
            locationCity: (listing as any).locationCity || null,
            locationState: (listing as any).locationState || null,
            locationCountry: (listing as any).locationCountry || null,

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
