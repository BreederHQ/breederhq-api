-- CreateEnum
CREATE TYPE "AnimalListingIntent" AS ENUM ('STUD', 'BROOD_PLACEMENT', 'REHOME', 'SHOWCASE');

-- CreateEnum
CREATE TYPE "AnimalListingStatus" AS ENUM ('DRAFT', 'LIVE', 'PAUSED');

-- AlterTable
ALTER TABLE "AnimalPublicListing" ADD COLUMN     "detailsJson" JSONB,
ADD COLUMN     "headline" VARCHAR(120),
ADD COLUMN     "intent" "AnimalListingIntent",
ADD COLUMN     "locationCity" VARCHAR(100),
ADD COLUMN     "locationCountry" VARCHAR(2),
ADD COLUMN     "locationRegion" VARCHAR(100),
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "priceMaxCents" INTEGER,
ADD COLUMN     "priceMinCents" INTEGER,
ADD COLUMN     "priceModel" VARCHAR(32),
ADD COLUMN     "priceText" VARCHAR(100),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "status" "AnimalListingStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "summary" TEXT;

-- CreateIndex
CREATE INDEX "AnimalPublicListing_tenantId_status_idx" ON "AnimalPublicListing"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AnimalPublicListing_tenantId_intent_idx" ON "AnimalPublicListing"("tenantId", "intent");

-- CreateIndex
CREATE INDEX "AnimalPublicListing_status_intent_idx" ON "AnimalPublicListing"("status", "intent");
