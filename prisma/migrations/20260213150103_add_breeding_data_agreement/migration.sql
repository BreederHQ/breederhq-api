-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."NotificationType" ADD VALUE 'network_breeding_inquiry';
ALTER TYPE "public"."NotificationType" ADD VALUE 'network_inquiry_response';
ALTER TYPE "public"."NotificationType" ADD VALUE 'breeding_data_agreement_request';
ALTER TYPE "public"."NotificationType" ADD VALUE 'breeding_data_agreement_approved';
ALTER TYPE "public"."NotificationType" ADD VALUE 'breeding_data_agreement_rejected';

-- CreateTable
CREATE TABLE "public"."AnimalAccessConversation" (
    "id" SERIAL NOT NULL,
    "animalAccessId" INTEGER NOT NULL,
    "messageThreadId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalAccessConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BreedingDataAgreement" (
    "id" TEXT NOT NULL,
    "breedingPlanId" INTEGER NOT NULL,
    "animalAccessId" INTEGER NOT NULL,
    "requestingTenantId" INTEGER NOT NULL,
    "approvingTenantId" INTEGER NOT NULL,
    "animalRole" TEXT NOT NULL,
    "status" "public"."BreedingAgreementStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "requestMessage" TEXT,
    "responseMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingDataAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalAccessConversation_animalAccessId_key" ON "public"."AnimalAccessConversation"("animalAccessId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalAccessConversation_messageThreadId_key" ON "public"."AnimalAccessConversation"("messageThreadId");

-- CreateIndex
CREATE INDEX "AnimalAccessConversation_animalAccessId_idx" ON "public"."AnimalAccessConversation"("animalAccessId");

-- CreateIndex
CREATE INDEX "AnimalAccessConversation_messageThreadId_idx" ON "public"."AnimalAccessConversation"("messageThreadId");

-- CreateIndex
CREATE INDEX "BreedingDataAgreement_requestingTenantId_status_idx" ON "public"."BreedingDataAgreement"("requestingTenantId", "status");

-- CreateIndex
CREATE INDEX "BreedingDataAgreement_approvingTenantId_status_idx" ON "public"."BreedingDataAgreement"("approvingTenantId", "status");

-- CreateIndex
CREATE INDEX "BreedingDataAgreement_status_idx" ON "public"."BreedingDataAgreement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingDataAgreement_breedingPlanId_animalAccessId_key" ON "public"."BreedingDataAgreement"("breedingPlanId", "animalAccessId");

-- AddForeignKey
ALTER TABLE "public"."AnimalAccessConversation" ADD CONSTRAINT "AnimalAccessConversation_animalAccessId_fkey" FOREIGN KEY ("animalAccessId") REFERENCES "public"."AnimalAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalAccessConversation" ADD CONSTRAINT "AnimalAccessConversation_messageThreadId_fkey" FOREIGN KEY ("messageThreadId") REFERENCES "public"."MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingDataAgreement" ADD CONSTRAINT "BreedingDataAgreement_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES "public"."BreedingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingDataAgreement" ADD CONSTRAINT "BreedingDataAgreement_animalAccessId_fkey" FOREIGN KEY ("animalAccessId") REFERENCES "public"."AnimalAccess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingDataAgreement" ADD CONSTRAINT "BreedingDataAgreement_requestingTenantId_fkey" FOREIGN KEY ("requestingTenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingDataAgreement" ADD CONSTRAINT "BreedingDataAgreement_approvingTenantId_fkey" FOREIGN KEY ("approvingTenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
