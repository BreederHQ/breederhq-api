-- CreateEnum
CREATE TYPE "public"."BreedingGroupStatus" AS ENUM ('ACTIVE', 'EXPOSURE_COMPLETE', 'MONITORING', 'LAMBING', 'COMPLETE', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."BreedingGroupMemberStatus" AS ENUM ('EXPOSED', 'REMOVED', 'NOT_PREGNANT', 'PREGNANT', 'LAMBING_IMMINENT', 'LAMBED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."Species" ADD VALUE 'CATTLE';
ALTER TYPE "public"."Species" ADD VALUE 'PIG';
ALTER TYPE "public"."Species" ADD VALUE 'ALPACA';
ALTER TYPE "public"."Species" ADD VALUE 'LLAMA';

-- CreateTable
CREATE TABLE "public"."BreedingGroup" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "organizationId" INTEGER,
    "programId" INTEGER,
    "name" TEXT NOT NULL,
    "species" "public"."Species" NOT NULL,
    "breedText" TEXT,
    "seasonLabel" TEXT,
    "notes" TEXT,
    "sireId" INTEGER NOT NULL,
    "exposureStartDate" TIMESTAMP(3) NOT NULL,
    "exposureEndDate" TIMESTAMP(3),
    "status" "public"."BreedingGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BreedingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BreedingGroupMember" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "damId" INTEGER NOT NULL,
    "memberStatus" "public"."BreedingGroupMemberStatus" NOT NULL DEFAULT 'EXPOSED',
    "exposedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "pregnancyConfirmedAt" TIMESTAMP(3),
    "pregnancyCheckMethod" "public"."PregnancyCheckMethod",
    "breedingPlanId" INTEGER,
    "expectedBirthStart" TIMESTAMP(3),
    "expectedBirthEnd" TIMESTAMP(3),
    "actualBirthDate" TIMESTAMP(3),
    "offspringCount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreedingGroup_tenantId_idx" ON "public"."BreedingGroup"("tenantId");

-- CreateIndex
CREATE INDEX "BreedingGroup_tenantId_species_idx" ON "public"."BreedingGroup"("tenantId", "species");

-- CreateIndex
CREATE INDEX "BreedingGroup_tenantId_status_idx" ON "public"."BreedingGroup"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BreedingGroup_organizationId_idx" ON "public"."BreedingGroup"("organizationId");

-- CreateIndex
CREATE INDEX "BreedingGroup_sireId_idx" ON "public"."BreedingGroup"("sireId");

-- CreateIndex
CREATE INDEX "BreedingGroup_programId_idx" ON "public"."BreedingGroup"("programId");

-- CreateIndex
CREATE INDEX "BreedingGroup_exposureStartDate_idx" ON "public"."BreedingGroup"("exposureStartDate");

-- CreateIndex
CREATE INDEX "BreedingGroup_deletedAt_idx" ON "public"."BreedingGroup"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingGroupMember_breedingPlanId_key" ON "public"."BreedingGroupMember"("breedingPlanId");

-- CreateIndex
CREATE INDEX "BreedingGroupMember_tenantId_idx" ON "public"."BreedingGroupMember"("tenantId");

-- CreateIndex
CREATE INDEX "BreedingGroupMember_groupId_idx" ON "public"."BreedingGroupMember"("groupId");

-- CreateIndex
CREATE INDEX "BreedingGroupMember_damId_idx" ON "public"."BreedingGroupMember"("damId");

-- CreateIndex
CREATE INDEX "BreedingGroupMember_memberStatus_idx" ON "public"."BreedingGroupMember"("memberStatus");

-- CreateIndex
CREATE INDEX "BreedingGroupMember_breedingPlanId_idx" ON "public"."BreedingGroupMember"("breedingPlanId");

-- CreateIndex
CREATE INDEX "BreedingGroupMember_expectedBirthStart_idx" ON "public"."BreedingGroupMember"("expectedBirthStart");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingGroupMember_groupId_damId_key" ON "public"."BreedingGroupMember"("groupId", "damId");

-- AddForeignKey
ALTER TABLE "public"."BreedingGroup" ADD CONSTRAINT "BreedingGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingGroup" ADD CONSTRAINT "BreedingGroup_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "public"."Organization"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingGroup" ADD CONSTRAINT "BreedingGroup_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."mkt_listing_breeding_program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingGroup" ADD CONSTRAINT "BreedingGroup_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "public"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingGroupMember" ADD CONSTRAINT "BreedingGroupMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingGroupMember" ADD CONSTRAINT "BreedingGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."BreedingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingGroupMember" ADD CONSTRAINT "BreedingGroupMember_damId_fkey" FOREIGN KEY ("damId") REFERENCES "public"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingGroupMember" ADD CONSTRAINT "BreedingGroupMember_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES "public"."BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
