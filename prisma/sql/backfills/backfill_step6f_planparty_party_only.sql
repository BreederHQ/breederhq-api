-- ============================================================================
-- Step 6F: PlanParty Backfill partyId - POST-MIGRATION REPAIR TOOL
-- ============================================================================
-- PURPOSE:
--   This is a post-migration repair tool for operational recovery.
--   Use this script to backfill PlanParty.partyId from legacy contactId or
--   organizationId if data inconsistencies are discovered after migration.
--
-- SAFETY:
--   - This script is IDEMPOTENT and safe to run multiple times
--   - Only updates rows where partyId is NULL
--   - Does not modify existing partyId values
--
-- USAGE:
--   psql $DATABASE_URL -f prisma/sql/backfills/backfill_step6f_planparty_party_only.sql
--
-- NOTE:
--   This is NOT part of the validation suite (does not match validate*.sql pattern)
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6F Backfill: PlanParty partyId'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Backfill from Contact
-- ============================================================================

\echo '1. Backfilling partyId from Contact...'

UPDATE "PlanParty" pp
SET "partyId" = c."partyId"
FROM "Contact" c
WHERE pp."contactId" = c.id
  AND pp."partyId" IS NULL
  AND c."partyId" IS NOT NULL;

\echo '   Done.'
\echo ''

-- ============================================================================
-- 2. Backfill from Organization
-- ============================================================================

\echo '2. Backfilling partyId from Organization...'

UPDATE "PlanParty" pp
SET "partyId" = o."partyId"
FROM "Organization" o
WHERE pp."organizationId" = o.id
  AND pp."partyId" IS NULL
  AND o."partyId" IS NOT NULL;

\echo '   Done.'
\echo ''

-- ============================================================================
-- 3. Report remaining gaps
-- ============================================================================

\echo '3. Backfill Coverage Report'
\echo '---------------------------'

SELECT
    COUNT(*) AS total_plan_parties,
    COUNT("partyId") AS has_party_id,
    COUNT(*) - COUNT("partyId") AS still_missing_party_id,
    ROUND(100.0 * COUNT("partyId") / NULLIF(COUNT(*), 0), 2) AS coverage_pct
FROM "PlanParty";

\echo ''
\echo 'If still_missing_party_id > 0, investigate rows with NULL partyId:'
\echo ''

SELECT
    id,
    "tenantId",
    "planId",
    role,
    "contactId",
    "organizationId",
    "partyId"
FROM "PlanParty"
WHERE "partyId" IS NULL
LIMIT 20;

\echo ''
\echo '======================================================================'
\echo 'Backfill Complete'
\echo '======================================================================'
\echo ''
\echo 'If coverage_pct = 100%, safe to drop legacy columns.'
\echo 'If still_missing_party_id > 0:'
\echo '  - Check if Contact/Organization have partyId populated'
\echo '  - Or verify if legacy IDs are NULL (acceptable if party was never assigned)'
\echo ''
