/*
  Warnings:

  - A unique constraint covering the columns `[tagId,buyerId]` on the table `TagAssignment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tagId,dealId]` on the table `TagAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."BuyerStatus" AS ENUM ('LEAD', 'ACTIVE', 'QUALIFIED', 'NEGOTIATING', 'PURCHASED', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."InterestLevel" AS ENUM ('BROWSING', 'INTERESTED', 'SERIOUS', 'OFFERED', 'DECLINED');

-- CreateEnum
CREATE TYPE "public"."DealStage" AS ENUM ('INQUIRY', 'VIEWING', 'NEGOTIATION', 'VET_CHECK', 'CONTRACT', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "public"."DealOutcome" AS ENUM ('WON', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."DealActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'VIEWING', 'NOTE', 'STATUS_CHANGE', 'OFFER_MADE', 'OFFER_RECEIVED', 'CONTRACT_SENT', 'CONTRACT_SIGNED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."TagModule" ADD VALUE 'BUYER';
ALTER TYPE "public"."TagModule" ADD VALUE 'DEAL';

-- AlterTable
ALTER TABLE "public"."TagAssignment" ADD COLUMN     "buyerId" INTEGER,
ADD COLUMN     "dealId" INTEGER;

-- CreateTable
CREATE TABLE "public"."Buyer" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "status" "public"."BuyerStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" VARCHAR(100),
    "budget" DECIMAL(12,2),
    "budgetCurrency" CHAR(3) NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "preferredBreeds" TEXT[],
    "preferredUses" TEXT[],
    "preferredAgeMin" INTEGER,
    "preferredAgeMax" INTEGER,
    "preferredSex" "public"."Sex",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BuyerInterest" (
    "id" SERIAL NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "level" "public"."InterestLevel" NOT NULL DEFAULT 'INTERESTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Deal" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "animalId" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "stage" "public"."DealStage" NOT NULL DEFAULT 'INQUIRY',
    "askingPrice" DECIMAL(12,2),
    "offerPrice" DECIMAL(12,2),
    "finalPrice" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "expectedCloseDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "outcome" "public"."DealOutcome",
    "lostReason" VARCHAR(500),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DealActivity" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "dealId" INTEGER NOT NULL,
    "type" "public"."DealActivityType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_partyId_key" ON "public"."Buyer"("partyId");

-- CreateIndex
CREATE INDEX "Buyer_tenantId_idx" ON "public"."Buyer"("tenantId");

-- CreateIndex
CREATE INDEX "Buyer_partyId_idx" ON "public"."Buyer"("partyId");

-- CreateIndex
CREATE INDEX "Buyer_status_idx" ON "public"."Buyer"("status");

-- CreateIndex
CREATE INDEX "Buyer_tenantId_status_idx" ON "public"."Buyer"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Buyer_tenantId_archivedAt_idx" ON "public"."Buyer"("tenantId", "archivedAt");

-- CreateIndex
CREATE INDEX "BuyerInterest_buyerId_idx" ON "public"."BuyerInterest"("buyerId");

-- CreateIndex
CREATE INDEX "BuyerInterest_animalId_idx" ON "public"."BuyerInterest"("animalId");

-- CreateIndex
CREATE INDEX "BuyerInterest_level_idx" ON "public"."BuyerInterest"("level");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerInterest_buyerId_animalId_key" ON "public"."BuyerInterest"("buyerId", "animalId");

-- CreateIndex
CREATE INDEX "Deal_tenantId_idx" ON "public"."Deal"("tenantId");

-- CreateIndex
CREATE INDEX "Deal_buyerId_idx" ON "public"."Deal"("buyerId");

-- CreateIndex
CREATE INDEX "Deal_animalId_idx" ON "public"."Deal"("animalId");

-- CreateIndex
CREATE INDEX "Deal_stage_idx" ON "public"."Deal"("stage");

-- CreateIndex
CREATE INDEX "Deal_tenantId_stage_idx" ON "public"."Deal"("tenantId", "stage");

-- CreateIndex
CREATE INDEX "Deal_tenantId_buyerId_idx" ON "public"."Deal"("tenantId", "buyerId");

-- CreateIndex
CREATE INDEX "Deal_outcome_idx" ON "public"."Deal"("outcome");

-- CreateIndex
CREATE INDEX "DealActivity_tenantId_idx" ON "public"."DealActivity"("tenantId");

-- CreateIndex
CREATE INDEX "DealActivity_dealId_idx" ON "public"."DealActivity"("dealId");

-- CreateIndex
CREATE INDEX "DealActivity_type_idx" ON "public"."DealActivity"("type");

-- CreateIndex
CREATE INDEX "DealActivity_dealId_createdAt_idx" ON "public"."DealActivity"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "TagAssignment_buyerId_idx" ON "public"."TagAssignment"("buyerId");

-- CreateIndex
CREATE INDEX "TagAssignment_dealId_idx" ON "public"."TagAssignment"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_buyerId_key" ON "public"."TagAssignment"("tagId", "buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_dealId_key" ON "public"."TagAssignment"("tagId", "dealId");

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Buyer" ADD CONSTRAINT "Buyer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Buyer" ADD CONSTRAINT "Buyer_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "public"."Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BuyerInterest" ADD CONSTRAINT "BuyerInterest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BuyerInterest" ADD CONSTRAINT "BuyerInterest_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deal" ADD CONSTRAINT "Deal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deal" ADD CONSTRAINT "Deal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deal" ADD CONSTRAINT "Deal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DealActivity" ADD CONSTRAINT "DealActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DealActivity" ADD CONSTRAINT "DealActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DealActivity" ADD CONSTRAINT "DealActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
