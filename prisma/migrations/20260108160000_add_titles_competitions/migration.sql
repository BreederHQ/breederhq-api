-- CreateEnum
CREATE TYPE "TitleCategory" AS ENUM (
  'CONFORMATION',
  'OBEDIENCE',
  'AGILITY',
  'FIELD',
  'HERDING',
  'TRACKING',
  'RALLY',
  'PRODUCING',
  'BREED_SPECIFIC',
  'PERFORMANCE',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "TitleStatus" AS ENUM ('IN_PROGRESS', 'EARNED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "CompetitionType" AS ENUM (
  'CONFORMATION_SHOW',
  'OBEDIENCE_TRIAL',
  'AGILITY_TRIAL',
  'FIELD_TRIAL',
  'HERDING_TRIAL',
  'TRACKING_TEST',
  'RALLY_TRIAL',
  'RACE',
  'PERFORMANCE_TEST',
  'BREED_SPECIALTY',
  'OTHER'
);

-- CreateTable: TitleDefinition
CREATE TABLE "TitleDefinition" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER,
  "species" "Species" NOT NULL,
  "abbreviation" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "category" "TitleCategory" NOT NULL,
  "organization" TEXT,
  "parentTitleId" INTEGER,
  "pointsRequired" INTEGER,
  "description" TEXT,
  "isProducingTitle" BOOLEAN NOT NULL DEFAULT false,
  "prefixTitle" BOOLEAN NOT NULL DEFAULT true,
  "suffixTitle" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TitleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AnimalTitle
CREATE TABLE "AnimalTitle" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "animalId" INTEGER NOT NULL,
  "titleDefinitionId" INTEGER NOT NULL,
  "dateEarned" TIMESTAMP(3),
  "status" "TitleStatus" NOT NULL DEFAULT 'EARNED',
  "pointsEarned" DOUBLE PRECISION,
  "majorWins" INTEGER,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "registryRef" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnimalTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AnimalTitleDocument
CREATE TABLE "AnimalTitleDocument" (
  "id" SERIAL NOT NULL,
  "animalTitleId" INTEGER NOT NULL,
  "documentId" INTEGER NOT NULL,

  CONSTRAINT "AnimalTitleDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CompetitionEntry
CREATE TABLE "CompetitionEntry" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "animalId" INTEGER NOT NULL,
  "eventName" TEXT NOT NULL,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "location" TEXT,
  "organization" TEXT,
  "competitionType" "CompetitionType" NOT NULL,
  "className" TEXT,
  "placement" INTEGER,
  "placementLabel" TEXT,
  "pointsEarned" DOUBLE PRECISION,
  "isMajorWin" BOOLEAN NOT NULL DEFAULT false,
  "qualifyingScore" BOOLEAN NOT NULL DEFAULT false,
  "score" DOUBLE PRECISION,
  "scoreMax" DOUBLE PRECISION,
  "judgeName" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompetitionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CompetitionEntryDocument
CREATE TABLE "CompetitionEntryDocument" (
  "id" SERIAL NOT NULL,
  "competitionEntryId" INTEGER NOT NULL,
  "documentId" INTEGER NOT NULL,

  CONSTRAINT "CompetitionEntryDocument_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Animal - add title prefix/suffix cache
ALTER TABLE "Animal" ADD COLUMN "titlePrefix" TEXT;
ALTER TABLE "Animal" ADD COLUMN "titleSuffix" TEXT;

-- CreateIndex
CREATE INDEX "TitleDefinition_species_idx" ON "TitleDefinition"("species");
CREATE INDEX "TitleDefinition_category_idx" ON "TitleDefinition"("category");
CREATE INDEX "TitleDefinition_tenantId_idx" ON "TitleDefinition"("tenantId");
CREATE UNIQUE INDEX "TitleDefinition_species_abbreviation_organization_tenantId_key" ON "TitleDefinition"("species", "abbreviation", "organization", "tenantId");

-- CreateIndex
CREATE INDEX "AnimalTitle_tenantId_idx" ON "AnimalTitle"("tenantId");
CREATE INDEX "AnimalTitle_animalId_idx" ON "AnimalTitle"("animalId");
CREATE INDEX "AnimalTitle_status_idx" ON "AnimalTitle"("status");
CREATE UNIQUE INDEX "AnimalTitle_animalId_titleDefinitionId_key" ON "AnimalTitle"("animalId", "titleDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalTitleDocument_animalTitleId_documentId_key" ON "AnimalTitleDocument"("animalTitleId", "documentId");

-- CreateIndex
CREATE INDEX "CompetitionEntry_tenantId_idx" ON "CompetitionEntry"("tenantId");
CREATE INDEX "CompetitionEntry_animalId_idx" ON "CompetitionEntry"("animalId");
CREATE INDEX "CompetitionEntry_eventDate_idx" ON "CompetitionEntry"("eventDate");
CREATE INDEX "CompetitionEntry_competitionType_idx" ON "CompetitionEntry"("competitionType");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionEntryDocument_competitionEntryId_documentId_key" ON "CompetitionEntryDocument"("competitionEntryId", "documentId");

-- AddForeignKey
ALTER TABLE "TitleDefinition" ADD CONSTRAINT "TitleDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TitleDefinition" ADD CONSTRAINT "TitleDefinition_parentTitleId_fkey" FOREIGN KEY ("parentTitleId") REFERENCES "TitleDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalTitle" ADD CONSTRAINT "AnimalTitle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalTitle" ADD CONSTRAINT "AnimalTitle_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalTitle" ADD CONSTRAINT "AnimalTitle_titleDefinitionId_fkey" FOREIGN KEY ("titleDefinitionId") REFERENCES "TitleDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalTitleDocument" ADD CONSTRAINT "AnimalTitleDocument_animalTitleId_fkey" FOREIGN KEY ("animalTitleId") REFERENCES "AnimalTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalTitleDocument" ADD CONSTRAINT "AnimalTitleDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntryDocument" ADD CONSTRAINT "CompetitionEntryDocument_competitionEntryId_fkey" FOREIGN KEY ("competitionEntryId") REFERENCES "CompetitionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionEntryDocument" ADD CONSTRAINT "CompetitionEntryDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
