-- migrate:up
-- Backfill Payment records for invoices that were paid via Stripe or deposit
-- but bypassed the Payment table (direct balanceCents writes before the fix).
-- Only inserts where no successful Payment exists for the invoice.

INSERT INTO "public"."Payment" (
  "tenantId", "invoiceId", "amountCents", "receivedAt",
  "methodType", "processor", "processorRef", "status", "notes", "createdAt"
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
  AND p.id IS NULL;

-- migrate:down
DELETE FROM "public"."Payment"
WHERE notes = 'Backfill: Payment record missing for Stripe/deposit payment';
