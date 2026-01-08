-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM (
  'MICROCHIP',
  'AKC',
  'UKC',
  'CKC',
  'KC',
  'FCI',
  'AQHA',
  'JOCKEY_CLUB',
  'USEF',
  'ADGA',
  'AGS',
  'ARBA',
  'TICA',
  'CFA',
  'EMBARK',
  'WISDOM_PANEL',
  'DNA_PROFILE',
  'TATTOO',
  'EAR_TAG',
  'USDA_SCRAPIE',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "LineageRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LineageAccessLevel" AS ENUM ('LINEAGE_ONLY', 'BASIC', 'STANDARD', 'FULL');

-- CreateTable: GlobalAnimalIdentity
CREATE TABLE "GlobalAnimalIdentity" (
  "id" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "species" "Species" NOT NULL,
  "sex" "Sex",
  "birthDate" TIMESTAMP(3),
  "name" TEXT,
  "damId" INTEGER,
  "sireId" INTEGER,

  CONSTRAINT "GlobalAnimalIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GlobalAnimalIdentifier
CREATE TABLE "GlobalAnimalIdentifier" (
  "id" SERIAL NOT NULL,
  "identityId" INTEGER NOT NULL,
  "type" "IdentifierType" NOT NULL,
  "value" TEXT NOT NULL,
  "rawValue" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "sourceTenantId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GlobalAnimalIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AnimalIdentityLink
CREATE TABLE "AnimalIdentityLink" (
  "id" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "animalId" INTEGER NOT NULL,
  "identityId" INTEGER NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "matchedOn" TEXT[],
  "autoMatched" BOOLEAN NOT NULL DEFAULT false,
  "confirmedAt" TIMESTAMP(3),
  "confirmedByUser" TEXT,

  CONSTRAINT "AnimalIdentityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AnimalPrivacySettings
CREATE TABLE "AnimalPrivacySettings" (
  "id" SERIAL NOT NULL,
  "animalId" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "allowCrossTenantMatching" BOOLEAN NOT NULL DEFAULT true,
  "showName" BOOLEAN NOT NULL DEFAULT true,
  "showPhoto" BOOLEAN NOT NULL DEFAULT true,
  "showFullDob" BOOLEAN NOT NULL DEFAULT true,
  "showRegistryFull" BOOLEAN NOT NULL DEFAULT false,
  "showHealthResults" BOOLEAN NOT NULL DEFAULT false,
  "showGeneticData" BOOLEAN NOT NULL DEFAULT false,
  "showBreeder" BOOLEAN NOT NULL DEFAULT true,
  "allowInfoRequests" BOOLEAN NOT NULL DEFAULT true,
  "allowDirectContact" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "AnimalPrivacySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LineageInfoRequest
CREATE TABLE "LineageInfoRequest" (
  "id" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "requestingTenantId" INTEGER NOT NULL,
  "requestingUserId" TEXT NOT NULL,
  "targetIdentityId" INTEGER NOT NULL,
  "targetTenantId" INTEGER NOT NULL,
  "message" TEXT,
  "purpose" TEXT,
  "status" "LineageRequestStatus" NOT NULL DEFAULT 'PENDING',
  "respondedAt" TIMESTAMP(3),
  "responseMessage" TEXT,
  "grantedAccess" "LineageAccessLevel",
  "accessExpiresAt" TIMESTAMP(3),

  CONSTRAINT "LineageInfoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GlobalAnimalIdentity_species_idx" ON "GlobalAnimalIdentity"("species");
CREATE INDEX "GlobalAnimalIdentity_damId_idx" ON "GlobalAnimalIdentity"("damId");
CREATE INDEX "GlobalAnimalIdentity_sireId_idx" ON "GlobalAnimalIdentity"("sireId");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalAnimalIdentifier_type_value_key" ON "GlobalAnimalIdentifier"("type", "value");
CREATE INDEX "GlobalAnimalIdentifier_identityId_idx" ON "GlobalAnimalIdentifier"("identityId");
CREATE INDEX "GlobalAnimalIdentifier_type_value_idx" ON "GlobalAnimalIdentifier"("type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalIdentityLink_animalId_key" ON "AnimalIdentityLink"("animalId");
CREATE INDEX "AnimalIdentityLink_identityId_idx" ON "AnimalIdentityLink"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalPrivacySettings_animalId_key" ON "AnimalPrivacySettings"("animalId");

-- CreateIndex
CREATE INDEX "LineageInfoRequest_requestingTenantId_idx" ON "LineageInfoRequest"("requestingTenantId");
CREATE INDEX "LineageInfoRequest_targetTenantId_idx" ON "LineageInfoRequest"("targetTenantId");
CREATE INDEX "LineageInfoRequest_targetIdentityId_idx" ON "LineageInfoRequest"("targetIdentityId");
CREATE INDEX "LineageInfoRequest_status_idx" ON "LineageInfoRequest"("status");

-- AddForeignKey
ALTER TABLE "GlobalAnimalIdentity" ADD CONSTRAINT "GlobalAnimalIdentity_damId_fkey" FOREIGN KEY ("damId") REFERENCES "GlobalAnimalIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GlobalAnimalIdentity" ADD CONSTRAINT "GlobalAnimalIdentity_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "GlobalAnimalIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalAnimalIdentifier" ADD CONSTRAINT "GlobalAnimalIdentifier_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "GlobalAnimalIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GlobalAnimalIdentifier" ADD CONSTRAINT "GlobalAnimalIdentifier_sourceTenantId_fkey" FOREIGN KEY ("sourceTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalIdentityLink" ADD CONSTRAINT "AnimalIdentityLink_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalIdentityLink" ADD CONSTRAINT "AnimalIdentityLink_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "GlobalAnimalIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPrivacySettings" ADD CONSTRAINT "AnimalPrivacySettings_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineageInfoRequest" ADD CONSTRAINT "LineageInfoRequest_requestingTenantId_fkey" FOREIGN KEY ("requestingTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LineageInfoRequest" ADD CONSTRAINT "LineageInfoRequest_requestingUserId_fkey" FOREIGN KEY ("requestingUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LineageInfoRequest" ADD CONSTRAINT "LineageInfoRequest_targetIdentityId_fkey" FOREIGN KEY ("targetIdentityId") REFERENCES "GlobalAnimalIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LineageInfoRequest" ADD CONSTRAINT "LineageInfoRequest_targetTenantId_fkey" FOREIGN KEY ("targetTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
