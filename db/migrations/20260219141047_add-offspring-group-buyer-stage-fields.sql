-- migrate:up
-- Add stage lifecycle and opt-out tracking fields to OffspringGroupBuyer
-- for the Buyer Selection Board feature.
-- NOTE: placementRank already exists on this table — no pick_order column needed.

ALTER TABLE "public"."OffspringGroupBuyer"
  ADD COLUMN "stage" varchar(50) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "optedOutAt" timestamptz,
  ADD COLUMN "optedOutReason" text,
  ADD COLUMN "optedOutBy" varchar(20),
  ADD COLUMN "depositDisposition" varchar(30),
  ADD COLUMN "notes" text;

-- Index on stage for filtering buyers by lifecycle state
CREATE INDEX "OffspringGroupBuyer_stage_idx"
  ON "public"."OffspringGroupBuyer" USING btree ("stage");

-- migrate:down
DROP INDEX IF EXISTS "public"."OffspringGroupBuyer_stage_idx";

ALTER TABLE "public"."OffspringGroupBuyer"
  DROP COLUMN IF EXISTS "stage",
  DROP COLUMN IF EXISTS "optedOutAt",
  DROP COLUMN IF EXISTS "optedOutReason",
  DROP COLUMN IF EXISTS "optedOutBy",
  DROP COLUMN IF EXISTS "depositDisposition",
  DROP COLUMN IF EXISTS "notes";
