-- Rename constraints and cleanup duplicate indexes after table renames
-- This ensures Prisma schema stays in sync with database

-- =============================================================================
-- mkt_listing_animal_program (was AnimalProgram)
-- =============================================================================

-- Rename primary key
ALTER INDEX "AnimalProgram_pkey" RENAME TO "mkt_listing_animal_program_pkey";

-- Rename foreign key
ALTER TABLE "public"."mkt_listing_animal_program"
  RENAME CONSTRAINT "AnimalProgram_tenantId_fkey" TO "mkt_listing_animal_program_tenantId_fkey";

-- Rename unique index
ALTER INDEX "AnimalProgram_slug_key" RENAME TO "mkt_listing_animal_program_slug_key";

-- Drop duplicate old indexes (keep new ones created in previous migration)
DROP INDEX IF EXISTS "public"."AnimalProgram_slug_idx";
DROP INDEX IF EXISTS "public"."AnimalProgram_tenantId_status_idx";
DROP INDEX IF EXISTS "public"."AnimalProgram_tenantId_templateType_idx";

-- =============================================================================
-- mkt_listing_breeder_service (was MarketplaceListing)
-- =============================================================================

-- Rename primary key
ALTER INDEX "MarketplaceListing_pkey" RENAME TO "mkt_listing_breeder_service_pkey";

-- Rename foreign keys
ALTER TABLE "public"."mkt_listing_breeder_service"
  RENAME CONSTRAINT "MarketplaceListing_tenantId_fkey" TO "mkt_listing_breeder_service_tenantId_fkey";

ALTER TABLE "public"."mkt_listing_breeder_service"
  RENAME CONSTRAINT "MarketplaceListing_serviceProviderId_fkey" TO "mkt_listing_breeder_service_serviceProviderId_fkey";

-- Rename unique index
ALTER INDEX "MarketplaceListing_slug_key" RENAME TO "mkt_listing_breeder_service_slug_key";

-- Drop duplicate old indexes
DROP INDEX IF EXISTS "public"."MarketplaceListing_listingType_category_idx";
DROP INDEX IF EXISTS "public"."MarketplaceListing_serviceProviderId_idx";
DROP INDEX IF EXISTS "public"."MarketplaceListing_tenantId_idx";
DROP INDEX IF EXISTS "public"."MarketplaceListing_tier_idx";

-- =============================================================================
-- mkt_listing_breeding_program (was BreedingProgram)
-- =============================================================================

-- Rename primary key
ALTER INDEX "BreedingProgram_pkey" RENAME TO "mkt_listing_breeding_program_pkey";

-- Rename foreign key
ALTER TABLE "public"."mkt_listing_breeding_program"
  RENAME CONSTRAINT "BreedingProgram_tenantId_fkey" TO "mkt_listing_breeding_program_tenantId_fkey";

-- Rename unique index
ALTER INDEX "BreedingProgram_tenantId_slug_key" RENAME TO "mkt_listing_breeding_program_tenantId_slug_key";

-- Drop duplicate old indexes
DROP INDEX IF EXISTS "public"."BreedingProgram_species_idx";
DROP INDEX IF EXISTS "public"."BreedingProgram_status_idx";
DROP INDEX IF EXISTS "public"."BreedingProgram_tenantId_idx";

-- =============================================================================
-- mkt_listing_individual_animal (was AnimalPublicListing)
-- =============================================================================

-- Rename primary key
ALTER INDEX "AnimalPublicListing_pkey" RENAME TO "mkt_listing_individual_animal_pkey";

-- Rename foreign keys
ALTER TABLE "public"."mkt_listing_individual_animal"
  RENAME CONSTRAINT "AnimalPublicListing_animalId_fkey" TO "mkt_listing_individual_animal_animalId_fkey";

ALTER TABLE "public"."mkt_listing_individual_animal"
  RENAME CONSTRAINT "AnimalPublicListing_tenantId_fkey" TO "mkt_listing_individual_animal_tenantId_fkey";

-- Rename unique indexes
ALTER INDEX "AnimalPublicListing_animalId_key" RENAME TO "mkt_listing_individual_animal_animalId_key";
ALTER INDEX "AnimalPublicListing_urlSlug_key" RENAME TO "mkt_listing_individual_animal_urlSlug_key";

-- Drop duplicate old indexes
DROP INDEX IF EXISTS "public"."AnimalPublicListing_status_intent_idx";
DROP INDEX IF EXISTS "public"."AnimalPublicListing_tenantId_idx";
DROP INDEX IF EXISTS "public"."AnimalPublicListing_tenantId_intent_idx";
DROP INDEX IF EXISTS "public"."AnimalPublicListing_tenantId_status_idx";
