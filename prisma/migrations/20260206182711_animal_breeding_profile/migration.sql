-- CreateTable
CREATE TABLE "AnimalBreedingProfile" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "breedingStatus" TEXT NOT NULL DEFAULT 'INTACT',
    "statusNotes" TEXT,
    "statusChangedAt" TIMESTAMP(3),
    "environmentPreference" VARCHAR(50),
    "environmentNotes" TEXT,
    "temperament" VARCHAR(50),
    "temperamentNotes" TEXT,
    "specialRequirements" TEXT,
    "generalNotes" TEXT,
    "libido" VARCHAR(20),
    "libidoNotes" TEXT,
    "serviceType" VARCHAR(20),
    "collectionTrained" BOOLEAN,
    "collectionNotes" TEXT,
    "fertilityStatus" VARCHAR(20),
    "lastFertilityTestDate" DATE,
    "lastFertilityTestResult" TEXT,
    "fertilityNotes" TEXT,
    "heatCycleRegularity" VARCHAR(20),
    "avgCycleLengthDays" INTEGER,
    "lastHeatDate" DATE,
    "heatNotes" TEXT,
    "pregnancyComplications" TEXT,
    "proneToComplications" BOOLEAN NOT NULL DEFAULT false,
    "naturalBirthCount" INTEGER NOT NULL DEFAULT 0,
    "cSectionCount" INTEGER NOT NULL DEFAULT 0,
    "cSectionNotes" TEXT,
    "lastBirthType" VARCHAR(20),
    "lastBirthDate" DATE,
    "maternalRating" VARCHAR(20),
    "maternalNotes" TEXT,
    "milkProduction" VARCHAR(20),
    "mastitisHistory" BOOLEAN NOT NULL DEFAULT false,
    "milkNotes" TEXT,
    "recoveryPattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalBreedingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalIncompatibility" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "profileId" INTEGER NOT NULL,
    "incompatibleAnimalId" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'AVOID',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" VARCHAR(255),

    CONSTRAINT "AnimalIncompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "eventType" VARCHAR(50) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "outcome" VARCHAR(30),
    "breedingPlanId" INTEGER,
    "partnerAnimalId" INTEGER,
    "title" VARCHAR(200),
    "description" TEXT,
    "serviceType" VARCHAR(20),
    "tieDurationMinutes" INTEGER,
    "totalBorn" INTEGER,
    "bornAlive" INTEGER,
    "stillborn" INTEGER,
    "deliveryType" VARCHAR(20),
    "testType" VARCHAR(100),
    "testResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(255),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalBreedingProfile_animalId_key" ON "AnimalBreedingProfile"("animalId");

-- CreateIndex
CREATE INDEX "AnimalBreedingProfile_tenantId_animalId_idx" ON "AnimalBreedingProfile"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "AnimalBreedingProfile_tenantId_breedingStatus_idx" ON "AnimalBreedingProfile"("tenantId", "breedingStatus");

-- CreateIndex
CREATE INDEX "AnimalIncompatibility_tenantId_idx" ON "AnimalIncompatibility"("tenantId");

-- CreateIndex
CREATE INDEX "AnimalIncompatibility_profileId_idx" ON "AnimalIncompatibility"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalIncompatibility_profileId_incompatibleAnimalId_key" ON "AnimalIncompatibility"("profileId", "incompatibleAnimalId");

-- CreateIndex
CREATE INDEX "BreedingEvent_tenantId_animalId_occurredAt_idx" ON "BreedingEvent"("tenantId", "animalId", "occurredAt");

-- CreateIndex
CREATE INDEX "BreedingEvent_tenantId_eventType_idx" ON "BreedingEvent"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "BreedingEvent_breedingPlanId_idx" ON "BreedingEvent"("breedingPlanId");

-- AddForeignKey
ALTER TABLE "AnimalBreedingProfile" ADD CONSTRAINT "AnimalBreedingProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalBreedingProfile" ADD CONSTRAINT "AnimalBreedingProfile_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalIncompatibility" ADD CONSTRAINT "AnimalIncompatibility_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalIncompatibility" ADD CONSTRAINT "AnimalIncompatibility_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AnimalBreedingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalIncompatibility" ADD CONSTRAINT "AnimalIncompatibility_incompatibleAnimalId_fkey" FOREIGN KEY ("incompatibleAnimalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingEvent" ADD CONSTRAINT "BreedingEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingEvent" ADD CONSTRAINT "BreedingEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingEvent" ADD CONSTRAINT "BreedingEvent_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES "BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingEvent" ADD CONSTRAINT "BreedingEvent_partnerAnimalId_fkey" FOREIGN KEY ("partnerAnimalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
