-- AlterTable
ALTER TABLE "MessageThread" ADD COLUMN     "businessHoursResponseTime" INTEGER,
ADD COLUMN     "firstInboundAt" TIMESTAMP(3),
ADD COLUMN     "firstOrgReplyAt" TIMESTAMP(3),
ADD COLUMN     "responseTimeSeconds" INTEGER;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "avgBusinessHoursResponseTime" INTEGER,
ADD COLUMN     "businessHours" JSONB,
ADD COLUMN     "lastBadgeEvaluatedAt" TIMESTAMP(3),
ADD COLUMN     "quickResponderBadge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timeZone" TEXT,
ADD COLUMN     "totalResponseCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "MessageThread_tenantId_responseTimeSeconds_idx" ON "MessageThread"("tenantId", "responseTimeSeconds");

-- CreateIndex
CREATE INDEX "MessageThread_tenantId_businessHoursResponseTime_idx" ON "MessageThread"("tenantId", "businessHoursResponseTime");

-- CreateIndex
CREATE INDEX "Tenant_quickResponderBadge_idx" ON "Tenant"("quickResponderBadge");
