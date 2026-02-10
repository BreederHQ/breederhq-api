-- AlterTable
ALTER TABLE "public"."mkt_listing_breeding_program" ADD COLUMN     "comingSoonWeeksThreshold" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "offspringDisplayMode" TEXT NOT NULL DEFAULT 'curated',
ADD COLUMN     "showOffspringPhotos" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showParentPhotos" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showPricing" BOOLEAN NOT NULL DEFAULT true;
