-- CreateEnum
CREATE TYPE "FeatureModule" AS ENUM ('GENETICS', 'MARKETPLACE', 'FINANCIAL', 'ANIMALS', 'CONTACTS', 'BREEDING', 'DOCUMENTS', 'HEALTH', 'SCHEDULING', 'PORTAL', 'REPORTING', 'SETTINGS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntitlementKey" ADD VALUE 'GENETICS_STANDARD';
ALTER TYPE "EntitlementKey" ADD VALUE 'GENETICS_PRO';

-- CreateTable
CREATE TABLE "Feature" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "module" "FeatureModule" NOT NULL,
    "entitlementKey" "EntitlementKey" NOT NULL,
    "uiHint" VARCHAR(200),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureCheck" (
    "id" BIGSERIAL NOT NULL,
    "featureKey" VARCHAR(100) NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "userId" TEXT,
    "granted" BOOLEAN NOT NULL,
    "context" VARCHAR(100),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureCheckDaily" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "featureKey" VARCHAR(100) NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "checkCount" INTEGER NOT NULL DEFAULT 0,
    "grantCount" INTEGER NOT NULL DEFAULT 0,
    "denyCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FeatureCheckDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feature_key_key" ON "Feature"("key");

-- CreateIndex
CREATE INDEX "Feature_module_idx" ON "Feature"("module");

-- CreateIndex
CREATE INDEX "Feature_entitlementKey_idx" ON "Feature"("entitlementKey");

-- CreateIndex
CREATE INDEX "Feature_isActive_idx" ON "Feature"("isActive");

-- CreateIndex
CREATE INDEX "FeatureCheck_featureKey_timestamp_idx" ON "FeatureCheck"("featureKey", "timestamp");

-- CreateIndex
CREATE INDEX "FeatureCheck_tenantId_timestamp_idx" ON "FeatureCheck"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "FeatureCheck_timestamp_idx" ON "FeatureCheck"("timestamp");

-- CreateIndex
CREATE INDEX "FeatureCheck_granted_timestamp_idx" ON "FeatureCheck"("granted", "timestamp");

-- CreateIndex
CREATE INDEX "FeatureCheckDaily_date_idx" ON "FeatureCheckDaily"("date");

-- CreateIndex
CREATE INDEX "FeatureCheckDaily_featureKey_idx" ON "FeatureCheckDaily"("featureKey");

-- CreateIndex
CREATE INDEX "FeatureCheckDaily_tenantId_idx" ON "FeatureCheckDaily"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureCheckDaily_date_featureKey_tenantId_key" ON "FeatureCheckDaily"("date", "featureKey", "tenantId");

-- AddForeignKey
ALTER TABLE "FeatureCheck" ADD CONSTRAINT "FeatureCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
