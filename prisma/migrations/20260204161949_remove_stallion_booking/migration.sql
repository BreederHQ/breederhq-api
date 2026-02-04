/*
  Warnings:

  - You are about to drop the column `bookingId` on the `SemenUsage` table. All the data in the column will be lost.
  - You are about to drop the `BookingStatusHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StallionBooking` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[semenUsageId]` on the table `BreedingBooking` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "BookingStatusHistory" DROP CONSTRAINT "BookingStatusHistory_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "SemenUsage" DROP CONSTRAINT "SemenUsage_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "StallionBooking" DROP CONSTRAINT "StallionBooking_breedingPlanId_fkey";

-- DropForeignKey
ALTER TABLE "StallionBooking" DROP CONSTRAINT "StallionBooking_mareId_fkey";

-- DropForeignKey
ALTER TABLE "StallionBooking" DROP CONSTRAINT "StallionBooking_mareOwnerPartyId_fkey";

-- DropForeignKey
ALTER TABLE "StallionBooking" DROP CONSTRAINT "StallionBooking_serviceListingId_fkey";

-- DropForeignKey
ALTER TABLE "StallionBooking" DROP CONSTRAINT "StallionBooking_stallionId_fkey";

-- DropForeignKey
ALTER TABLE "StallionBooking" DROP CONSTRAINT "StallionBooking_tenantId_fkey";

-- DropIndex
DROP INDEX "SemenUsage_bookingId_key";

-- AlterTable
ALTER TABLE "BreedingBooking" ADD COLUMN     "outcomeRecordedAt" TIMESTAMP(3),
ADD COLUMN     "outcomeType" VARCHAR(50),
ADD COLUMN     "semenUsageId" INTEGER;

-- AlterTable
ALTER TABLE "SemenUsage" DROP COLUMN "bookingId";

-- DropTable
DROP TABLE "BookingStatusHistory";

-- DropTable
DROP TABLE "StallionBooking";

-- DropEnum
DROP TYPE "BookingStatus";

-- CreateIndex
CREATE UNIQUE INDEX "BreedingBooking_semenUsageId_key" ON "BreedingBooking"("semenUsageId");

-- AddForeignKey
ALTER TABLE "BreedingBooking" ADD CONSTRAINT "BreedingBooking_semenUsageId_fkey" FOREIGN KEY ("semenUsageId") REFERENCES "SemenUsage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
