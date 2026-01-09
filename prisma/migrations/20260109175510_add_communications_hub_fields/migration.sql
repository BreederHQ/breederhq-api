-- CreateEnum
CREATE TYPE "DraftChannel" AS ENUM ('email', 'dm');

-- AlterTable
ALTER TABLE "EmailSendLog" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "flagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "partyId" INTEGER;

-- AlterTable
ALTER TABLE "MessageThread" ADD COLUMN     "flagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flaggedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Draft" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "partyId" INTEGER,
    "channel" "DraftChannel" NOT NULL,
    "subject" TEXT,
    "toAddresses" TEXT[],
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "templateId" INTEGER,
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Draft_tenantId_idx" ON "Draft"("tenantId");

-- CreateIndex
CREATE INDEX "Draft_tenantId_partyId_idx" ON "Draft"("tenantId", "partyId");

-- CreateIndex
CREATE INDEX "Draft_tenantId_channel_idx" ON "Draft"("tenantId", "channel");

-- CreateIndex
CREATE INDEX "Draft_tenantId_updatedAt_idx" ON "Draft"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "EmailSendLog_tenantId_archived_idx" ON "EmailSendLog"("tenantId", "archived");

-- CreateIndex
CREATE INDEX "EmailSendLog_tenantId_flagged_idx" ON "EmailSendLog"("tenantId", "flagged");

-- CreateIndex
CREATE INDEX "EmailSendLog_tenantId_partyId_idx" ON "EmailSendLog"("tenantId", "partyId");

-- CreateIndex
CREATE INDEX "MessageThread_tenantId_flagged_idx" ON "MessageThread"("tenantId", "flagged");

-- CreateIndex
CREATE INDEX "MessageThread_tenantId_archived_idx" ON "MessageThread"("tenantId", "archived");

-- AddForeignKey
ALTER TABLE "EmailSendLog" ADD CONSTRAINT "EmailSendLog_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
