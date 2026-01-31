-- CreateEnum
CREATE TYPE "public"."SemenCollectionMethod" AS ENUM ('AV', 'EE', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."SemenStorageType" AS ENUM ('FRESH', 'COOLED', 'FROZEN');

-- CreateEnum
CREATE TYPE "public"."SemenQualityGrade" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR');

-- CreateEnum
CREATE TYPE "public"."SemenInventoryStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'DEPLETED', 'EXPIRED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "public"."SemenUsageType" AS ENUM ('BREEDING_ON_SITE', 'BREEDING_SHIPPED', 'TRANSFERRED', 'SAMPLE_TESTING', 'DISCARDED');

-- CreateTable
CREATE TABLE "public"."SemenInventory" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "stallionId" INTEGER NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "collectionMethod" "public"."SemenCollectionMethod" NOT NULL DEFAULT 'AV',
    "storageType" "public"."SemenStorageType" NOT NULL,
    "storageLocation" TEXT,
    "storageFacility" TEXT,
    "initialDoses" INTEGER NOT NULL,
    "availableDoses" INTEGER NOT NULL,
    "doseVolumeMl" DECIMAL(5,2),
    "concentration" INTEGER,
    "motility" INTEGER,
    "morphology" INTEGER,
    "qualityGrade" "public"."SemenQualityGrade",
    "expiresAt" TIMESTAMP(3),
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."SemenInventoryStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "SemenInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SemenUsage" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "usageType" "public"."SemenUsageType" NOT NULL,
    "usageDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dosesUsed" INTEGER NOT NULL DEFAULT 1,
    "breedingAttemptId" INTEGER,
    "shippedToName" TEXT,
    "shippedToAddress" TEXT,
    "shippingCarrier" TEXT,
    "trackingNumber" TEXT,
    "transferredToFacility" TEXT,
    "notes" TEXT,
    "recordedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SemenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SemenInventory_tenantId_stallionId_idx" ON "public"."SemenInventory"("tenantId", "stallionId");

-- CreateIndex
CREATE INDEX "SemenInventory_tenantId_status_idx" ON "public"."SemenInventory"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SemenInventory_tenantId_batchNumber_key" ON "public"."SemenInventory"("tenantId", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SemenUsage_breedingAttemptId_key" ON "public"."SemenUsage"("breedingAttemptId");

-- CreateIndex
CREATE INDEX "SemenUsage_tenantId_inventoryId_idx" ON "public"."SemenUsage"("tenantId", "inventoryId");

-- CreateIndex
CREATE INDEX "SemenUsage_tenantId_usageDate_idx" ON "public"."SemenUsage"("tenantId", "usageDate");

-- AddForeignKey
ALTER TABLE "public"."SemenInventory" ADD CONSTRAINT "SemenInventory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SemenInventory" ADD CONSTRAINT "SemenInventory_stallionId_fkey" FOREIGN KEY ("stallionId") REFERENCES "public"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SemenUsage" ADD CONSTRAINT "SemenUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SemenUsage" ADD CONSTRAINT "SemenUsage_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "public"."SemenInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SemenUsage" ADD CONSTRAINT "SemenUsage_breedingAttemptId_fkey" FOREIGN KEY ("breedingAttemptId") REFERENCES "public"."BreedingAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
