-- ============================================================================
-- Party Migration Step 5: Finance Domain - POST-MIGRATION REPAIR TOOL
-- ============================================================================
-- PURPOSE:
--   This is a post-migration repair tool for operational recovery.
--   Use this script to backfill partyId columns from legacy Contact/Organization IDs
--   if data inconsistencies are discovered after migration.
--   Models: Invoice, OffspringContract, ContractParty
--
-- SAFETY:
--   - This script is IDEMPOTENT and safe to run multiple times
--   - Only updates rows where partyId is NULL
--   - Does not modify existing partyId values
--
-- USAGE:
--   psql $DATABASE_URL -f prisma/sql/backfills/backfill_party_step5_finance.sql
--
-- NOTE:
--   This is NOT part of the validation suite (does not match validate*.sql pattern)
-- ============================================================================

-- Enable timing and row counts for monitoring
\timing on

-- ============================================================================
-- Invoice: Backfill clientPartyId from contactId and organizationId
-- ============================================================================

-- First, detect and report conflicts (both contactId and organizationId set)
SELECT
    COUNT(*) as conflict_count,
    'Invoice rows with both contactId and organizationId set (will not be backfilled)' as description
FROM "Invoice"
WHERE "contactId" IS NOT NULL
  AND "organizationId" IS NOT NULL;

-- Backfill from Contact.partyId
UPDATE "Invoice" AS inv
SET "clientPartyId" = c."partyId"
FROM "Contact" AS c
WHERE inv."contactId" = c.id
  AND inv."clientPartyId" IS NULL
  AND c."partyId" IS NOT NULL
  AND inv."organizationId" IS NULL;  -- Only when no org conflict

-- Report progress
SELECT
    COUNT(*) as backfilled_from_contact,
    'Invoice rows backfilled from Contact.partyId' as description
FROM "Invoice" AS inv
INNER JOIN "Contact" AS c ON inv."contactId" = c.id
WHERE inv."clientPartyId" = c."partyId"
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization.partyId
UPDATE "Invoice" AS inv
SET "clientPartyId" = o."partyId"
FROM "Organization" AS o
WHERE inv."organizationId" = o.id
  AND inv."clientPartyId" IS NULL
  AND o."partyId" IS NOT NULL
  AND inv."contactId" IS NULL;  -- Only when no contact conflict

-- Report progress
SELECT
    COUNT(*) as backfilled_from_organization,
    'Invoice rows backfilled from Organization.partyId' as description
FROM "Invoice" AS inv
INNER JOIN "Organization" AS o ON inv."organizationId" = o.id
WHERE inv."clientPartyId" = o."partyId"
  AND o."partyId" IS NOT NULL;

-- ============================================================================
-- OffspringContract: Backfill buyerPartyId from buyerContactId and buyerOrganizationId
-- ============================================================================

-- Detect and report conflicts
SELECT
    COUNT(*) as conflict_count,
    'OffspringContract rows with both buyerContactId and buyerOrganizationId set (will not be backfilled)' as description
FROM "OffspringContract"
WHERE "buyerContactId" IS NOT NULL
  AND "buyerOrganizationId" IS NOT NULL;

-- Backfill from Contact.partyId
UPDATE "OffspringContract" AS oc
SET "buyerPartyId" = c."partyId"
FROM "Contact" AS c
WHERE oc."buyerContactId" = c.id
  AND oc."buyerPartyId" IS NULL
  AND c."partyId" IS NOT NULL
  AND oc."buyerOrganizationId" IS NULL;

-- Report progress
SELECT
    COUNT(*) as backfilled_from_contact,
    'OffspringContract rows backfilled from Contact.partyId' as description
FROM "OffspringContract" AS oc
INNER JOIN "Contact" AS c ON oc."buyerContactId" = c.id
WHERE oc."buyerPartyId" = c."partyId"
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization.partyId
UPDATE "OffspringContract" AS oc
SET "buyerPartyId" = o."partyId"
FROM "Organization" AS o
WHERE oc."buyerOrganizationId" = o.id
  AND oc."buyerPartyId" IS NULL
  AND o."partyId" IS NOT NULL
  AND oc."buyerContactId" IS NULL;

-- Report progress
SELECT
    COUNT(*) as backfilled_from_organization,
    'OffspringContract rows backfilled from Organization.partyId' as description
FROM "OffspringContract" AS oc
INNER JOIN "Organization" AS o ON oc."buyerOrganizationId" = o.id
WHERE oc."buyerPartyId" = o."partyId"
  AND o."partyId" IS NOT NULL;

-- ============================================================================
-- ContractParty: Backfill partyId from contactId, organizationId, and userId
-- ============================================================================

-- Detect and report conflicts (multiple IDs set)
SELECT
    COUNT(*) as conflict_count,
    'ContractParty rows with multiple party sources set (will not be backfilled)' as description
FROM "ContractParty"
WHERE (
    ("contactId" IS NOT NULL AND "organizationId" IS NOT NULL) OR
    ("contactId" IS NOT NULL AND "userId" IS NOT NULL) OR
    ("organizationId" IS NOT NULL AND "userId" IS NOT NULL)
);

-- Backfill from Contact.partyId
UPDATE "ContractParty" AS cp
SET "partyId" = c."partyId"
FROM "Contact" AS c
WHERE cp."contactId" = c.id
  AND cp."partyId" IS NULL
  AND c."partyId" IS NOT NULL
  AND cp."organizationId" IS NULL
  AND cp."userId" IS NULL;

-- Report progress
SELECT
    COUNT(*) as backfilled_from_contact,
    'ContractParty rows backfilled from Contact.partyId' as description
FROM "ContractParty" AS cp
INNER JOIN "Contact" AS c ON cp."contactId" = c.id
WHERE cp."partyId" = c."partyId"
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization.partyId
UPDATE "ContractParty" AS cp
SET "partyId" = o."partyId"
FROM "Organization" AS o
WHERE cp."organizationId" = o.id
  AND cp."partyId" IS NULL
  AND o."partyId" IS NOT NULL
  AND cp."contactId" IS NULL
  AND cp."userId" IS NULL;

-- Report progress
SELECT
    COUNT(*) as backfilled_from_organization,
    'ContractParty rows backfilled from Organization.partyId' as description
FROM "ContractParty" AS cp
INNER JOIN "Organization" AS o ON cp."organizationId" = o.id
WHERE cp."partyId" = o."partyId"
  AND o."partyId" IS NOT NULL;

-- Backfill from User.partyId (if User has a linked partyId)
UPDATE "ContractParty" AS cp
SET "partyId" = u."partyId"
FROM "User" AS u
WHERE cp."userId" = u.id
  AND cp."partyId" IS NULL
  AND u."partyId" IS NOT NULL
  AND cp."contactId" IS NULL
  AND cp."organizationId" IS NULL;

-- Report progress
SELECT
    COUNT(*) as backfilled_from_user,
    'ContractParty rows backfilled from User.partyId' as description
FROM "ContractParty" AS cp
INNER JOIN "User" AS u ON cp."userId" = u.id
WHERE cp."partyId" = u."partyId"
  AND u."partyId" IS NOT NULL;

-- ============================================================================
-- Final Summary
-- ============================================================================

SELECT
    'Invoice' as model,
    COUNT(*) as total_rows,
    COUNT("clientPartyId") as with_party_id,
    COUNT(*) - COUNT("clientPartyId") as without_party_id,
    ROUND(100.0 * COUNT("clientPartyId") / NULLIF(COUNT(*), 0), 2) as percent_complete
FROM "Invoice"
UNION ALL
SELECT
    'OffspringContract' as model,
    COUNT(*) as total_rows,
    COUNT("buyerPartyId") as with_party_id,
    COUNT(*) - COUNT("buyerPartyId") as without_party_id,
    ROUND(100.0 * COUNT("buyerPartyId") / NULLIF(COUNT(*), 0), 2) as percent_complete
FROM "OffspringContract"
UNION ALL
SELECT
    'ContractParty' as model,
    COUNT(*) as total_rows,
    COUNT("partyId") as with_party_id,
    COUNT(*) - COUNT("partyId") as without_party_id,
    ROUND(100.0 * COUNT("partyId") / NULLIF(COUNT(*), 0), 2) as percent_complete
FROM "ContractParty"
ORDER BY model;
