/**
 * Seed Default Stud Visibility Rules for Existing Tenants
 *
 * This migration creates TENANT-level default visibility rules for all
 * existing tenants that don't already have one. This ensures the visibility
 * system works correctly with inheritance for stud listings.
 *
 * Usage:
 *   npx ts-node scripts/migrations/seed-stud-visibility-defaults.ts
 *
 * Or with environment:
 *   DATABASE_URL="..." npx ts-node scripts/migrations/seed-stud-visibility-defaults.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default visibility configuration - conservative defaults
// Breeder opts-in to more visibility
const DEFAULT_VISIBILITY_CONFIG = {
  booking: {
    enabled: true,
    showSlotsAvailable: true,
    showTotalSlots: false,
    showSeasonDates: true,
    showAcceptingBookings: true,
    showHealthCertRequired: true,
    showCogginsRequired: true,
    showCultureRequired: true,
    showUterineExamRequired: true,
    showRequirementsNotes: false,
    showBookingFee: true,
    showFullFee: true,
    showFeeRange: false,
    showPaymentTerms: false,
    showGuaranteeType: true,
    showGuaranteeTerms: false,
    showShippingAvailable: true,
    showShippingRegions: false,
    showShippingFee: false,
  },
  semen: {
    enabled: true,
    showStorageTypes: true,
    showDosesAvailable: false,
    showStorageFacility: false,
    showQualityGrade: true,
    showMotility: false,
    showMorphology: false,
    showConcentration: false,
    showCollectionDates: false,
    showCollectionMethod: false,
    showExpirationDates: false,
    showBatchInfo: false,
  },
  calendar: {
    enabled: true,
    showAvailableDates: true,
    showBlockedPeriods: false,
    showBookedDates: false,
    showCollectionDays: false,
    showNextAvailable: true,
    showLiveCoverAvailable: true,
    showAIFreshAvailable: true,
    showAIFrozenAvailable: true,
    showShippingOptions: true,
  },
  performance: {
    enabled: false, // Entire section disabled by default - opt-in
    showSuccessRate: false,
    showTotalBreedings: false,
    showCompletedBreedings: false,
    showCurrentPregnancies: false,
    showYearlyBreedings: false,
    showLifetimeStats: false,
    showCurrentSeason: false,
    showBookingCount: false,
  },
  breedingTerms: {
    enabled: true,
    showMethods: true,
    showPreferredMethod: false,
    showMareAgeRequirements: true,
    showMareBreedRequirements: true,
    showMareHealthRequirements: true,
    showContractRequired: true,
    showContractTerms: false,
    showBestTimeToBreed: false,
    showSeasonalAvailability: true,
  },
  version: 1,
};

async function seedVisibilityDefaults() {
  console.log('🌱 Seeding default stud visibility rules...\n');

  try {
    // Get all existing tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true },
    });

    console.log(`Found ${tenants.length} tenants\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const tenant of tenants) {
      try {
        // Check if tenant already has a TENANT-level rule
        // Using raw query since the model may not be generated yet
        const existingRule = await (prisma as any).studVisibilityRule?.findFirst?.({
          where: {
            tenantId: tenant.id,
            level: 'TENANT',
            levelId: String(tenant.id),
          },
        });

        if (existingRule) {
          console.log(`  ⏭️  [${tenant.id}] ${tenant.name || tenant.slug} - Already has default rule`);
          skipped++;
          continue;
        }

        // Create default TENANT-level rule
        await (prisma as any).studVisibilityRule?.create?.({
          data: {
            tenantId: tenant.id,
            level: 'TENANT',
            levelId: String(tenant.id),
            config: DEFAULT_VISIBILITY_CONFIG,
            enabled: true,
            inheritsFromId: null, // Root level - no parent
          },
        });

        console.log(`  ✅ [${tenant.id}] ${tenant.name || tenant.slug} - Created default rule`);
        created++;
      } catch (err: any) {
        // If the table doesn't exist yet, that's expected before migration
        if (err.code === 'P2021' || err.message?.includes('does not exist')) {
          console.log(`  ⚠️  [${tenant.id}] ${tenant.name || tenant.slug} - StudVisibilityRule table not yet created`);
          console.log('     Run database migration first: prisma migrate deploy');
          skipped++;
        } else {
          console.error(`  ❌ [${tenant.id}] ${tenant.name || tenant.slug} - Error:`, err.message);
          errors++;
        }
      }
    }

    console.log('\n────────────────────────────────────────');
    console.log('📊 Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors:  ${errors}`);
    console.log('────────────────────────────────────────\n');

    if (created > 0) {
      console.log('✅ Migration complete! Default visibility rules have been created.\n');
    } else if (skipped === tenants.length) {
      console.log('ℹ️  No changes needed - all tenants already have default rules.\n');
    }

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
seedVisibilityDefaults()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
