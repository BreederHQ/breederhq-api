-- CreateEnum
CREATE TYPE "public"."BreedingGuaranteeType" AS ENUM ('NO_GUARANTEE', 'LIVE_FOAL', 'STANDS_AND_NURSES', 'SIXTY_DAY_PREGNANCY', 'CERTIFIED_PREGNANT');

-- CreateEnum
CREATE TYPE "public"."GuaranteeResolution" AS ENUM ('NOT_TRIGGERED', 'RETURN_BREEDING_GRANTED', 'PARTIAL_REFUND', 'FULL_REFUND', 'WAIVED');

-- AlterTable
ALTER TABLE "public"."BreedingAttempt" ADD COLUMN     "agreedFeeCents" INTEGER,
ADD COLUMN     "feePaidCents" INTEGER DEFAULT 0,
ADD COLUMN     "guaranteeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "guaranteeReason" TEXT,
ADD COLUMN     "guaranteeResolution" "public"."GuaranteeResolution",
ADD COLUMN     "guaranteeTriggered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "guaranteeTriggeredAt" TIMESTAMP(3),
ADD COLUMN     "guaranteeType" "public"."BreedingGuaranteeType",
ADD COLUMN     "returnBreedingExpiresAt" TIMESTAMP(3),
ADD COLUMN     "returnBreedingGranted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "returnBreedingUsedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."mkt_listing_breeder_service" ADD COLUMN     "bookingsClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "breedingMethods" TEXT[],
ADD COLUMN     "defaultGuarantee" "public"."BreedingGuaranteeType",
ADD COLUMN     "horseServiceData" JSONB,
ADD COLUMN     "seasonEnd" TIMESTAMP(3),
ADD COLUMN     "seasonName" TEXT,
ADD COLUMN     "seasonStart" TIMESTAMP(3);
