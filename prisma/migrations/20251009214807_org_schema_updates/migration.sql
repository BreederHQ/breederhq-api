/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,microchip]` on the table `Animal` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'BILLING', 'VIEWER');

-- CreateEnum
CREATE TYPE "ShareScope" AS ENUM ('VIEW', 'BREED_PLAN');

-- CreateEnum
CREATE TYPE "ShareStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "tenantId" INTEGER;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "tenantId" INTEGER;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "tenantId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultTenantId" INTEGER;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "primaryEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMembership" (
    "userId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("userId","tenantId")
);

-- CreateTable
CREATE TABLE "BillingAccount" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "provider" TEXT,
    "customerId" TEXT,
    "subscriptionId" TEXT,
    "plan" TEXT,
    "status" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registry" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "url" TEXT,
    "country" TEXT,
    "species" "Species",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalRegistryIdentifier" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "registryId" INTEGER NOT NULL,
    "identifier" TEXT NOT NULL,
    "registrarOfRecord" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalRegistryIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalShare" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "fromTenantId" INTEGER NOT NULL,
    "toTenantId" INTEGER NOT NULL,
    "scope" "ShareScope" NOT NULL DEFAULT 'VIEW',
    "status" "ShareStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalPublicListing" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "isListed" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT,
    "urlSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalPublicListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_name_idx" ON "Tenant"("name");

-- CreateIndex
CREATE INDEX "TenantMembership_tenantId_idx" ON "TenantMembership"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_tenantId_key" ON "BillingAccount"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Registry_code_key" ON "Registry"("code");

-- CreateIndex
CREATE INDEX "AnimalRegistryIdentifier_animalId_idx" ON "AnimalRegistryIdentifier"("animalId");

-- CreateIndex
CREATE INDEX "AnimalRegistryIdentifier_registryId_idx" ON "AnimalRegistryIdentifier"("registryId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalRegistryIdentifier_registryId_identifier_key" ON "AnimalRegistryIdentifier"("registryId", "identifier");

-- CreateIndex
CREATE INDEX "AnimalShare_fromTenantId_idx" ON "AnimalShare"("fromTenantId");

-- CreateIndex
CREATE INDEX "AnimalShare_toTenantId_idx" ON "AnimalShare"("toTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalShare_animalId_toTenantId_key" ON "AnimalShare"("animalId", "toTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalPublicListing_animalId_key" ON "AnimalPublicListing"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalPublicListing_urlSlug_key" ON "AnimalPublicListing"("urlSlug");

-- CreateIndex
CREATE INDEX "AnimalPublicListing_tenantId_idx" ON "AnimalPublicListing"("tenantId");

-- CreateIndex
CREATE INDEX "Animal_tenantId_idx" ON "Animal"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_tenantId_microchip_key" ON "Animal"("tenantId", "microchip");

-- CreateIndex
CREATE INDEX "Contact_tenantId_idx" ON "Contact"("tenantId");

-- CreateIndex
CREATE INDEX "Organization_tenantId_idx" ON "Organization"("tenantId");

-- CreateIndex
CREATE INDEX "User_defaultTenantId_idx" ON "User"("defaultTenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultTenantId_fkey" FOREIGN KEY ("defaultTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalRegistryIdentifier" ADD CONSTRAINT "AnimalRegistryIdentifier_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalRegistryIdentifier" ADD CONSTRAINT "AnimalRegistryIdentifier_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "Registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalShare" ADD CONSTRAINT "AnimalShare_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalShare" ADD CONSTRAINT "AnimalShare_fromTenantId_fkey" FOREIGN KEY ("fromTenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalShare" ADD CONSTRAINT "AnimalShare_toTenantId_fkey" FOREIGN KEY ("toTenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPublicListing" ADD CONSTRAINT "AnimalPublicListing_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPublicListing" ADD CONSTRAINT "AnimalPublicListing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
