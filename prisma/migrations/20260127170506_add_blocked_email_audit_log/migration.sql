-- CreateTable
CREATE TABLE "public"."BlockedEmail" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "fromEmail" VARCHAR(255) NOT NULL,
    "toEmail" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "bodySnippet" TEXT,
    "resendEmailId" VARCHAR(100),
    "reason" VARCHAR(50) NOT NULL,
    "details" JSONB,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockedEmail_tenantId_blockedAt_idx" ON "public"."BlockedEmail"("tenantId", "blockedAt");

-- CreateIndex
CREATE INDEX "BlockedEmail_fromEmail_blockedAt_idx" ON "public"."BlockedEmail"("fromEmail", "blockedAt");

-- CreateIndex
CREATE INDEX "BlockedEmail_reason_blockedAt_idx" ON "public"."BlockedEmail"("reason", "blockedAt");

-- CreateIndex
CREATE INDEX "BlockedEmail_blockedAt_idx" ON "public"."BlockedEmail"("blockedAt");

-- AddForeignKey
ALTER TABLE "public"."BlockedEmail" ADD CONSTRAINT "BlockedEmail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
