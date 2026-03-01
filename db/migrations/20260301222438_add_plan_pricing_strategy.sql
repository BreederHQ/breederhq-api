-- migrate:up
-- Add pricing cascade fields to BreedingPlan for per-plan price overrides

ALTER TABLE "public"."BreedingPlan"
  ADD COLUMN "pricingStrategy" VARCHAR(20) DEFAULT NULL,
  ADD COLUMN "groupPriceCents" INTEGER DEFAULT NULL,
  ADD COLUMN "malePriceCents" INTEGER DEFAULT NULL,
  ADD COLUMN "femalePriceCents" INTEGER DEFAULT NULL;

ALTER TABLE "public"."BreedingPlan"
  ADD CONSTRAINT "BreedingPlan_pricingStrategy_check"
  CHECK ("pricingStrategy" IN ('PROGRAM_DEFAULT', 'FIXED', 'BY_SEX', 'INDIVIDUAL'));

-- migrate:down
-- Remove pricing cascade fields from BreedingPlan

ALTER TABLE "public"."BreedingPlan"
  DROP CONSTRAINT IF EXISTS "BreedingPlan_pricingStrategy_check";

ALTER TABLE "public"."BreedingPlan"
  DROP COLUMN IF EXISTS "pricingStrategy",
  DROP COLUMN IF EXISTS "groupPriceCents",
  DROP COLUMN IF EXISTS "malePriceCents",
  DROP COLUMN IF EXISTS "femalePriceCents";
