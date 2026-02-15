-- CreateEnum
CREATE TYPE "public"."ListingBoostTarget" AS ENUM ('INDIVIDUAL_ANIMAL', 'ANIMAL_PROGRAM', 'BREEDING_PROGRAM', 'BREEDER', 'BREEDER_SERVICE', 'BREEDING_LISTING', 'PROVIDER_SERVICE');

-- CreateEnum
CREATE TYPE "public"."BoostTier" AS ENUM ('BOOST', 'FEATURED');

-- CreateEnum
CREATE TYPE "public"."BoostStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELED');

-- CreateTable
CREATE TABLE "public"."ListingBoost" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER,
    "providerId" INTEGER,
    "listingType" "public"."ListingBoostTarget" NOT NULL,
    "listingId" INTEGER NOT NULL,
    "tier" "public"."BoostTier" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "status" "public"."BoostStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "stripeSessionId" TEXT,
    "stripePaymentId" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "inquiries" INTEGER NOT NULL DEFAULT 0,
    "expiryNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingBoost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingBoost_tenantId_idx" ON "public"."ListingBoost"("tenantId");

-- CreateIndex
CREATE INDEX "ListingBoost_providerId_idx" ON "public"."ListingBoost"("providerId");

-- CreateIndex
CREATE INDEX "ListingBoost_listingType_listingId_idx" ON "public"."ListingBoost"("listingType", "listingId");

-- CreateIndex
CREATE INDEX "ListingBoost_status_expiresAt_idx" ON "public"."ListingBoost"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ListingBoost_listingType_status_tier_idx" ON "public"."ListingBoost"("listingType", "status", "tier");
