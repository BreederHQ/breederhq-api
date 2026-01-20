-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."BreedingPlanStatus" ADD VALUE 'CYCLE';
ALTER TYPE "public"."BreedingPlanStatus" ADD VALUE 'UNSUCCESSFUL';
ALTER TYPE "public"."BreedingPlanStatus" ADD VALUE 'ON_HOLD';

-- AlterTable
ALTER TABLE "public"."BreedingPlan" ADD COLUMN     "breedDateUnknown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cycleStartDateUnknown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isCommittedIntent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ovulationDateUnknown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statusBeforeHold" "public"."BreedingPlanStatus",
ADD COLUMN     "statusReason" TEXT;
