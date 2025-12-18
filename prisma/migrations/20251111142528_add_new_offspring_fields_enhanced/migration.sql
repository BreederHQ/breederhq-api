/*
  Warnings:

  - A unique constraint covering the columns `[tagId,offspringGroupId]` on the table `TagAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OffspringLinkState" AS ENUM ('linked', 'orphan', 'pending');

-- CreateEnum
CREATE TYPE "OffspringLinkReason" AS ENUM ('legacy_import', 'rescue', 'accidental', 'third_party', 'cobreeder', 'placeholder', 'historical', 'other');

-- AlterEnum
ALTER TYPE "TagModule" ADD VALUE 'OFFSPRING_GROUP';

-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "offspringGroupId" INTEGER;

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "offspringGroupId" INTEGER;

-- AlterTable
ALTER TABLE "TagAssignment" ADD COLUMN     "offspringGroupId" INTEGER;

-- AlterTable
ALTER TABLE "WaitlistEntry" ADD COLUMN     "offspringGroupId" INTEGER;

-- CreateTable
CREATE TABLE "OffspringGroup" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER,
    "linkState" "OffspringLinkState" NOT NULL DEFAULT 'linked',
    "linkReason" "OffspringLinkReason",
    "species" "Species" NOT NULL,
    "damId" INTEGER NOT NULL,
    "sireId" INTEGER,
    "tentativeName" TEXT,
    "expectedBirthOn" TIMESTAMP(3),
    "actualBirthOn" TIMESTAMP(3),
    "countBorn" INTEGER,
    "countLive" INTEGER,
    "countStillborn" INTEGER,
    "countMale" INTEGER,
    "countFemale" INTEGER,
    "countWeaned" INTEGER,
    "countPlaced" INTEGER,
    "weanedAt" TIMESTAMP(3),
    "placementStartAt" TIMESTAMP(3),
    "placementCompletedAt" TIMESTAMP(3),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "coverImageUrl" TEXT,
    "themeName" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffspringGroupEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringGroupId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "field" TEXT,
    "before" JSONB,
    "after" JSONB,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringGroupEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OffspringGroup_tenantId_idx" ON "OffspringGroup"("tenantId");

-- CreateIndex
CREATE INDEX "OffspringGroup_tenantId_species_expectedBirthOn_idx" ON "OffspringGroup"("tenantId", "species", "expectedBirthOn");

-- CreateIndex
CREATE INDEX "OffspringGroup_tenantId_damId_actualBirthOn_idx" ON "OffspringGroup"("tenantId", "damId", "actualBirthOn");

-- CreateIndex
CREATE INDEX "OffspringGroup_sireId_idx" ON "OffspringGroup"("sireId");

-- CreateIndex
CREATE INDEX "OffspringGroup_linkState_idx" ON "OffspringGroup"("linkState");

-- CreateIndex
CREATE INDEX "OffspringGroup_placementStartAt_idx" ON "OffspringGroup"("placementStartAt");

-- CreateIndex
CREATE INDEX "OffspringGroup_placementCompletedAt_idx" ON "OffspringGroup"("placementCompletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OffspringGroup_planId_key" ON "OffspringGroup"("planId");

-- CreateIndex
CREATE INDEX "OffspringGroupEvent_tenantId_idx" ON "OffspringGroupEvent"("tenantId");

-- CreateIndex
CREATE INDEX "OffspringGroupEvent_offspringGroupId_type_occurredAt_idx" ON "OffspringGroupEvent"("offspringGroupId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "Animal_offspringGroupId_idx" ON "Animal"("offspringGroupId");

-- CreateIndex
CREATE INDEX "Attachment_offspringGroupId_idx" ON "Attachment"("offspringGroupId");

-- CreateIndex
CREATE INDEX "TagAssignment_offspringGroupId_idx" ON "TagAssignment"("offspringGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_offspringGroupId_key" ON "TagAssignment"("tagId", "offspringGroupId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_offspringGroupId_idx" ON "WaitlistEntry"("offspringGroupId");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroup" ADD CONSTRAINT "OffspringGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroup" ADD CONSTRAINT "OffspringGroup_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroup" ADD CONSTRAINT "OffspringGroup_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroup" ADD CONSTRAINT "OffspringGroup_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupEvent" ADD CONSTRAINT "OffspringGroupEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupEvent" ADD CONSTRAINT "OffspringGroupEvent_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffspringGroupEvent" ADD CONSTRAINT "OffspringGroupEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
