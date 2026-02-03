-- AlterTable
ALTER TABLE "FeedingPlan" ADD COLUMN     "offspringGroupId" INTEGER,
ALTER COLUMN "animalId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "FeedingRecord" ADD COLUMN     "offspringGroupId" INTEGER,
ALTER COLUMN "animalId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "FeedingPlan_tenantId_offspringGroupId_idx" ON "FeedingPlan"("tenantId", "offspringGroupId");

-- CreateIndex
CREATE INDEX "FeedingPlan_tenantId_offspringGroupId_isActive_idx" ON "FeedingPlan"("tenantId", "offspringGroupId", "isActive");

-- CreateIndex
CREATE INDEX "FeedingPlan_offspringGroupId_startDate_idx" ON "FeedingPlan"("offspringGroupId", "startDate");

-- CreateIndex
CREATE INDEX "FeedingRecord_tenantId_offspringGroupId_idx" ON "FeedingRecord"("tenantId", "offspringGroupId");

-- CreateIndex
CREATE INDEX "FeedingRecord_tenantId_offspringGroupId_fedAt_idx" ON "FeedingRecord"("tenantId", "offspringGroupId", "fedAt");

-- AddForeignKey
ALTER TABLE "FeedingPlan" ADD CONSTRAINT "FeedingPlan_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedingRecord" ADD CONSTRAINT "FeedingRecord_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
