-- AlterTable
ALTER TABLE "marketplace"."MktListingService" ADD COLUMN     "featured_until" TIMESTAMP(3),
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "marketplace"."invoices" ADD COLUMN     "stripe_invoice_pdf_url" TEXT,
ADD COLUMN     "stripe_invoice_sent_at" TIMESTAMP(3),
ADD COLUMN     "stripe_invoice_url" TEXT;

-- AlterTable
ALTER TABLE "marketplace"."providers" ADD COLUMN     "listing_fee_exempt" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "listing_fee_exempt_until" TIMESTAMP(3),
ADD COLUMN     "listing_tier" TEXT,
ADD COLUMN     "max_active_listings" INTEGER;

-- CreateIndex
CREATE INDEX "MktListingService_is_featured_featured_until_idx" ON "marketplace"."MktListingService"("is_featured", "featured_until");
