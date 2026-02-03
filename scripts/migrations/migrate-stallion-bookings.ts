/**
 * Data Migration: StallionBooking → BreedingBooking
 *
 * Migrates legacy stallion bookings to the new BreedingBooking model.
 * Run this AFTER migrating stud listings.
 *
 * Usage:
 *   npx tsx scripts/migrations/migrate-stallion-bookings.ts           # Run migration
 *   npx tsx scripts/migrations/migrate-stallion-bookings.ts --dry-run # Preview without writing
 */

import prisma from '../../src/prisma.js';

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');

async function generateBookingNumber(): Promise<string> {
  // Generate globally unique booking number (not per-tenant)
  const count = await prisma.breedingBooking.count();
  return `BK-${String(count + 1).padStart(6, '0')}`;
}

function mapStallionBookingStatus(status: string): string {
  const mapping: Record<string, string> = {
    'INQUIRY': 'INQUIRY',
    'PENDING_MARE_INFO': 'PENDING_REQUIREMENTS',
    'PENDING_REQUIREMENTS': 'PENDING_REQUIREMENTS',
    'APPROVED': 'APPROVED',
    'DEPOSIT_PAID': 'DEPOSIT_PAID',
    'CONFIRMED': 'CONFIRMED',
    'SCHEDULED': 'SCHEDULED',
    'BREEDING_IN_PROGRESS': 'IN_PROGRESS',
    'IN_PROGRESS': 'IN_PROGRESS',
    'COMPLETED': 'COMPLETED',
    'CANCELLED': 'CANCELLED',
  };
  return mapping[status] || 'INQUIRY';
}

async function migrateStallionBookings() {
  console.log('Starting migration: StallionBooking → BreedingBooking...');
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be written to the database\n');
  }

  try {
    // Find all stallion bookings
    const stallionBookings = await prisma.stallionBooking.findMany({
      include: {
        tenant: true,
        stallion: true,
        mare: true,
        mareOwnerParty: true,
        breedingPlan: true,
      },
    });

    console.log(`Found ${stallionBookings.length} stallion bookings to migrate`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const booking of stallionBookings) {
      try {
        // Check if already migrated
        const existing = await prisma.breedingBooking.findFirst({
          where: {
            offeringTenantId: booking.tenantId,
            offeringAnimalId: booking.stallionId,
            seekingPartyId: booking.mareOwnerPartyId,
            createdAt: booking.createdAt,
          },
        });

        if (existing) {
          console.log(`Skipping booking ${booking.id} - already migrated`);
          skipped++;
          continue;
        }

        // Generate new booking number
        const bookingNumber = await generateBookingNumber();

        if (isDryRun) {
          // Dry run: just report what would be done
          console.log(`[DRY RUN] Would migrate booking ${booking.id} → ${bookingNumber}`);
          console.log(`  Stallion: ${booking.stallion?.name || booking.stallionId} (Owner Tenant: ${booking.tenantId})`);
          console.log(`  Mare Owner: ${booking.mareOwnerParty?.name || booking.mareOwnerPartyId}`);
          console.log(`  Status: ${booking.status || 'INQUIRY'} → ${mapStallionBookingStatus(booking.status || 'INQUIRY')}`);
          migrated++;
        } else {
          // Create BreedingBooking
          await prisma.breedingBooking.create({
            data: {
              bookingNumber,

              // Source - legacy bookings weren't from marketplace
              sourceListingId: null,
              sourceInquiryId: null,

              // Offering side (stallion owner)
              offeringTenantId: booking.tenantId,
              offeringAnimalId: booking.stallionId,

              // Seeking side (mare owner)
              seekingPartyId: booking.mareOwnerPartyId,
              seekingTenantId: null, // Mare owner is external (Party), not a tenant
              seekingAnimalId: booking.mareId || null,

              // External mare info (if mare not in system)
              externalAnimalName: booking.externalMareName || null,
              externalAnimalReg: booking.externalMareReg || null,
              externalAnimalBreed: booking.externalMareBreed || null,
              externalAnimalSex: 'F',

              // Details
              species: booking.stallion?.species || 'HORSE',
              bookingType: 'STUD_SERVICE',
              preferredMethod: booking.preferredMethod || null,

              // Scheduling
              preferredDateStart: booking.preferredDateStart || null,
              preferredDateEnd: booking.preferredDateEnd || null,
              scheduledDate: booking.scheduledDate || null,

              // Shipping
              shippingRequired: booking.shippingRequired || false,
              shippingAddress: booking.shippingAddress || null,

              // Financials
              agreedFeeCents: booking.agreedFeeCents || 0,
              depositCents: booking.bookingFeeCents || 0,
              totalPaidCents: booking.totalPaidCents || 0,
              feeDirection: 'I_RECEIVE', // Offering breeder receives the fee

              // Status
              status: mapStallionBookingStatus(booking.status || 'INQUIRY'),
              statusChangedAt: booking.statusChangedAt || booking.createdAt,

              // Requirements - parse from requirementsJson
              requirements: (booking.requirementsJson as any) || {},
              requirementsConfig: 'HORSE_DEFAULT',

              // Guarantee
              guaranteeType: booking.guaranteeType || null,

              // Link to BreedingPlan
              breedingPlanId: booking.breedingPlanId || null,

              // Notes
              notes: booking.notes || null,
              internalNotes: booking.internalNotes || null,

              // Audit
              createdAt: booking.createdAt,
              updatedAt: booking.updatedAt,
              cancelledAt: booking.cancelledAt || null,
              cancellationReason: booking.cancellationReason || null,
            },
          });

          // Mark original booking as migrated (if migratedAt field exists)
          // await prisma.stallionBooking.update({
          //   where: { id: booking.id },
          //   data: { migratedAt: new Date() },
          // });

          migrated++;
          console.log(`✓ Migrated booking ${booking.id} → ${bookingNumber}`);
        }
      } catch (err) {
        console.error(`✗ Failed to migrate booking ${booking.id}:`, err);
        errors++;
      }
    }

    console.log('\nMigration complete!');
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);

    // Verify data integrity
    console.log('\nVerifying data integrity...');
    const breedingBookings = await prisma.breedingBooking.count();
    const withBreedingPlan = await prisma.breedingBooking.count({
      where: { breedingPlanId: { not: null } },
    });
    console.log(`Total BreedingBooking records: ${breedingBookings}`);
    console.log(`With BreedingPlan link: ${withBreedingPlan}`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateStallionBookings();
