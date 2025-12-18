-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BreedingPlanStatus" ADD VALUE 'COMMITTED';
ALTER TYPE "BreedingPlanStatus" ADD VALUE 'HOMING';

-- AlterTable
ALTER TABLE "BreedingPlan" ADD COLUMN     "committedAt" TIMESTAMP(3),
ADD COLUMN     "committedByUserId" TEXT;

-- CreateTable
CREATE TABLE "PlanCodeCounter" (
    "tenantId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanCodeCounter_pkey" PRIMARY KEY ("tenantId","year")
);

-- CreateIndex
CREATE INDEX "PlanCodeCounter_tenantId_idx" ON "PlanCodeCounter"("tenantId");

-- CreateIndex
CREATE INDEX "BreedingPlan_status_idx" ON "BreedingPlan"("status");

-- CreateIndex
CREATE INDEX "BreedingPlan_committedAt_idx" ON "BreedingPlan"("committedAt");

-- AddForeignKey
ALTER TABLE "BreedingPlan" ADD CONSTRAINT "BreedingPlan_committedByUserId_fkey" FOREIGN KEY ("committedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCodeCounter" ADD CONSTRAINT "PlanCodeCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
