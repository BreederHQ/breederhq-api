/*
  Warnings:

  - You are about to drop the column `bookingsClosed` on the `mkt_listing_breeder_service` table. All the data in the column will be lost.
  - You are about to drop the column `bookingsReceived` on the `mkt_listing_breeder_service` table. All the data in the column will be lost.
  - You are about to drop the column `breedingMethods` on the `mkt_listing_breeder_service` table. All the data in the column will be lost.
  - You are about to drop the column `defaultGuarantee` on the `mkt_listing_breeder_service` table. All the data in the column will be lost.
  - You are about to drop the column `horseServiceData` on the `mkt_listing_breeder_service` table. All the data in the column will be lost.
  - You are about to drop the column `maxBookings` on the `mkt_listing_breeder_service` table. All the data in the column will be lost.
  - You are about to drop the column `seasonEnd` on the `mkt_listing_breeder_service` table. All the data in the column will be lost.
  - You are about to drop the column `seasonName` on the `mkt_listing_breeder_service` table. All the data in the column will be lost.
  - You are about to drop the column `seasonStart` on the `mkt_listing_breeder_service` table. All the data in the column will be lost.
  - You are about to drop the column `stallionId` on the `mkt_listing_breeder_service` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."mkt_listing_breeder_service" DROP CONSTRAINT "mkt_listing_breeder_service_stallionId_fkey";

-- DropIndex
DROP INDEX "public"."mkt_listing_breeder_service_stallionId_idx";

-- AlterTable
ALTER TABLE "public"."AnimalProgramParticipant" ADD COLUMN     "bookingFeeOverride" INTEGER,
ADD COLUMN     "bookingsClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bookingsReceived" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxBookingsOverride" INTEGER;

-- AlterTable
ALTER TABLE "public"."direct_animal_listing" ADD COLUMN     "bookingFeeCents" INTEGER,
ADD COLUMN     "bookingsClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bookingsReceived" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "breedingMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "defaultGuaranteeType" "public"."BreedingGuaranteeType",
ADD COLUMN     "healthCertRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxBookings" INTEGER,
ADD COLUMN     "requiredTests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "seasonEnd" TIMESTAMP(3),
ADD COLUMN     "seasonName" VARCHAR(100),
ADD COLUMN     "seasonStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."mkt_listing_animal_program" ADD COLUMN     "breedingMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "defaultBookingFeeCents" INTEGER,
ADD COLUMN     "defaultGuaranteeType" "public"."BreedingGuaranteeType",
ADD COLUMN     "defaultMaxBookingsPerAnimal" INTEGER,
ADD COLUMN     "healthCertRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiredTests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "seasonEnd" TIMESTAMP(3),
ADD COLUMN     "seasonName" VARCHAR(100),
ADD COLUMN     "seasonStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."mkt_listing_breeder_service" DROP COLUMN "bookingsClosed",
DROP COLUMN "bookingsReceived",
DROP COLUMN "breedingMethods",
DROP COLUMN "defaultGuarantee",
DROP COLUMN "horseServiceData",
DROP COLUMN "maxBookings",
DROP COLUMN "seasonEnd",
DROP COLUMN "seasonName",
DROP COLUMN "seasonStart",
DROP COLUMN "stallionId";
