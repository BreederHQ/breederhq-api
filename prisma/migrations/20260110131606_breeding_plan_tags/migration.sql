/*
  Warnings:

  - A unique constraint covering the columns `[tagId,breedingPlanId]` on the table `TagAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "TagModule" ADD VALUE 'BREEDING_PLAN';

-- AlterTable
ALTER TABLE "TagAssignment" ADD COLUMN     "breedingPlanId" INTEGER;

-- CreateIndex
CREATE INDEX "TagAssignment_breedingPlanId_idx" ON "TagAssignment"("breedingPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_breedingPlanId_key" ON "TagAssignment"("tagId", "breedingPlanId");

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
