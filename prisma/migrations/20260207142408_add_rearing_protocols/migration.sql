-- CreateEnum
CREATE TYPE "public"."ActivityCategory" AS ENUM ('ENS', 'ESI', 'SOCIALIZATION', 'HANDLING', 'ENRICHMENT', 'TRAINING', 'HEALTH', 'ASSESSMENT', 'TRANSITION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."ActivityFrequency" AS ENUM ('ONCE', 'DAILY', 'TWICE_DAILY', 'WEEKLY', 'AS_AVAILABLE', 'CHECKLIST');

-- CreateEnum
CREATE TYPE "public"."RearingAssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."RearingExceptionType" AS ENUM ('SKIPPED', 'DELAYED', 'MODIFIED', 'UNABLE_TO_COMPLETE');

-- CreateEnum
CREATE TYPE "public"."RearingCompletionScope" AS ENUM ('LITTER', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "public"."AssessmentType" AS ENUM ('VOLHARD_PAT', 'CUSTOM');

-- CreateTable
CREATE TABLE "public"."RearingProtocol" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "species" "public"."Species" NOT NULL,
    "isBenchmark" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentProtocolId" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "targetAgeStart" INTEGER NOT NULL,
    "targetAgeEnd" INTEGER NOT NULL,
    "estimatedDailyMinutes" INTEGER,
    "breederName" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RearingProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RearingProtocolStage" (
    "id" TEXT NOT NULL,
    "protocolId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ageStartDays" INTEGER NOT NULL,
    "ageEndDays" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RearingProtocolStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RearingProtocolActivity" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "category" "public"."ActivityCategory" NOT NULL,
    "frequency" "public"."ActivityFrequency" NOT NULL,
    "durationMinutes" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "requiresEquipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL,
    "checklistItems" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RearingProtocolActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RearingProtocolAssignment" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "offspringGroupId" INTEGER NOT NULL,
    "protocolId" INTEGER NOT NULL,
    "protocolVersion" INTEGER NOT NULL,
    "protocolSnapshot" JSONB,
    "availableUpgrade" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."RearingAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "acknowledgedDisclaimer" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "completedActivities" INTEGER NOT NULL DEFAULT 0,
    "totalActivities" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RearingProtocolAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActivityCompletion" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "activityId" TEXT NOT NULL,
    "scope" "public"."RearingCompletionScope" NOT NULL,
    "offspringId" INTEGER,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedBy" TEXT NOT NULL,
    "checklistItemKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OffspringProtocolException" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "activityId" TEXT NOT NULL,
    "checklistItemKey" TEXT,
    "exceptionType" "public"."RearingExceptionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffspringProtocolException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssignmentOffspringOverride" (
    "id" SERIAL NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "customStartDate" TIMESTAMP(3),
    "skipToStage" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentOffspringOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProtocolRating" (
    "id" SERIAL NOT NULL,
    "protocolId" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssessmentResult" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "assessmentType" "public"."AssessmentType" NOT NULL,
    "scores" JSONB NOT NULL,
    "notes" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RearingCertificate" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "offspringId" INTEGER NOT NULL,
    "offspringName" TEXT NOT NULL,
    "protocolName" TEXT NOT NULL,
    "breederName" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "RearingCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RearingProtocol_tenantId_idx" ON "public"."RearingProtocol"("tenantId");

-- CreateIndex
CREATE INDEX "RearingProtocol_species_isActive_idx" ON "public"."RearingProtocol"("species", "isActive");

-- CreateIndex
CREATE INDEX "RearingProtocol_isPublic_species_idx" ON "public"."RearingProtocol"("isPublic", "species");

-- CreateIndex
CREATE INDEX "RearingProtocol_isBenchmark_idx" ON "public"."RearingProtocol"("isBenchmark");

-- CreateIndex
CREATE INDEX "RearingProtocol_deletedAt_idx" ON "public"."RearingProtocol"("deletedAt");

-- CreateIndex
CREATE INDEX "RearingProtocolStage_protocolId_order_idx" ON "public"."RearingProtocolStage"("protocolId", "order");

-- CreateIndex
CREATE INDEX "RearingProtocolActivity_stageId_order_idx" ON "public"."RearingProtocolActivity"("stageId", "order");

-- CreateIndex
CREATE INDEX "RearingProtocolAssignment_tenantId_idx" ON "public"."RearingProtocolAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "RearingProtocolAssignment_offspringGroupId_idx" ON "public"."RearingProtocolAssignment"("offspringGroupId");

-- CreateIndex
CREATE INDEX "RearingProtocolAssignment_protocolId_idx" ON "public"."RearingProtocolAssignment"("protocolId");

-- CreateIndex
CREATE INDEX "RearingProtocolAssignment_status_idx" ON "public"."RearingProtocolAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RearingProtocolAssignment_offspringGroupId_protocolId_key" ON "public"."RearingProtocolAssignment"("offspringGroupId", "protocolId");

-- CreateIndex
CREATE INDEX "ActivityCompletion_tenantId_idx" ON "public"."ActivityCompletion"("tenantId");

-- CreateIndex
CREATE INDEX "ActivityCompletion_assignmentId_activityId_idx" ON "public"."ActivityCompletion"("assignmentId", "activityId");

-- CreateIndex
CREATE INDEX "ActivityCompletion_offspringId_idx" ON "public"."ActivityCompletion"("offspringId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCompletion_assignmentId_activityId_offspringId_chec_key" ON "public"."ActivityCompletion"("assignmentId", "activityId", "offspringId", "checklistItemKey");

-- CreateIndex
CREATE INDEX "OffspringProtocolException_tenantId_idx" ON "public"."OffspringProtocolException"("tenantId");

-- CreateIndex
CREATE INDEX "OffspringProtocolException_assignmentId_idx" ON "public"."OffspringProtocolException"("assignmentId");

-- CreateIndex
CREATE INDEX "OffspringProtocolException_offspringId_idx" ON "public"."OffspringProtocolException"("offspringId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentOffspringOverride_assignmentId_offspringId_key" ON "public"."AssignmentOffspringOverride"("assignmentId", "offspringId");

-- CreateIndex
CREATE INDEX "ProtocolRating_protocolId_idx" ON "public"."ProtocolRating"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolRating_protocolId_tenantId_key" ON "public"."ProtocolRating"("protocolId", "tenantId");

-- CreateIndex
CREATE INDEX "AssessmentResult_tenantId_idx" ON "public"."AssessmentResult"("tenantId");

-- CreateIndex
CREATE INDEX "AssessmentResult_assignmentId_idx" ON "public"."AssessmentResult"("assignmentId");

-- CreateIndex
CREATE INDEX "AssessmentResult_offspringId_idx" ON "public"."AssessmentResult"("offspringId");

-- CreateIndex
CREATE INDEX "RearingCertificate_tenantId_idx" ON "public"."RearingCertificate"("tenantId");

-- CreateIndex
CREATE INDEX "RearingCertificate_assignmentId_idx" ON "public"."RearingCertificate"("assignmentId");

-- CreateIndex
CREATE INDEX "RearingCertificate_offspringId_idx" ON "public"."RearingCertificate"("offspringId");

-- CreateIndex
CREATE INDEX "RearingCertificate_isValid_idx" ON "public"."RearingCertificate"("isValid");

-- AddForeignKey
ALTER TABLE "public"."RearingProtocol" ADD CONSTRAINT "RearingProtocol_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RearingProtocol" ADD CONSTRAINT "RearingProtocol_parentProtocolId_fkey" FOREIGN KEY ("parentProtocolId") REFERENCES "public"."RearingProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RearingProtocolStage" ADD CONSTRAINT "RearingProtocolStage_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."RearingProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RearingProtocolActivity" ADD CONSTRAINT "RearingProtocolActivity_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."RearingProtocolStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RearingProtocolAssignment" ADD CONSTRAINT "RearingProtocolAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RearingProtocolAssignment" ADD CONSTRAINT "RearingProtocolAssignment_offspringGroupId_fkey" FOREIGN KEY ("offspringGroupId") REFERENCES "public"."OffspringGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RearingProtocolAssignment" ADD CONSTRAINT "RearingProtocolAssignment_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."RearingProtocol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActivityCompletion" ADD CONSTRAINT "ActivityCompletion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActivityCompletion" ADD CONSTRAINT "ActivityCompletion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."RearingProtocolAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActivityCompletion" ADD CONSTRAINT "ActivityCompletion_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "public"."Offspring"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffspringProtocolException" ADD CONSTRAINT "OffspringProtocolException_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffspringProtocolException" ADD CONSTRAINT "OffspringProtocolException_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."RearingProtocolAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffspringProtocolException" ADD CONSTRAINT "OffspringProtocolException_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "public"."Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignmentOffspringOverride" ADD CONSTRAINT "AssignmentOffspringOverride_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."RearingProtocolAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignmentOffspringOverride" ADD CONSTRAINT "AssignmentOffspringOverride_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "public"."Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProtocolRating" ADD CONSTRAINT "ProtocolRating_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."RearingProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProtocolRating" ADD CONSTRAINT "ProtocolRating_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssessmentResult" ADD CONSTRAINT "AssessmentResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssessmentResult" ADD CONSTRAINT "AssessmentResult_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."RearingProtocolAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssessmentResult" ADD CONSTRAINT "AssessmentResult_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "public"."Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RearingCertificate" ADD CONSTRAINT "RearingCertificate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RearingCertificate" ADD CONSTRAINT "RearingCertificate_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."RearingProtocolAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RearingCertificate" ADD CONSTRAINT "RearingCertificate_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "public"."Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;
