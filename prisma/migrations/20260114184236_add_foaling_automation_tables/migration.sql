-- CreateEnum
CREATE TYPE "public"."MarePostFoalingCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'VETERINARY_CARE_REQUIRED');

-- CreateEnum
CREATE TYPE "public"."MilestoneType" AS ENUM ('VET_PREGNANCY_CHECK_15D', 'VET_ULTRASOUND_45D', 'VET_ULTRASOUND_90D', 'BEGIN_MONITORING_300D', 'PREPARE_FOALING_AREA_320D', 'DAILY_CHECKS_330D', 'DUE_DATE_340D', 'OVERDUE_VET_CALL_350D');

-- CreateEnum
CREATE TYPE "public"."FoalHealthStatus" AS ENUM ('HEALTHY', 'MINOR_ISSUES', 'VETERINARY_CARE', 'CRITICAL', 'DECEASED');

-- CreateEnum
CREATE TYPE "public"."FoalNursingStatus" AS ENUM ('UNKNOWN', 'NURSING_WELL', 'ASSISTED', 'BOTTLE_FED', 'ORPHANED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."NotificationType" ADD VALUE 'foaling_270d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'foaling_300d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'foaling_320d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'foaling_330d';

-- AlterTable
ALTER TABLE "public"."Offspring" ADD COLUMN     "birthWeight" DOUBLE PRECISION,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "healthNotes" TEXT,
ADD COLUMN     "healthStatus" "public"."FoalHealthStatus" NOT NULL DEFAULT 'HEALTHY',
ADD COLUMN     "nursingMinutes" INTEGER,
ADD COLUMN     "nursingStatus" "public"."FoalNursingStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "requiredVetCare" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "standingMinutes" INTEGER,
ADD COLUMN     "vetCareDetails" TEXT;

-- CreateTable
CREATE TABLE "public"."FoalingOutcome" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "breedingPlanId" INTEGER NOT NULL,
    "hadComplications" BOOLEAN NOT NULL DEFAULT false,
    "complicationDetails" TEXT,
    "veterinarianCalled" BOOLEAN NOT NULL DEFAULT false,
    "veterinarianName" TEXT,
    "veterinarianNotes" TEXT,
    "placentaPassed" BOOLEAN,
    "placentaPassedMinutes" INTEGER,
    "mareCondition" "public"."MarePostFoalingCondition",
    "postFoalingHeatDate" TIMESTAMP(3),
    "postFoalingHeatNotes" TEXT,
    "readyForRebreeding" BOOLEAN NOT NULL DEFAULT false,
    "rebredDate" TIMESTAMP(3),
    "foalPhotoUrls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoalingOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BreedingMilestone" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "breedingPlanId" INTEGER NOT NULL,
    "milestoneType" "public"."MilestoneType" NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notificationSentAt" TIMESTAMP(3),
    "notes" TEXT,
    "vetAppointmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FoalingOutcome_breedingPlanId_key" ON "public"."FoalingOutcome"("breedingPlanId");

-- CreateIndex
CREATE INDEX "FoalingOutcome_tenantId_idx" ON "public"."FoalingOutcome"("tenantId");

-- CreateIndex
CREATE INDEX "FoalingOutcome_breedingPlanId_idx" ON "public"."FoalingOutcome"("breedingPlanId");

-- CreateIndex
CREATE INDEX "BreedingMilestone_tenantId_idx" ON "public"."BreedingMilestone"("tenantId");

-- CreateIndex
CREATE INDEX "BreedingMilestone_breedingPlanId_scheduledDate_idx" ON "public"."BreedingMilestone"("breedingPlanId", "scheduledDate");

-- CreateIndex
CREATE INDEX "BreedingMilestone_scheduledDate_isCompleted_idx" ON "public"."BreedingMilestone"("scheduledDate", "isCompleted");

-- AddForeignKey
ALTER TABLE "public"."FoalingOutcome" ADD CONSTRAINT "FoalingOutcome_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FoalingOutcome" ADD CONSTRAINT "FoalingOutcome_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES "public"."BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingMilestone" ADD CONSTRAINT "BreedingMilestone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingMilestone" ADD CONSTRAINT "BreedingMilestone_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES "public"."BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
