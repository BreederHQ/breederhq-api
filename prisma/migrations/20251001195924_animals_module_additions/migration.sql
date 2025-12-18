/*
  Warnings:

  - A unique constraint covering the columns `[animalId,tagId]` on the table `TagAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."Species" AS ENUM ('DOG', 'CAT', 'HORSE');

-- CreateEnum
CREATE TYPE "public"."Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "public"."AnimalStatus" AS ENUM ('ACTIVE', 'UNAVAILABLE', 'RETIRED', 'DECEASED', 'PROSPECT');

-- AlterTable
ALTER TABLE "public"."TagAssignment" ADD COLUMN     "animalId" TEXT;

-- CreateTable
CREATE TABLE "public"."Breed" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Animal" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "callName" TEXT,
    "species" "public"."Species",
    "sex" "public"."Sex",
    "status" "public"."AnimalStatus",
    "birthDate" TIMESTAMP(3),
    "deathDate" TIMESTAMP(3),
    "registration" TEXT,
    "microchip" TEXT,
    "color" TEXT,
    "pattern" TEXT,
    "organizationId" INTEGER,
    "primaryOwnerId" INTEGER,
    "breedId" TEXT,
    "sireId" TEXT,
    "damId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalOwner" (
    "id" SERIAL NOT NULL,
    "animalId" TEXT NOT NULL,
    "contactId" INTEGER NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalBreed" (
    "id" SERIAL NOT NULL,
    "animalId" TEXT NOT NULL,
    "breedId" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalBreed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WeightEntry" (
    "id" SERIAL NOT NULL,
    "animalId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeightEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OffspringGroup" (
    "id" SERIAL NOT NULL,
    "sireId" TEXT,
    "damId" TEXT,
    "occurredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Breed_name_key" ON "public"."Breed"("name");

-- CreateIndex
CREATE INDEX "Animal_organizationId_idx" ON "public"."Animal"("organizationId");

-- CreateIndex
CREATE INDEX "Animal_primaryOwnerId_idx" ON "public"."Animal"("primaryOwnerId");

-- CreateIndex
CREATE INDEX "Animal_breedId_idx" ON "public"."Animal"("breedId");

-- CreateIndex
CREATE INDEX "Animal_sireId_idx" ON "public"."Animal"("sireId");

-- CreateIndex
CREATE INDEX "Animal_damId_idx" ON "public"."Animal"("damId");

-- CreateIndex
CREATE INDEX "AnimalOwner_contactId_idx" ON "public"."AnimalOwner"("contactId");

-- CreateIndex
CREATE INDEX "AnimalOwner_animalId_idx" ON "public"."AnimalOwner"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalOwner_animalId_contactId_key" ON "public"."AnimalOwner"("animalId", "contactId");

-- CreateIndex
CREATE INDEX "AnimalBreed_breedId_idx" ON "public"."AnimalBreed"("breedId");

-- CreateIndex
CREATE INDEX "AnimalBreed_animalId_idx" ON "public"."AnimalBreed"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalBreed_animalId_breedId_key" ON "public"."AnimalBreed"("animalId", "breedId");

-- CreateIndex
CREATE INDEX "WeightEntry_animalId_takenAt_idx" ON "public"."WeightEntry"("animalId", "takenAt");

-- CreateIndex
CREATE INDEX "OffspringGroup_sireId_idx" ON "public"."OffspringGroup"("sireId");

-- CreateIndex
CREATE INDEX "OffspringGroup_damId_idx" ON "public"."OffspringGroup"("damId");

-- CreateIndex
CREATE INDEX "TagAssignment_animalId_idx" ON "public"."TagAssignment"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_animalId_tagId_key" ON "public"."TagAssignment"("animalId", "tagId");

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Animal" ADD CONSTRAINT "Animal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Animal" ADD CONSTRAINT "Animal_primaryOwnerId_fkey" FOREIGN KEY ("primaryOwnerId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Animal" ADD CONSTRAINT "Animal_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "public"."Breed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Animal" ADD CONSTRAINT "Animal_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Animal" ADD CONSTRAINT "Animal_damId_fkey" FOREIGN KEY ("damId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalOwner" ADD CONSTRAINT "AnimalOwner_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalOwner" ADD CONSTRAINT "AnimalOwner_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalBreed" ADD CONSTRAINT "AnimalBreed_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalBreed" ADD CONSTRAINT "AnimalBreed_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "public"."Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeightEntry" ADD CONSTRAINT "WeightEntry_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffspringGroup" ADD CONSTRAINT "OffspringGroup_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffspringGroup" ADD CONSTRAINT "OffspringGroup_damId_fkey" FOREIGN KEY ("damId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
