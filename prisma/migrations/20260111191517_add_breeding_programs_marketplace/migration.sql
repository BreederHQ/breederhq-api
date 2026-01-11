/*
  Warnings:

  - The values [SHOWCASE] on the enum `AnimalListingIntent` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AnimalListingIntent_new" AS ENUM ('STUD', 'BROOD_PLACEMENT', 'REHOME', 'GUARDIAN', 'TRAINED', 'WORKING', 'STARTED', 'CO_OWNERSHIP');
ALTER TABLE "AnimalPublicListing" ALTER COLUMN "intent" TYPE "AnimalListingIntent_new" USING ("intent"::text::"AnimalListingIntent_new");
ALTER TYPE "AnimalListingIntent" RENAME TO "AnimalListingIntent_old";
ALTER TYPE "AnimalListingIntent_new" RENAME TO "AnimalListingIntent";
DROP TYPE "public"."AnimalListingIntent_old";
COMMIT;

-- AlterTable
ALTER TABLE "BreedingPlan" ADD COLUMN     "programId" INTEGER;

-- CreateTable
CREATE TABLE "BreedingProgram" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "species" "Species" NOT NULL,
    "breedText" TEXT,
    "listed" BOOLEAN NOT NULL DEFAULT false,
    "acceptInquiries" BOOLEAN NOT NULL DEFAULT true,
    "openWaitlist" BOOLEAN NOT NULL DEFAULT false,
    "acceptReservations" BOOLEAN NOT NULL DEFAULT false,
    "pricingTiers" JSONB,
    "whatsIncluded" TEXT,
    "typicalWaitTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "BreedingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingProgramMedia" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "assetUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingProgramMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreedingProgram_tenantId_idx" ON "BreedingProgram"("tenantId");

-- CreateIndex
CREATE INDEX "BreedingProgram_listed_idx" ON "BreedingProgram"("listed");

-- CreateIndex
CREATE INDEX "BreedingProgram_species_idx" ON "BreedingProgram"("species");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingProgram_tenantId_slug_key" ON "BreedingProgram"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "BreedingProgramMedia_programId_idx" ON "BreedingProgramMedia"("programId");

-- CreateIndex
CREATE INDEX "BreedingProgramMedia_tenantId_idx" ON "BreedingProgramMedia"("tenantId");

-- CreateIndex
CREATE INDEX "BreedingPlan_programId_idx" ON "BreedingPlan"("programId");

-- AddForeignKey
ALTER TABLE "BreedingProgram" ADD CONSTRAINT "BreedingProgram_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingProgramMedia" ADD CONSTRAINT "BreedingProgramMedia_programId_fkey" FOREIGN KEY ("programId") REFERENCES "BreedingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingProgramMedia" ADD CONSTRAINT "BreedingProgramMedia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlan" ADD CONSTRAINT "BreedingPlan_programId_fkey" FOREIGN KEY ("programId") REFERENCES "BreedingProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
