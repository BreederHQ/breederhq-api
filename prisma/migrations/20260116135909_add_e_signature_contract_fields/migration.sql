/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `ContractTemplate` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."ContractTemplateType" AS ENUM ('SYSTEM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."ContractTemplateCategory" AS ENUM ('SALES_AGREEMENT', 'DEPOSIT_AGREEMENT', 'CO_OWNERSHIP', 'GUARDIAN_HOME', 'STUD_SERVICE', 'HEALTH_GUARANTEE', 'CUSTOM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."NotificationType" ADD VALUE 'contract_sent';
ALTER TYPE "public"."NotificationType" ADD VALUE 'contract_reminder_7d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'contract_reminder_3d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'contract_reminder_1d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'contract_signed';
ALTER TYPE "public"."NotificationType" ADD VALUE 'contract_declined';
ALTER TYPE "public"."NotificationType" ADD VALUE 'contract_voided';
ALTER TYPE "public"."NotificationType" ADD VALUE 'contract_expired';

-- AlterTable
ALTER TABLE "public"."Contract" ADD COLUMN     "animalId" INTEGER,
ADD COLUMN     "waitlistEntryId" INTEGER;

-- AlterTable
ALTER TABLE "public"."ContractTemplate" ADD COLUMN     "bodyHtml" TEXT,
ADD COLUMN     "bodyJson" JSONB,
ADD COLUMN     "category" "public"."ContractTemplateCategory" NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN     "conditionalSections" JSONB,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "mergeFields" JSONB,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "type" "public"."ContractTemplateType" NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "tenantId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."ContractContent" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "renderedHtml" TEXT NOT NULL,
    "renderedPdfKey" TEXT,
    "mergeData" JSONB NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractContent_contractId_key" ON "public"."ContractContent"("contractId");

-- CreateIndex
CREATE INDEX "Contract_animalId_idx" ON "public"."Contract"("animalId");

-- CreateIndex
CREATE INDEX "Contract_waitlistEntryId_idx" ON "public"."Contract"("waitlistEntryId");

-- CreateIndex
CREATE INDEX "Contract_expiresAt_idx" ON "public"."Contract"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_slug_key" ON "public"."ContractTemplate"("slug");

-- CreateIndex
CREATE INDEX "ContractTemplate_type_idx" ON "public"."ContractTemplate"("type");

-- CreateIndex
CREATE INDEX "ContractTemplate_category_idx" ON "public"."ContractTemplate"("category");

-- AddForeignKey
ALTER TABLE "public"."ContractTemplate" ADD CONSTRAINT "ContractTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "public"."WaitlistEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractContent" ADD CONSTRAINT "ContractContent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
