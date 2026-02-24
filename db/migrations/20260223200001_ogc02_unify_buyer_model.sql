-- migrate:up

-- ============================================================
-- OGC-02 Part A: Extend BreedingPlanBuyer schema
-- Adds post-birth columns + new enum stage values.
-- Backfill is in Part B (separate migration) because PostgreSQL
-- cannot use newly-added enum values in the same transaction.
-- ============================================================

-- 1. Add post-birth fields from OffspringGroupBuyer
ALTER TABLE public."BreedingPlanBuyer"
  ADD COLUMN IF NOT EXISTS "placementRank" integer,
  ADD COLUMN IF NOT EXISTS "optedOutAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "optedOutReason" text,
  ADD COLUMN IF NOT EXISTS "optedOutBy" varchar(20),
  ADD COLUMN IF NOT EXISTS "depositDisposition" varchar(30);

-- 2. Add new stage values to BreedingPlanBuyerStage enum
-- Current values: POSSIBLE_MATCH, INQUIRY, ASSIGNED, MATCHED_TO_OFFSPRING
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DEPOSIT_NEEDED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'DEPOSIT_NEEDED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DEPOSIT_PAID' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'DEPOSIT_PAID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AWAITING_PICK' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'AWAITING_PICK';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MATCH_PROPOSED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'MATCH_PROPOSED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'COMPLETED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'COMPLETED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DECLINED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'DECLINED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'WITHDRAWN' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'WITHDRAWN';
  END IF;
  -- Additional stages used by offspring-group-buyers routes (backward compat)
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PENDING' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'PENDING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MATCHED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'MATCHED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'OPTED_OUT' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'OPTED_OUT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'VISIT_SCHEDULED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'VISIT_SCHEDULED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PICKUP_SCHEDULED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'PICKUP_SCHEDULED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'WINDOW_EXPIRED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanBuyerStage')) THEN
    ALTER TYPE public."BreedingPlanBuyerStage" ADD VALUE 'WINDOW_EXPIRED';
  END IF;
END$$;

-- migrate:down

ALTER TABLE public."BreedingPlanBuyer"
  DROP COLUMN IF EXISTS "placementRank",
  DROP COLUMN IF EXISTS "optedOutAt",
  DROP COLUMN IF EXISTS "optedOutReason",
  DROP COLUMN IF EXISTS "optedOutBy",
  DROP COLUMN IF EXISTS "depositDisposition";

-- Note: Cannot remove enum values in PostgreSQL without recreating the type
