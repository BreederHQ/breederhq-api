/*
  Warnings:

  - A unique constraint covering the columns `[stripe_payment_intent_id]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email_verify_token]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[password_reset_token]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `subtotal_cents` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `service_price_cents` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "marketplace"."service_listings_category_status_idx";

-- DropIndex
DROP INDEX "marketplace"."service_listings_provider_id_idx";

-- DropIndex
DROP INDEX "marketplace"."service_listings_state_city_status_idx";

-- DropIndex
DROP INDEX "marketplace"."transactions_listing_id_idx";

-- AlterTable
ALTER TABLE "marketplace"."invoices" ADD COLUMN     "internal_notes" TEXT,
ADD COLUMN     "manual_payment_confirmed_by" INTEGER,
ADD COLUMN     "manual_payment_marked_at" TIMESTAMP(3),
ADD COLUMN     "manual_payment_method" TEXT,
ADD COLUMN     "manual_payment_reference" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paid_cents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "sent_at" TIMESTAMP(3),
ADD COLUMN     "stripe_charge_id" TEXT,
ADD COLUMN     "subtotal_cents" BIGINT NOT NULL,
ADD COLUMN     "tax_cents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "viewed_at" TIMESTAMP(3),
ADD COLUMN     "voided_at" TIMESTAMP(3),
ALTER COLUMN "payment_mode" SET DEFAULT 'stripe';

-- AlterTable
ALTER TABLE "marketplace"."providers" ADD COLUMN     "activated_at" TIMESTAMP(3),
ADD COLUMN     "active_listings" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "business_hours" JSONB,
ADD COLUMN     "completed_transactions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "country" TEXT DEFAULT 'US',
ADD COLUMN     "cover_image_url" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "lifetime_payout_cents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "premium_provider" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "public_email" TEXT,
ADD COLUMN     "public_phone" TEXT,
ADD COLUMN     "quick_responder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripe_connect_details_submitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "suspended_reason" TEXT,
ADD COLUMN     "time_zone" TEXT DEFAULT 'America/New_York',
ADD COLUMN     "total_reviews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verified_provider" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "zip" TEXT,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "marketplace"."service_listings" ADD COLUMN     "availability" TEXT,
ADD COLUMN     "booking_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cover_image_url" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "duration" TEXT,
ADD COLUMN     "images" JSONB,
ADD COLUMN     "inquiry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "keywords" TEXT,
ADD COLUMN     "meta_description" TEXT,
ADD COLUMN     "paused_at" TIMESTAMP(3),
ADD COLUMN     "price_text" TEXT,
ADD COLUMN     "subcategory" TEXT,
ADD COLUMN     "view_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "zip" TEXT;

-- AlterTable
ALTER TABLE "marketplace"."transactions" ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by" TEXT,
ADD COLUMN     "refund_amount_cents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "refund_reason" TEXT,
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "service_notes" TEXT,
ADD COLUMN     "service_price_cents" BIGINT NOT NULL,
ADD COLUMN     "started_at" TIMESTAMP(3),
ADD COLUMN     "stripe_fees_cents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "tax_cents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "tax_rate" DECIMAL(5,4),
ALTER COLUMN "invoice_type" DROP NOT NULL,
ALTER COLUMN "invoice_id" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "marketplace"."users" ADD COLUMN     "address_line1" TEXT,
ADD COLUMN     "address_line2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'US',
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "email_verify_expires" TIMESTAMP(3),
ADD COLUMN     "email_verify_token" TEXT,
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_expires" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "suspended_reason" TEXT,
ADD COLUMN     "zip" TEXT;

-- CreateTable
CREATE TABLE "marketplace"."reviews" (
    "id" SERIAL NOT NULL,
    "transaction_id" BIGINT NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "listing_id" INTEGER,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "review_text" TEXT,
    "provider_response" TEXT,
    "responded_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'published',
    "flagged_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."saved_listings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "listing_id" INTEGER NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_transaction_id_key" ON "marketplace"."reviews"("transaction_id");

-- CreateIndex
CREATE INDEX "reviews_provider_id_status_created_at_idx" ON "marketplace"."reviews"("provider_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reviews_client_id_idx" ON "marketplace"."reviews"("client_id");

-- CreateIndex
CREATE INDEX "reviews_listing_id_status_idx" ON "marketplace"."reviews"("listing_id", "status");

-- CreateIndex
CREATE INDEX "reviews_rating_status_idx" ON "marketplace"."reviews"("rating", "status");

-- CreateIndex
CREATE INDEX "saved_listings_user_id_saved_at_idx" ON "marketplace"."saved_listings"("user_id", "saved_at" DESC);

-- CreateIndex
CREATE INDEX "saved_listings_listing_id_idx" ON "marketplace"."saved_listings"("listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_listings_user_id_listing_id_key" ON "marketplace"."saved_listings"("user_id", "listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripe_payment_intent_id_key" ON "marketplace"."invoices"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "invoices_stripe_payment_intent_id_idx" ON "marketplace"."invoices"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "invoices_stripe_charge_id_idx" ON "marketplace"."invoices"("stripe_charge_id");

-- CreateIndex
CREATE INDEX "invoices_status_due_at_idx" ON "marketplace"."invoices"("status", "due_at");

-- CreateIndex
CREATE INDEX "providers_status_activated_at_idx" ON "marketplace"."providers"("status", "activated_at");

-- CreateIndex
CREATE INDEX "providers_city_state_status_idx" ON "marketplace"."providers"("city", "state", "status");

-- CreateIndex
CREATE INDEX "providers_deleted_at_idx" ON "marketplace"."providers"("deleted_at");

-- CreateIndex
CREATE INDEX "service_listings_provider_id_status_idx" ON "marketplace"."service_listings"("provider_id", "status");

-- CreateIndex
CREATE INDEX "service_listings_category_status_published_at_idx" ON "marketplace"."service_listings"("category", "status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "service_listings_state_city_category_status_idx" ON "marketplace"."service_listings"("state", "city", "category", "status");

-- CreateIndex
CREATE INDEX "service_listings_deleted_at_idx" ON "marketplace"."service_listings"("deleted_at");

-- CreateIndex
CREATE INDEX "service_listings_slug_idx" ON "marketplace"."service_listings"("slug");

-- CreateIndex
CREATE INDEX "transactions_listing_id_status_idx" ON "marketplace"."transactions"("listing_id", "status");

-- CreateIndex
CREATE INDEX "transactions_status_paid_at_idx" ON "marketplace"."transactions"("status", "paid_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_verify_token_key" ON "marketplace"."users"("email_verify_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_password_reset_token_key" ON "marketplace"."users"("password_reset_token");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "marketplace"."users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "marketplace"."users"("status");

-- AddForeignKey
ALTER TABLE "marketplace"."reviews" ADD CONSTRAINT "reviews_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace"."transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."reviews" ADD CONSTRAINT "reviews_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "marketplace"."providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."reviews" ADD CONSTRAINT "reviews_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "marketplace"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."reviews" ADD CONSTRAINT "reviews_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace"."service_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."saved_listings" ADD CONSTRAINT "saved_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "marketplace"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."saved_listings" ADD CONSTRAINT "saved_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace"."service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
