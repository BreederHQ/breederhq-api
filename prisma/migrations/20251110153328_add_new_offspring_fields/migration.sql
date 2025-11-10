-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "buyerContactId" INTEGER,
ADD COLUMN     "buyerOrganizationId" INTEGER,
ADD COLUMN     "buyerPartyType" "OwnerPartyType",
ADD COLUMN     "collarAssignedAt" TIMESTAMP(3),
ADD COLUMN     "collarColorHex" TEXT,
ADD COLUMN     "collarColorId" TEXT,
ADD COLUMN     "collarColorName" TEXT,
ADD COLUMN     "collarLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "contractSignedAt" TIMESTAMP(3),
ADD COLUMN     "depositCents" INTEGER,
ADD COLUMN     "healthCertAt" TIMESTAMP(3),
ADD COLUMN     "microchipAppliedAt" TIMESTAMP(3),
ADD COLUMN     "paidInFullAt" TIMESTAMP(3),
ADD COLUMN     "pickupAt" TIMESTAMP(3),
ADD COLUMN     "placedAt" TIMESTAMP(3),
ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "saleInvoiceId" TEXT;

-- AlterTable
ALTER TABLE "Litter" ADD COLUMN     "countPlaced" INTEGER,
ADD COLUMN     "countWeaned" INTEGER,
ADD COLUMN     "statusOverride" TEXT,
ADD COLUMN     "statusOverrideReason" TEXT;

-- CreateTable
CREATE TABLE "LitterEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "litterId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "field" TEXT,
    "before" JSONB,
    "after" JSONB,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LitterEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LitterEvent_tenantId_idx" ON "LitterEvent"("tenantId");

-- CreateIndex
CREATE INDEX "LitterEvent_litterId_type_occurredAt_idx" ON "LitterEvent"("litterId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "Animal_tenantId_placedAt_idx" ON "Animal"("tenantId", "placedAt");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_buyerContactId_fkey" FOREIGN KEY ("buyerContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_buyerOrganizationId_fkey" FOREIGN KEY ("buyerOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitterEvent" ADD CONSTRAINT "LitterEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitterEvent" ADD CONSTRAINT "LitterEvent_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES "Litter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitterEvent" ADD CONSTRAINT "LitterEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
