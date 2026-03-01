-- migrate:up
-- Add draft board fields to BreedingPlan and BreedingPlanBuyer tables
-- Supports MANUAL, ASSISTED, and AUTO draft modes for offspring placement

-- BreedingPlan: draft board configuration and state
ALTER TABLE "public"."BreedingPlan"
  ADD COLUMN "draftMode" VARCHAR(10) DEFAULT NULL,
  ADD COLUMN "draftStatus" VARCHAR(15) DEFAULT NULL,
  ADD COLUMN "draftStartedAt" TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN "draftTimePerPickMinutes" INTEGER DEFAULT NULL,
  ADD COLUMN "draftWindowExpiryBehavior" VARCHAR(25) DEFAULT NULL,
  ADD COLUMN "draftCurrentPickNumber" INTEGER DEFAULT NULL;

ALTER TABLE "public"."BreedingPlan"
  ADD CONSTRAINT "BreedingPlan_draftMode_check"
    CHECK ("draftMode" IN ('MANUAL', 'ASSISTED', 'AUTO')),
  ADD CONSTRAINT "BreedingPlan_draftStatus_check"
    CHECK ("draftStatus" IN ('NOT_STARTED', 'ACTIVE', 'PAUSED', 'COMPLETE')),
  ADD CONSTRAINT "BreedingPlan_draftWindowExpiryBehavior_check"
    CHECK ("draftWindowExpiryBehavior" IN ('DEFER_TO_END', 'AUTO_PICK_PREFERENCE', 'PAUSE_FOR_BREEDER'));

-- BreedingPlanBuyer: per-buyer draft pick tracking
ALTER TABLE "public"."BreedingPlanBuyer"
  ADD COLUMN "draftPickNumber" INTEGER DEFAULT NULL,
  ADD COLUMN "draftPickedAt" TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN "draftPickStatus" VARCHAR(15) DEFAULT NULL,
  ADD COLUMN "draftSelectedOffspringId" INTEGER DEFAULT NULL;

ALTER TABLE "public"."BreedingPlanBuyer"
  ADD CONSTRAINT "BreedingPlanBuyer_draftPickStatus_check"
    CHECK ("draftPickStatus" IN ('WAITING', 'ON_THE_CLOCK', 'PICK_PENDING', 'PICKED', 'TIMED_OUT', 'SKIPPED')),
  ADD CONSTRAINT "BreedingPlanBuyer_draftSelectedOffspringId_fkey"
    FOREIGN KEY ("draftSelectedOffspringId") REFERENCES "public"."Offspring"(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX "BreedingPlanBuyer_draftSelectedOffspringId_idx"
  ON "public"."BreedingPlanBuyer" USING btree ("draftSelectedOffspringId");

-- migrate:down
-- Remove draft board fields from both tables

-- Drop constraints and index on BreedingPlanBuyer first (FK before columns)
DROP INDEX IF EXISTS "public"."BreedingPlanBuyer_draftSelectedOffspringId_idx";
ALTER TABLE "public"."BreedingPlanBuyer"
  DROP CONSTRAINT IF EXISTS "BreedingPlanBuyer_draftSelectedOffspringId_fkey",
  DROP CONSTRAINT IF EXISTS "BreedingPlanBuyer_draftPickStatus_check";
ALTER TABLE "public"."BreedingPlanBuyer"
  DROP COLUMN IF EXISTS "draftPickNumber",
  DROP COLUMN IF EXISTS "draftPickedAt",
  DROP COLUMN IF EXISTS "draftPickStatus",
  DROP COLUMN IF EXISTS "draftSelectedOffspringId";

-- Drop constraints and columns on BreedingPlan
ALTER TABLE "public"."BreedingPlan"
  DROP CONSTRAINT IF EXISTS "BreedingPlan_draftMode_check",
  DROP CONSTRAINT IF EXISTS "BreedingPlan_draftStatus_check",
  DROP CONSTRAINT IF EXISTS "BreedingPlan_draftWindowExpiryBehavior_check";
ALTER TABLE "public"."BreedingPlan"
  DROP COLUMN IF EXISTS "draftMode",
  DROP COLUMN IF EXISTS "draftStatus",
  DROP COLUMN IF EXISTS "draftStartedAt",
  DROP COLUMN IF EXISTS "draftTimePerPickMinutes",
  DROP COLUMN IF EXISTS "draftWindowExpiryBehavior",
  DROP COLUMN IF EXISTS "draftCurrentPickNumber";
