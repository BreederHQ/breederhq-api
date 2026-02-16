-- Add dataDrawerConfig column to mkt_listing_breeding_booking
ALTER TABLE "mkt_listing_breeding_booking" ADD COLUMN "dataDrawerConfig" JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN "mkt_listing_breeding_booking"."dataDrawerConfig" IS 'Configuration for which animal data sections to display on marketplace listing';
