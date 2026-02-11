-- Standardize marketplace listing table names to follow mkt_listing_* snake_case convention
-- Using RENAME to preserve existing data (57 rows in MktListingService, 3 rows in direct_animal_listing)

-- Rename direct_animal_listing to mkt_listing_individual_animal (public schema)
ALTER TABLE "public"."direct_animal_listing" RENAME TO "mkt_listing_individual_animal";

-- Rename MktListingService to mkt_listing_breeder_service (marketplace schema)
ALTER TABLE "marketplace"."MktListingService" RENAME TO "mkt_listing_breeder_service";
