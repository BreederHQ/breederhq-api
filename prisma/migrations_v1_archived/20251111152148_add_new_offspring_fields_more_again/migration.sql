/*
  Warnings:

  - A unique constraint covering the columns `[tagId,offspringId]` on the table `TagAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OffspringStatus" AS ENUM ('NEWBORN', 'ALIVE', 'WEANED', 'PLACED', 'DECEASED');

-- AlterEnum
ALTER TYPE "TagModule" ADD VALUE 'OFFSPRING';

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "offspringId" INTEGER;

-- AlterTable
ALTER TABLE "TagAssignment" ADD COLUMN     "offspringId" INTEGER;

-- AlterTable
ALTER TABLE "WaitlistEntry" ADD COLUMN     "offspringId" INTEGER;

-- CreateTable
CREATE TABLE "Offspring" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "name" TEXT,
    "species" "Species" NOT NULL,
    "sex" "Sex",
    "bornAt" TIMESTAMP(3),
    "diedAt" TIMESTAMP(3),
    "status" "OffspringStatus" NOT NULL DEFAULT 'NEWBORN',
    "collarColorId" TEXT,
    "collarColorName" TEXT,
    "collarColorHex" TEXT,
    "collarAssignedAt" TIMESTAMP(3),
    "collarLocked" BOOLEAN NOT NULL DEFAULT false,
    "buyerPartyType" "OwnerPartyType",
    "buyerContactId" INTEGER,
    "buyerOrganizationId" INTEGER,
    "priceCents" INTEGER,
    "depositCents" INTEGER,
    "contractId" TEXT,
    "contractSignedAt" TIMESTAMP(3),
    "paidInFullAt" TIMESTAMP(3),
    "pickupAt" TIMESTAMP(3),
    "placedAt" TIMESTAMP(3),
    "promotedAnimalId" INTEGER,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offspring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffspringEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "field" TEXT,
    "before" JSONB,
    "after" JSONB,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Offspring_tenantId_idx" ON "Offspring"("tenantId");

-- CreateIndex
CREATE INDEX "Offspring_groupId_idx" ON "Offspring"("groupId");

-- CreateIndex
CREATE INDEX "Offspring_tenantId_status_idx" ON "Offspring"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Offspring_buyerContactId_idx" ON "Offspring"("buyerContactId");

-- CreateIndex
CREATE INDEX "Offspring_buyerOrganizationId_idx" ON "Offspring"("buyerOrganizationId");

-- CreateIndex
CREATE INDEX "Offspring_placedAt_idx" ON "Offspring"("placedAt");

-- CreateIndex
CREATE INDEX "OffspringEvent_tenantId_idx" ON "OffspringEvent"("tenantId");

-- CreateIndex
CREATE INDEX "OffspringEvent_offspringId_type_occurredAt_idx" ON "OffspringEvent"("offspringId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "Attachment_offspringId_idx" ON "Attachment"("offspringId");

-- CreateIndex
CREATE INDEX "TagAssignment_offspringId_idx" ON "TagAssignment"("offspringId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_offspringId_key" ON "TagAssignment"("tagId", "offspringId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_offspringId_idx" ON "WaitlistEntry"("offspringId");

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OffspringGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_buyerContactId_fkey" FOREIGN KEY ("buyerContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_buyerOrganizationId_fkey" FOREIGN KEY ("buyerOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_promotedAnimalId_fkey" FOREIGN KEY ("promotedAnimalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringEvent" ADD CONSTRAINT "OffspringEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringEvent" ADD CONSTRAINT "OffspringEvent_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringEvent" ADD CONSTRAINT "OffspringEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;
