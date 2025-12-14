-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FinanceScope" ADD VALUE 'contact';
ALTER TYPE "FinanceScope" ADD VALUE 'organization';
ALTER TYPE "FinanceScope" ADD VALUE 'general';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalProvider" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "lastSyncError" TEXT,
ADD COLUMN     "lastSyncStatus" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InvoiceLineItem" ADD COLUMN     "category" TEXT,
ADD COLUMN     "discountCents" INTEGER,
ADD COLUMN     "itemCode" TEXT,
ADD COLUMN     "taxRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalProvider" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "lastSyncError" TEXT,
ADD COLUMN     "lastSyncStatus" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AccountingIntegration" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncDirection" TEXT NOT NULL DEFAULT 'outbound',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingIntegration_tenantId_provider_idx" ON "AccountingIntegration"("tenantId", "provider");

-- AddForeignKey
ALTER TABLE "AccountingIntegration" ADD CONSTRAINT "AccountingIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
