-- Protocol Handoff Support Migration
-- Adds handoff fields to RearingProtocolAssignment for Client Portal protocol continuation
-- Adds certificate type support for breeder/buyer phase certificates

-- CreateEnum
CREATE TYPE "public"."RearingCertificateType" AS ENUM ('BREEDER_PHASE', 'BUYER_PHASE', 'FULL_PROTOCOL');

-- AlterTable: Add certificate type fields
ALTER TABLE "public"."RearingCertificate" ADD COLUMN     "buyerName" TEXT,
ADD COLUMN     "buyerUserId" TEXT,
ADD COLUMN     "certificateType" "public"."RearingCertificateType" NOT NULL DEFAULT 'FULL_PROTOCOL',
ADD COLUMN     "stageCompleted" INTEGER,
ADD COLUMN     "stageData" JSONB;

-- AlterTable: Add handoff fields and optional assignment targets
ALTER TABLE "public"."RearingProtocolAssignment" ADD COLUMN     "animalId" INTEGER,
ADD COLUMN     "handoffAt" TIMESTAMP(3),
ADD COLUMN     "handoffByUserId" TEXT,
ADD COLUMN     "handoffFromStage" INTEGER,
ADD COLUMN     "handoffNotes" TEXT,
ADD COLUMN     "handoffSnapshot" JSONB,
ADD COLUMN     "handoffToUserId" TEXT,
ADD COLUMN     "offspringId" INTEGER,
ALTER COLUMN "offspringGroupId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "RearingCertificate_certificateType_idx" ON "public"."RearingCertificate"("certificateType");

-- CreateIndex
CREATE INDEX "RearingProtocolAssignment_offspringId_idx" ON "public"."RearingProtocolAssignment"("offspringId");

-- CreateIndex
CREATE INDEX "RearingProtocolAssignment_animalId_idx" ON "public"."RearingProtocolAssignment"("animalId");

-- CreateIndex
CREATE INDEX "RearingProtocolAssignment_handoffToUserId_idx" ON "public"."RearingProtocolAssignment"("handoffToUserId");

-- CreateIndex: Unique constraints for assignment targets
CREATE UNIQUE INDEX "RearingProtocolAssignment_offspringId_protocolId_key" ON "public"."RearingProtocolAssignment"("offspringId", "protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "RearingProtocolAssignment_animalId_protocolId_key" ON "public"."RearingProtocolAssignment"("animalId", "protocolId");

-- AddForeignKey: Offspring assignment target
ALTER TABLE "public"."RearingProtocolAssignment" ADD CONSTRAINT "RearingProtocolAssignment_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES "public"."Offspring"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Animal assignment target
ALTER TABLE "public"."RearingProtocolAssignment" ADD CONSTRAINT "RearingProtocolAssignment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Handoff recipient (buyer user)
ALTER TABLE "public"."RearingProtocolAssignment" ADD CONSTRAINT "RearingProtocolAssignment_handoffToUserId_fkey" FOREIGN KEY ("handoffToUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Handoff initiator (breeder user)
ALTER TABLE "public"."RearingProtocolAssignment" ADD CONSTRAINT "RearingProtocolAssignment_handoffByUserId_fkey" FOREIGN KEY ("handoffByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
