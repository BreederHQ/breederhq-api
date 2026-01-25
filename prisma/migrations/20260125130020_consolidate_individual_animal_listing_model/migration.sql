/*
  Warnings:

  - You are about to drop the `DirectAnimalListing` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mkt_listing_individual_animal` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."DirectAnimalListing" DROP CONSTRAINT "DirectAnimalListing_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DirectAnimalListing" DROP CONSTRAINT "DirectAnimalListing_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."mkt_listing_individual_animal" DROP CONSTRAINT "mkt_listing_individual_animal_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."mkt_listing_individual_animal" DROP CONSTRAINT "mkt_listing_individual_animal_tenantId_fkey";

-- DropTable
DROP TABLE "public"."DirectAnimalListing";

-- DropTable
DROP TABLE "public"."mkt_listing_individual_animal";

-- CreateTable
CREATE TABLE "public"."direct_animal_listing" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "templateType" VARCHAR(32) NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" VARCHAR(120),
    "title" VARCHAR(100),
    "summary" TEXT,
    "description" TEXT,
    "dataDrawerConfig" JSONB NOT NULL,
    "listingContent" JSONB,
    "priceModel" VARCHAR(32) NOT NULL,
    "priceCents" INTEGER,
    "priceMinCents" INTEGER,
    "priceMaxCents" INTEGER,
    "locationCity" VARCHAR(100),
    "locationRegion" VARCHAR(100),
    "locationCountry" VARCHAR(2),
    "status" "public"."MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT',
    "listed" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "lastInquiryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direct_animal_listing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "direct_animal_listing_slug_key" ON "public"."direct_animal_listing"("slug");

-- CreateIndex
CREATE INDEX "direct_animal_listing_tenantId_status_idx" ON "public"."direct_animal_listing"("tenantId", "status");

-- CreateIndex
CREATE INDEX "direct_animal_listing_tenantId_templateType_idx" ON "public"."direct_animal_listing"("tenantId", "templateType");

-- CreateIndex
CREATE INDEX "direct_animal_listing_animalId_idx" ON "public"."direct_animal_listing"("animalId");

-- CreateIndex
CREATE INDEX "direct_animal_listing_status_idx" ON "public"."direct_animal_listing"("status");

-- CreateIndex
CREATE INDEX "direct_animal_listing_slug_idx" ON "public"."direct_animal_listing"("slug");

-- AddForeignKey
ALTER TABLE "public"."direct_animal_listing" ADD CONSTRAINT "direct_animal_listing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."direct_animal_listing" ADD CONSTRAINT "direct_animal_listing_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
