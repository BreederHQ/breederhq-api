-- migrate:up

-- Move post-birth plans to PLAN_COMPLETE
-- Only plans that have a recorded birth should transition.
-- After this migration, no plans should remain in WEANED, PLACEMENT, or COMPLETE status.
UPDATE public."BreedingPlan"
SET status = 'PLAN_COMPLETE'::"BreedingPlanStatus"
WHERE status IN ('WEANED', 'PLACEMENT', 'COMPLETE')
  AND "birthDateActual" IS NOT NULL
  AND "deletedAt" IS NULL;

-- Safety net: move any WEANED/PLACEMENT/COMPLETE plans that somehow lack a birth date
-- These are data-integrity edge cases — treat them as PLAN_COMPLETE anyway
-- since those statuses no longer exist on plans.
UPDATE public."BreedingPlan"
SET status = 'PLAN_COMPLETE'::"BreedingPlanStatus"
WHERE status IN ('WEANED', 'PLACEMENT', 'COMPLETE')
  AND "deletedAt" IS NULL;

-- migrate:down

-- Cannot reliably reverse — would need to re-derive status from group lifecycle.
-- Log a warning instead.
DO $$ BEGIN RAISE WARNING 'Cannot reverse PLAN_COMPLETE migration. Manual intervention needed.'; END $$;
