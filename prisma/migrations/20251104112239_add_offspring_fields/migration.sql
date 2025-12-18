/*
  Warnings:

  - You are about to drop the `Reservation` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[tagId,waitlistEntryId]` on the table `TagAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('INQUIRY', 'DEPOSIT_DUE', 'DEPOSIT_PAID', 'READY', 'ALLOCATED', 'COMPLETED', 'CANCELED');

-- AlterEnum
ALTER TYPE "TagModule" ADD VALUE 'WAITLIST_ENTRY';

-- DropForeignKey
ALTER TABLE "public"."Reservation" DROP CONSTRAINT "Reservation_contactId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Reservation" DROP CONSTRAINT "Reservation_litterId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Reservation" DROP CONSTRAINT "Reservation_planId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Reservation" DROP CONSTRAINT "Reservation_tenantId_fkey";

-- AlterTable
ALTER TABLE "Litter" ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "placementCompletedAt" TIMESTAMP(3),
ADD COLUMN     "placementStartAt" TIMESTAMP(3),
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "themeName" TEXT,
ADD COLUMN     "weanedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TagAssignment" ADD COLUMN     "waitlistEntryId" INTEGER;

-- DropTable
DROP TABLE "public"."Reservation";

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER,
    "litterId" INTEGER,
    "partyType" "OwnerPartyType" NOT NULL,
    "contactId" INTEGER,
    "organizationId" INTEGER,
    "speciesPref" "Species",
    "breedPrefs" JSONB,
    "sirePrefId" INTEGER,
    "damPrefId" INTEGER,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'INQUIRY',
    "priority" INTEGER,
    "depositInvoiceId" TEXT,
    "balanceInvoiceId" TEXT,
    "depositPaidAt" TIMESTAMP(3),
    "depositRequiredCents" INTEGER,
    "depositPaidCents" INTEGER,
    "balanceDueCents" INTEGER,
    "animalId" INTEGER,
    "skipCount" INTEGER,
    "lastSkipAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_tenantId_idx" ON "WaitlistEntry"("tenantId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_planId_idx" ON "WaitlistEntry"("planId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_litterId_idx" ON "WaitlistEntry"("litterId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_contactId_idx" ON "WaitlistEntry"("contactId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_organizationId_idx" ON "WaitlistEntry"("organizationId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_tenantId_speciesPref_idx" ON "WaitlistEntry"("tenantId", "speciesPref");

-- CreateIndex
CREATE INDEX "WaitlistEntry_sirePrefId_idx" ON "WaitlistEntry"("sirePrefId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_damPrefId_idx" ON "WaitlistEntry"("damPrefId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_animalId_idx" ON "WaitlistEntry"("animalId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_tenantId_depositPaidAt_idx" ON "WaitlistEntry"("tenantId", "depositPaidAt");

-- CreateIndex
CREATE INDEX "Litter_tenantId_weanedAt_idx" ON "Litter"("tenantId", "weanedAt");

-- CreateIndex
CREATE INDEX "Litter_tenantId_placementStartAt_idx" ON "Litter"("tenantId", "placementStartAt");

-- CreateIndex
CREATE INDEX "Litter_tenantId_placementCompletedAt_idx" ON "Litter"("tenantId", "placementCompletedAt");

-- CreateIndex
CREATE INDEX "TagAssignment_waitlistEntryId_idx" ON "TagAssignment"("waitlistEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_waitlistEntryId_key" ON "TagAssignment"("tagId", "waitlistEntryId");

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "WaitlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES "Litter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_sirePrefId_fkey" FOREIGN KEY ("sirePrefId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_damPrefId_fkey" FOREIGN KEY ("damPrefId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
