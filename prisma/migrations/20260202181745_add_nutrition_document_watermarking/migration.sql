-- CreateEnum
CREATE TYPE "public"."MediaAccessType" AS ENUM ('VIEW', 'DOWNLOAD', 'SHARE');

-- CreateEnum
CREATE TYPE "public"."MediaAccessActor" AS ENUM ('OWNER', 'BUYER', 'PUBLIC', 'PORTAL');

-- CreateEnum
CREATE TYPE "public"."FoodType" AS ENUM ('DRY', 'WET', 'RAW', 'FRESH', 'FREEZE_DRIED', 'SUPPLEMENT', 'TREAT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."LifeStage" AS ENUM ('PUPPY', 'JUNIOR', 'ADULT', 'SENIOR', 'ALL_STAGES', 'BREEDING', 'PERFORMANCE');

-- CreateEnum
CREATE TYPE "public"."FoodChangeReason" AS ENUM ('LIFE_STAGE', 'HEALTH_ISSUE', 'VET_RECOMMENDATION', 'AVAILABILITY', 'COST_OPTIMIZATION', 'PERFORMANCE', 'PREFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SuccessRating" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR');

-- AlterTable
ALTER TABLE "public"."Document" ADD COLUMN     "watermarkEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Tenant" ADD COLUMN     "watermarkSettings" JSONB;

-- CreateTable
CREATE TABLE "public"."MediaAccessEvent" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" INTEGER NOT NULL,
    "documentId" INTEGER,
    "storageKey" TEXT NOT NULL,
    "actorType" "public"."MediaAccessActor" NOT NULL,
    "userId" VARCHAR(36),
    "marketplaceUserId" INTEGER,
    "partyId" INTEGER,
    "accessType" "public"."MediaAccessType" NOT NULL,
    "ip" VARCHAR(45),
    "userAgent" TEXT,
    "watermarked" BOOLEAN NOT NULL DEFAULT false,
    "watermarkHash" VARCHAR(32),

    CONSTRAINT "MediaAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WatermarkedAsset" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "originalKey" TEXT NOT NULL,
    "watermarkedKey" TEXT NOT NULL,
    "settingsHash" VARCHAR(32) NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatermarkedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoodProduct" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "sku" TEXT,
    "foodType" "public"."FoodType" NOT NULL,
    "species" "public"."Species"[],
    "lifeStage" "public"."LifeStage",
    "photoUrl" TEXT,
    "bagSizeOz" INTEGER,
    "costCents" INTEGER,
    "costPerOzCents" INTEGER,
    "servingSizeOz" DOUBLE PRECISION,
    "proteinPct" DOUBLE PRECISION,
    "fatPct" DOUBLE PRECISION,
    "fiberPct" DOUBLE PRECISION,
    "caloriesPerCup" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeedingPlan" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "foodProductId" INTEGER NOT NULL,
    "portionOz" DOUBLE PRECISION NOT NULL,
    "feedingsPerDay" INTEGER NOT NULL DEFAULT 2,
    "feedingTimes" TEXT[],
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "autoCreateExpense" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeedingRecord" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "feedingPlanId" INTEGER,
    "foodProductId" INTEGER,
    "fedAt" TIMESTAMP(3) NOT NULL,
    "portionOz" DOUBLE PRECISION,
    "costCents" INTEGER,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "skipReason" TEXT,
    "appetiteScore" INTEGER,
    "expenseId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoodChange" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "previousPlanId" INTEGER,
    "newPlanId" INTEGER NOT NULL,
    "changeDate" TIMESTAMP(3) NOT NULL,
    "changeReason" "public"."FoodChangeReason" NOT NULL,
    "reasonDetails" TEXT,
    "transitionDays" INTEGER,
    "transitionNotes" TEXT,
    "reactions" TEXT,
    "digestiveNotes" TEXT,
    "overallSuccess" "public"."SuccessRating",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaAccessEvent_tenantId_createdAt_idx" ON "public"."MediaAccessEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAccessEvent_documentId_idx" ON "public"."MediaAccessEvent"("documentId");

-- CreateIndex
CREATE INDEX "MediaAccessEvent_storageKey_idx" ON "public"."MediaAccessEvent"("storageKey");

-- CreateIndex
CREATE INDEX "WatermarkedAsset_expiresAt_idx" ON "public"."WatermarkedAsset"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WatermarkedAsset_tenantId_originalKey_settingsHash_key" ON "public"."WatermarkedAsset"("tenantId", "originalKey", "settingsHash");

-- CreateIndex
CREATE INDEX "FoodProduct_tenantId_idx" ON "public"."FoodProduct"("tenantId");

-- CreateIndex
CREATE INDEX "FoodProduct_tenantId_foodType_idx" ON "public"."FoodProduct"("tenantId", "foodType");

-- CreateIndex
CREATE INDEX "FoodProduct_tenantId_isActive_idx" ON "public"."FoodProduct"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "FoodProduct_tenantId_species_idx" ON "public"."FoodProduct"("tenantId", "species");

-- CreateIndex
CREATE INDEX "FeedingPlan_tenantId_idx" ON "public"."FeedingPlan"("tenantId");

-- CreateIndex
CREATE INDEX "FeedingPlan_tenantId_animalId_idx" ON "public"."FeedingPlan"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "FeedingPlan_tenantId_animalId_isActive_idx" ON "public"."FeedingPlan"("tenantId", "animalId", "isActive");

-- CreateIndex
CREATE INDEX "FeedingPlan_animalId_startDate_idx" ON "public"."FeedingPlan"("animalId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "FeedingRecord_expenseId_key" ON "public"."FeedingRecord"("expenseId");

-- CreateIndex
CREATE INDEX "FeedingRecord_tenantId_idx" ON "public"."FeedingRecord"("tenantId");

-- CreateIndex
CREATE INDEX "FeedingRecord_tenantId_animalId_idx" ON "public"."FeedingRecord"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "FeedingRecord_tenantId_animalId_fedAt_idx" ON "public"."FeedingRecord"("tenantId", "animalId", "fedAt");

-- CreateIndex
CREATE INDEX "FeedingRecord_fedAt_idx" ON "public"."FeedingRecord"("fedAt");

-- CreateIndex
CREATE INDEX "FoodChange_tenantId_idx" ON "public"."FoodChange"("tenantId");

-- CreateIndex
CREATE INDEX "FoodChange_tenantId_animalId_idx" ON "public"."FoodChange"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "FoodChange_animalId_changeDate_idx" ON "public"."FoodChange"("animalId", "changeDate");

-- AddForeignKey
ALTER TABLE "public"."MediaAccessEvent" ADD CONSTRAINT "MediaAccessEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WatermarkedAsset" ADD CONSTRAINT "WatermarkedAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FoodProduct" ADD CONSTRAINT "FoodProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedingPlan" ADD CONSTRAINT "FeedingPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedingPlan" ADD CONSTRAINT "FeedingPlan_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedingPlan" ADD CONSTRAINT "FeedingPlan_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES "public"."FoodProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedingRecord" ADD CONSTRAINT "FeedingRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedingRecord" ADD CONSTRAINT "FeedingRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedingRecord" ADD CONSTRAINT "FeedingRecord_feedingPlanId_fkey" FOREIGN KEY ("feedingPlanId") REFERENCES "public"."FeedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedingRecord" ADD CONSTRAINT "FeedingRecord_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES "public"."FoodProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FoodChange" ADD CONSTRAINT "FoodChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FoodChange" ADD CONSTRAINT "FoodChange_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FoodChange" ADD CONSTRAINT "FoodChange_previousPlanId_fkey" FOREIGN KEY ("previousPlanId") REFERENCES "public"."FeedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FoodChange" ADD CONSTRAINT "FoodChange_newPlanId_fkey" FOREIGN KEY ("newPlanId") REFERENCES "public"."FeedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
