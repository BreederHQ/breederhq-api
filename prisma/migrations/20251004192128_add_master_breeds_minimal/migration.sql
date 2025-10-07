/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Breed` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."Registry" AS ENUM ('AKC', 'FCI', 'TICA', 'CFA', 'WCF', 'WBFSH', 'USEF', 'FEI', 'JOCKEY_CLUB', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."BreedStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "public"."AliasKind" AS ENUM ('COMMON', 'LEGACY', 'MISSPELLING');

-- AlterTable
ALTER TABLE "public"."Breed" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "species" "public"."Species",
ADD COLUMN     "status" "public"."BreedStatus" DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "public"."BreedAlias" (
    "id" SERIAL NOT NULL,
    "breedId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "kind" "public"."AliasKind" NOT NULL DEFAULT 'COMMON',

    CONSTRAINT "BreedAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BreedRegistryLink" (
    "id" SERIAL NOT NULL,
    "breedId" TEXT NOT NULL,
    "registry" "public"."Registry" NOT NULL,
    "registryId" TEXT,
    "url" TEXT,

    CONSTRAINT "BreedRegistryLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalCustomBreed" (
    "id" SERIAL NOT NULL,
    "animalId" TEXT NOT NULL,
    "customBreedId" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalCustomBreed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomBreed" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "species" "public"."Species",
    "name" TEXT NOT NULL,
    "canonicalBreedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomBreed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomBreedAlias" (
    "id" SERIAL NOT NULL,
    "customBreedId" INTEGER NOT NULL,
    "alias" TEXT NOT NULL,

    CONSTRAINT "CustomBreedAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreedAlias_alias_idx" ON "public"."BreedAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "BreedAlias_breedId_alias_key" ON "public"."BreedAlias"("breedId", "alias");

-- CreateIndex
CREATE INDEX "BreedRegistryLink_breedId_idx" ON "public"."BreedRegistryLink"("breedId");

-- CreateIndex
CREATE UNIQUE INDEX "BreedRegistryLink_breedId_registry_registryId_key" ON "public"."BreedRegistryLink"("breedId", "registry", "registryId");

-- CreateIndex
CREATE INDEX "AnimalCustomBreed_animalId_idx" ON "public"."AnimalCustomBreed"("animalId");

-- CreateIndex
CREATE INDEX "AnimalCustomBreed_customBreedId_idx" ON "public"."AnimalCustomBreed"("customBreedId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalCustomBreed_animalId_customBreedId_key" ON "public"."AnimalCustomBreed"("animalId", "customBreedId");

-- CreateIndex
CREATE INDEX "CustomBreed_organizationId_name_idx" ON "public"."CustomBreed"("organizationId", "name");

-- CreateIndex
CREATE INDEX "CustomBreed_canonicalBreedId_idx" ON "public"."CustomBreed"("canonicalBreedId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomBreed_organizationId_name_key" ON "public"."CustomBreed"("organizationId", "name");

-- CreateIndex
CREATE INDEX "CustomBreedAlias_alias_idx" ON "public"."CustomBreedAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "CustomBreedAlias_customBreedId_alias_key" ON "public"."CustomBreedAlias"("customBreedId", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "Breed_slug_key" ON "public"."Breed"("slug");

-- AddForeignKey
ALTER TABLE "public"."BreedAlias" ADD CONSTRAINT "BreedAlias_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "public"."Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedRegistryLink" ADD CONSTRAINT "BreedRegistryLink_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "public"."Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalCustomBreed" ADD CONSTRAINT "AnimalCustomBreed_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalCustomBreed" ADD CONSTRAINT "AnimalCustomBreed_customBreedId_fkey" FOREIGN KEY ("customBreedId") REFERENCES "public"."CustomBreed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomBreed" ADD CONSTRAINT "CustomBreed_canonicalBreedId_fkey" FOREIGN KEY ("canonicalBreedId") REFERENCES "public"."Breed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomBreed" ADD CONSTRAINT "CustomBreed_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomBreedAlias" ADD CONSTRAINT "CustomBreedAlias_customBreedId_fkey" FOREIGN KEY ("customBreedId") REFERENCES "public"."CustomBreed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
