-- Remove deprecated marketplace listing tables
-- These have been replaced by MktListingService (unified) and MktListingAnimalProgram

-- Drop MktListingProviderService table (marketplace schema)
DROP TABLE IF EXISTS "marketplace"."service_listings" CASCADE;

-- Drop MktListingBreederService table (public schema)
DROP TABLE IF EXISTS "public"."mkt_listing_breeder_service" CASCADE;
