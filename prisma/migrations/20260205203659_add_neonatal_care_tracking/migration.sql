-- CreateEnum
CREATE TYPE "NeonatalHealthStatus" AS ENUM ('THRIVING', 'WATCH', 'CRITICAL', 'DECEASED');

-- CreateEnum
CREATE TYPE "NeonatalFeedingMethod" AS ENUM ('NURSING', 'SUPPLEMENTAL', 'BOTTLE', 'TUBE', 'ORPHANED');

-- CreateEnum
CREATE TYPE "StoolQuality" AS ENUM ('NORMAL', 'SOFT', 'DIARRHEA', 'CONSTIPATED', 'NONE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('VIGOROUS', 'NORMAL', 'WEAK', 'LETHARGIC');

-- CreateEnum
CREATE TYPE "NeonatalInterventionType" AS ENUM ('PLASMA_TRANSFUSION', 'COLOSTRUM_SUPPLEMENT', 'SERUM_IMMUNOGLOBULIN', 'SUBQ_FLUIDS', 'IV_FLUIDS', 'DEXTROSE_GLUCOSE', 'TUBE_FEEDING', 'IRON_SUPPLEMENT', 'CALCIUM_SUPPLEMENT', 'OXYGEN_THERAPY', 'DOXAPRAM', 'NALOXONE', 'NEBULIZER', 'ANTIBIOTIC', 'PROBIOTIC', 'DEWORMER', 'VITAMIN_K', 'UMBILICAL_CARE', 'EYE_CARE', 'SKIN_TREATMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "InterventionRoute" AS ENUM ('ORAL', 'SUBCUTANEOUS', 'INTRAVENOUS', 'INTRAMUSCULAR', 'TOPICAL', 'INHALATION');

-- CreateEnum
CREATE TYPE "AdministeredBy" AS ENUM ('SELF', 'VET', 'VET_TECH');

-- CreateEnum
CREATE TYPE "InterventionResponse" AS ENUM ('IMPROVED', 'NO_CHANGE', 'WORSENED');

-- AlterTable
ALTER TABLE "Offspring" ADD COLUMN     "birthWeightOz" DOUBLE PRECISION,
ADD COLUMN     "isExtraNeeds" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "neonatalFeedingMethod" "NeonatalFeedingMethod",
ADD COLUMN     "neonatalHealthStatus" "NeonatalHealthStatus";

-- CreateTable
CREATE TABLE "NeonatalCareEntry" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,
    "recordedById" TEXT,
    "weightOz" DECIMAL(6,2),
    "weightChangePercent" DECIMAL(5,2),
    "temperatureF" DECIMAL(4,1),
    "feedingMethod" "NeonatalFeedingMethod",
    "feedingVolumeMl" DECIMAL(5,1),
    "feedingNotes" TEXT,
    "urinated" BOOLEAN,
    "stoolQuality" "StoolQuality",
    "activityLevel" "ActivityLevel",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeonatalCareEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeonatalIntervention" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "type" "NeonatalInterventionType" NOT NULL,
    "route" "InterventionRoute",
    "dose" TEXT,
    "administeredBy" "AdministeredBy",
    "vetClinic" TEXT,
    "reason" TEXT,
    "response" "InterventionResponse",
    "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "cost" DECIMAL(10,2),
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeonatalIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NeonatalCareEntry_tenantId_offspringId_recordedAt_idx" ON "NeonatalCareEntry"("tenantId", "offspringId", "recordedAt");

-- CreateIndex
CREATE INDEX "NeonatalCareEntry_offspringId_recordedAt_idx" ON "NeonatalCareEntry"("offspringId", "recordedAt");

-- CreateIndex
CREATE INDEX "NeonatalIntervention_tenantId_offspringId_occurredAt_idx" ON "NeonatalIntervention"("tenantId", "offspringId", "occurredAt");

-- CreateIndex
CREATE INDEX "NeonatalIntervention_offspringId_type_idx" ON "NeonatalIntervention"("offspringId", "type");

-- AddForeignKey
ALTER TABLE "NeonatalCareEntry" ADD CONSTRAINT "NeonatalCareEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeonatalCareEntry" ADD CONSTRAINT "NeonatalCareEntry_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeonatalCareEntry" ADD CONSTRAINT "NeonatalCareEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeonatalIntervention" ADD CONSTRAINT "NeonatalIntervention_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeonatalIntervention" ADD CONSTRAINT "NeonatalIntervention_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeonatalIntervention" ADD CONSTRAINT "NeonatalIntervention_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
