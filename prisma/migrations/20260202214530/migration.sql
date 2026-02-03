-- AlterTable
ALTER TABLE "FoodChange" ADD COLUMN     "offspringGroupId" INTEGER,
ALTER COLUMN "animalId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "FoodChange_tenantId_offspringGroupId_idx" ON "FoodChange"("tenantId", "offspringGroupId");

-- CreateIndex
CREATE INDEX "FoodChange_offspringGroupId_changeDate_idx" ON "FoodChange"("offspringGroupId", "changeDate");

-- AddForeignKey
ALTER TABLE "FoodChange" ADD CONSTRAINT "FoodChange_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "OffspringGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
