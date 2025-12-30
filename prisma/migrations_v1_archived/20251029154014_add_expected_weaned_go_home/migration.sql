-- AlterTable
ALTER TABLE "BreedingPlan" ADD COLUMN     "expectedGoHomeExtendedEnd" TIMESTAMP(3),
ADD COLUMN     "expectedWeaned" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BreedingPlan_expectedWeaned_idx" ON "BreedingPlan"("expectedWeaned");

-- CreateIndex
CREATE INDEX "BreedingPlan_expectedGoHomeExtendedEnd_idx" ON "BreedingPlan"("expectedGoHomeExtendedEnd");
