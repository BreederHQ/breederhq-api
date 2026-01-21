/*
  Warnings:

  - The `status` column on the `service_listings` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `published` on the `AnimalProgram` table. All the data in the column will be lost.
  - The `status` column on the `AnimalPublicListing` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `listed` on the `BreedingProgram` table. All the data in the column will be lost.
  - You are about to drop the column `published` on the `Litter` table. All the data in the column will be lost.
  - You are about to drop the column `published` on the `OffspringGroup` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."MarketplaceListingStatus" AS ENUM ('DRAFT', 'LIVE', 'PAUSED');

-- DropIndex
DROP INDEX "public"."AnimalProgram_tenantId_published_idx";

-- DropIndex
DROP INDEX "public"."BreedingProgram_listed_idx";

-- DropIndex
DROP INDEX "public"."DirectAnimalListing_status_listed_idx";

-- DropIndex
DROP INDEX "public"."OffspringGroup_published_idx";

-- AlterTable
ALTER TABLE "marketplace"."service_listings" DROP COLUMN "status",
ADD COLUMN     "status" "public"."MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "public"."AnimalProgram" DROP COLUMN "published",
ADD COLUMN     "status" "public"."MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "public"."AnimalPublicListing" DROP COLUMN "status",
ADD COLUMN     "status" "public"."MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "public"."BreedingProgram" DROP COLUMN "listed",
ADD COLUMN     "status" "public"."MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "public"."Litter" DROP COLUMN "published",
ADD COLUMN     "marketplaceStatus" "public"."MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "public"."OffspringGroup" DROP COLUMN "published",
ADD COLUMN     "status" "public"."MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "service_listings_provider_id_status_idx" ON "marketplace"."service_listings"("provider_id", "status");

-- CreateIndex
CREATE INDEX "service_listings_category_status_published_at_idx" ON "marketplace"."service_listings"("category", "status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "service_listings_state_city_category_status_idx" ON "marketplace"."service_listings"("state", "city", "category", "status");

-- CreateIndex
CREATE INDEX "AnimalProgram_tenantId_status_idx" ON "public"."AnimalProgram"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AnimalPublicListing_tenantId_status_idx" ON "public"."AnimalPublicListing"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AnimalPublicListing_status_intent_idx" ON "public"."AnimalPublicListing"("status", "intent");

-- CreateIndex
CREATE INDEX "BreedingProgram_status_idx" ON "public"."BreedingProgram"("status");

-- CreateIndex
CREATE INDEX "DirectAnimalListing_status_idx" ON "public"."DirectAnimalListing"("status");

-- CreateIndex
CREATE INDEX "OffspringGroup_status_idx" ON "public"."OffspringGroup"("status");
