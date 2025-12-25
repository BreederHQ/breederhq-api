-- ============================================================================
-- Party Migration Step 5: Validation Queries for Offspring and Waitlist
-- ============================================================================
-- This script validates the Party migration for WaitlistEntry, OffspringGroupBuyer,
-- and Offspring models.
--
-- Run this manually in pgAdmin or psql to verify migration completeness.
--
-- Usage:
--   psql -h <host> -U <user> -d <database> -f validate_party_step5_offspring_waitlist.sql
-- ============================================================================

\echo '======================================================================'
\echo 'Party Migration Step 5 Validation: Offspring and Waitlist'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Schema Validation
-- ============================================================================

\echo '--- 1. Schema Validation ---'
\echo ''

-- Check columns exist
\echo 'Checking columns exist:'
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('WaitlistEntry', 'OffspringGroupBuyer', 'Offspring')
  AND column_name IN ('clientPartyId', 'buyerPartyId')
ORDER BY table_name, column_name;

\echo ''

-- Check indexes exist
\echo 'Checking indexes exist:'
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('WaitlistEntry', 'OffspringGroupBuyer', 'Offspring')
  AND indexname LIKE '%PartyId%'
ORDER BY tablename, indexname;

\echo ''

-- Check foreign keys exist
\echo 'Checking foreign keys exist:'
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('WaitlistEntry', 'OffspringGroupBuyer', 'Offspring')
  AND kcu.column_name IN ('clientPartyId', 'buyerPartyId')
ORDER BY tc.table_name, tc.constraint_name;

\echo ''
\echo ''

-- ============================================================================
-- 2. WaitlistEntry Completeness
-- ============================================================================

\echo '--- 2. WaitlistEntry Completeness ---'
\echo ''

-- Overall metrics
\echo 'Overall WaitlistEntry metrics:'
SELECT
  COUNT(*) AS total_entries,
  COUNT("clientPartyId") AS entries_with_party,
  COUNT(*) - COUNT("clientPartyId") AS entries_without_party,
  ROUND(100.0 * COUNT("clientPartyId") / NULLIF(COUNT(*), 0), 2) AS pct_with_party
FROM "WaitlistEntry";

\echo ''

-- Entries with contactId but no partyId
\echo 'Entries with contactId but no clientPartyId:'
SELECT COUNT(*) AS count_contact_no_party
FROM "WaitlistEntry"
WHERE "contactId" IS NOT NULL
  AND "clientPartyId" IS NULL;

\echo ''

-- Entries with organizationId but no partyId
\echo 'Entries with organizationId but no clientPartyId:'
SELECT COUNT(*) AS count_org_no_party
FROM "WaitlistEntry"
WHERE "organizationId" IS NOT NULL
  AND "clientPartyId" IS NULL;

\echo ''

-- Conflict detection: both contactId and organizationId set
\echo 'Conflict: entries with BOTH contactId and organizationId:'
SELECT COUNT(*) AS conflict_count
FROM "WaitlistEntry"
WHERE "contactId" IS NOT NULL
  AND "organizationId" IS NOT NULL;

\echo ''

-- Orphan partyId references
\echo 'Orphan clientPartyId (no matching Party):'
SELECT COUNT(*) AS orphan_count
FROM "WaitlistEntry" w
WHERE w."clientPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = w."clientPartyId"
  );

\echo ''

-- Type consistency: partyId matches partyType
\echo 'Type consistency check (clientPartyId matches Contact or Organization type):'
SELECT
  COUNT(*) AS total_with_party,
  SUM(CASE
    WHEN w."contactId" IS NOT NULL AND p.type = 'CONTACT' THEN 1
    WHEN w."organizationId" IS NOT NULL AND p.type = 'ORGANIZATION' THEN 1
    ELSE 0
  END) AS type_matches,
  COUNT(*) - SUM(CASE
    WHEN w."contactId" IS NOT NULL AND p.type = 'CONTACT' THEN 1
    WHEN w."organizationId" IS NOT NULL AND p.type = 'ORGANIZATION' THEN 1
    ELSE 0
  END) AS type_mismatches
FROM "WaitlistEntry" w
INNER JOIN "Party" p ON w."clientPartyId" = p.id;

\echo ''
\echo ''

-- ============================================================================
-- 3. OffspringGroupBuyer Completeness
-- ============================================================================

\echo '--- 3. OffspringGroupBuyer Completeness ---'
\echo ''

-- Overall metrics
\echo 'Overall OffspringGroupBuyer metrics:'
SELECT
  COUNT(*) AS total_buyers,
  COUNT("buyerPartyId") AS buyers_with_party,
  COUNT(*) - COUNT("buyerPartyId") AS buyers_without_party,
  ROUND(100.0 * COUNT("buyerPartyId") / NULLIF(COUNT(*), 0), 2) AS pct_with_party
FROM "OffspringGroupBuyer";

\echo ''

-- Buyers with contactId but no partyId
\echo 'Buyers with contactId but no buyerPartyId:'
SELECT COUNT(*) AS count_contact_no_party
FROM "OffspringGroupBuyer"
WHERE "contactId" IS NOT NULL
  AND "buyerPartyId" IS NULL;

\echo ''

-- Buyers with organizationId but no partyId
\echo 'Buyers with organizationId but no buyerPartyId:'
SELECT COUNT(*) AS count_org_no_party
FROM "OffspringGroupBuyer"
WHERE "organizationId" IS NOT NULL
  AND "buyerPartyId" IS NULL;

\echo ''

-- Conflict detection
\echo 'Conflict: buyers with BOTH contactId and organizationId:'
SELECT COUNT(*) AS conflict_count
FROM "OffspringGroupBuyer"
WHERE "contactId" IS NOT NULL
  AND "organizationId" IS NOT NULL;

\echo ''

-- Orphan partyId references
\echo 'Orphan buyerPartyId (no matching Party):'
SELECT COUNT(*) AS orphan_count
FROM "OffspringGroupBuyer" ogb
WHERE ogb."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = ogb."buyerPartyId"
  );

\echo ''

-- Type consistency
\echo 'Type consistency check (buyerPartyId matches Contact or Organization type):'
SELECT
  COUNT(*) AS total_with_party,
  SUM(CASE
    WHEN ogb."contactId" IS NOT NULL AND p.type = 'CONTACT' THEN 1
    WHEN ogb."organizationId" IS NOT NULL AND p.type = 'ORGANIZATION' THEN 1
    ELSE 0
  END) AS type_matches,
  COUNT(*) - SUM(CASE
    WHEN ogb."contactId" IS NOT NULL AND p.type = 'CONTACT' THEN 1
    WHEN ogb."organizationId" IS NOT NULL AND p.type = 'ORGANIZATION' THEN 1
    ELSE 0
  END) AS type_mismatches
FROM "OffspringGroupBuyer" ogb
INNER JOIN "Party" p ON ogb."buyerPartyId" = p.id;

\echo ''
\echo ''

-- ============================================================================
-- 4. Offspring Completeness
-- ============================================================================

\echo '--- 4. Offspring Completeness ---'
\echo ''

-- Overall metrics
\echo 'Overall Offspring metrics:'
SELECT
  COUNT(*) AS total_offspring,
  COUNT("buyerPartyId") AS offspring_with_party,
  COUNT(*) - COUNT("buyerPartyId") AS offspring_without_party,
  ROUND(100.0 * COUNT("buyerPartyId") / NULLIF(COUNT(*), 0), 2) AS pct_with_party
FROM "Offspring";

\echo ''

-- Offspring with buyerContactId but no partyId
\echo 'Offspring with buyerContactId but no buyerPartyId:'
SELECT COUNT(*) AS count_contact_no_party
FROM "Offspring"
WHERE "buyerContactId" IS NOT NULL
  AND "buyerPartyId" IS NULL;

\echo ''

-- Offspring with buyerOrganizationId but no partyId
\echo 'Offspring with buyerOrganizationId but no buyerPartyId:'
SELECT COUNT(*) AS count_org_no_party
FROM "Offspring"
WHERE "buyerOrganizationId" IS NOT NULL
  AND "buyerPartyId" IS NULL;

\echo ''

-- Conflict detection
\echo 'Conflict: offspring with BOTH buyerContactId and buyerOrganizationId:'
SELECT COUNT(*) AS conflict_count
FROM "Offspring"
WHERE "buyerContactId" IS NOT NULL
  AND "buyerOrganizationId" IS NOT NULL;

\echo ''

-- Orphan partyId references
\echo 'Orphan buyerPartyId (no matching Party):'
SELECT COUNT(*) AS orphan_count
FROM "Offspring" off
WHERE off."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = off."buyerPartyId"
  );

\echo ''

-- Type consistency
\echo 'Type consistency check (buyerPartyId matches Contact or Organization type):'
SELECT
  COUNT(*) AS total_with_party,
  SUM(CASE
    WHEN off."buyerContactId" IS NOT NULL AND p.type = 'CONTACT' THEN 1
    WHEN off."buyerOrganizationId" IS NOT NULL AND p.type = 'ORGANIZATION' THEN 1
    ELSE 0
  END) AS type_matches,
  COUNT(*) - SUM(CASE
    WHEN off."buyerContactId" IS NOT NULL AND p.type = 'CONTACT' THEN 1
    WHEN off."buyerOrganizationId" IS NOT NULL AND p.type = 'ORGANIZATION' THEN 1
    ELSE 0
  END) AS type_mismatches
FROM "Offspring" off
INNER JOIN "Party" p ON off."buyerPartyId" = p.id;

\echo ''
\echo ''

-- ============================================================================
-- Summary
-- ============================================================================

\echo '======================================================================'
\echo 'Validation Complete'
\echo ''
\echo 'Review the output above:'
\echo '  - Schema validation: columns, indexes, and FKs should all exist'
\echo '  - Completeness: check percentage of records with partyId populated'
\echo '  - Conflicts: rows with both contactId and organizationId need review'
\echo '  - Orphans: partyId references with no matching Party record'
\echo '  - Type consistency: partyId should match Contact or Organization type'
\echo '======================================================================'
