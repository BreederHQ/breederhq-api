-- AlterTable
ALTER TABLE "marketplace"."service_listings" ADD COLUMN     "custom_service_type" VARCHAR(50),
ADD COLUMN     "flagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flagged_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "marketplace"."service_tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "suggested" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."service_tag_assignments" (
    "listing_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "service_tag_assignments_pkey" PRIMARY KEY ("listing_id","tag_id")
);

-- CreateTable
CREATE TABLE "marketplace"."listing_reports" (
    "id" SERIAL NOT NULL,
    "listing_id" INTEGER NOT NULL,
    "reporter_user_id" INTEGER,
    "reason" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."stripe_identity_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "stripe_session_id" VARCHAR(255) NOT NULL,
    "client_secret" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMP(3),
    "stripe_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_identity_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."admin_action_logs" (
    "id" SERIAL NOT NULL,
    "admin_user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" INTEGER,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_tags_slug_key" ON "marketplace"."service_tags"("slug");

-- CreateIndex
CREATE INDEX "service_tags_suggested_idx" ON "marketplace"."service_tags"("suggested");

-- CreateIndex
CREATE INDEX "service_tags_usage_count_idx" ON "marketplace"."service_tags"("usage_count" DESC);

-- CreateIndex
CREATE INDEX "service_tags_name_idx" ON "marketplace"."service_tags"("name");

-- CreateIndex
CREATE INDEX "service_tag_assignments_listing_id_idx" ON "marketplace"."service_tag_assignments"("listing_id");

-- CreateIndex
CREATE INDEX "service_tag_assignments_tag_id_idx" ON "marketplace"."service_tag_assignments"("tag_id");

-- CreateIndex
CREATE INDEX "listing_reports_listing_id_idx" ON "marketplace"."listing_reports"("listing_id");

-- CreateIndex
CREATE INDEX "listing_reports_reporter_user_id_idx" ON "marketplace"."listing_reports"("reporter_user_id");

-- CreateIndex
CREATE INDEX "listing_reports_status_idx" ON "marketplace"."listing_reports"("status");

-- CreateIndex
CREATE INDEX "listing_reports_created_at_idx" ON "marketplace"."listing_reports"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_identity_sessions_stripe_session_id_key" ON "marketplace"."stripe_identity_sessions"("stripe_session_id");

-- CreateIndex
CREATE INDEX "stripe_identity_sessions_user_id_idx" ON "marketplace"."stripe_identity_sessions"("user_id");

-- CreateIndex
CREATE INDEX "stripe_identity_sessions_status_idx" ON "marketplace"."stripe_identity_sessions"("status");

-- CreateIndex
CREATE INDEX "stripe_identity_sessions_created_at_idx" ON "marketplace"."stripe_identity_sessions"("created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_action_logs_admin_user_id_idx" ON "marketplace"."admin_action_logs"("admin_user_id");

-- CreateIndex
CREATE INDEX "admin_action_logs_action_idx" ON "marketplace"."admin_action_logs"("action");

-- CreateIndex
CREATE INDEX "admin_action_logs_created_at_idx" ON "marketplace"."admin_action_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "marketplace"."service_tag_assignments" ADD CONSTRAINT "service_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "marketplace"."service_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
