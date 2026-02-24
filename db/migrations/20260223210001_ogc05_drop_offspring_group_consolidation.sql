-- migrate:up
-- ============================================================
-- OGC-05: Drop OffspringGroup infrastructure
-- ============================================================

-- STEP 0: Backfill any remaining Offspring with null breedingPlanId
-- Case 1: OffspringGroup has a planId — copy it to Offspring.breedingPlanId
UPDATE public."Offspring" o
SET "breedingPlanId" = og."planId"
FROM public."OffspringGroup" og
WHERE o."groupId" = og.id
  AND o."breedingPlanId" IS NULL
  AND og."planId" IS NOT NULL;

-- Case 2: OffspringGroup has NO planId — create a BreedingPlan for each such group
-- then link the offspring to the new plan
DO $$
DECLARE
  rec RECORD;
  new_plan_id INT;
BEGIN
  FOR rec IN
    SELECT DISTINCT og.id, og."tenantId", og."species", og."damId", og."sireId",
           og."name", og."expectedBirthOn", og."actualBirthOn"
    FROM public."OffspringGroup" og
    WHERE og."planId" IS NULL
      AND EXISTS (
        SELECT 1 FROM public."Offspring" o
        WHERE o."groupId" = og.id AND o."breedingPlanId" IS NULL
      )
  LOOP
    INSERT INTO public."BreedingPlan" (
      "tenantId", "species", "damId", "sireId", "name",
      "expectedBirthDate", "birthDateActual",
      "status", "createdAt", "updatedAt"
    ) VALUES (
      rec."tenantId",
      rec."species",
      rec."damId",
      rec."sireId",
      COALESCE(rec."name", 'Migrated Group #' || rec.id),
      rec."expectedBirthOn",
      rec."actualBirthOn",
      'COMPLETE',
      NOW(),
      NOW()
    ) RETURNING id INTO new_plan_id;

    -- Link orphaned offspring to the new plan
    UPDATE public."Offspring"
    SET "breedingPlanId" = new_plan_id
    WHERE "groupId" = rec.id AND "breedingPlanId" IS NULL;

    -- Also set OffspringGroup.planId for consistency before drop
    UPDATE public."OffspringGroup"
    SET "planId" = new_plan_id
    WHERE id = rec.id;
  END LOOP;
END $$;

-- STEP 1: Make breedingPlanId NOT NULL on Offspring
-- All rows now backfilled by STEP 0 above
ALTER TABLE public."Offspring"
  ALTER COLUMN "breedingPlanId" SET NOT NULL;

-- STEP 2: Drop old offspringGroupId / groupId FKs from all models
-- Order: drop FK constraints first, then columns

-- Offspring
ALTER TABLE public."Offspring" DROP CONSTRAINT IF EXISTS "Offspring_groupId_fkey";
ALTER TABLE public."Offspring" DROP COLUMN IF EXISTS "groupId";

-- BreedingMilestone
ALTER TABLE public."BreedingMilestone" DROP CONSTRAINT IF EXISTS "BreedingMilestone_offspringGroupId_fkey";
ALTER TABLE public."BreedingMilestone" DROP COLUMN IF EXISTS "offspringGroupId";

-- WaitlistEntry
ALTER TABLE public."WaitlistEntry" DROP COLUMN IF EXISTS "offspringGroupId";

-- Invoice
ALTER TABLE public."Invoice" DROP CONSTRAINT IF EXISTS "Invoice_groupId_fkey";
ALTER TABLE public."Invoice" DROP COLUMN IF EXISTS "groupId";

-- Contract
ALTER TABLE public."Contract" DROP CONSTRAINT IF EXISTS "Contract_groupId_fkey";
ALTER TABLE public."Contract" DROP COLUMN IF EXISTS "groupId";

-- Document
ALTER TABLE public."Document" DROP CONSTRAINT IF EXISTS "Document_groupId_fkey";
ALTER TABLE public."Document" DROP COLUMN IF EXISTS "groupId";

-- Expense
ALTER TABLE public."Expense" DROP CONSTRAINT IF EXISTS "Expense_offspringGroupId_fkey";
ALTER TABLE public."Expense" DROP COLUMN IF EXISTS "offspringGroupId";

-- FeedingPlan
ALTER TABLE public."FeedingPlan" DROP CONSTRAINT IF EXISTS "FeedingPlan_offspringGroupId_fkey";
ALTER TABLE public."FeedingPlan" DROP COLUMN IF EXISTS "offspringGroupId";

-- FeedingRecord
ALTER TABLE public."FeedingRecord" DROP CONSTRAINT IF EXISTS "FeedingRecord_offspringGroupId_fkey";
ALTER TABLE public."FeedingRecord" DROP COLUMN IF EXISTS "offspringGroupId";

-- FoodChange
ALTER TABLE public."FoodChange" DROP CONSTRAINT IF EXISTS "FoodChange_offspringGroupId_fkey";
ALTER TABLE public."FoodChange" DROP COLUMN IF EXISTS "offspringGroupId";

-- RearingProtocolAssignment
ALTER TABLE public."RearingProtocolAssignment" DROP CONSTRAINT IF EXISTS "RearingProtocolAssignment_offspringGroupId_fkey";
DROP INDEX IF EXISTS "RearingProtocolAssignment_offspringGroupId_protocolId_key";
ALTER TABLE public."RearingProtocolAssignment" DROP COLUMN IF EXISTS "offspringGroupId";

-- SupplementSchedule
ALTER TABLE public."SupplementSchedule" DROP CONSTRAINT IF EXISTS "SupplementSchedule_offspringGroupId_fkey";
ALTER TABLE public."SupplementSchedule" DROP COLUMN IF EXISTS "offspringGroupId";

-- SchedulingAvailabilityBlock
ALTER TABLE public."SchedulingAvailabilityBlock" DROP CONSTRAINT IF EXISTS "SchedulingAvailabilityBlock_offspringGroupId_fkey";
ALTER TABLE public."SchedulingAvailabilityBlock" DROP COLUMN IF EXISTS "offspringGroupId";

-- TagAssignment
ALTER TABLE public."TagAssignment" DROP CONSTRAINT IF EXISTS "TagAssignment_offspringGroupId_fkey";
ALTER TABLE public."TagAssignment" DROP COLUMN IF EXISTS "offspringGroupId";

-- LitterEvent
ALTER TABLE public."LitterEvent" DROP COLUMN IF EXISTS "offspringGroupId";

-- Animal (legacy)
ALTER TABLE public."Animal" DROP CONSTRAINT IF EXISTS "Animal_offspringGroupId_fkey";
DROP INDEX IF EXISTS "Animal_offspringGroupId_idx";
ALTER TABLE public."Animal" DROP COLUMN IF EXISTS "offspringGroupId";

-- STEP 3: Rename OffspringGroupEvent → BreedingPlanEvent (preserves history)
-- BreedingPlanEvent may already exist from an earlier migration; handle both cases
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'BreedingPlanEvent')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'OffspringGroupEvent') THEN
    -- Both exist: BreedingPlanEvent already has correct data, just drop the old table
    DROP TABLE public."OffspringGroupEvent" CASCADE;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'OffspringGroupEvent') THEN
    -- Only old table exists: rename it
    ALTER TABLE public."OffspringGroupEvent" RENAME TO "BreedingPlanEvent";
  END IF;
  -- If only BreedingPlanEvent exists, nothing to do
END $$;
ALTER TABLE public."BreedingPlanEvent" DROP CONSTRAINT IF EXISTS "OffspringGroupEvent_offspringGroupId_fkey";
ALTER TABLE public."BreedingPlanEvent" DROP COLUMN IF EXISTS "offspringGroupId";

-- STEP 4: Drop OffspringGroupBuyer table
DROP TABLE IF EXISTS public."OffspringGroupBuyer" CASCADE;

-- STEP 5: BreedingPlan has no offspringGroup column (relation was via OffspringGroup.planId)
-- No column to drop on BreedingPlan.

-- STEP 6: Drop OffspringGroup table
DROP TABLE IF EXISTS public."OffspringGroup" CASCADE;

-- STEP 7: Drop unused enums
DROP TYPE IF EXISTS public."OffspringLinkState";
DROP TYPE IF EXISTS public."OffspringLinkReason";

-- STEP 8: PLAN_COMPLETE enum value left in place (PostgreSQL can't easily remove enum values)
-- Just stop using it in code.

-- STEP 9: Clean up BreedingPlanBuyer
ALTER TABLE public."BreedingPlanBuyer" DROP COLUMN IF EXISTS "offspringGroupBuyerId";

-- STEP 10: Drop indexes that referenced OffspringGroup
DROP INDEX IF EXISTS "Offspring_groupId_idx";
DROP INDEX IF EXISTS "OffspringGroupEvent_offspringGroupId_type_occurredAt_idx";
DROP INDEX IF EXISTS "OffspringGroup_tenantId_idx";
DROP INDEX IF EXISTS "OffspringGroup_species_expectedBirthOn_idx";

-- migrate:down
-- WARNING: This migration is destructive and cannot be fully reversed.
-- The OffspringGroup, OffspringGroupBuyer tables and all dropped columns are gone.
-- A restore from backup would be needed to reverse this migration.
