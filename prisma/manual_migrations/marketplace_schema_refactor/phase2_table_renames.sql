-- Phase 2: Table Renames
-- Rename marketplace listing tables to follow mkt_listing_* convention
--
-- AnimalPublicListing    → mkt_listing_individual_animal
-- AnimalProgram          → mkt_listing_animal_program
-- BreedingProgram        → mkt_listing_breeding_program
-- MarketplaceListing     → mkt_listing_breeder_service

-- Rename AnimalPublicListing
ALTER TABLE "AnimalPublicListing" RENAME TO "mkt_listing_individual_animal";

-- Rename AnimalProgram
ALTER TABLE "AnimalProgram" RENAME TO "mkt_listing_animal_program";

-- Rename BreedingProgram
ALTER TABLE "BreedingProgram" RENAME TO "mkt_listing_breeding_program";

-- Rename MarketplaceListing
ALTER TABLE "MarketplaceListing" RENAME TO "mkt_listing_breeder_service";

-- Update foreign key constraints if needed
-- (Postgres automatically updates FK references when table is renamed)

-- Update indexes (may need to rename for clarity)
-- Note: Index names don't auto-rename, but they still work.
-- Optional: rename indexes to match new table names
