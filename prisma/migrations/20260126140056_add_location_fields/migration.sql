-- AlterTable
ALTER TABLE "marketplace"."service_listings" ADD COLUMN     "country" VARCHAR(2);

-- AlterTable
ALTER TABLE "public"."direct_animal_listing" ADD COLUMN     "locationZip" VARCHAR(20);

-- AlterTable
ALTER TABLE "public"."mkt_listing_animal_program" ADD COLUMN     "locationCity" VARCHAR(100),
ADD COLUMN     "locationCountry" VARCHAR(2),
ADD COLUMN     "locationRegion" VARCHAR(100),
ADD COLUMN     "locationZip" VARCHAR(20);
