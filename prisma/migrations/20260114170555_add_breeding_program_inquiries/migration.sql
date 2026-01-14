-- CreateEnum
CREATE TYPE "public"."InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'SCHEDULED_VISIT', 'CONVERTED', 'NOT_INTERESTED', 'SPAM');

-- CreateTable
CREATE TABLE "public"."BreedingProgramInquiry" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerPhone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "interestedIn" TEXT,
    "priceRange" TEXT,
    "timeline" TEXT,
    "status" "public"."InquiryStatus" NOT NULL DEFAULT 'NEW',
    "assignedToUserId" TEXT,
    "responded" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" TIMESTAMP(3),
    "notes" TEXT,
    "source" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingProgramInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreedingProgramInquiry_programId_status_idx" ON "public"."BreedingProgramInquiry"("programId", "status");

-- CreateIndex
CREATE INDEX "BreedingProgramInquiry_tenantId_status_idx" ON "public"."BreedingProgramInquiry"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BreedingProgramInquiry_buyerEmail_idx" ON "public"."BreedingProgramInquiry"("buyerEmail");

-- CreateIndex
CREATE INDEX "BreedingProgramInquiry_createdAt_idx" ON "public"."BreedingProgramInquiry"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."BreedingProgramInquiry" ADD CONSTRAINT "BreedingProgramInquiry_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."BreedingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingProgramInquiry" ADD CONSTRAINT "BreedingProgramInquiry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingProgramInquiry" ADD CONSTRAINT "BreedingProgramInquiry_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
