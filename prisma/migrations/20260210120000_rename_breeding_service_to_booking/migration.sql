-- Rename mkt_listing_breeding_service to mkt_listing_breeding_booking
-- Using RENAME to preserve existing data

ALTER TABLE "public"."mkt_listing_breeding_service" RENAME TO "mkt_listing_breeding_booking";

-- Rename indexes to match new table name
ALTER INDEX "public"."mkt_listing_breeding_service_slug_key" RENAME TO "mkt_listing_breeding_booking_slug_key";
ALTER INDEX "public"."mkt_listing_breeding_service_tenantId_status_idx" RENAME TO "mkt_listing_breeding_booking_tenantId_status_idx";
ALTER INDEX "public"."mkt_listing_breeding_service_intent_idx" RENAME TO "mkt_listing_breeding_booking_intent_idx";

-- Rename constraints
ALTER TABLE "public"."mkt_listing_breeding_booking" RENAME CONSTRAINT "mkt_listing_breeding_service_pkey" TO "mkt_listing_breeding_booking_pkey";
ALTER TABLE "public"."mkt_listing_breeding_booking" RENAME CONSTRAINT "mkt_listing_breeding_service_tenantId_fkey" TO "mkt_listing_breeding_booking_tenantId_fkey";
