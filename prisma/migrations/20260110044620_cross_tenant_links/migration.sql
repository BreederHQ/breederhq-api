/*
  Warnings:

  - A unique constraint covering the columns `[exchangeCode]` on the table `Animal` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[gaid]` on the table `GlobalAnimalIdentity` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ParentType" AS ENUM ('SIRE', 'DAM');

-- CreateEnum
CREATE TYPE "LinkRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "LinkMethod" AS ENUM ('GAID', 'EXCHANGE_CODE', 'REGISTRY_MATCH', 'MICROCHIP_MATCH', 'BREEDER_REQUEST', 'OFFSPRING_DERIVED');

-- CreateEnum
CREATE TYPE "RevokedBy" AS ENUM ('CHILD_OWNER', 'PARENT_OWNER', 'SYSTEM');

-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "exchangeCode" TEXT,
ADD COLUMN     "exchangeCodeExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GlobalAnimalIdentity" ADD COLUMN     "gaid" TEXT;

-- CreateTable
CREATE TABLE "AnimalLinkRequest" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requestingTenantId" INTEGER NOT NULL,
    "requestingUserId" TEXT NOT NULL,
    "sourceAnimalId" INTEGER NOT NULL,
    "relationshipType" "ParentType" NOT NULL,
    "targetAnimalId" INTEGER,
    "targetGaid" TEXT,
    "targetExchangeCode" TEXT,
    "targetRegistryId" INTEGER,
    "targetRegistryNum" TEXT,
    "targetTenantId" INTEGER,
    "message" TEXT,
    "status" "LinkRequestStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "responseMessage" TEXT,
    "denialReason" TEXT,
    "confirmedTargetAnimalId" INTEGER,

    CONSTRAINT "AnimalLinkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossTenantAnimalLink" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "childAnimalId" INTEGER NOT NULL,
    "childTenantId" INTEGER NOT NULL,
    "parentAnimalId" INTEGER NOT NULL,
    "parentTenantId" INTEGER NOT NULL,
    "parentType" "ParentType" NOT NULL,
    "linkRequestId" INTEGER,
    "linkMethod" "LinkMethod" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" "RevokedBy",
    "revocationReason" TEXT,

    CONSTRAINT "CrossTenantAnimalLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalLinkRequest_requestingTenantId_idx" ON "AnimalLinkRequest"("requestingTenantId");

-- CreateIndex
CREATE INDEX "AnimalLinkRequest_targetTenantId_idx" ON "AnimalLinkRequest"("targetTenantId");

-- CreateIndex
CREATE INDEX "AnimalLinkRequest_targetAnimalId_idx" ON "AnimalLinkRequest"("targetAnimalId");

-- CreateIndex
CREATE INDEX "AnimalLinkRequest_sourceAnimalId_idx" ON "AnimalLinkRequest"("sourceAnimalId");

-- CreateIndex
CREATE INDEX "AnimalLinkRequest_status_idx" ON "AnimalLinkRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CrossTenantAnimalLink_linkRequestId_key" ON "CrossTenantAnimalLink"("linkRequestId");

-- CreateIndex
CREATE INDEX "CrossTenantAnimalLink_parentAnimalId_idx" ON "CrossTenantAnimalLink"("parentAnimalId");

-- CreateIndex
CREATE INDEX "CrossTenantAnimalLink_childTenantId_idx" ON "CrossTenantAnimalLink"("childTenantId");

-- CreateIndex
CREATE INDEX "CrossTenantAnimalLink_parentTenantId_idx" ON "CrossTenantAnimalLink"("parentTenantId");

-- CreateIndex
CREATE INDEX "CrossTenantAnimalLink_active_idx" ON "CrossTenantAnimalLink"("active");

-- CreateIndex
CREATE UNIQUE INDEX "CrossTenantAnimalLink_childAnimalId_parentType_key" ON "CrossTenantAnimalLink"("childAnimalId", "parentType");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_exchangeCode_key" ON "Animal"("exchangeCode");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalAnimalIdentity_gaid_key" ON "GlobalAnimalIdentity"("gaid");

-- AddForeignKey
ALTER TABLE "AnimalLinkRequest" ADD CONSTRAINT "AnimalLinkRequest_requestingTenantId_fkey" FOREIGN KEY ("requestingTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalLinkRequest" ADD CONSTRAINT "AnimalLinkRequest_requestingUserId_fkey" FOREIGN KEY ("requestingUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalLinkRequest" ADD CONSTRAINT "AnimalLinkRequest_sourceAnimalId_fkey" FOREIGN KEY ("sourceAnimalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalLinkRequest" ADD CONSTRAINT "AnimalLinkRequest_targetAnimalId_fkey" FOREIGN KEY ("targetAnimalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalLinkRequest" ADD CONSTRAINT "AnimalLinkRequest_targetTenantId_fkey" FOREIGN KEY ("targetTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossTenantAnimalLink" ADD CONSTRAINT "CrossTenantAnimalLink_childAnimalId_fkey" FOREIGN KEY ("childAnimalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossTenantAnimalLink" ADD CONSTRAINT "CrossTenantAnimalLink_childTenantId_fkey" FOREIGN KEY ("childTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossTenantAnimalLink" ADD CONSTRAINT "CrossTenantAnimalLink_parentAnimalId_fkey" FOREIGN KEY ("parentAnimalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossTenantAnimalLink" ADD CONSTRAINT "CrossTenantAnimalLink_parentTenantId_fkey" FOREIGN KEY ("parentTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossTenantAnimalLink" ADD CONSTRAINT "CrossTenantAnimalLink_linkRequestId_fkey" FOREIGN KEY ("linkRequestId") REFERENCES "AnimalLinkRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
