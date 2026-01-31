/*
  Warnings:

  - A unique constraint covering the columns `[bookingId]` on the table `SemenUsage` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('INQUIRY', 'PENDING_REQUIREMENTS', 'APPROVED', 'DEPOSIT_PAID', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."SemenUsage" ADD COLUMN     "bookingId" INTEGER;

-- CreateTable
CREATE TABLE "public"."StallionBooking" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "serviceListingId" INTEGER NOT NULL,
    "stallionId" INTEGER NOT NULL,
    "mareId" INTEGER,
    "externalMareName" TEXT,
    "externalMareReg" TEXT,
    "externalMareBreed" TEXT,
    "mareOwnerPartyId" INTEGER NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'INQUIRY',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preferredMethod" "public"."BreedingMethod",
    "preferredDateStart" TIMESTAMP(3),
    "preferredDateEnd" TIMESTAMP(3),
    "scheduledDate" TIMESTAMP(3),
    "shippingRequired" BOOLEAN NOT NULL DEFAULT false,
    "shippingAddress" TEXT,
    "agreedFeeCents" INTEGER NOT NULL,
    "bookingFeeCents" INTEGER NOT NULL DEFAULT 0,
    "totalPaidCents" INTEGER NOT NULL DEFAULT 0,
    "guaranteeType" "public"."BreedingGuaranteeType",
    "requirementsJson" JSONB,
    "breedingPlanId" INTEGER,
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "StallionBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingStatusHistory" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "fromStatus" "public"."BookingStatus",
    "toStatus" "public"."BookingStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" INTEGER,
    "notes" TEXT,

    CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StallionBooking_bookingNumber_key" ON "public"."StallionBooking"("bookingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StallionBooking_breedingPlanId_key" ON "public"."StallionBooking"("breedingPlanId");

-- CreateIndex
CREATE INDEX "StallionBooking_tenantId_status_idx" ON "public"."StallionBooking"("tenantId", "status");

-- CreateIndex
CREATE INDEX "StallionBooking_tenantId_stallionId_idx" ON "public"."StallionBooking"("tenantId", "stallionId");

-- CreateIndex
CREATE INDEX "StallionBooking_tenantId_mareOwnerPartyId_idx" ON "public"."StallionBooking"("tenantId", "mareOwnerPartyId");

-- CreateIndex
CREATE INDEX "StallionBooking_serviceListingId_idx" ON "public"."StallionBooking"("serviceListingId");

-- CreateIndex
CREATE INDEX "BookingStatusHistory_bookingId_idx" ON "public"."BookingStatusHistory"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "SemenUsage_bookingId_key" ON "public"."SemenUsage"("bookingId");

-- AddForeignKey
ALTER TABLE "public"."SemenUsage" ADD CONSTRAINT "SemenUsage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."StallionBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StallionBooking" ADD CONSTRAINT "StallionBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StallionBooking" ADD CONSTRAINT "StallionBooking_serviceListingId_fkey" FOREIGN KEY ("serviceListingId") REFERENCES "public"."mkt_listing_breeder_service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StallionBooking" ADD CONSTRAINT "StallionBooking_stallionId_fkey" FOREIGN KEY ("stallionId") REFERENCES "public"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StallionBooking" ADD CONSTRAINT "StallionBooking_mareId_fkey" FOREIGN KEY ("mareId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StallionBooking" ADD CONSTRAINT "StallionBooking_mareOwnerPartyId_fkey" FOREIGN KEY ("mareOwnerPartyId") REFERENCES "public"."Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StallionBooking" ADD CONSTRAINT "StallionBooking_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES "public"."BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."StallionBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
