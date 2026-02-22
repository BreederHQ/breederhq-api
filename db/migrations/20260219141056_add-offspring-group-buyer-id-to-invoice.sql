-- migrate:up
-- Add offspringGroupBuyerId to Invoice so deposit invoices can be linked
-- directly to an OffspringGroupBuyer record (mirrors existing breedingPlanBuyerId pattern).
-- This enables credit application for buyers added directly to a group without
-- going through a Breeding Plan.

ALTER TABLE "public"."Invoice"
  ADD COLUMN "offspringGroupBuyerId" integer;

-- One-to-one: each invoice links to at most one offspring group buyer
ALTER TABLE "public"."Invoice"
  ADD CONSTRAINT "Invoice_offspringGroupBuyerId_fkey"
    FOREIGN KEY ("offspringGroupBuyerId")
    REFERENCES "public"."OffspringGroupBuyer"("id")
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE UNIQUE INDEX "Invoice_offspringGroupBuyerId_key"
  ON "public"."Invoice" ("offspringGroupBuyerId");

-- migrate:down
DROP INDEX IF EXISTS "public"."Invoice_offspringGroupBuyerId_key";

ALTER TABLE "public"."Invoice"
  DROP CONSTRAINT IF EXISTS "Invoice_offspringGroupBuyerId_fkey";

ALTER TABLE "public"."Invoice"
  DROP COLUMN IF EXISTS "offspringGroupBuyerId";
