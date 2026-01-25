/*
  Warnings:

  - Changed the type of `status` on the `AutoReplyLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `name` to the `AutoReplyRule` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."AutoReplyRuleStatus" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "public"."AutoReplyLogStatus" AS ENUM ('sent', 'skipped', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."AutoReplyTriggerType" ADD VALUE 'email_received';
ALTER TYPE "public"."AutoReplyTriggerType" ADD VALUE 'time_based';
ALTER TYPE "public"."AutoReplyTriggerType" ADD VALUE 'keyword_match';
ALTER TYPE "public"."AutoReplyTriggerType" ADD VALUE 'business_hours';

-- DropIndex
DROP INDEX "public"."AutoReplyRule_tenantId_channel_enabled_idx";

-- AlterTable
ALTER TABLE "public"."AutoReplyLog" DROP COLUMN "status",
ADD COLUMN     "status" "public"."AutoReplyLogStatus" NOT NULL;

-- AlterTable
ALTER TABLE "public"."AutoReplyRule" ADD COLUMN     "createdByPartyId" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "executionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "keywordConfigJson" JSONB,
ADD COLUMN     "lastExecutedAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "status" "public"."AutoReplyRuleStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "timeBasedConfigJson" JSONB;

-- DropEnum
DROP TYPE "public"."AutoReplyStatus";

-- CreateIndex
CREATE INDEX "AutoReplyRule_tenantId_channel_status_idx" ON "public"."AutoReplyRule"("tenantId", "channel", "status");

-- CreateIndex
CREATE INDEX "AutoReplyRule_tenantId_triggerType_idx" ON "public"."AutoReplyRule"("tenantId", "triggerType");

-- AddForeignKey
ALTER TABLE "public"."AutoReplyRule" ADD CONSTRAINT "AutoReplyRule_createdByPartyId_fkey" FOREIGN KEY ("createdByPartyId") REFERENCES "public"."Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
