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

async function generateBookingNumber(tenantId: number): Promise<string> {
  const count = await prisma.breedingBooking.count({ where: { offeringTenantId: tenantId } });
  return `BK-${String(count + 1).padStart(6, '0')}`;
}

function mapStallionBookingStatus(status: string): string {
  const mapping: Record<string, string> = {
    'INQUIRY': 'INQUIRY',
    'PENDING_MARE_INFO': 'PENDING_REQUIREMENTS',
    'MARE_INFO_RECEIVED': 'REQUIREMENTS_RECEIVED',
    'PENDING_CONTRACT': 'PENDING_CONTRACT',
    'CONTRACT_SENT': 'PENDING_CONTRACT',
    'CONTRACT_SIGNED': 'CONTRACT_SIGNED',
    'PENDING_PAYMENT': 'PENDING_PAYMENT',
    'DEPOSIT_PAID': 'PAID',
    'FULLY_PAID': 'PAID',
    'SCHEDULED': 'SCHEDULED',
    'BREEDING_IN_PROGRESS': 'IN_PROGRESS',
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
        stallion: true,
        mare: true,
        stallionOwnerTenant: true,
        mareOwnerTenant: true,
        stallionOwnerParty: true,
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
            offeringTenantId: booking.stallionOwnerTenantId,
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
        const bookingNumber = await generateBookingNumber(booking.stallionOwnerTenantId);

        if (isDryRun) {
          // Dry run: just report what would be done
          console.log(`[DRY RUN] Would migrate booking ${booking.id} → ${bookingNumber}`);
          console.log(`  Stallion: ${booking.stallion.name || booking.stallionId} (Owner: ${booking.stallionOwnerTenantId})`);
          console.log(`  Mare Owner: ${booking.mareOwnerParty?.name || booking.mareOwnerPartyId}`);
          console.log(`  Status: ${(booking as any).status || 'INQUIRY'} → ${mapStallionBookingStatus((booking as any).status || 'INQUIRY')}`);
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
              offeringTenantId: booking.stallionOwnerTenantId,
              offeringAnimalId: booking.stallionId,

              // Seeking side (mare owner)
              seekingPartyId: booking.mareOwnerPartyId,
              seekingTenantId: booking.mareOwnerTenantId || null,
              seekingAnimalId: booking.mareId || null,

              // External mare info (if mare not in system)
              externalPartyName: booking.mareOwnerParty?.name || null,
              externalPartyEmail: booking.mareOwnerParty?.email || null,
              externalPartyPhone: booking.mareOwnerParty?.phone || null,
              externalAnimalName: (booking as any).externalMareName || null,
              externalAnimalReg: (booking as any).externalMareReg || null,
              externalAnimalBreed: (booking as any).externalMareBreed || null,
              externalAnimalSex: 'F',

              // Details
              species: booking.stallion.species,
              bookingType: 'STUD_SERVICE',
              preferredMethod: (booking as any).breedingMethod || null,

              // Scheduling
              preferredDateStart: (booking as any).preferredDateStart || null,
              preferredDateEnd: (booking as any).preferredDateEnd || null,
              scheduledDate: (booking as any).scheduledDate || null,

              // Shipping
              shippingRequired: (booking as any).shippingRequired || false,
              shippingAddress: (booking as any).shippingAddress || null,

              // Financials
              agreedFeeCents: (booking as any).agreedFeeCents || 0,
              depositCents: (booking as any).depositCents || 0,
              totalPaidCents: (booking as any).totalPaidCents || 0,
              feeDirection: 'OFFERING_RECEIVES',

              // Status
              status: mapStallionBookingStatus((booking as any).status || 'INQUIRY'),
              statusChangedAt: (booking as any).statusChangedAt || booking.createdAt,

              // Requirements
              requirements: {
                coggins: {
                  received: (booking as any).cogginsReceived || false,
                  date: (booking as any).cogginsDate || null,
                },
                culture: {
                  received: (booking as any).cultureReceived || false,
                  date: (booking as any).cultureDate || null,
                },
                uterineExam: {
                  received: (booking as any).uterineExamReceived || false,
                  date: (booking as any).uterineExamDate || null,
                },
              },
              requirementsConfig: 'HORSE_DEFAULT',

              // Guarantee
              guaranteeType: (booking as any).guaranteeType || null,

              // Link to BreedingPlan
              breedingPlanId: booking.breedingPlanId || null,

              // Notes
              notes: (booking as any).notes || null,
              internalNotes: (booking as any).internalNotes || null,

              // Audit
              createdAt: booking.createdAt,
              updatedAt: booking.updatedAt,
              cancelledAt: (booking as any).cancelledAt || null,
              cancellationReason: (booking as any).cancellationReason || null,
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
