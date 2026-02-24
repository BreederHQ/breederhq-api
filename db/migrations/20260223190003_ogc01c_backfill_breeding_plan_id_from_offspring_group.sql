-- migrate:up

-- ============================================================
-- OGC-01c: Backfill breedingPlanId from OffspringGroup.planId
-- ============================================================

-- For every model with offspringGroupId, set breedingPlanId = OG.planId
UPDATE public."Offspring" o
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE o."groupId" = og.id AND og."planId" IS NOT NULL AND o."breedingPlanId" IS NULL;

UPDATE public."Contract" c
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE c."groupId" = og.id AND og."planId" IS NOT NULL AND c."breedingPlanId" IS NULL;

UPDATE public."Document" d
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE d."groupId" = og.id AND og."planId" IS NOT NULL AND d."breedingPlanId" IS NULL;

UPDATE public."FeedingPlan" fp
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE fp."offspringGroupId" = og.id AND og."planId" IS NOT NULL AND fp."breedingPlanId" IS NULL;

UPDATE public."FeedingRecord" fr
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE fr."offspringGroupId" = og.id AND og."planId" IS NOT NULL AND fr."breedingPlanId" IS NULL;

UPDATE public."FoodChange" fc
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE fc."offspringGroupId" = og.id AND og."planId" IS NOT NULL AND fc."breedingPlanId" IS NULL;

UPDATE public."RearingProtocolAssignment" rpa
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE rpa."offspringGroupId" = og.id AND og."planId" IS NOT NULL AND rpa."breedingPlanId" IS NULL;

UPDATE public."SchedulingAvailabilityBlock" sab
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE sab."offspringGroupId" = og.id AND og."planId" IS NOT NULL AND sab."breedingPlanId" IS NULL;

UPDATE public."TagAssignment" ta
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE ta."offspringGroupId" = og.id AND og."planId" IS NOT NULL AND ta."breedingPlanId" IS NULL;

-- LitterEvent: join through Litter (LitterEvent has litterId, not offspringGroupId)
UPDATE public."LitterEvent" le
  SET "breedingPlanId" = l."planId"
  FROM public."Litter" l
  WHERE le."litterId" = l.id AND l."planId" IS NOT NULL AND le."breedingPlanId" IS NULL;

UPDATE public."Animal" a
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE a."offspringGroupId" = og.id AND og."planId" IS NOT NULL AND a."breedingPlanId" IS NULL;

UPDATE public."OffspringGroupEvent" oge
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE oge."offspringGroupId" = og.id AND og."planId" IS NOT NULL AND oge."breedingPlanId" IS NULL;

-- Backfill for models that already have breedingPlanId but may also have offspringGroupId
-- (WaitlistEntry, Invoice, Expense)
-- These already have planId/breedingPlanId — ensure they're populated:
UPDATE public."WaitlistEntry" we
  SET "planId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE we."offspringGroupId" = og.id AND og."planId" IS NOT NULL AND we."planId" IS NULL;

UPDATE public."Invoice" i
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE i."groupId" = og.id AND og."planId" IS NOT NULL AND i."breedingPlanId" IS NULL;

UPDATE public."Expense" e
  SET "breedingPlanId" = og."planId"
  FROM public."OffspringGroup" og
  WHERE e."offspringGroupId" = og.id AND og."planId" IS NOT NULL AND e."breedingPlanId" IS NULL;

-- Backfill BreedingPlan fields from OffspringGroup
UPDATE public."BreedingPlan" bp
  SET
    "countBorn" = og."countBorn",
    "countLive" = og."countLive",
    "countStillborn" = og."countStillborn",
    "countMale" = og."countMale",
    "countFemale" = og."countFemale",
    "countWeaned" = og."countWeaned",
    "countPlaced" = og."countPlaced",
    "listingSlug" = og."listingSlug",
    "listingTitle" = og."listingTitle",
    "listingDescription" = og."listingDescription",
    "marketplaceDefaultPriceCents" = og."marketplaceDefaultPriceCents",
    "marketplaceStatus" = og.status::text,
    "depositRequired" = og."depositRequired",
    "depositAmountCents" = og."depositAmountCents",
    "coverImageUrl" = og."coverImageUrl",
    "themeName" = og."themeName",
    "placementSchedulingPolicy" = og."placementSchedulingPolicy"
  FROM public."OffspringGroup" og
  WHERE og."planId" = bp.id;

-- migrate:down

-- Backfill is data-only; no structural rollback needed.
-- The column drops in OGC-01b's down migration handle cleanup.
