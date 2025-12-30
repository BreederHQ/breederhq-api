-- CreateEnum
CREATE TYPE "BreedingPlanStatus" AS ENUM ('PLANNING', 'CYCLE_EXPECTED', 'HORMONE_TESTING', 'BRED', 'PREGNANT', 'WHELPED', 'WEANED', 'COMPLETE', 'CANCELED');

-- CreateEnum
CREATE TYPE "BreedingMethod" AS ENUM ('NATURAL', 'AI_TCI', 'AI_SI', 'AI_FROZEN');

-- CreateEnum
CREATE TYPE "PregnancyCheckMethod" AS ENUM ('PALPATION', 'ULTRASOUND', 'RELAXIN_TEST', 'XRAY', 'OTHER');

-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "litterId" INTEGER;

-- CreateTable
CREATE TABLE "BreedingPlan" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "organizationId" INTEGER,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "species" "Species" NOT NULL,
    "breedText" TEXT,
    "damId" INTEGER NOT NULL,
    "sireId" INTEGER,
    "lockedCycleKey" TEXT,
    "lockedCycleStart" TIMESTAMP(3),
    "lockedOvulationDate" TIMESTAMP(3),
    "lockedDueDate" TIMESTAMP(3),
    "lockedGoHomeDate" TIMESTAMP(3),
    "expectedDue" TIMESTAMP(3),
    "expectedGoHome" TIMESTAMP(3),
    "breedDateActual" TIMESTAMP(3),
    "birthDateActual" TIMESTAMP(3),
    "weanedDateActual" TIMESTAMP(3),
    "goHomeDateActual" TIMESTAMP(3),
    "lastGoHomeDateActual" TIMESTAMP(3),
    "status" "BreedingPlanStatus" NOT NULL DEFAULT 'PLANNING',
    "notes" TEXT,
    "depositsCommittedCents" INTEGER,
    "depositsPaidCents" INTEGER,
    "depositRiskScore" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReproductiveCycle" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "femaleId" INTEGER NOT NULL,
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "ovulation" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "goHomeDate" TIMESTAMP(3),
    "status" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReproductiveCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingPlanShare" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "fromTenantId" INTEGER NOT NULL,
    "toTenantId" INTEGER NOT NULL,
    "scope" "ShareScope" NOT NULL DEFAULT 'BREED_PLAN',
    "status" "ShareStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingPlanShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingPlanEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingPlanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER,
    "animalId" INTEGER,
    "kind" TEXT NOT NULL,
    "method" TEXT,
    "labName" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueText" TEXT,
    "units" TEXT,
    "referenceRange" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "resultAt" TIMESTAMP(3),
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingAttempt" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "method" "BreedingMethod" NOT NULL,
    "attemptAt" TIMESTAMP(3),
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "studOwnerContactId" INTEGER,
    "semenBatchId" INTEGER,
    "success" BOOLEAN,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PregnancyCheck" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "method" "PregnancyCheckMethod" NOT NULL,
    "result" BOOLEAN NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PregnancyCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Litter" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "identifier" TEXT,
    "whelpedStartAt" TIMESTAMP(3),
    "whelpedEndAt" TIMESTAMP(3),
    "countBorn" INTEGER,
    "countLive" INTEGER,
    "countStillborn" INTEGER,
    "countMale" INTEGER,
    "countFemale" INTEGER,
    "notes" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Litter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER,
    "litterId" INTEGER,
    "contactId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "priority" INTEGER,
    "depositRequiredCents" INTEGER,
    "depositPaidCents" INTEGER,
    "balanceDueCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER,
    "animalId" INTEGER,
    "litterId" INTEGER,
    "contactId" INTEGER,
    "kind" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanParty" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "contactId" INTEGER,
    "organizationId" INTEGER,
    "notes" TEXT,

    CONSTRAINT "PlanParty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreedingPlan_tenantId_idx" ON "BreedingPlan"("tenantId");

-- CreateIndex
CREATE INDEX "BreedingPlan_organizationId_idx" ON "BreedingPlan"("organizationId");

-- CreateIndex
CREATE INDEX "BreedingPlan_damId_idx" ON "BreedingPlan"("damId");

-- CreateIndex
CREATE INDEX "BreedingPlan_sireId_idx" ON "BreedingPlan"("sireId");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingPlan_tenantId_code_key" ON "BreedingPlan"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ReproductiveCycle_tenantId_idx" ON "ReproductiveCycle"("tenantId");

-- CreateIndex
CREATE INDEX "ReproductiveCycle_femaleId_idx" ON "ReproductiveCycle"("femaleId");

-- CreateIndex
CREATE INDEX "ReproductiveCycle_cycleStart_idx" ON "ReproductiveCycle"("cycleStart");

-- CreateIndex
CREATE INDEX "BreedingPlanShare_fromTenantId_idx" ON "BreedingPlanShare"("fromTenantId");

-- CreateIndex
CREATE INDEX "BreedingPlanShare_toTenantId_idx" ON "BreedingPlanShare"("toTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingPlanShare_planId_toTenantId_key" ON "BreedingPlanShare"("planId", "toTenantId");

-- CreateIndex
CREATE INDEX "BreedingPlanEvent_tenantId_idx" ON "BreedingPlanEvent"("tenantId");

-- CreateIndex
CREATE INDEX "BreedingPlanEvent_planId_type_occurredAt_idx" ON "BreedingPlanEvent"("planId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "TestResult_tenantId_idx" ON "TestResult"("tenantId");

-- CreateIndex
CREATE INDEX "TestResult_animalId_idx" ON "TestResult"("animalId");

-- CreateIndex
CREATE INDEX "TestResult_planId_idx" ON "TestResult"("planId");

-- CreateIndex
CREATE INDEX "TestResult_kind_collectedAt_idx" ON "TestResult"("kind", "collectedAt");

-- CreateIndex
CREATE INDEX "BreedingAttempt_tenantId_idx" ON "BreedingAttempt"("tenantId");

-- CreateIndex
CREATE INDEX "BreedingAttempt_planId_idx" ON "BreedingAttempt"("planId");

-- CreateIndex
CREATE INDEX "PregnancyCheck_tenantId_idx" ON "PregnancyCheck"("tenantId");

-- CreateIndex
CREATE INDEX "PregnancyCheck_planId_checkedAt_idx" ON "PregnancyCheck"("planId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Litter_planId_key" ON "Litter"("planId");

-- CreateIndex
CREATE INDEX "Litter_tenantId_idx" ON "Litter"("tenantId");

-- CreateIndex
CREATE INDEX "Reservation_tenantId_idx" ON "Reservation"("tenantId");

-- CreateIndex
CREATE INDEX "Reservation_planId_idx" ON "Reservation"("planId");

-- CreateIndex
CREATE INDEX "Reservation_litterId_idx" ON "Reservation"("litterId");

-- CreateIndex
CREATE INDEX "Reservation_contactId_idx" ON "Reservation"("contactId");

-- CreateIndex
CREATE INDEX "Attachment_tenantId_idx" ON "Attachment"("tenantId");

-- CreateIndex
CREATE INDEX "Attachment_planId_idx" ON "Attachment"("planId");

-- CreateIndex
CREATE INDEX "Attachment_animalId_idx" ON "Attachment"("animalId");

-- CreateIndex
CREATE INDEX "Attachment_litterId_idx" ON "Attachment"("litterId");

-- CreateIndex
CREATE INDEX "Attachment_contactId_idx" ON "Attachment"("contactId");

-- CreateIndex
CREATE INDEX "PlanParty_tenantId_idx" ON "PlanParty"("tenantId");

-- CreateIndex
CREATE INDEX "PlanParty_planId_idx" ON "PlanParty"("planId");

-- CreateIndex
CREATE INDEX "Animal_litterId_idx" ON "Animal"("litterId");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES "Litter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlan" ADD CONSTRAINT "BreedingPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlan" ADD CONSTRAINT "BreedingPlan_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "Organization"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlan" ADD CONSTRAINT "BreedingPlan_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlan" ADD CONSTRAINT "BreedingPlan_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproductiveCycle" ADD CONSTRAINT "ReproductiveCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproductiveCycle" ADD CONSTRAINT "ReproductiveCycle_femaleId_fkey" FOREIGN KEY ("femaleId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlanShare" ADD CONSTRAINT "BreedingPlanShare_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlanShare" ADD CONSTRAINT "BreedingPlanShare_fromTenantId_fkey" FOREIGN KEY ("fromTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlanShare" ADD CONSTRAINT "BreedingPlanShare_toTenantId_fkey" FOREIGN KEY ("toTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlanEvent" ADD CONSTRAINT "BreedingPlanEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlanEvent" ADD CONSTRAINT "BreedingPlanEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingPlanEvent" ADD CONSTRAINT "BreedingPlanEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_studOwnerContactId_fkey" FOREIGN KEY ("studOwnerContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PregnancyCheck" ADD CONSTRAINT "PregnancyCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PregnancyCheck" ADD CONSTRAINT "PregnancyCheck_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Litter" ADD CONSTRAINT "Litter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Litter" ADD CONSTRAINT "Litter_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES "Litter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES "Litter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanParty" ADD CONSTRAINT "PlanParty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanParty" ADD CONSTRAINT "PlanParty_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanParty" ADD CONSTRAINT "PlanParty_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanParty" ADD CONSTRAINT "PlanParty_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
