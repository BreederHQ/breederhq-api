-- Phase 3: Schema Cleanup
-- Delete unused tables, enums, and legacy fields

-- =============================================================================
-- Step 1: Delete unused MarketplaceServiceListing table
-- =============================================================================
-- Check if table exists in marketplace schema
DROP TABLE IF EXISTS marketplace.service_listings CASCADE;

-- =============================================================================
-- Step 2: Remove legacy fields from mkt_listing_individual_animal
-- =============================================================================
-- Remove isListed (legacy boolean, replaced by status enum)
ALTER TABLE "mkt_listing_individual_animal" DROP COLUMN IF EXISTS "isListed";

-- Remove visibility (legacy string, replaced by status enum)
ALTER TABLE "mkt_listing_individual_animal" DROP COLUMN IF EXISTS "visibility";

-- =============================================================================
-- Step 3: Remove status field from OffspringGroup
-- =============================================================================
-- OffspringGroup is not a listing - visibility is inherited from BreedingProgram
ALTER TABLE "OffspringGroup" DROP COLUMN IF EXISTS "status";

-- =============================================================================
-- Step 4: Delete deprecated enums (if no longer referenced)
-- =============================================================================
-- Note: Only drop enums if no columns reference them
-- Check before running: SELECT * FROM pg_enum WHERE enumtypid = 'AnimalListingStatus'::regtype;

-- DROP TYPE IF EXISTS "AnimalListingStatus";
-- DROP TYPE IF EXISTS "ListingStatus";

-- =============================================================================
-- Verification queries (run after migration)
-- =============================================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'mkt_%';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'mkt_listing_individual_animal';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'OffspringGroup' AND column_name = 'status';
