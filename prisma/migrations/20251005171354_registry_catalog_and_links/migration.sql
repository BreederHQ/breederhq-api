/*
  Warnings:

  - A unique constraint covering the columns `[breedId,registryCode]` on the table `BreedRegistryLink` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."RegistryStatus" AS ENUM ('RECOGNIZED', 'PROVISIONAL', 'NOT_RECOGNIZED', 'DELISTED', 'VARIANT');

-- AlterTable
ALTER TABLE "public"."BreedRegistryLink" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "primary" BOOLEAN,
ADD COLUMN     "proofUrl" TEXT,
ADD COLUMN     "registryCode" TEXT,
ADD COLUMN     "since" INTEGER,
ADD COLUMN     "status" "public"."RegistryStatus" DEFAULT 'RECOGNIZED',
ALTER COLUMN "registry" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."RegistryCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "url" TEXT,

    CONSTRAINT "RegistryCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistryCatalog_code_key" ON "public"."RegistryCatalog"("code");

-- CreateIndex
CREATE INDEX "BreedRegistryLink_registryCode_idx" ON "public"."BreedRegistryLink"("registryCode");

-- CreateIndex
CREATE INDEX "BreedRegistryLink_status_idx" ON "public"."BreedRegistryLink"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BreedRegistryLink_breedId_registryCode_key" ON "public"."BreedRegistryLink"("breedId", "registryCode");

-- AddForeignKey
ALTER TABLE "public"."BreedRegistryLink" ADD CONSTRAINT "BreedRegistryLink_registryCode_fkey" FOREIGN KEY ("registryCode") REFERENCES "public"."RegistryCatalog"("code") ON DELETE SET NULL ON UPDATE CASCADE;
