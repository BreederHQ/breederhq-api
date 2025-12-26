-- ============================================================================
-- Party Migration Step 5: Finance Domain - Validation Queries
-- ============================================================================
-- Purpose: Validate schema objects, backfill completeness, and data integrity
-- Models: Invoice, OffspringContract, ContractParty
--
-- Run this script manually in pgAdmin or PowerShell after backfill.
-- ============================================================================

\echo '=========================================='
\echo 'PARTY MIGRATION STEP 5: FINANCE VALIDATION'
\echo '=========================================='
\echo ''

-- ============================================================================
-- 1. COLUMN EXISTENCE CHECKS
-- ============================================================================

\echo '1. COLUMN EXISTENCE CHECKS'
\echo '--------------------------'

SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('Invoice', 'OffspringContract', 'ContractParty')
  AND column_name IN ('clientPartyId', 'buyerPartyId', 'partyId')
ORDER BY table_name, column_name;

\echo ''

-- ============================================================================
-- 2. FOREIGN KEY CONSTRAINT CHECKS
-- ============================================================================

\echo '2. FOREIGN KEY CONSTRAINT CHECKS'
\echo '--------------------------------'

SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('Invoice', 'OffspringContract', 'ContractParty')
  AND kcu.column_name IN ('clientPartyId', 'buyerPartyId', 'partyId')
ORDER BY tc.table_name, kcu.column_name;

\echo ''

-- ============================================================================
-- 3. INDEX EXISTENCE CHECKS
-- ============================================================================

\echo '3. INDEX EXISTENCE CHECKS'
\echo '------------------------'

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('Invoice', 'OffspringContract', 'ContractParty')
  AND (
    indexname LIKE '%PartyId%' OR
    indexname LIKE '%partyId%'
  )
ORDER BY tablename, indexname;

\echo ''

-- ============================================================================
-- 4. BACKFILL COMPLETENESS METRICS
-- ============================================================================

\echo '4. BACKFILL COMPLETENESS METRICS'
\echo '--------------------------------'

-- Invoice backfill completeness
SELECT
    'Invoice' as model,
    'clientPartyId' as party_column,
    COUNT(*) as total_rows,
    COUNT("clientPartyId") as with_party_id,
    COUNT(*) - COUNT("clientPartyId") as without_party_id,
    ROUND(100.0 * COUNT("clientPartyId") / NULLIF(COUNT(*), 0), 2) as percent_complete,
    COUNT(CASE WHEN "contactId" IS NOT NULL AND "clientPartyId" IS NULL THEN 1 END) as contact_not_backfilled,
    COUNT(CASE WHEN "organizationId" IS NOT NULL AND "clientPartyId" IS NULL THEN 1 END) as org_not_backfilled,
    COUNT(CASE WHEN "contactId" IS NOT NULL AND "organizationId" IS NOT NULL THEN 1 END) as conflict_rows
FROM "Invoice";

-- OffspringContract backfill completeness
SELECT
    'OffspringContract' as model,
    'buyerPartyId' as party_column,
    COUNT(*) as total_rows,
    COUNT("buyerPartyId") as with_party_id,
    COUNT(*) - COUNT("buyerPartyId") as without_party_id,
    ROUND(100.0 * COUNT("buyerPartyId") / NULLIF(COUNT(*), 0), 2) as percent_complete,
    COUNT(CASE WHEN "buyerContactId" IS NOT NULL AND "buyerPartyId" IS NULL THEN 1 END) as contact_not_backfilled,
    COUNT(CASE WHEN "buyerOrganizationId" IS NOT NULL AND "buyerPartyId" IS NULL THEN 1 END) as org_not_backfilled,
    COUNT(CASE WHEN "buyerContactId" IS NOT NULL AND "buyerOrganizationId" IS NOT NULL THEN 1 END) as conflict_rows
FROM "OffspringContract";

-- ContractParty backfill completeness
SELECT
    'ContractParty' as model,
    'partyId' as party_column,
    COUNT(*) as total_rows,
    COUNT("partyId") as with_party_id,
    COUNT(*) - COUNT("partyId") as without_party_id,
    ROUND(100.0 * COUNT("partyId") / NULLIF(COUNT(*), 0), 2) as percent_complete,
    COUNT(CASE WHEN "contactId" IS NOT NULL AND "partyId" IS NULL THEN 1 END) as contact_not_backfilled,
    COUNT(CASE WHEN "organizationId" IS NOT NULL AND "partyId" IS NULL THEN 1 END) as org_not_backfilled,
    COUNT(CASE WHEN "userId" IS NOT NULL AND "partyId" IS NULL THEN 1 END) as user_not_backfilled,
    COUNT(CASE WHEN
        ("contactId" IS NOT NULL AND "organizationId" IS NOT NULL) OR
        ("contactId" IS NOT NULL AND "userId" IS NOT NULL) OR
        ("organizationId" IS NOT NULL AND "userId" IS NOT NULL)
    THEN 1 END) as conflict_rows
FROM "ContractParty";

\echo ''

-- ============================================================================
-- 5. ORPHAN DETECTION (partyId set but Party row missing)
-- ============================================================================

\echo '5. ORPHAN DETECTION'
\echo '-------------------'

-- Invoice orphans
SELECT
    'Invoice' as model,
    COUNT(*) as orphan_count,
    'Rows with clientPartyId but Party does not exist' as description
FROM "Invoice" AS inv
WHERE inv."clientPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" AS p WHERE p.id = inv."clientPartyId"
  );

-- OffspringContract orphans
SELECT
    'OffspringContract' as model,
    COUNT(*) as orphan_count,
    'Rows with buyerPartyId but Party does not exist' as description
FROM "OffspringContract" AS oc
WHERE oc."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" AS p WHERE p.id = oc."buyerPartyId"
  );

-- ContractParty orphans
SELECT
    'ContractParty' as model,
    COUNT(*) as orphan_count,
    'Rows with partyId but Party does not exist' as description
FROM "ContractParty" AS cp
WHERE cp."partyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" AS p WHERE p.id = cp."partyId"
  );

\echo ''

-- ============================================================================
-- 6. TYPE CONSISTENCY CHECKS
-- ============================================================================

\echo '6. TYPE CONSISTENCY CHECKS'
\echo '-------------------------'

-- Invoice: Check that clientPartyId points to Party with correct type
SELECT
    'Invoice via Contact' as check_type,
    COUNT(*) as inconsistent_count,
    'Invoice.clientPartyId points to Party but type is not CONTACT' as description
FROM "Invoice" AS inv
INNER JOIN "Party" AS p ON inv."clientPartyId" = p.id
WHERE inv."contactId" IS NOT NULL
  AND p.type != 'CONTACT';

SELECT
    'Invoice via Organization' as check_type,
    COUNT(*) as inconsistent_count,
    'Invoice.clientPartyId points to Party but type is not ORGANIZATION' as description
FROM "Invoice" AS inv
INNER JOIN "Party" AS p ON inv."clientPartyId" = p.id
WHERE inv."organizationId" IS NOT NULL
  AND p.type != 'ORGANIZATION';

-- OffspringContract: Check type consistency
SELECT
    'OffspringContract via Contact' as check_type,
    COUNT(*) as inconsistent_count,
    'OffspringContract.buyerPartyId points to Party but type is not CONTACT' as description
FROM "OffspringContract" AS oc
INNER JOIN "Party" AS p ON oc."buyerPartyId" = p.id
WHERE oc."buyerContactId" IS NOT NULL
  AND p.type != 'CONTACT';

SELECT
    'OffspringContract via Organization' as check_type,
    COUNT(*) as inconsistent_count,
    'OffspringContract.buyerPartyId points to Party but type is not ORGANIZATION' as description
FROM "OffspringContract" AS oc
INNER JOIN "Party" AS p ON oc."buyerPartyId" = p.id
WHERE oc."buyerOrganizationId" IS NOT NULL
  AND p.type != 'ORGANIZATION';

-- ContractParty: Check type consistency
SELECT
    'ContractParty via Contact' as check_type,
    COUNT(*) as inconsistent_count,
    'ContractParty.partyId points to Party but type is not CONTACT' as description
FROM "ContractParty" AS cp
INNER JOIN "Party" AS p ON cp."partyId" = p.id
WHERE cp."contactId" IS NOT NULL
  AND p.type != 'CONTACT';

SELECT
    'ContractParty via Organization' as check_type,
    COUNT(*) as inconsistent_count,
    'ContractParty.partyId points to Party but type is not ORGANIZATION' as description
FROM "ContractParty" AS cp
INNER JOIN "Party" AS p ON cp."partyId" = p.id
WHERE cp."organizationId" IS NOT NULL
  AND p.type != 'ORGANIZATION';

\echo ''

-- ============================================================================
-- 7. LEGACY COLUMN INTEGRITY (ensure legacy columns still have data)
-- ============================================================================

\echo '7. LEGACY COLUMN INTEGRITY'
\echo '-------------------------'

-- Invoice: Ensure legacy columns are preserved
SELECT
    'Invoice' as model,
    COUNT(*) as total_with_party_id,
    COUNT("contactId") as with_contact_id,
    COUNT("organizationId") as with_org_id,
    'Legacy columns should be preserved when partyId is set' as note
FROM "Invoice"
WHERE "clientPartyId" IS NOT NULL;

-- OffspringContract: Ensure legacy columns are preserved
SELECT
    'OffspringContract' as model,
    COUNT(*) as total_with_party_id,
    COUNT("buyerContactId") as with_contact_id,
    COUNT("buyerOrganizationId") as with_org_id,
    'Legacy columns should be preserved when partyId is set' as note
FROM "OffspringContract"
WHERE "buyerPartyId" IS NOT NULL;

-- ContractParty: Ensure legacy columns are preserved
SELECT
    'ContractParty' as model,
    COUNT(*) as total_with_party_id,
    COUNT("contactId") as with_contact_id,
    COUNT("organizationId") as with_org_id,
    COUNT("userId") as with_user_id,
    'Legacy columns should be preserved when partyId is set' as note
FROM "ContractParty"
WHERE "partyId" IS NOT NULL;

\echo ''
\echo '=========================================='
\echo 'VALIDATION COMPLETE'
\echo '=========================================='
