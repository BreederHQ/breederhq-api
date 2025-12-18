/*
  Warnings:

  - The values [WHELPED] on the enum `BreedingPlanStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `expectedDue` on the `BreedingPlan` table. All the data in the column will be lost.
  - You are about to drop the column `whelpedEndAt` on the `Litter` table. All the data in the column will be lost.
  - You are about to drop the column `whelpedStartAt` on the `Litter` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BreedingPlanStatus_new" AS ENUM ('PLANNING', 'COMMITTED', 'CYCLE_EXPECTED', 'HORMONE_TESTING', 'BRED', 'PREGNANT', 'BIRTHED', 'WEANED', 'PLACEMENT', 'COMPLETE', 'CANCELED');
ALTER TABLE "public"."BreedingPlan" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BreedingPlan" ALTER COLUMN "status" TYPE "BreedingPlanStatus_new" USING ("status"::text::"BreedingPlanStatus_new");
ALTER TYPE "BreedingPlanStatus" RENAME TO "BreedingPlanStatus_old";
ALTER TYPE "BreedingPlanStatus_new" RENAME TO "BreedingPlanStatus";
DROP TYPE "public"."BreedingPlanStatus_old";
ALTER TABLE "BreedingPlan" ALTER COLUMN "status" SET DEFAULT 'PLANNING';
COMMIT;

-- AlterTable
ALTER TABLE "BreedingPlan" DROP COLUMN "expectedDue",
ADD COLUMN     "cycleStartDateActual" TIMESTAMP(3),
ADD COLUMN     "expectedBirthDate" TIMESTAMP(3),
ADD COLUMN     "expectedBreedDate" TIMESTAMP(3),
ADD COLUMN     "expectedCycleStart" TIMESTAMP(3),
ADD COLUMN     "expectedHormoneTestingStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Litter" DROP COLUMN "whelpedEndAt",
DROP COLUMN "whelpedStartAt",
ADD COLUMN     "birthedEndAt" TIMESTAMP(3),
ADD COLUMN     "birthedStartAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BreedingPlan_expectedBirthDate_idx" ON "BreedingPlan"("expectedBirthDate");

-- CreateIndex
CREATE INDEX "BreedingPlan_expectedCycleStart_idx" ON "BreedingPlan"("expectedCycleStart");

-- CreateIndex
CREATE INDEX "BreedingPlan_expectedHormoneTestingStart_idx" ON "BreedingPlan"("expectedHormoneTestingStart");

-- CreateIndex
CREATE INDEX "BreedingPlan_expectedBreedDate_idx" ON "BreedingPlan"("expectedBreedDate");

-- CreateIndex
CREATE INDEX "BreedingPlan_cycleStartDateActual_idx" ON "BreedingPlan"("cycleStartDateActual");
