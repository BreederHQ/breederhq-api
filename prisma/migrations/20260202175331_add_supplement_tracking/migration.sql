-- CreateEnum
CREATE TYPE "public"."SupplementTriggerType" AS ENUM ('BREEDING_CYCLE_RELATIVE', 'AGE_BASED', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."BreedingCycleAnchorEvent" AS ENUM ('CYCLE_START', 'BREED_DATE', 'BIRTH_DATE', 'WEANED_DATE');

-- CreateEnum
CREATE TYPE "public"."SupplementFrequency" AS ENUM ('ONCE', 'DAILY', 'EVERY_OTHER_DAY', 'EVERY_3_DAYS', 'WEEKLY', 'ONGOING');

-- CreateEnum
CREATE TYPE "public"."SupplementScheduleMode" AS ENUM ('BREEDING_LINKED', 'STANDALONE');

-- CreateEnum
CREATE TYPE "public"."SupplementScheduleStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."NotificationType" ADD VALUE 'supplement_starting_7d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'supplement_starting_3d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'supplement_starting_1d';
ALTER TYPE "public"."NotificationType" ADD VALUE 'supplement_due_today';
ALTER TYPE "public"."NotificationType" ADD VALUE 'supplement_overdue';
ALTER TYPE "public"."NotificationType" ADD VALUE 'supplement_schedule_complete';

-- CreateTable
CREATE TABLE "public"."SupplementProtocol" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "species" "public"."Species"[],
    "isBenchmark" BOOLEAN NOT NULL DEFAULT false,
    "benchmarkSource" TEXT,
    "benchmarkNotes" TEXT,
    "dosageAmount" TEXT,
    "dosageUnit" TEXT,
    "administrationRoute" TEXT,
    "triggerType" "public"."SupplementTriggerType" NOT NULL,
    "anchorEvent" "public"."BreedingCycleAnchorEvent",
    "offsetDays" INTEGER,
    "ageTriggerWeeks" INTEGER,
    "durationDays" INTEGER,
    "frequency" "public"."SupplementFrequency" NOT NULL DEFAULT 'DAILY',
    "reminderDaysBefore" INTEGER[] DEFAULT ARRAY[7, 3, 1]::INTEGER[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplementSchedule" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "protocolId" INTEGER NOT NULL,
    "breedingPlanId" INTEGER,
    "animalId" INTEGER NOT NULL,
    "mode" "public"."SupplementScheduleMode" NOT NULL,
    "calculatedStartDate" TIMESTAMP(3) NOT NULL,
    "calculatedEndDate" TIMESTAMP(3),
    "startDateOverride" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3),
    "status" "public"."SupplementScheduleStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completedDoses" INTEGER NOT NULL DEFAULT 0,
    "totalDoses" INTEGER,
    "lastAdministeredAt" TIMESTAMP(3),
    "disclaimerAcknowledgedAt" TIMESTAMP(3),
    "disclaimerAcknowledgedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplementAdministration" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "administeredAt" TIMESTAMP(3) NOT NULL,
    "actualDosage" TEXT,
    "givenBy" TEXT,
    "doseNumber" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementAdministration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplementProtocol_tenantId_idx" ON "public"."SupplementProtocol"("tenantId");

-- CreateIndex
CREATE INDEX "SupplementProtocol_tenantId_active_idx" ON "public"."SupplementProtocol"("tenantId", "active");

-- CreateIndex
CREATE INDEX "SupplementProtocol_isBenchmark_idx" ON "public"."SupplementProtocol"("isBenchmark");

-- CreateIndex
CREATE INDEX "SupplementSchedule_tenantId_idx" ON "public"."SupplementSchedule"("tenantId");

-- CreateIndex
CREATE INDEX "SupplementSchedule_breedingPlanId_idx" ON "public"."SupplementSchedule"("breedingPlanId");

-- CreateIndex
CREATE INDEX "SupplementSchedule_animalId_idx" ON "public"."SupplementSchedule"("animalId");

-- CreateIndex
CREATE INDEX "SupplementSchedule_status_calculatedStartDate_idx" ON "public"."SupplementSchedule"("status", "calculatedStartDate");

-- CreateIndex
CREATE INDEX "SupplementSchedule_status_nextDueDate_idx" ON "public"."SupplementSchedule"("status", "nextDueDate");

-- CreateIndex
CREATE INDEX "SupplementAdministration_tenantId_idx" ON "public"."SupplementAdministration"("tenantId");

-- CreateIndex
CREATE INDEX "SupplementAdministration_scheduleId_idx" ON "public"."SupplementAdministration"("scheduleId");

-- CreateIndex
CREATE INDEX "SupplementAdministration_animalId_idx" ON "public"."SupplementAdministration"("animalId");

-- CreateIndex
CREATE INDEX "SupplementAdministration_administeredAt_idx" ON "public"."SupplementAdministration"("administeredAt");

-- AddForeignKey
ALTER TABLE "public"."SupplementProtocol" ADD CONSTRAINT "SupplementProtocol_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplementSchedule" ADD CONSTRAINT "SupplementSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplementSchedule" ADD CONSTRAINT "SupplementSchedule_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."SupplementProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplementSchedule" ADD CONSTRAINT "SupplementSchedule_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES "public"."BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplementSchedule" ADD CONSTRAINT "SupplementSchedule_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplementAdministration" ADD CONSTRAINT "SupplementAdministration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplementAdministration" ADD CONSTRAINT "SupplementAdministration_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "public"."SupplementSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplementAdministration" ADD CONSTRAINT "SupplementAdministration_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
