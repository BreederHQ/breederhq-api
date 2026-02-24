-- migrate:up
-- Backfill Payment records for invoices that were paid via Stripe Connect
-- webhook or deposit checkout but didn't create Payment rows.
-- This fixes the balance source-of-truth so recalculateInvoiceBalance()
-- produces correct results going forward.
--
-- Only targets invoices that:
--   1. Have status 'paid' or 'partially_paid'
--   2. Have collected money (amountCents > balanceCents)
--   3. Have NO existing succeeded Payment rows

INSERT INTO "public"."Payment" (
  "tenantId",
  "invoiceId",
  "amountCents",
  "receivedAt",
  "methodType",
  "processor",
  "processorRef",
  "status",
  "notes",
  "createdAt"
)
SELECT
  i."tenantId",
  i.id,
  i."amountCents" - i."balanceCents",
  COALESCE(i."paidAt", i."updatedAt"),
  'card',
  'stripe',
  i."stripePaymentIntentId",
  'succeeded',
  'Backfill: Payment record missing for Stripe/deposit payment',
  NOW()
FROM "public"."Invoice" i
LEFT JOIN "public"."Payment" p
  ON p."invoiceId" = i.id AND p.status = 'succeeded'
WHERE i.status IN ('paid', 'partially_paid')
  AND i."amountCents" > i."balanceCents"
  AND i."deletedAt" IS NULL
  AND p.id IS NULL;

-- migrate:down
DELETE FROM "public"."Payment"
WHERE notes = 'Backfill: Payment record missing for Stripe/deposit payment';
