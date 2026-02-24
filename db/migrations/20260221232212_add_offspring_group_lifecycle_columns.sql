-- migrate:up

-- 1. Lifecycle status on OffspringGroup
ALTER TABLE public."OffspringGroup"
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" varchar(30) NOT NULL DEFAULT 'PENDING';
CREATE INDEX IF NOT EXISTS "OffspringGroup_lifecycleStatus_idx"
  ON public."OffspringGroup"("lifecycleStatus");

-- 2. Expected date columns (relocating from BreedingPlan)
ALTER TABLE public."OffspringGroup"
  ADD COLUMN IF NOT EXISTS "expectedWeanedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "expectedPlacementStartAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "expectedPlacementCompletedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "completedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "lockedPlacementStartDate" timestamptz;

-- 3. Add PLAN_COMPLETE to BreedingPlanStatus enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'PLAN_COMPLETE'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BreedingPlanStatus')
  ) THEN
    ALTER TYPE public."BreedingPlanStatus" ADD VALUE 'PLAN_COMPLETE';
  END IF;
END$$;

-- 4. SupplementSchedule → OffspringGroup FK
ALTER TABLE public."SupplementSchedule"
  ADD COLUMN IF NOT EXISTS "offspringGroupId" integer;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SupplementSchedule_offspringGroupId_fkey'
  ) THEN
    ALTER TABLE public."SupplementSchedule"
      ADD CONSTRAINT "SupplementSchedule_offspringGroupId_fkey"
      FOREIGN KEY ("offspringGroupId") REFERENCES public."OffspringGroup"(id) ON DELETE SET NULL;
  END IF;
END$$;

-- 5. BreedingMilestone → OffspringGroup FK
ALTER TABLE public."BreedingMilestone"
  ADD COLUMN IF NOT EXISTS "offspringGroupId" integer;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'BreedingMilestone_offspringGroupId_fkey'
  ) THEN
    ALTER TABLE public."BreedingMilestone"
      ADD CONSTRAINT "BreedingMilestone_offspringGroupId_fkey"
      FOREIGN KEY ("offspringGroupId") REFERENCES public."OffspringGroup"(id) ON DELETE CASCADE;
  END IF;
END$$;

-- migrate:down

ALTER TABLE public."BreedingMilestone" DROP COLUMN IF EXISTS "offspringGroupId";
ALTER TABLE public."SupplementSchedule" DROP COLUMN IF EXISTS "offspringGroupId";
ALTER TABLE public."OffspringGroup"
  DROP COLUMN IF EXISTS "lockedPlacementStartDate",
  DROP COLUMN IF EXISTS "completedAt",
  DROP COLUMN IF EXISTS "expectedPlacementCompletedAt",
  DROP COLUMN IF EXISTS "expectedPlacementStartAt",
  DROP COLUMN IF EXISTS "expectedWeanedAt",
  DROP COLUMN IF EXISTS "lifecycleStatus";
DROP INDEX IF EXISTS "OffspringGroup_lifecycleStatus_idx";
-- Note: Cannot remove enum value in PostgreSQL. PLAN_COMPLETE persists.
