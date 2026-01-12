-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailChangeStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PartyActivityKind" ADD VALUE 'PROFILE_UPDATED_BY_CLIENT';
ALTER TYPE "PartyActivityKind" ADD VALUE 'NAME_CHANGE_REQUESTED';
ALTER TYPE "PartyActivityKind" ADD VALUE 'NAME_CHANGE_APPROVED';
ALTER TYPE "PartyActivityKind" ADD VALUE 'NAME_CHANGE_REJECTED';
ALTER TYPE "PartyActivityKind" ADD VALUE 'EMAIL_CHANGE_REQUESTED';
ALTER TYPE "PartyActivityKind" ADD VALUE 'EMAIL_CHANGE_VERIFIED';
ALTER TYPE "PartyActivityKind" ADD VALUE 'EMAIL_CHANGE_EXPIRED';

-- CreateTable
CREATE TABLE "ContactChangeRequest" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailChangeRequest" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "oldEmail" TEXT,
    "newEmail" TEXT NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "status" "EmailChangeStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactChangeRequest_tenantId_status_idx" ON "ContactChangeRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ContactChangeRequest_contactId_idx" ON "ContactChangeRequest"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChangeRequest_verificationToken_key" ON "EmailChangeRequest"("verificationToken");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_tenantId_idx" ON "EmailChangeRequest"("tenantId");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_contactId_idx" ON "EmailChangeRequest"("contactId");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_verificationToken_idx" ON "EmailChangeRequest"("verificationToken");

-- AddForeignKey
ALTER TABLE "ContactChangeRequest" ADD CONSTRAINT "ContactChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactChangeRequest" ADD CONSTRAINT "ContactChangeRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailChangeRequest" ADD CONSTRAINT "EmailChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailChangeRequest" ADD CONSTRAINT "EmailChangeRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
