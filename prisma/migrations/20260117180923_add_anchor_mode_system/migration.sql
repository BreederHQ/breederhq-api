-- CreateEnum
CREATE TYPE "public"."ReproAnchorMode" AS ENUM ('CYCLE_START', 'OVULATION', 'BREEDING_DATE');

-- CreateEnum
CREATE TYPE "public"."AnchorType" AS ENUM ('CYCLE_START', 'OVULATION', 'BREEDING_DATE', 'BIRTH', 'LOCKED_CYCLE');

-- CreateEnum
CREATE TYPE "public"."OvulationMethod" AS ENUM ('CALCULATED', 'PROGESTERONE_TEST', 'LH_TEST', 'ULTRASOUND', 'VAGINAL_CYTOLOGY', 'PALPATION', 'AT_HOME_TEST', 'VETERINARY_EXAM', 'BREEDING_INDUCED');

-- CreateEnum
CREATE TYPE "public"."ConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "public"."DataSource" AS ENUM ('OBSERVED', 'DERIVED', 'ESTIMATED');

-- AlterTable
ALTER TABLE "public"."BreedingPlan" ADD COLUMN     "actualOvulationOffset" INTEGER,
ADD COLUMN     "cycleStartConfidence" "public"."ConfidenceLevel",
ADD COLUMN     "cycleStartObserved" TIMESTAMP(3),
ADD COLUMN     "cycleStartSource" "public"."DataSource",
ADD COLUMN     "dateConfidenceLevel" "public"."ConfidenceLevel" DEFAULT 'MEDIUM',
ADD COLUMN     "dateSourceNotes" TEXT,
ADD COLUMN     "expectedOvulationOffset" INTEGER,
ADD COLUMN     "ovulationConfidence" "public"."ConfidenceLevel",
ADD COLUMN     "ovulationConfirmed" TIMESTAMP(3),
ADD COLUMN     "ovulationConfirmedMethod" "public"."OvulationMethod",
ADD COLUMN     "ovulationTestResultId" INTEGER,
ADD COLUMN     "primaryAnchor" "public"."AnchorType" NOT NULL DEFAULT 'CYCLE_START',
ADD COLUMN     "reproAnchorMode" "public"."ReproAnchorMode" NOT NULL DEFAULT 'CYCLE_START',
ADD COLUMN     "varianceFromExpected" INTEGER;

-- AlterTable
ALTER TABLE "public"."TestResult" ADD COLUMN     "indicatesOvulationDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BreedingPlan_reproAnchorMode_idx" ON "public"."BreedingPlan"("reproAnchorMode");

-- CreateIndex
CREATE INDEX "BreedingPlan_ovulationConfirmed_idx" ON "public"."BreedingPlan"("ovulationConfirmed");

-- CreateIndex
CREATE INDEX "BreedingPlan_cycleStartObserved_idx" ON "public"."BreedingPlan"("cycleStartObserved");

-- CreateIndex
CREATE INDEX "BreedingPlan_primaryAnchor_idx" ON "public"."BreedingPlan"("primaryAnchor");

-- CreateIndex
CREATE INDEX "BreedingPlan_ovulationTestResultId_idx" ON "public"."BreedingPlan"("ovulationTestResultId");

-- AddForeignKey
ALTER TABLE "public"."BreedingPlan" ADD CONSTRAINT "BreedingPlan_ovulationTestResultId_fkey" FOREIGN KEY ("ovulationTestResultId") REFERENCES "public"."TestResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- Data Backfill: Initialize anchor mode system fields for existing plans
-- ────────────────────────────────────────────────────────────────────────────

-- Backfill existing plans: copy lockedCycleStart to cycleStartObserved
-- All existing plans are CYCLE_START mode with CALCULATED ovulation
UPDATE "public"."BreedingPlan"
SET
  "cycleStartObserved" = "lockedCycleStart",
  "reproAnchorMode" = 'CYCLE_START',
  "primaryAnchor" = 'CYCLE_START',
  "cycleStartConfidence" = 'MEDIUM',
  "ovulationConfirmedMethod" = 'CALCULATED',
  "dateConfidenceLevel" = 'MEDIUM'
WHERE "lockedCycleStart" IS NOT NULL;

-- For induced ovulators (CAT, RABBIT), set to BREEDING_DATE mode if breedDateActual exists
UPDATE "public"."BreedingPlan"
SET "reproAnchorMode" = 'BREEDING_DATE'
WHERE "species" IN ('CAT', 'RABBIT') AND "breedDateActual" IS NOT NULL;
