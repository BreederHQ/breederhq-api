/*
  Warnings:

  - You are about to drop the column `organizationId` on the `CustomBreed` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id,tenantId]` on the table `CustomBreed` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,species,name]` on the table `CustomBreed` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `CustomBreed` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Animal" DROP CONSTRAINT "Animal_customBreedId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomBreed" DROP CONSTRAINT "CustomBreed_organizationId_fkey";

-- DropIndex
DROP INDEX "public"."Animal_customBreedId_idx";

-- DropIndex
DROP INDEX "public"."CustomBreed_organizationId_species_idx";

-- DropIndex
DROP INDEX "public"."CustomBreed_organizationId_species_name_key";

-- AlterTable
ALTER TABLE "CustomBreed" DROP COLUMN "organizationId",
ADD COLUMN     "createdByOrganizationId" INTEGER,
ADD COLUMN     "tenantId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Animal_tenantId_customBreedId_idx" ON "Animal"("tenantId", "customBreedId");

-- CreateIndex
CREATE INDEX "CustomBreed_tenantId_species_idx" ON "CustomBreed"("tenantId", "species");

-- CreateIndex
CREATE UNIQUE INDEX "CustomBreed_id_tenantId_key" ON "CustomBreed"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomBreed_tenantId_species_name_key" ON "CustomBreed"("tenantId", "species", "name");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_customBreedId_tenantId_fkey" FOREIGN KEY ("customBreedId", "tenantId") REFERENCES "CustomBreed"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBreed" ADD CONSTRAINT "CustomBreed_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBreed" ADD CONSTRAINT "CustomBreed_createdByOrganizationId_tenantId_fkey" FOREIGN KEY ("createdByOrganizationId", "tenantId") REFERENCES "Organization"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
