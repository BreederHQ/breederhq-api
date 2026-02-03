-- CreateEnum
CREATE TYPE "public"."MicrochipRenewalType" AS ENUM ('LIFETIME', 'ANNUAL', 'UNKNOWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."NotificationType" ADD VALUE 'microchip_renewal_30d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'microchip_renewal_14d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'microchip_renewal_7d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'microchip_renewal_3d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'microchip_expired';

-- AlterTable
ALTER TABLE "public"."UserNotificationPreferences" ADD COLUMN     "microchipRenewal" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "public"."MicrochipRegistry" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT,
    "renewalType" "public"."MicrochipRenewalType" NOT NULL DEFAULT 'UNKNOWN',
    "species" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicrochipRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalMicrochipRegistration" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER,
    "offspringId" INTEGER,
    "microchipNumber" TEXT NOT NULL,
    "registryId" INTEGER NOT NULL,
    "registrationDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "accountNumber" TEXT,
    "registeredToContactId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalMicrochipRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MicrochipRegistry_slug_key" ON "public"."MicrochipRegistry"("slug");

-- CreateIndex
CREATE INDEX "MicrochipRegistry_isActive_sortOrder_idx" ON "public"."MicrochipRegistry"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AnimalMicrochipRegistration_tenantId_expirationDate_idx" ON "public"."AnimalMicrochipRegistration"("tenantId", "expirationDate");

-- CreateIndex
CREATE INDEX "AnimalMicrochipRegistration_registeredToContactId_idx" ON "public"."AnimalMicrochipRegistration"("registeredToContactId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalMicrochipRegistration_tenantId_animalId_registryId_key" ON "public"."AnimalMicrochipRegistration"("tenantId", "animalId", "registryId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalMicrochipRegistration_tenantId_offspringId_registryId_key" ON "public"."AnimalMicrochipRegistration"("tenantId", "offspringId", "registryId");

-- AddForeignKey
ALTER TABLE "public"."AnimalMicrochipRegistration" ADD CONSTRAINT "AnimalMicrochipRegistration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalMicrochipRegistration" ADD CONSTRAINT "AnimalMicrochipRegistration_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalMicrochipRegistration" ADD CONSTRAINT "AnimalMicrochipRegistration_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "public"."Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalMicrochipRegistration" ADD CONSTRAINT "AnimalMicrochipRegistration_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "public"."MicrochipRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalMicrochipRegistration" ADD CONSTRAINT "AnimalMicrochipRegistration_registeredToContactId_fkey" FOREIGN KEY ("registeredToContactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
