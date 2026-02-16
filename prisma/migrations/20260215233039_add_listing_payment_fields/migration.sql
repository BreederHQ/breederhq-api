/*
  Warnings:

  - A unique constraint covering the columns `[stripe_subscription_id]` on the table `mkt_listing_breeder_service` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "marketplace"."mkt_listing_breeder_service" ADD COLUMN     "current_period_end" TIMESTAMP(3),
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "is_founding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "listing_fee_cents" INTEGER NOT NULL DEFAULT 499,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "stripe_subscription_id" TEXT,
ADD COLUMN     "stripe_subscription_status" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "mkt_listing_breeder_service_stripe_subscription_id_key" ON "marketplace"."mkt_listing_breeder_service"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "mkt_listing_breeder_service_expires_at_status_idx" ON "marketplace"."mkt_listing_breeder_service"("expires_at", "status");
