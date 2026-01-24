-- Marketplace Table Renames Migration
-- This migration renames marketplace listing tables to follow mkt_listing_* convention
-- And migrates status enum from ListingStatus to MarketplaceListingStatus

-- =============================================================================
-- PHASE 1: Status Enum Migration for MarketplaceListing
-- =============================================================================

-- Add new status column with MarketplaceListingStatus type
ALTER TABLE "public"."MarketplaceListing"
ADD COLUMN "new_status" "public"."MarketplaceListingStatus" DEFAULT 'DRAFT';

-- Migrate data from old status to new status
UPDATE "public"."MarketplaceListing" SET "new_status" = 'DRAFT' WHERE status::text = 'DRAFT';
UPDATE "public"."MarketplaceListing" SET "new_status" = 'LIVE' WHERE status::text = 'ACTIVE';
UPDATE "public"."MarketplaceListing" SET "new_status" = 'PAUSED' WHERE status::text = 'PAUSED';
-- Map any remaining statuses to DRAFT (PENDING_REVIEW, EXPIRED, REMOVED)
UPDATE "public"."MarketplaceListing" SET "new_status" = 'DRAFT' WHERE "new_status" IS NULL;

-- Drop old status column
ALTER TABLE "public"."MarketplaceListing" DROP COLUMN "status";

-- Rename new_status to status
ALTER TABLE "public"."MarketplaceListing" RENAME COLUMN "new_status" TO "status";

-- Set NOT NULL constraint
ALTER TABLE "public"."MarketplaceListing" ALTER COLUMN "status" SET NOT NULL;

-- Set default
ALTER TABLE "public"."MarketplaceListing" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"MarketplaceListingStatus";

-- =============================================================================
-- PHASE 2: Table Renames
-- =============================================================================

-- Rename AnimalPublicListing -> mkt_listing_individual_animal
ALTER TABLE "public"."AnimalPublicListing" RENAME TO "mkt_listing_individual_animal";

-- Rename AnimalProgram -> mkt_listing_animal_program
ALTER TABLE "public"."AnimalProgram" RENAME TO "mkt_listing_animal_program";

-- Rename BreedingProgram -> mkt_listing_breeding_program
ALTER TABLE "public"."BreedingProgram" RENAME TO "mkt_listing_breeding_program";

-- Rename MarketplaceListing -> mkt_listing_breeder_service
ALTER TABLE "public"."MarketplaceListing" RENAME TO "mkt_listing_breeder_service";

-- =============================================================================
-- PHASE 3: Cleanup - Remove deprecated columns
-- =============================================================================

-- Remove legacy fields from mkt_listing_individual_animal
ALTER TABLE "public"."mkt_listing_individual_animal" DROP COLUMN IF EXISTS "isListed";
ALTER TABLE "public"."mkt_listing_individual_animal" DROP COLUMN IF EXISTS "visibility";

-- =============================================================================
-- PHASE 4: Create new indexes on renamed tables (matching Prisma schema)
-- =============================================================================

-- Indexes for mkt_listing_breeder_service
CREATE INDEX IF NOT EXISTS "mkt_listing_breeder_service_tenantId_idx" ON "public"."mkt_listing_breeder_service"("tenantId");
CREATE INDEX IF NOT EXISTS "mkt_listing_breeder_service_serviceProviderId_idx" ON "public"."mkt_listing_breeder_service"("serviceProviderId");
CREATE INDEX IF NOT EXISTS "mkt_listing_breeder_service_status_publishedAt_idx" ON "public"."mkt_listing_breeder_service"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "mkt_listing_breeder_service_listingType_category_idx" ON "public"."mkt_listing_breeder_service"("listingType", "category");
CREATE INDEX IF NOT EXISTS "mkt_listing_breeder_service_tier_idx" ON "public"."mkt_listing_breeder_service"("tier");

-- Indexes for mkt_listing_individual_animal
CREATE INDEX IF NOT EXISTS "mkt_listing_individual_animal_tenantId_idx" ON "public"."mkt_listing_individual_animal"("tenantId");
CREATE INDEX IF NOT EXISTS "mkt_listing_individual_animal_tenantId_status_idx" ON "public"."mkt_listing_individual_animal"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "mkt_listing_individual_animal_tenantId_intent_idx" ON "public"."mkt_listing_individual_animal"("tenantId", "intent");
CREATE INDEX IF NOT EXISTS "mkt_listing_individual_animal_status_intent_idx" ON "public"."mkt_listing_individual_animal"("status", "intent");

-- Indexes for mkt_listing_animal_program
CREATE INDEX IF NOT EXISTS "mkt_listing_animal_program_tenantId_status_idx" ON "public"."mkt_listing_animal_program"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "mkt_listing_animal_program_tenantId_templateType_idx" ON "public"."mkt_listing_animal_program"("tenantId", "templateType");
CREATE INDEX IF NOT EXISTS "mkt_listing_animal_program_slug_idx" ON "public"."mkt_listing_animal_program"("slug");

-- Indexes for mkt_listing_breeding_program
CREATE INDEX IF NOT EXISTS "mkt_listing_breeding_program_tenantId_idx" ON "public"."mkt_listing_breeding_program"("tenantId");
CREATE INDEX IF NOT EXISTS "mkt_listing_breeding_program_status_idx" ON "public"."mkt_listing_breeding_program"("status");
CREATE INDEX IF NOT EXISTS "mkt_listing_breeding_program_species_idx" ON "public"."mkt_listing_breeding_program"("species");
