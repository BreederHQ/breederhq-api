-- migrate:up
-- Add invoicingMode and paymentInstructions fields to tenants table.
-- invoicingMode: 'manual' (default) or 'stripe'
-- paymentInstructions: free-text payment instructions shown on manual invoices

ALTER TABLE "public"."Tenant"
  ADD COLUMN "invoicingMode" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "paymentInstructions" TEXT;

-- Backfill: tenants with active Stripe Connect get 'stripe' mode
UPDATE "public"."Tenant"
SET "invoicingMode" = 'stripe'
WHERE "stripeConnectAccountId" IS NOT NULL
  AND "stripeConnectPayoutsEnabled" = true;

-- migrate:down
ALTER TABLE "public"."Tenant"
  DROP COLUMN IF EXISTS "invoicingMode",
  DROP COLUMN IF EXISTS "paymentInstructions";
