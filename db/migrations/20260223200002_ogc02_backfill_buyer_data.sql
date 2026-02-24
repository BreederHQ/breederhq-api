-- migrate:up

-- ============================================================
-- OGC-02 Part B: Backfill BreedingPlanBuyer from OffspringGroupBuyer
-- Must be a separate migration from Part A because PostgreSQL
-- cannot use newly-added enum values in the same transaction.
-- ============================================================

-- 1. Backfill: For OffspringGroupBuyers that have linked BreedingPlanBuyers, copy post-birth fields
UPDATE public."BreedingPlanBuyer" bpb
  SET
    "placementRank" = ogb."placementRank",
    "optedOutAt" = ogb."optedOutAt",
    "optedOutReason" = ogb."optedOutReason",
    "optedOutBy" = ogb."optedOutBy",
    "depositDisposition" = ogb."depositDisposition"
  FROM public."OffspringGroupBuyer" ogb
  WHERE bpb."offspringGroupBuyerId" = ogb.id;

-- 2. For OffspringGroupBuyers WITHOUT a linked BreedingPlanBuyer, create new BreedingPlanBuyer records
-- This handles buyers that were added directly to the offspring group (not via plan)
INSERT INTO public."BreedingPlanBuyer" (
  "tenantId", "planId", "partyId", "waitlistEntryId", "buyerId",
  "stage", "placementRank", "optedOutAt", "optedOutReason", "optedOutBy",
  "depositDisposition", "offspringGroupBuyerId", "notes",
  "assignedAt", "createdAt", "updatedAt"
)
SELECT
  ogb."tenantId",
  og."planId",
  ogb."buyerPartyId",
  ogb."waitlistEntryId",
  ogb."buyerId",
  CASE
    WHEN ogb.stage = 'PENDING' THEN 'ASSIGNED'::"BreedingPlanBuyerStage"
    WHEN ogb.stage = 'DEPOSIT_NEEDED' THEN 'DEPOSIT_NEEDED'::"BreedingPlanBuyerStage"
    WHEN ogb.stage = 'DEPOSIT_PAID' THEN 'DEPOSIT_PAID'::"BreedingPlanBuyerStage"
    WHEN ogb.stage = 'AWAITING_PICK' THEN 'AWAITING_PICK'::"BreedingPlanBuyerStage"
    WHEN ogb.stage = 'MATCH_PROPOSED' THEN 'MATCH_PROPOSED'::"BreedingPlanBuyerStage"
    WHEN ogb.stage = 'COMPLETED' THEN 'COMPLETED'::"BreedingPlanBuyerStage"
    WHEN ogb.stage = 'DECLINED' THEN 'DECLINED'::"BreedingPlanBuyerStage"
    WHEN ogb.stage = 'WITHDRAWN' THEN 'WITHDRAWN'::"BreedingPlanBuyerStage"
    ELSE 'ASSIGNED'::"BreedingPlanBuyerStage"
  END,
  ogb."placementRank",
  ogb."optedOutAt",
  ogb."optedOutReason",
  ogb."optedOutBy",
  ogb."depositDisposition",
  ogb.id,
  ogb.notes,
  COALESCE(ogb."createdAt", now()),
  COALESCE(ogb."createdAt", now()),
  COALESCE(ogb."updatedAt", now())
FROM public."OffspringGroupBuyer" ogb
JOIN public."OffspringGroup" og ON ogb."groupId" = og.id
WHERE og."planId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public."BreedingPlanBuyer" bpb
    WHERE bpb."offspringGroupBuyerId" = ogb.id
  );

-- migrate:down

-- Note: Cannot reliably undo the INSERT backfill without tracking which rows were created
-- The UPDATE backfill set columns that will be dropped by Part A's migrate:down
