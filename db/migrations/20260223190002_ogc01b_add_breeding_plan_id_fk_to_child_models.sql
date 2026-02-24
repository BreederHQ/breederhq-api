-- migrate:up

-- ============================================================
-- OGC-01b: Add breedingPlanId FK to offspring-group-only models
-- Uses DO $$ guards for constraints since some may pre-exist.
-- ============================================================

-- Offspring (currently has groupId NOT NULL → OffspringGroup)
ALTER TABLE public."Offspring"
  ADD COLUMN IF NOT EXISTS "breedingPlanId" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Offspring_breedingPlanId_fkey') THEN
    ALTER TABLE public."Offspring"
      ADD CONSTRAINT "Offspring_breedingPlanId_fkey"
      FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id)
      ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "Offspring_breedingPlanId_idx"
  ON public."Offspring"("breedingPlanId");

-- Contract
ALTER TABLE public."Contract"
  ADD COLUMN IF NOT EXISTS "breedingPlanId" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Contract_breedingPlanId_fkey') THEN
    ALTER TABLE public."Contract"
      ADD CONSTRAINT "Contract_breedingPlanId_fkey"
      FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id);
  END IF;
END $$;

-- Document
ALTER TABLE public."Document"
  ADD COLUMN IF NOT EXISTS "breedingPlanId" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Document_breedingPlanId_fkey') THEN
    ALTER TABLE public."Document"
      ADD CONSTRAINT "Document_breedingPlanId_fkey"
      FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id);
  END IF;
END $$;

-- FeedingPlan
ALTER TABLE public."FeedingPlan"
  ADD COLUMN IF NOT EXISTS "breedingPlanId" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeedingPlan_breedingPlanId_fkey') THEN
    ALTER TABLE public."FeedingPlan"
      ADD CONSTRAINT "FeedingPlan_breedingPlanId_fkey"
      FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id)
      ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "FeedingPlan_breedingPlanId_idx"
  ON public."FeedingPlan"("tenantId", "breedingPlanId");

-- FeedingRecord
ALTER TABLE public."FeedingRecord"
  ADD COLUMN IF NOT EXISTS "breedingPlanId" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeedingRecord_breedingPlanId_fkey') THEN
    ALTER TABLE public."FeedingRecord"
      ADD CONSTRAINT "FeedingRecord_breedingPlanId_fkey"
      FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id)
      ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "FeedingRecord_breedingPlanId_idx"
  ON public."FeedingRecord"("tenantId", "breedingPlanId");

-- FoodChange
ALTER TABLE public."FoodChange"
  ADD COLUMN IF NOT EXISTS "breedingPlanId" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FoodChange_breedingPlanId_fkey') THEN
    ALTER TABLE public."FoodChange"
      ADD CONSTRAINT "FoodChange_breedingPlanId_fkey"
      FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- RearingProtocolAssignment
ALTER TABLE public."RearingProtocolAssignment"
  ADD COLUMN IF NOT EXISTS "breedingPlanId" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RearingProtocolAssignment_breedingPlanId_fkey') THEN
    ALTER TABLE public."RearingProtocolAssignment"
      ADD CONSTRAINT "RearingProtocolAssignment_breedingPlanId_fkey"
      FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id)
      ON DELETE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "RearingProtocolAssignment_breedingPlanId_protocolId_key"
  ON public."RearingProtocolAssignment"("breedingPlanId", "protocolId")
  WHERE "breedingPlanId" IS NOT NULL;

-- SchedulingAvailabilityBlock
ALTER TABLE public."SchedulingAvailabilityBlock"
  ADD COLUMN IF NOT EXISTS "breedingPlanId" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingAvailabilityBlock_breedingPlanId_fkey') THEN
    ALTER TABLE public."SchedulingAvailabilityBlock"
      ADD CONSTRAINT "SchedulingAvailabilityBlock_breedingPlanId_fkey"
      FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "SchedulingAvailabilityBlock_breedingPlanId_idx"
  ON public."SchedulingAvailabilityBlock"("breedingPlanId");

-- TagAssignment (may already have breedingPlanId from baseline)
ALTER TABLE public."TagAssignment"
  ADD COLUMN IF NOT EXISTS "breedingPlanId" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TagAssignment_breedingPlanId_fkey') THEN
    ALTER TABLE public."TagAssignment"
      ADD CONSTRAINT "TagAssignment_breedingPlanId_fkey"
      FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- LitterEvent (uses litterId → Litter → BreedingPlan, not offspringGroupId)
ALTER TABLE public."LitterEvent"
  ADD COLUMN IF NOT EXISTS "breedingPlanId" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LitterEvent_breedingPlanId_fkey') THEN
    ALTER TABLE public."LitterEvent"
      ADD CONSTRAINT "LitterEvent_breedingPlanId_fkey"
      FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id);
  END IF;
END $$;

-- Animal (legacy offspringGroupId → add breedingPlanId)
ALTER TABLE public."Animal"
  ADD COLUMN IF NOT EXISTS "breedingPlanId" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Animal_breedingPlanId_fkey') THEN
    ALTER TABLE public."Animal"
      ADD CONSTRAINT "Animal_breedingPlanId_fkey"
      FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "Animal_breedingPlanId_idx"
  ON public."Animal"("breedingPlanId");

-- OffspringGroupEvent → add breedingPlanId (will become sole FK later)
ALTER TABLE public."OffspringGroupEvent"
  ADD COLUMN IF NOT EXISTS "breedingPlanId" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OffspringGroupEvent_breedingPlanId_fkey') THEN
    ALTER TABLE public."OffspringGroupEvent"
      ADD CONSTRAINT "OffspringGroupEvent_breedingPlanId_fkey"
      FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- migrate:down

ALTER TABLE public."OffspringGroupEvent" DROP CONSTRAINT IF EXISTS "OffspringGroupEvent_breedingPlanId_fkey";
ALTER TABLE public."OffspringGroupEvent" DROP COLUMN IF EXISTS "breedingPlanId";

DROP INDEX IF EXISTS public."Animal_breedingPlanId_idx";
ALTER TABLE public."Animal" DROP CONSTRAINT IF EXISTS "Animal_breedingPlanId_fkey";
ALTER TABLE public."Animal" DROP COLUMN IF EXISTS "breedingPlanId";

ALTER TABLE public."LitterEvent" DROP CONSTRAINT IF EXISTS "LitterEvent_breedingPlanId_fkey";
ALTER TABLE public."LitterEvent" DROP COLUMN IF EXISTS "breedingPlanId";

ALTER TABLE public."TagAssignment" DROP CONSTRAINT IF EXISTS "TagAssignment_breedingPlanId_fkey";
ALTER TABLE public."TagAssignment" DROP COLUMN IF EXISTS "breedingPlanId";

DROP INDEX IF EXISTS public."SchedulingAvailabilityBlock_breedingPlanId_idx";
ALTER TABLE public."SchedulingAvailabilityBlock" DROP CONSTRAINT IF EXISTS "SchedulingAvailabilityBlock_breedingPlanId_fkey";
ALTER TABLE public."SchedulingAvailabilityBlock" DROP COLUMN IF EXISTS "breedingPlanId";

DROP INDEX IF EXISTS public."RearingProtocolAssignment_breedingPlanId_protocolId_key";
ALTER TABLE public."RearingProtocolAssignment" DROP CONSTRAINT IF EXISTS "RearingProtocolAssignment_breedingPlanId_fkey";
ALTER TABLE public."RearingProtocolAssignment" DROP COLUMN IF EXISTS "breedingPlanId";

ALTER TABLE public."FoodChange" DROP CONSTRAINT IF EXISTS "FoodChange_breedingPlanId_fkey";
ALTER TABLE public."FoodChange" DROP COLUMN IF EXISTS "breedingPlanId";

DROP INDEX IF EXISTS public."FeedingRecord_breedingPlanId_idx";
ALTER TABLE public."FeedingRecord" DROP CONSTRAINT IF EXISTS "FeedingRecord_breedingPlanId_fkey";
ALTER TABLE public."FeedingRecord" DROP COLUMN IF EXISTS "breedingPlanId";

DROP INDEX IF EXISTS public."FeedingPlan_breedingPlanId_idx";
ALTER TABLE public."FeedingPlan" DROP CONSTRAINT IF EXISTS "FeedingPlan_breedingPlanId_fkey";
ALTER TABLE public."FeedingPlan" DROP COLUMN IF EXISTS "breedingPlanId";

ALTER TABLE public."Document" DROP CONSTRAINT IF EXISTS "Document_breedingPlanId_fkey";
ALTER TABLE public."Document" DROP COLUMN IF EXISTS "breedingPlanId";

ALTER TABLE public."Contract" DROP CONSTRAINT IF EXISTS "Contract_breedingPlanId_fkey";
ALTER TABLE public."Contract" DROP COLUMN IF EXISTS "breedingPlanId";

DROP INDEX IF EXISTS public."Offspring_breedingPlanId_idx";
ALTER TABLE public."Offspring" DROP CONSTRAINT IF EXISTS "Offspring_breedingPlanId_fkey";
ALTER TABLE public."Offspring" DROP COLUMN IF EXISTS "breedingPlanId";
