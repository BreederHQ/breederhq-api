-- CreateEnum
CREATE TYPE "public"."RegistryConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'ERROR', 'TOKEN_EXPIRED');

-- CreateEnum
CREATE TYPE "public"."VerificationMethod" AS ENUM ('API', 'MANUAL', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "public"."VerificationConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NONE');

-- CreateTable
CREATE TABLE "public"."RegistryConnection" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "registryId" INTEGER NOT NULL,
    "status" "public"."RegistryConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistryConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RegistryVerification" (
    "id" SERIAL NOT NULL,
    "animalRegistryIdentifierId" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "method" "public"."VerificationMethod",
    "confidence" "public"."VerificationConfidence" NOT NULL DEFAULT 'NONE',
    "registryData" JSONB,
    "documentUrl" TEXT,
    "documentNotes" TEXT,
    "verifiedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistryVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RegistryPedigree" (
    "id" SERIAL NOT NULL,
    "animalRegistryIdentifierId" INTEGER NOT NULL,
    "generation" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "birthYear" INTEGER,
    "sex" TEXT,
    "linkedAnimalId" INTEGER,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistryPedigree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RegistrySyncLog" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "registryId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "animalId" INTEGER,
    "identifier" TEXT,
    "requestData" JSONB,
    "responseData" JSONB,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "initiatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrySyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistryConnection_tenantId_idx" ON "public"."RegistryConnection"("tenantId");

-- CreateIndex
CREATE INDEX "RegistryConnection_registryId_idx" ON "public"."RegistryConnection"("registryId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistryConnection_tenantId_registryId_key" ON "public"."RegistryConnection"("tenantId", "registryId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistryVerification_animalRegistryIdentifierId_key" ON "public"."RegistryVerification"("animalRegistryIdentifierId");

-- CreateIndex
CREATE INDEX "RegistryVerification_verified_idx" ON "public"."RegistryVerification"("verified");

-- CreateIndex
CREATE INDEX "RegistryPedigree_animalRegistryIdentifierId_idx" ON "public"."RegistryPedigree"("animalRegistryIdentifierId");

-- CreateIndex
CREATE INDEX "RegistryPedigree_linkedAnimalId_idx" ON "public"."RegistryPedigree"("linkedAnimalId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistryPedigree_animalRegistryIdentifierId_position_key" ON "public"."RegistryPedigree"("animalRegistryIdentifierId", "position");

-- CreateIndex
CREATE INDEX "RegistrySyncLog_tenantId_idx" ON "public"."RegistrySyncLog"("tenantId");

-- CreateIndex
CREATE INDEX "RegistrySyncLog_tenantId_registryId_idx" ON "public"."RegistrySyncLog"("tenantId", "registryId");

-- CreateIndex
CREATE INDEX "RegistrySyncLog_createdAt_idx" ON "public"."RegistrySyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "RegistrySyncLog_action_idx" ON "public"."RegistrySyncLog"("action");

-- AddForeignKey
ALTER TABLE "public"."RegistryConnection" ADD CONSTRAINT "RegistryConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistryConnection" ADD CONSTRAINT "RegistryConnection_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "public"."Registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistryVerification" ADD CONSTRAINT "RegistryVerification_animalRegistryIdentifierId_fkey" FOREIGN KEY ("animalRegistryIdentifierId") REFERENCES "public"."AnimalRegistryIdentifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistryVerification" ADD CONSTRAINT "RegistryVerification_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistryPedigree" ADD CONSTRAINT "RegistryPedigree_animalRegistryIdentifierId_fkey" FOREIGN KEY ("animalRegistryIdentifierId") REFERENCES "public"."AnimalRegistryIdentifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistryPedigree" ADD CONSTRAINT "RegistryPedigree_linkedAnimalId_fkey" FOREIGN KEY ("linkedAnimalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistrySyncLog" ADD CONSTRAINT "RegistrySyncLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistrySyncLog" ADD CONSTRAINT "RegistrySyncLog_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
