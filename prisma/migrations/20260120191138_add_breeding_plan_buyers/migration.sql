-- CreateEnum
CREATE TYPE "public"."BreedingPlanBuyerStage" AS ENUM ('POSSIBLE_MATCH', 'INQUIRY', 'ASSIGNED', 'MATCHED_TO_OFFSPRING');

-- AlterTable
ALTER TABLE "public"."BreedingPlan" ADD COLUMN     "depositOverrideAmountCents" INTEGER,
ADD COLUMN     "depositOverrideRequired" BOOLEAN,
ADD COLUMN     "expectedLitterSize" INTEGER;

-- AlterTable
ALTER TABLE "public"."WaitlistEntry" ADD COLUMN     "programId" INTEGER;

-- CreateTable
CREATE TABLE "public"."BreedingPlanBuyer" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "waitlistEntryId" INTEGER,
    "partyId" INTEGER,
    "stage" "public"."BreedingPlanBuyerStage" NOT NULL DEFAULT 'POSSIBLE_MATCH',
    "matchScore" INTEGER,
    "matchReasons" JSONB,
    "assignedAt" TIMESTAMP(3),
    "assignedByPartyId" INTEGER,
    "priority" INTEGER,
    "offspringGroupBuyerId" INTEGER,
    "offspringId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingPlanBuyer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreedingPlanBuyer_tenantId_idx" ON "public"."BreedingPlanBuyer"("tenantId");

-- CreateIndex
CREATE INDEX "BreedingPlanBuyer_planId_idx" ON "public"."BreedingPlanBuyer"("planId");

-- CreateIndex
CREATE INDEX "BreedingPlanBuyer_planId_stage_idx" ON "public"."BreedingPlanBuyer"("planId", "stage");

-- CreateIndex
CREATE INDEX "BreedingPlanBuyer_waitlistEntryId_idx" ON "public"."BreedingPlanBuyer"("waitlistEntryId");

-- CreateIndex
CREATE INDEX "BreedingPlanBuyer_partyId_idx" ON "public"."BreedingPlanBuyer"("partyId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_programId_idx" ON "public"."WaitlistEntry"("programId");

-- AddForeignKey
ALTER TABLE "public"."BreedingPlanBuyer" ADD CONSTRAINT "BreedingPlanBuyer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingPlanBuyer" ADD CONSTRAINT "BreedingPlanBuyer_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingPlanBuyer" ADD CONSTRAINT "BreedingPlanBuyer_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "public"."WaitlistEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingPlanBuyer" ADD CONSTRAINT "BreedingPlanBuyer_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "public"."Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."BreedingProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
