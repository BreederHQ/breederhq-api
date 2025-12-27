-- CreateEnum
CREATE TYPE "TraitValueType" AS ENUM ('BOOLEAN', 'TEXT', 'DATE', 'FILE_REFERENCE', 'ENUM', 'JSON');

-- CreateEnum
CREATE TYPE "TraitSource" AS ENUM ('GLOBAL', 'TENANT');

-- CreateEnum
CREATE TYPE "TraitStatus" AS ENUM ('ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "DocVisibility" AS ENUM ('PRIVATE', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('PLACEHOLDER', 'UPLOADED', 'VERIFIED');

-- CreateTable
CREATE TABLE "TraitDefinition" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER,
    "species" "Species" NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "valueType" "TraitValueType" NOT NULL,
    "enumValues" JSONB,
    "requiresDocument" BOOLEAN NOT NULL DEFAULT false,
    "marketplaceVisibleDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraitDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalTraitValue" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "traitKey" TEXT NOT NULL,
    "boolValue" BOOLEAN,
    "textValue" TEXT,
    "dateValue" TIMESTAMP(3),
    "fileReference" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "marketplaceVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalTraitValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalTraitValueDocument" (
    "id" SERIAL NOT NULL,
    "animalTraitValueId" INTEGER NOT NULL,
    "documentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalTraitValueDocument_pkey" PRIMARY KEY ("id")
);

-- AlterTable Document - Add trait prototype fields
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "visibility" "DocVisibility" DEFAULT 'PRIVATE';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "status" "DocStatus" DEFAULT 'PLACEHOLDER';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "originalFileName" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "bucket" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "objectKey" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "url" TEXT;

-- CreateIndex
CREATE INDEX "TraitDefinition_species_idx" ON "TraitDefinition"("species");
CREATE INDEX "TraitDefinition_tenantId_species_idx" ON "TraitDefinition"("tenantId", "species");
CREATE UNIQUE INDEX "TraitDefinition_species_key_tenantId_key" ON "TraitDefinition"("species", "key", "tenantId");

-- CreateIndex
CREATE INDEX "AnimalTraitValue_animalId_idx" ON "AnimalTraitValue"("animalId");
CREATE UNIQUE INDEX "AnimalTraitValue_animalId_traitKey_key" ON "AnimalTraitValue"("animalId", "traitKey");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalTraitValueDocument_animalTraitValueId_documentId_key" ON "AnimalTraitValueDocument"("animalTraitValueId", "documentId");

-- AddForeignKey
ALTER TABLE "AnimalTraitValue" ADD CONSTRAINT "AnimalTraitValue_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalTraitValueDocument" ADD CONSTRAINT "AnimalTraitValueDocument_animalTraitValueId_fkey" FOREIGN KEY ("animalTraitValueId") REFERENCES "AnimalTraitValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalTraitValueDocument" ADD CONSTRAINT "AnimalTraitValueDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
