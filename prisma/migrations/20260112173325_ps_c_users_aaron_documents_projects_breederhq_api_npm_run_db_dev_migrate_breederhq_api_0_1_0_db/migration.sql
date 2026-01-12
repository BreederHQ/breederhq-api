/*
  Warnings:

  - A unique constraint covering the columns `[marketplaceUserId,tenantId]` on the table `Contact` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeConnectAccountId]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "marketplaceFirstContactedAt" TIMESTAMP(3),
ADD COLUMN     "marketplaceTotalSpentCents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "marketplaceTotalTransactions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "marketplaceUserId" INTEGER;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "buyerMarkedPaidAt" TIMESTAMP(3),
ADD COLUMN     "buyerPaymentMethod" TEXT,
ADD COLUMN     "buyerPaymentReference" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isMarketplaceInvoice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketplaceTransactionId" INTEGER,
ADD COLUMN     "paymentModeSnapshot" TEXT,
ADD COLUMN     "providerConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "providerConfirmedBy" INTEGER,
ADD COLUMN     "refundedCents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "stripeInvoiceId" TEXT,
ADD COLUMN     "stripePaymentIntentId" TEXT,
ALTER COLUMN "amountCents" SET DATA TYPE BIGINT,
ALTER COLUMN "balanceCents" SET DATA TYPE BIGINT,
ALTER COLUMN "depositCents" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amountCents" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "marketplacePaymentMode" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "stripeConnectAccountId" TEXT,
ADD COLUMN     "stripeConnectOnboardingComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeConnectPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Contact_deletedAt_idx" ON "Contact"("deletedAt");

-- CreateIndex
CREATE INDEX "Contact_tenantId_deletedAt_idx" ON "Contact"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_marketplaceUserId_tenantId_key" ON "Contact"("marketplaceUserId", "tenantId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_createdAt_idx" ON "Invoice"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Invoice_clientPartyId_status_idx" ON "Invoice"("clientPartyId", "status");

-- CreateIndex
CREATE INDEX "Invoice_deletedAt_idx" ON "Invoice"("deletedAt");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_isMarketplaceInvoice_status_idx" ON "Invoice"("tenantId", "isMarketplaceInvoice", "status");

-- CreateIndex
CREATE INDEX "Invoice_stripeInvoiceId_idx" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_status_idx" ON "Payment"("invoiceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeConnectAccountId_key" ON "Tenant"("stripeConnectAccountId");
