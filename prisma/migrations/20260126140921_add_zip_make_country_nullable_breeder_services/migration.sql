-- AlterTable
ALTER TABLE "public"."mkt_listing_breeder_service" ADD COLUMN     "zip" TEXT,
ALTER COLUMN "country" DROP NOT NULL,
ALTER COLUMN "country" DROP DEFAULT;
