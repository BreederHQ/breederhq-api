/*
  Warnings:

  - The values [HOMING] on the enum `BreedingPlanStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `expectedGoHome` on the `BreedingPlan` table. All the data in the column will be lost.
  - You are about to drop the column `expectedGoHomeExtendedEnd` on the `BreedingPlan` table. All the data in the column will be lost.
  - You are about to drop the column `goHomeDateActual` on the `BreedingPlan` table. All the data in the column will be lost.
  - You are about to drop the column `lastGoHomeDateActual` on the `BreedingPlan` table. All the data in the column will be lost.
  - You are about to drop the column `lockedGoHomeDate` on the `BreedingPlan` table. All the data in the column will be lost.
  - You are about to drop the column `goHomeDate` on the `ReproductiveCycle` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BreedingPlanStatus_new" AS ENUM ('PLANNING', 'COMMITTED', 'CYCLE_EXPECTED', 'HORMONE_TESTING', 'BRED', 'PREGNANT', 'WHELPED', 'WEANED', 'PLACEMENT', 'COMPLETE', 'CANCELED');
ALTER TABLE "public"."BreedingPlan" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BreedingPlan" ALTER COLUMN "status" TYPE "BreedingPlanStatus_new" USING ("status"::text::"BreedingPlanStatus_new");
ALTER TYPE "BreedingPlanStatus" RENAME TO "BreedingPlanStatus_old";
ALTER TYPE "BreedingPlanStatus_new" RENAME TO "BreedingPlanStatus";
DROP TYPE "public"."BreedingPlanStatus_old";
ALTER TABLE "BreedingPlan" ALTER COLUMN "status" SET DEFAULT 'PLANNING';
COMMIT;

-- DropIndex
DROP INDEX "public"."BreedingPlan_expectedGoHomeExtendedEnd_idx";

-- AlterTable
ALTER TABLE "BreedingPlan" DROP COLUMN "expectedGoHome",
DROP COLUMN "expectedGoHomeExtendedEnd",
DROP COLUMN "goHomeDateActual",
DROP COLUMN "lastGoHomeDateActual",
DROP COLUMN "lockedGoHomeDate",
ADD COLUMN     "expectedPlacementCompleted" TIMESTAMP(3),
ADD COLUMN     "expectedPlacementStart" TIMESTAMP(3),
ADD COLUMN     "hormoneTestingStartDateActual" TIMESTAMP(3),
ADD COLUMN     "lockedPlacementStartDate" TIMESTAMP(3),
ADD COLUMN     "placementCompletedDateActual" TIMESTAMP(3),
ADD COLUMN     "placementStartDateActual" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReproductiveCycle" DROP COLUMN "goHomeDate",
ADD COLUMN     "placementStartDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BreedingPlan_expectedPlacementCompleted_idx" ON "BreedingPlan"("expectedPlacementCompleted");

-- CreateIndex
CREATE INDEX "BreedingPlan_expectedPlacementStart_idx" ON "BreedingPlan"("expectedPlacementStart");

-- CreateIndex
CREATE INDEX "BreedingPlan_placementStartDateActual_idx" ON "BreedingPlan"("placementStartDateActual");

-- CreateIndex
CREATE INDEX "BreedingPlan_placementCompletedDateActual_idx" ON "BreedingPlan"("placementCompletedDateActual");
