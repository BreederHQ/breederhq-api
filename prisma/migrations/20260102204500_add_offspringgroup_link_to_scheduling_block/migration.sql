-- AlterTable
ALTER TABLE "SchedulingAvailabilityBlock" ADD COLUMN "offspringGroupId" INTEGER;

-- CreateIndex
CREATE INDEX "SchedulingAvailabilityBlock_offspringGroupId_idx" ON "SchedulingAvailabilityBlock"("offspringGroupId");

-- AddForeignKey
ALTER TABLE "SchedulingAvailabilityBlock" ADD CONSTRAINT "SchedulingAvailabilityBlock_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
