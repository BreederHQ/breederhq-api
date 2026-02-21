-- migrate:up
-- Add deposit/reservation fee configuration to offspring groups.
-- Breeders can toggle whether a deposit is required per group and set the amount.

ALTER TABLE "public"."OffspringGroup"
  ADD COLUMN "depositRequired" boolean NOT NULL DEFAULT false,
  ADD COLUMN "depositAmountCents" integer;

-- migrate:down
ALTER TABLE "public"."OffspringGroup"
  DROP COLUMN IF EXISTS "depositRequired",
  DROP COLUMN IF EXISTS "depositAmountCents";
