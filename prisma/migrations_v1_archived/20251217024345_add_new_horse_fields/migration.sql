-- CreateEnum
CREATE TYPE "TenantOperationType" AS ENUM ('HOBBY', 'COMMERCIAL', 'PERFORMANCE');

-- CreateEnum
CREATE TYPE "HorseIntendedUse" AS ENUM ('BREEDING', 'SHOW', 'RACING');

-- CreateEnum
CREATE TYPE "HorseValuationSource" AS ENUM ('PRIVATE_SALE', 'AUCTION', 'APPRAISAL', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "OwnershipChangeKind" AS ENUM ('SALE', 'SYNDICATION', 'TRANSFER', 'LEASE', 'DEATH', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('PLANNED', 'EXTERNAL', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentIntentPurpose" AS ENUM ('DEPOSIT', 'PURCHASE', 'STUD_FEE', 'BOARDING', 'TRAINING', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentKind" ADD VALUE 'bill_of_sale';
ALTER TYPE "DocumentKind" ADD VALUE 'syndication_agreement';
ALTER TYPE "DocumentKind" ADD VALUE 'lease_agreement';
ALTER TYPE "DocumentKind" ADD VALUE 'insurance_policy';
ALTER TYPE "DocumentKind" ADD VALUE 'vet_certificate';

-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "declaredValueCents" INTEGER,
ADD COLUMN     "declaredValueCurrency" VARCHAR(3),
ADD COLUMN     "forSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inSyndication" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intendedUse" "HorseIntendedUse",
ADD COLUMN     "isLeased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valuationDate" TIMESTAMP(3),
ADD COLUMN     "valuationSource" "HorseValuationSource";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "animalId" INTEGER,
ADD COLUMN     "ownershipChangeId" INTEGER;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "operationType" "TenantOperationType" NOT NULL DEFAULT 'HOBBY';

-- CreateTable
CREATE TABLE "AnimalOwnershipChange" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "kind" "OwnershipChangeKind" NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valueCents" INTEGER,
    "currency" VARCHAR(3),
    "fromOwners" JSONB NOT NULL,
    "toOwners" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalOwnershipChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "invoiceId" INTEGER,
    "animalId" INTEGER,
    "ownershipChangeId" INTEGER,
    "purpose" "PaymentIntentPurpose" NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PLANNED',
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "externalProvider" TEXT,
    "externalId" TEXT,
    "reference" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalOwnershipChange_tenantId_idx" ON "AnimalOwnershipChange"("tenantId");

-- CreateIndex
CREATE INDEX "AnimalOwnershipChange_animalId_idx" ON "AnimalOwnershipChange"("animalId");

-- CreateIndex
CREATE INDEX "AnimalOwnershipChange_kind_idx" ON "AnimalOwnershipChange"("kind");

-- CreateIndex
CREATE INDEX "AnimalOwnershipChange_occurredAt_idx" ON "AnimalOwnershipChange"("occurredAt");

-- CreateIndex
CREATE INDEX "PaymentIntent_tenantId_idx" ON "PaymentIntent"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentIntent_invoiceId_idx" ON "PaymentIntent"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentIntent_animalId_idx" ON "PaymentIntent"("animalId");

-- CreateIndex
CREATE INDEX "PaymentIntent_ownershipChangeId_idx" ON "PaymentIntent"("ownershipChangeId");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- CreateIndex
CREATE INDEX "PaymentIntent_purpose_idx" ON "PaymentIntent"("purpose");

-- AddForeignKey
ALTER TABLE "AnimalOwnershipChange" ADD CONSTRAINT "AnimalOwnershipChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalOwnershipChange" ADD CONSTRAINT "AnimalOwnershipChange_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_ownershipChangeId_fkey" FOREIGN KEY ("ownershipChangeId") REFERENCES "AnimalOwnershipChange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownershipChangeId_fkey" FOREIGN KEY ("ownershipChangeId") REFERENCES "AnimalOwnershipChange"("id") ON DELETE SET NULL ON UPDATE CASCADE;
