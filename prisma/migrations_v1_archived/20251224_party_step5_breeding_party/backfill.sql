-- ============================================================================
-- Party Step 5: Breeding Domain - Backfill Script
-- ============================================================================
-- This script backfills partyId fields for all Breeding domain models
-- by resolving Contact and Organization legacy IDs to their corresponding Party IDs.
-- This script is idempotent and can be run multiple times safely.
-- ============================================================================

-- ============================================================================
-- 1. BreedingAttempt: studOwnerPartyId from studOwnerContactId
-- ============================================================================

UPDATE "BreedingAttempt" ba
SET "studOwnerPartyId" = c."partyId"
FROM "Contact" c
WHERE ba."studOwnerContactId" = c.id
  AND ba."studOwnerPartyId" IS NULL
  AND c."partyId" IS NOT NULL;

-- ============================================================================
-- 2. PlanParty: partyId from contactId or organizationId
-- ============================================================================

-- Backfill from Contact
UPDATE "PlanParty" pp
SET "partyId" = c."partyId"
FROM "Contact" c
WHERE pp."contactId" = c.id
  AND pp."partyId" IS NULL
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization
UPDATE "PlanParty" pp
SET "partyId" = o."partyId"
FROM "Organization" o
WHERE pp."organizationId" = o.id
  AND pp."partyId" IS NULL
  AND o."partyId" IS NOT NULL;

-- ============================================================================
-- 3. WaitlistEntry: clientPartyId from contactId or organizationId
-- ============================================================================

-- Backfill from Contact
UPDATE "WaitlistEntry" we
SET "clientPartyId" = c."partyId"
FROM "Contact" c
WHERE we."contactId" = c.id
  AND we."clientPartyId" IS NULL
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization
UPDATE "WaitlistEntry" we
SET "clientPartyId" = o."partyId"
FROM "Organization" o
WHERE we."organizationId" = o.id
  AND we."clientPartyId" IS NULL
  AND o."partyId" IS NOT NULL;

-- ============================================================================
-- 4. OffspringGroupBuyer: buyerPartyId from contactId or organizationId
-- ============================================================================

-- Backfill from Contact
UPDATE "OffspringGroupBuyer" ogb
SET "buyerPartyId" = c."partyId"
FROM "Contact" c
WHERE ogb."contactId" = c.id
  AND ogb."buyerPartyId" IS NULL
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization
UPDATE "OffspringGroupBuyer" ogb
SET "buyerPartyId" = o."partyId"
FROM "Organization" o
WHERE ogb."organizationId" = o.id
  AND ogb."buyerPartyId" IS NULL
  AND o."partyId" IS NOT NULL;

-- ============================================================================
-- 5. Offspring: buyerPartyId from buyerContactId or buyerOrganizationId
-- ============================================================================

-- Backfill from Contact
UPDATE "Offspring" o
SET "buyerPartyId" = c."partyId"
FROM "Contact" c
WHERE o."buyerContactId" = c.id
  AND o."buyerPartyId" IS NULL
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization
UPDATE "Offspring" o
SET "buyerPartyId" = org."partyId"
FROM "Organization" org
WHERE o."buyerOrganizationId" = org.id
  AND o."buyerPartyId" IS NULL
  AND org."partyId" IS NOT NULL;

-- ============================================================================
-- 6. Invoice: clientPartyId from contactId or organizationId
-- ============================================================================

-- Backfill from Contact
UPDATE "Invoice" i
SET "clientPartyId" = c."partyId"
FROM "Contact" c
WHERE i."contactId" = c.id
  AND i."clientPartyId" IS NULL
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization
UPDATE "Invoice" i
SET "clientPartyId" = o."partyId"
FROM "Organization" o
WHERE i."organizationId" = o.id
  AND i."clientPartyId" IS NULL
  AND o."partyId" IS NOT NULL;

-- ============================================================================
-- 7. ContractParty: partyId from contactId or organizationId
-- ============================================================================

-- Backfill from Contact
UPDATE "ContractParty" cp
SET "partyId" = c."partyId"
FROM "Contact" c
WHERE cp."contactId" = c.id
  AND cp."partyId" IS NULL
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization
UPDATE "ContractParty" cp
SET "partyId" = o."partyId"
FROM "Organization" o
WHERE cp."organizationId" = o.id
  AND cp."partyId" IS NULL
  AND o."partyId" IS NOT NULL;

-- ============================================================================
-- 8. OffspringContract: buyerPartyId from buyerContactId or buyerOrganizationId
-- ============================================================================

-- Backfill from Contact
UPDATE "OffspringContract" oc
SET "buyerPartyId" = c."partyId"
FROM "Contact" c
WHERE oc."buyerContactId" = c.id
  AND oc."buyerPartyId" IS NULL
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization
UPDATE "OffspringContract" oc
SET "buyerPartyId" = o."partyId"
FROM "Organization" o
WHERE oc."buyerOrganizationId" = o.id
  AND oc."buyerPartyId" IS NULL
  AND o."partyId" IS NOT NULL;

-- ============================================================================
-- Backfill Completion Summary
-- ============================================================================
-- The backfill is complete. All breeding domain party-like references have been
-- populated with partyId values where resolvable from Contact or Organization.
-- ============================================================================
