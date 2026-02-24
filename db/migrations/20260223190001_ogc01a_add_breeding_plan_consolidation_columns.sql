-- migrate:up

-- ============================================================
-- OGC-01a: Add offspring group fields to BreedingPlan
-- ============================================================

-- 1. Offspring count fields (from OffspringGroup)
ALTER TABLE public."BreedingPlan"
  ADD COLUMN IF NOT EXISTS "countBorn" integer,
  ADD COLUMN IF NOT EXISTS "countLive" integer,
  ADD COLUMN IF NOT EXISTS "countStillborn" integer,
  ADD COLUMN IF NOT EXISTS "countMale" integer,
  ADD COLUMN IF NOT EXISTS "countFemale" integer,
  ADD COLUMN IF NOT EXISTS "countWeaned" integer,
  ADD COLUMN IF NOT EXISTS "countPlaced" integer;

-- 2. Marketplace fields (from OffspringGroup)
ALTER TABLE public."BreedingPlan"
  ADD COLUMN IF NOT EXISTS "listingSlug" text,
  ADD COLUMN IF NOT EXISTS "listingTitle" text,
  ADD COLUMN IF NOT EXISTS "listingDescription" text,
  ADD COLUMN IF NOT EXISTS "marketplaceDefaultPriceCents" integer,
  ADD COLUMN IF NOT EXISTS "marketplaceStatus" text DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "depositRequired" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "depositAmountCents" integer,
  ADD COLUMN IF NOT EXISTS "coverImageUrl" text,
  ADD COLUMN IF NOT EXISTS "themeName" text;

-- 3. Placement scheduling (from OffspringGroup)
ALTER TABLE public."BreedingPlan"
  ADD COLUMN IF NOT EXISTS "placementSchedulingPolicy" jsonb;

-- 4. Unique constraint for marketplace listing slug per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "BreedingPlan_tenantId_listingSlug_key"
  ON public."BreedingPlan"("tenantId", "listingSlug")
  WHERE "listingSlug" IS NOT NULL;

-- 5. Add BORN and DISSOLVED to BreedingPlanStatus enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'BORN'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanStatus')
  ) THEN
    ALTER TYPE public."BreedingPlanStatus" ADD VALUE 'BORN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'DISSOLVED'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanStatus')
  ) THEN
    ALTER TYPE public."BreedingPlanStatus" ADD VALUE 'DISSOLVED';
  END IF;
END$$;

-- migrate:down

DROP INDEX IF EXISTS public."BreedingPlan_tenantId_listingSlug_key";

ALTER TABLE public."BreedingPlan"
  DROP COLUMN IF EXISTS "countBorn",
  DROP COLUMN IF EXISTS "countLive",
  DROP COLUMN IF EXISTS "countStillborn",
  DROP COLUMN IF EXISTS "countMale",
  DROP COLUMN IF EXISTS "countFemale",
  DROP COLUMN IF EXISTS "countWeaned",
  DROP COLUMN IF EXISTS "countPlaced",
  DROP COLUMN IF EXISTS "listingSlug",
  DROP COLUMN IF EXISTS "listingTitle",
  DROP COLUMN IF EXISTS "listingDescription",
  DROP COLUMN IF EXISTS "marketplaceDefaultPriceCents",
  DROP COLUMN IF EXISTS "marketplaceStatus",
  DROP COLUMN IF EXISTS "depositRequired",
  DROP COLUMN IF EXISTS "depositAmountCents",
  DROP COLUMN IF EXISTS "coverImageUrl",
  DROP COLUMN IF EXISTS "themeName",
  DROP COLUMN IF EXISTS "placementSchedulingPolicy";

-- Note: Cannot remove enum values in PostgreSQL without recreating the type
