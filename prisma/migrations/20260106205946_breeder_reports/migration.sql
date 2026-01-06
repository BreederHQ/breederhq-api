-- CreateEnum
CREATE TYPE "BreederReportReason" AS ENUM ('SPAM', 'FRAUD', 'HARASSMENT', 'MISREPRESENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "BreederReportSeverity" AS ENUM ('LIGHT', 'MEDIUM', 'HEAVY');

-- CreateEnum
CREATE TYPE "BreederReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED');

-- CreateTable
CREATE TABLE "BreederReport" (
    "id" SERIAL NOT NULL,
    "breederTenantId" INTEGER NOT NULL,
    "reporterUserId" VARCHAR(36) NOT NULL,
    "reason" "BreederReportReason" NOT NULL,
    "severity" "BreederReportSeverity" NOT NULL,
    "description" TEXT,
    "status" "BreederReportStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreederReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreederReportFlag" (
    "id" SERIAL NOT NULL,
    "breederTenantId" INTEGER NOT NULL,
    "totalReports" INTEGER NOT NULL DEFAULT 0,
    "pendingReports" INTEGER NOT NULL DEFAULT 0,
    "lightReports" INTEGER NOT NULL DEFAULT 0,
    "mediumReports" INTEGER NOT NULL DEFAULT 0,
    "heavyReports" INTEGER NOT NULL DEFAULT 0,
    "flaggedAt" TIMESTAMP(3),
    "flagReason" TEXT,
    "warningIssuedAt" TIMESTAMP(3),
    "warningNote" TEXT,
    "marketplaceSuspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreederReportFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreederReport_breederTenantId_idx" ON "BreederReport"("breederTenantId");

-- CreateIndex
CREATE INDEX "BreederReport_reporterUserId_idx" ON "BreederReport"("reporterUserId");

-- CreateIndex
CREATE INDEX "BreederReport_status_idx" ON "BreederReport"("status");

-- CreateIndex
CREATE INDEX "BreederReport_createdAt_idx" ON "BreederReport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BreederReportFlag_breederTenantId_key" ON "BreederReportFlag"("breederTenantId");

-- CreateIndex
CREATE INDEX "BreederReportFlag_flaggedAt_idx" ON "BreederReportFlag"("flaggedAt");

-- CreateIndex
CREATE INDEX "BreederReportFlag_marketplaceSuspendedAt_idx" ON "BreederReportFlag"("marketplaceSuspendedAt");

-- CreateIndex
CREATE INDEX "BreederReportFlag_pendingReports_idx" ON "BreederReportFlag"("pendingReports");

-- AddForeignKey
ALTER TABLE "BreederReport" ADD CONSTRAINT "BreederReport_breederTenantId_fkey" FOREIGN KEY ("breederTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreederReport" ADD CONSTRAINT "BreederReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreederReport" ADD CONSTRAINT "BreederReport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreederReportFlag" ADD CONSTRAINT "BreederReportFlag_breederTenantId_fkey" FOREIGN KEY ("breederTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
