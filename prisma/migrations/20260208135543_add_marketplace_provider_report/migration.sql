-- AlterTable
ALTER TABLE "marketplace"."providers" ADD COLUMN     "flag_reason" TEXT,
ADD COLUMN     "flagged_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "marketplace"."provider_reports" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "reporter_user_id" VARCHAR(36) NOT NULL,
    "reporter_email" TEXT,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "details" TEXT,
    "related_listing_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "related_transaction_id" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "admin_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_reports_provider_id_status_idx" ON "marketplace"."provider_reports"("provider_id", "status");

-- CreateIndex
CREATE INDEX "provider_reports_reporter_user_id_idx" ON "marketplace"."provider_reports"("reporter_user_id");

-- CreateIndex
CREATE INDEX "provider_reports_status_created_at_idx" ON "marketplace"."provider_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "providers_flagged_at_idx" ON "marketplace"."providers"("flagged_at");

-- AddForeignKey
ALTER TABLE "marketplace"."provider_reports" ADD CONSTRAINT "provider_reports_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "marketplace"."providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."provider_reports" ADD CONSTRAINT "provider_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
