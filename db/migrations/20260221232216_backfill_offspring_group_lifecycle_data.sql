-- migrate:up

-- Backfill lifecycleStatus from plan status
-- NOTE: Full BreedingPlanStatus enum values in DB:
--   PLANNING, COMMITTED, CYCLE_EXPECTED, HORMONE_TESTING, CYCLE,
--   BRED, PREGNANT, FOALING, DELIVERY, RECOVERY,
--   BIRTHED, WEANED, PLACEMENT, COMPLETE,
--   CANCELED, UNSUCCESSFUL, ON_HOLD
-- PLACEMENT_STARTED / PLACEMENT_COMPLETED are frontend-only phase keys, NOT in DB.
UPDATE public."OffspringGroup" og
SET "lifecycleStatus" = CASE
  WHEN bp.status::text = 'COMPLETE' THEN 'GROUP_COMPLETE'
  WHEN bp.status::text = 'PLACEMENT' THEN 'PLACEMENT'
  WHEN bp.status::text = 'WEANED' THEN 'WEANED'
  -- BIRTHED = birth recorded. FOALING/DELIVERY/RECOVERY = horse-specific post-birth.
  -- Cast to text because FOALING/DELIVERY/RECOVERY may not exist in enum yet.
  WHEN bp.status::text IN ('BIRTHED', 'FOALING', 'DELIVERY', 'RECOVERY') THEN 'BORN'
  -- Pre-birth statuses: plan is active but no birth yet
  WHEN bp.status::text IN ('BRED', 'PREGNANT') THEN 'PENDING'
  ELSE 'PENDING'
END
FROM public."BreedingPlan" bp
WHERE og."planId" = bp.id
  AND og."planId" IS NOT NULL;

-- Backfill dates (only if OG column is currently null)
UPDATE public."OffspringGroup" og
SET
  "expectedWeanedAt" = COALESCE(og."expectedWeanedAt", bp."expectedWeaned"),
  "expectedPlacementStartAt" = COALESCE(og."expectedPlacementStartAt", bp."expectedPlacementStart"),
  "expectedPlacementCompletedAt" = COALESCE(og."expectedPlacementCompletedAt", bp."expectedPlacementCompleted"),
  "weanedAt" = COALESCE(og."weanedAt", bp."weanedDateActual"),
  "placementStartAt" = COALESCE(og."placementStartAt", bp."placementStartDateActual"),
  "placementCompletedAt" = COALESCE(og."placementCompletedAt", bp."placementCompletedDateActual"),
  "completedAt" = COALESCE(og."completedAt", bp."completedDateActual"),
  "actualBirthOn" = COALESCE(og."actualBirthOn", bp."birthDateActual")
FROM public."BreedingPlan" bp
WHERE og."planId" = bp.id
  AND og."planId" IS NOT NULL;

-- migrate:down

-- Reset lifecycleStatus to PENDING (data-safe -- the original plan columns still have the data)
UPDATE public."OffspringGroup" SET "lifecycleStatus" = 'PENDING';
