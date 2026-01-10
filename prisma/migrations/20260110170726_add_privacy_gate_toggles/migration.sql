/*
  Warnings:

  - You are about to drop the column `showGeneticData` on the `AnimalPrivacySettings` table. All the data in the column will be lost.
  - You are about to drop the column `showHealthResults` on the `AnimalPrivacySettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AnimalPrivacySettings" DROP COLUMN "showGeneticData",
DROP COLUMN "showHealthResults",
ADD COLUMN     "enableDocumentSharing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableGeneticsSharing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableHealthSharing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableMediaSharing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showBreedingHistory" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UnlinkedEmail" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "toAddresses" TEXT[],
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "bodyPreview" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "linkedPartyId" INTEGER,
    "linkedAt" TIMESTAMP(3),
    "messageId" TEXT,
    "templateKey" TEXT,
    "category" TEXT NOT NULL DEFAULT 'transactional',
    "metadata" JSONB,
    "createdBy" INTEGER,

    CONSTRAINT "UnlinkedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnlinkedEmail_tenantId_idx" ON "UnlinkedEmail"("tenantId");

-- CreateIndex
CREATE INDEX "UnlinkedEmail_tenantId_linkedPartyId_idx" ON "UnlinkedEmail"("tenantId", "linkedPartyId");

-- CreateIndex
CREATE INDEX "UnlinkedEmail_tenantId_createdAt_idx" ON "UnlinkedEmail"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "UnlinkedEmail_toAddresses_idx" ON "UnlinkedEmail"("toAddresses");

-- AddForeignKey
ALTER TABLE "UnlinkedEmail" ADD CONSTRAINT "UnlinkedEmail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnlinkedEmail" ADD CONSTRAINT "UnlinkedEmail_linkedPartyId_fkey" FOREIGN KEY ("linkedPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
