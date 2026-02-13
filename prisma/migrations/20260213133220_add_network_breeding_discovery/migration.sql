-- CreateEnum
CREATE TYPE "public"."AnimalAccessTier" AS ENUM ('BASIC', 'GENETICS', 'LINEAGE', 'HEALTH', 'FULL');

-- CreateEnum
CREATE TYPE "public"."AnimalAccessSource" AS ENUM ('INQUIRY', 'QR_SCAN', 'SHARE_CODE', 'BREEDING_AGREEMENT');

-- CreateEnum
CREATE TYPE "public"."AnimalAccessStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'OWNER_DELETED');

-- CreateEnum
CREATE TYPE "public"."ShareCodeStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'MAX_USES_REACHED');

-- CreateEnum
CREATE TYPE "public"."BreedingAgreementStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."NetworkVisibility" AS ENUM ('VISIBLE', 'ANONYMOUS', 'HIDDEN');

-- CreateEnum
CREATE TYPE "public"."InquiryPermission" AS ENUM ('ANYONE', 'VERIFIED', 'CONNECTIONS');

-- AlterTable
ALTER TABLE "public"."Animal" ADD COLUMN     "networkSearchVisible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."Tenant" ADD COLUMN     "inquiryPermission" "public"."InquiryPermission" NOT NULL DEFAULT 'ANYONE',
ADD COLUMN     "networkVisibility" "public"."NetworkVisibility" NOT NULL DEFAULT 'VISIBLE';

-- CreateTable
CREATE TABLE "public"."ShareCode" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "animalIds" INTEGER[],
    "defaultAccessTier" "public"."AnimalAccessTier" NOT NULL DEFAULT 'BASIC',
    "perAnimalTiers" JSONB,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."ShareCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalAccess" (
    "id" SERIAL NOT NULL,
    "ownerTenantId" INTEGER NOT NULL,
    "accessorTenantId" INTEGER NOT NULL,
    "animalId" INTEGER,
    "accessTier" "public"."AnimalAccessTier" NOT NULL DEFAULT 'BASIC',
    "source" "public"."AnimalAccessSource" NOT NULL,
    "shareCodeId" INTEGER,
    "breedingPlanId" INTEGER,
    "status" "public"."AnimalAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "animalNameSnapshot" TEXT,
    "animalSpeciesSnapshot" "public"."Species",
    "animalSexSnapshot" "public"."Sex",
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareCode_code_key" ON "public"."ShareCode"("code");

-- CreateIndex
CREATE INDEX "ShareCode_tenantId_status_idx" ON "public"."ShareCode"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ShareCode_code_idx" ON "public"."ShareCode"("code");

-- CreateIndex
CREATE INDEX "ShareCode_expiresAt_idx" ON "public"."ShareCode"("expiresAt");

-- CreateIndex
CREATE INDEX "AnimalAccess_ownerTenantId_status_idx" ON "public"."AnimalAccess"("ownerTenantId", "status");

-- CreateIndex
CREATE INDEX "AnimalAccess_accessorTenantId_status_idx" ON "public"."AnimalAccess"("accessorTenantId", "status");

-- CreateIndex
CREATE INDEX "AnimalAccess_animalId_idx" ON "public"."AnimalAccess"("animalId");

-- CreateIndex
CREATE INDEX "AnimalAccess_shareCodeId_idx" ON "public"."AnimalAccess"("shareCodeId");

-- CreateIndex
CREATE INDEX "AnimalAccess_status_deletedAt_idx" ON "public"."AnimalAccess"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "AnimalAccess_expiresAt_idx" ON "public"."AnimalAccess"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalAccess_animalId_accessorTenantId_key" ON "public"."AnimalAccess"("animalId", "accessorTenantId");

-- CreateIndex
CREATE INDEX "Animal_tenantId_species_sex_networkSearchVisible_idx" ON "public"."Animal"("tenantId", "species", "sex", "networkSearchVisible");

-- AddForeignKey
ALTER TABLE "public"."ShareCode" ADD CONSTRAINT "ShareCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalAccess" ADD CONSTRAINT "AnimalAccess_ownerTenantId_fkey" FOREIGN KEY ("ownerTenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalAccess" ADD CONSTRAINT "AnimalAccess_accessorTenantId_fkey" FOREIGN KEY ("accessorTenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalAccess" ADD CONSTRAINT "AnimalAccess_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalAccess" ADD CONSTRAINT "AnimalAccess_shareCodeId_fkey" FOREIGN KEY ("shareCodeId") REFERENCES "public"."ShareCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalAccess" ADD CONSTRAINT "AnimalAccess_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES "public"."BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
