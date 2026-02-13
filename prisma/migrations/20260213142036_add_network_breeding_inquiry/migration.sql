-- CreateEnum
CREATE TYPE "public"."NetworkInquiryStatus" AS ENUM ('PENDING', 'RESPONDED', 'DECLINED');

-- AlterTable
ALTER TABLE "public"."MessageThread" ADD COLUMN     "contextType" TEXT;

-- CreateTable
CREATE TABLE "public"."NetworkBreedingInquiry" (
    "id" SERIAL NOT NULL,
    "senderTenantId" INTEGER NOT NULL,
    "recipientTenantId" INTEGER NOT NULL,
    "searchCriteria" JSONB NOT NULL,
    "matchingAnimalIds" INTEGER[],
    "matchedTraits" TEXT[],
    "message" TEXT,
    "status" "public"."NetworkInquiryStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "messageThreadId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkBreedingInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetworkBreedingInquiry_messageThreadId_key" ON "public"."NetworkBreedingInquiry"("messageThreadId");

-- CreateIndex
CREATE INDEX "NetworkBreedingInquiry_senderTenantId_status_idx" ON "public"."NetworkBreedingInquiry"("senderTenantId", "status");

-- CreateIndex
CREATE INDEX "NetworkBreedingInquiry_recipientTenantId_status_idx" ON "public"."NetworkBreedingInquiry"("recipientTenantId", "status");

-- CreateIndex
CREATE INDEX "NetworkBreedingInquiry_createdAt_idx" ON "public"."NetworkBreedingInquiry"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."NetworkBreedingInquiry" ADD CONSTRAINT "NetworkBreedingInquiry_senderTenantId_fkey" FOREIGN KEY ("senderTenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NetworkBreedingInquiry" ADD CONSTRAINT "NetworkBreedingInquiry_recipientTenantId_fkey" FOREIGN KEY ("recipientTenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NetworkBreedingInquiry" ADD CONSTRAINT "NetworkBreedingInquiry_messageThreadId_fkey" FOREIGN KEY ("messageThreadId") REFERENCES "public"."MessageThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
