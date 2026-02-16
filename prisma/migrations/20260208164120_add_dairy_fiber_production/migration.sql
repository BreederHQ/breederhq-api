-- CreateEnum
CREATE TYPE "public"."LactationStatus" AS ENUM ('FRESH', 'MILKING', 'DRY', 'PREGNANT_DRY', 'TRANSITION');

-- CreateEnum
CREATE TYPE "public"."MilkingFrequency" AS ENUM ('ONCE_DAILY', 'TWICE_DAILY', 'THREE_DAILY');

-- CreateEnum
CREATE TYPE "public"."DHIATestType" AS ENUM ('STANDARD', 'OWNER_SAMPLER', 'HERD_TEST');

-- CreateEnum
CREATE TYPE "public"."ShearingType" AS ENUM ('FULL_BODY', 'PARTIAL', 'BELLY_CRUTCH');

-- CreateEnum
CREATE TYPE "public"."FleeceGrade" AS ENUM ('PRIME', 'CHOICE', 'STANDARD', 'UTILITY', 'REJECT');

-- CreateEnum
CREATE TYPE "public"."FiberLabTestType" AS ENUM ('MICRON_ANALYSIS', 'YIELD_TEST', 'STAPLE_STRENGTH', 'FULL_PROFILE');

-- CreateTable
CREATE TABLE "public"."LactationCycle" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "lactationNumber" INTEGER NOT NULL,
    "status" "public"."LactationStatus" NOT NULL DEFAULT 'FRESH',
    "freshenDate" DATE NOT NULL,
    "dryOffDate" DATE,
    "milkingFrequency" "public"."MilkingFrequency" NOT NULL DEFAULT 'TWICE_DAILY',
    "days305MilkLbs" DECIMAL(10,2),
    "days305FatLbs" DECIMAL(8,3),
    "days305ProteinLbs" DECIMAL(8,3),
    "peakMilkDate" DATE,
    "peakMilkLbs" DECIMAL(6,2),
    "daysToReachPeak" INTEGER,
    "avgButterfatPct" DECIMAL(4,2),
    "avgProteinPct" DECIMAL(4,2),
    "avgSCC" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LactationCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MilkingRecord" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "lactationCycleId" INTEGER,
    "milkedAt" TIMESTAMP(3) NOT NULL,
    "sessionNumber" INTEGER,
    "daysInMilk" INTEGER,
    "milkLbs" DECIMAL(6,2) NOT NULL,
    "butterfatPct" DECIMAL(4,2),
    "proteinPct" DECIMAL(4,2),
    "somaticCellCount" INTEGER,
    "lactose" DECIMAL(4,2),
    "conductivity" DECIMAL(6,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilkingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DHIATestRecord" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "lactationCycleId" INTEGER,
    "testDate" DATE NOT NULL,
    "testType" "public"."DHIATestType" NOT NULL DEFAULT 'STANDARD',
    "daysInMilk" INTEGER,
    "testDayMilkLbs" DECIMAL(6,2) NOT NULL,
    "butterfatPct" DECIMAL(4,2),
    "proteinPct" DECIMAL(4,2),
    "lactose" DECIMAL(4,2),
    "fatLbs" DECIMAL(6,3),
    "proteinLbs" DECIMAL(6,3),
    "somaticCellCount" INTEGER,
    "milkUreaNitrogen" DECIMAL(5,2),
    "labName" TEXT,
    "labTestNumber" TEXT,
    "certificateUrl" TEXT,
    "documentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DHIATestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LinearAppraisal" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "appraisalDate" DATE NOT NULL,
    "appraiserName" TEXT,
    "appraiserId" TEXT,
    "finalScore" INTEGER NOT NULL,
    "classification" TEXT,
    "generalAppearance" INTEGER,
    "dairyCharacter" INTEGER,
    "bodyCapacity" INTEGER,
    "mammarySystem" INTEGER,
    "allScores" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinearAppraisal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DairyProductionHistory" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "totalLactations" INTEGER NOT NULL DEFAULT 0,
    "completedLactations" INTEGER NOT NULL DEFAULT 0,
    "best305DayMilkLbs" DECIMAL(10,2),
    "best305DayFatLbs" DECIMAL(8,3),
    "best305DayProteinLbs" DECIMAL(8,3),
    "avg305DayMilkLbs" DECIMAL(10,2),
    "avgPeakMilkLbs" DECIMAL(6,2),
    "avgDaysToReachPeak" INTEGER,
    "lifetimeMilkLbs" DECIMAL(12,2),
    "lifetimeFatLbs" DECIMAL(10,3),
    "lifetimeProteinLbs" DECIMAL(10,3),
    "lifetimeAvgButterfatPct" DECIMAL(4,2),
    "lifetimeAvgProteinPct" DECIMAL(4,2),
    "lifetimeAvgSCC" INTEGER,
    "bestAppraisalScore" INTEGER,
    "bestAppraisalDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DairyProductionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShearingRecord" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "shearingDate" DATE NOT NULL,
    "shearingType" "public"."ShearingType" NOT NULL DEFAULT 'FULL_BODY',
    "daysSinceLastShearing" INTEGER,
    "grossWeightLbs" DECIMAL(6,2) NOT NULL,
    "cleanWeightLbs" DECIMAL(6,2),
    "yieldPct" DECIMAL(5,2),
    "stapleLengthIn" DECIMAL(4,2),
    "grade" "public"."FleeceGrade",
    "handleQuality" TEXT,
    "crimpPerInch" DECIMAL(4,1),
    "vegetableMatter" TEXT,
    "weathering" TEXT,
    "cotting" BOOLEAN,
    "tenderness" TEXT,
    "soldTo" TEXT,
    "salePriceCents" INTEGER,
    "fiberBuyer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShearingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FiberLabTest" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "shearingRecordId" INTEGER,
    "testDate" DATE NOT NULL,
    "testType" "public"."FiberLabTestType" NOT NULL DEFAULT 'MICRON_ANALYSIS',
    "labName" TEXT,
    "avgFiberDiameter" DECIMAL(5,2),
    "standardDeviation" DECIMAL(5,2),
    "coefficientOfVariation" DECIMAL(5,2),
    "comfortFactor" DECIMAL(5,2),
    "spinningFineness" DECIMAL(5,2),
    "curvature" DECIMAL(6,2),
    "stapleStrengthNKtex" DECIMAL(6,2),
    "positionOfBreak" TEXT,
    "cleanFleeceYieldPct" DECIMAL(5,2),
    "histogramData" JSONB,
    "certificateNumber" TEXT,
    "certificateUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiberLabTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FiberProductionHistory" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "totalShearings" INTEGER NOT NULL DEFAULT 0,
    "totalGrossWeightLbs" DECIMAL(10,2),
    "totalCleanWeightLbs" DECIMAL(10,2),
    "avgGrossWeightLbs" DECIMAL(6,2),
    "avgCleanWeightLbs" DECIMAL(6,2),
    "avgYieldPct" DECIMAL(5,2),
    "avgStapleLengthIn" DECIMAL(4,2),
    "avgMicron" DECIMAL(5,2),
    "micronTrend" TEXT,
    "bestMicron" DECIMAL(5,2),
    "bestFleeceWeightLbs" DECIMAL(6,2),
    "bestGradeAchieved" "public"."FleeceGrade",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiberProductionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LactationCycle_tenantId_idx" ON "public"."LactationCycle"("tenantId");

-- CreateIndex
CREATE INDEX "LactationCycle_tenantId_animalId_idx" ON "public"."LactationCycle"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "LactationCycle_animalId_status_idx" ON "public"."LactationCycle"("animalId", "status");

-- CreateIndex
CREATE INDEX "LactationCycle_animalId_freshenDate_idx" ON "public"."LactationCycle"("animalId", "freshenDate");

-- CreateIndex
CREATE INDEX "MilkingRecord_tenantId_idx" ON "public"."MilkingRecord"("tenantId");

-- CreateIndex
CREATE INDEX "MilkingRecord_tenantId_animalId_idx" ON "public"."MilkingRecord"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "MilkingRecord_animalId_milkedAt_idx" ON "public"."MilkingRecord"("animalId", "milkedAt");

-- CreateIndex
CREATE INDEX "MilkingRecord_lactationCycleId_idx" ON "public"."MilkingRecord"("lactationCycleId");

-- CreateIndex
CREATE INDEX "DHIATestRecord_tenantId_idx" ON "public"."DHIATestRecord"("tenantId");

-- CreateIndex
CREATE INDEX "DHIATestRecord_tenantId_animalId_idx" ON "public"."DHIATestRecord"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "DHIATestRecord_animalId_testDate_idx" ON "public"."DHIATestRecord"("animalId", "testDate");

-- CreateIndex
CREATE INDEX "DHIATestRecord_lactationCycleId_idx" ON "public"."DHIATestRecord"("lactationCycleId");

-- CreateIndex
CREATE INDEX "LinearAppraisal_tenantId_idx" ON "public"."LinearAppraisal"("tenantId");

-- CreateIndex
CREATE INDEX "LinearAppraisal_tenantId_animalId_idx" ON "public"."LinearAppraisal"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "LinearAppraisal_animalId_appraisalDate_idx" ON "public"."LinearAppraisal"("animalId", "appraisalDate");

-- CreateIndex
CREATE UNIQUE INDEX "DairyProductionHistory_animalId_key" ON "public"."DairyProductionHistory"("animalId");

-- CreateIndex
CREATE INDEX "DairyProductionHistory_tenantId_idx" ON "public"."DairyProductionHistory"("tenantId");

-- CreateIndex
CREATE INDEX "DairyProductionHistory_tenantId_animalId_idx" ON "public"."DairyProductionHistory"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "ShearingRecord_tenantId_idx" ON "public"."ShearingRecord"("tenantId");

-- CreateIndex
CREATE INDEX "ShearingRecord_tenantId_animalId_idx" ON "public"."ShearingRecord"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "ShearingRecord_animalId_shearingDate_idx" ON "public"."ShearingRecord"("animalId", "shearingDate");

-- CreateIndex
CREATE INDEX "ShearingRecord_tenantId_grade_idx" ON "public"."ShearingRecord"("tenantId", "grade");

-- CreateIndex
CREATE INDEX "FiberLabTest_tenantId_idx" ON "public"."FiberLabTest"("tenantId");

-- CreateIndex
CREATE INDEX "FiberLabTest_tenantId_animalId_idx" ON "public"."FiberLabTest"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "FiberLabTest_animalId_testDate_idx" ON "public"."FiberLabTest"("animalId", "testDate");

-- CreateIndex
CREATE INDEX "FiberLabTest_shearingRecordId_idx" ON "public"."FiberLabTest"("shearingRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "FiberProductionHistory_animalId_key" ON "public"."FiberProductionHistory"("animalId");

-- CreateIndex
CREATE INDEX "FiberProductionHistory_tenantId_idx" ON "public"."FiberProductionHistory"("tenantId");

-- CreateIndex
CREATE INDEX "FiberProductionHistory_tenantId_animalId_idx" ON "public"."FiberProductionHistory"("tenantId", "animalId");

-- AddForeignKey
ALTER TABLE "public"."LactationCycle" ADD CONSTRAINT "LactationCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LactationCycle" ADD CONSTRAINT "LactationCycle_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MilkingRecord" ADD CONSTRAINT "MilkingRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MilkingRecord" ADD CONSTRAINT "MilkingRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MilkingRecord" ADD CONSTRAINT "MilkingRecord_lactationCycleId_fkey" FOREIGN KEY ("lactationCycleId") REFERENCES "public"."LactationCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DHIATestRecord" ADD CONSTRAINT "DHIATestRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DHIATestRecord" ADD CONSTRAINT "DHIATestRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DHIATestRecord" ADD CONSTRAINT "DHIATestRecord_lactationCycleId_fkey" FOREIGN KEY ("lactationCycleId") REFERENCES "public"."LactationCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LinearAppraisal" ADD CONSTRAINT "LinearAppraisal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LinearAppraisal" ADD CONSTRAINT "LinearAppraisal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DairyProductionHistory" ADD CONSTRAINT "DairyProductionHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DairyProductionHistory" ADD CONSTRAINT "DairyProductionHistory_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShearingRecord" ADD CONSTRAINT "ShearingRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShearingRecord" ADD CONSTRAINT "ShearingRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FiberLabTest" ADD CONSTRAINT "FiberLabTest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FiberLabTest" ADD CONSTRAINT "FiberLabTest_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FiberLabTest" ADD CONSTRAINT "FiberLabTest_shearingRecordId_fkey" FOREIGN KEY ("shearingRecordId") REFERENCES "public"."ShearingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FiberProductionHistory" ADD CONSTRAINT "FiberProductionHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FiberProductionHistory" ADD CONSTRAINT "FiberProductionHistory_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
