-- AlterTable
ALTER TABLE "marketplace"."users" ADD COLUMN     "passkey_challenge" TEXT,
ADD COLUMN     "passkey_challenge_expires" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."ContractParty" ADD COLUMN     "signatureData" JSONB;

-- AlterTable
ALTER TABLE "public"."Tenant" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" CHAR(2),
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "marketplace"."abuse_reports" (
    "id" SERIAL NOT NULL,
    "listing_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "reporter_email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "admin_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "abuse_reports_listing_id_idx" ON "marketplace"."abuse_reports"("listing_id");

-- CreateIndex
CREATE INDEX "abuse_reports_status_idx" ON "marketplace"."abuse_reports"("status");

-- CreateIndex
CREATE INDEX "abuse_reports_created_at_idx" ON "marketplace"."abuse_reports"("created_at");

-- AddForeignKey
ALTER TABLE "marketplace"."abuse_reports" ADD CONSTRAINT "abuse_reports_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace"."service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."service_tag_assignments" ADD CONSTRAINT "service_tag_assignments_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace"."service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
