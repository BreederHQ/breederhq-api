-- ============================================================================
-- Step 6M: User Pre-Migration Validation
-- ============================================================================
-- Run this BEFORE dropping legacy contactId column.
-- Validates that partyId is fully populated and data is safe to migrate.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6M Pre-Migration Validation: User'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Check partyId coverage for users with contactId
-- ============================================================================

\echo '1. User partyId Coverage'
\echo '------------------------'

SELECT
    COUNT(*) AS total_users,
    COUNT("contactId") AS has_contact_id,
    COUNT("partyId") AS has_party_id,
    COUNT(CASE WHEN "contactId" IS NOT NULL AND "partyId" IS NULL THEN 1 END) AS missing_party_id,
    ROUND(100.0 * COUNT("partyId") / NULLIF(COUNT("contactId"), 0), 2) AS coverage_pct
FROM "User";

\echo ''
\echo 'Expected: missing_party_id = 0 (100% coverage for users with legacy contactId)'
\echo 'If missing_party_id > 0: Run backfill before dropping legacy column'
\echo ''

-- ============================================================================
-- 2. Check for orphaned partyId references
-- ============================================================================

\echo '2. Orphaned Party References'
\echo '-----------------------------'

WITH orphans AS (
    SELECT u.id, u."partyId"
    FROM "User" u
    WHERE u."partyId" IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM "Party" p WHERE p.id = u."partyId"
      )
)
SELECT COUNT(*) AS orphaned_party_refs FROM orphans;

\echo ''
\echo 'Expected: orphaned_party_refs = 0'
\echo 'If > 0: Fix Party data integrity before proceeding'
\echo ''

-- ============================================================================
-- 3. Verify Party backing entities (every Party must have Contact)
-- ============================================================================

\echo '3. Party Backing Entity Integrity'
\echo '----------------------------------'

WITH used_parties AS (
    SELECT DISTINCT "partyId" FROM "User" WHERE "partyId" IS NOT NULL
),
orphaned_parties AS (
    SELECT p.id, p.type, p.name
    FROM "Party" p
    INNER JOIN used_parties up ON up."partyId" = p.id
    WHERE NOT EXISTS (SELECT 1 FROM "Contact" c WHERE c."partyId" = p.id)
)
SELECT COUNT(*) AS parties_without_contact FROM orphaned_parties;

\echo ''
\echo 'Expected: parties_without_contact = 0'
\echo 'If > 0: Create backing Contact for orphaned Parties'
\echo ''

-- ============================================================================
-- 4. Verify contactId matches partyId backing Contact
-- ============================================================================

\echo '4. ContactId vs PartyId Consistency'
\echo '-----------------------------------'

WITH mismatches AS (
    SELECT
        u.id,
        u.email,
        u."contactId",
        u."partyId",
        p."contactId" AS party_contact_id
    FROM "User" u
    INNER JOIN "Party" p ON p.id = u."partyId"
    WHERE u."contactId" IS NOT NULL
      AND u."contactId" != p."contactId"
)
SELECT COUNT(*) AS contact_party_mismatch FROM mismatches;

\echo ''
\echo 'Expected: contact_party_mismatch = 0'
\echo 'If > 0: Review and fix contact/party associations'
\echo ''

SELECT * FROM (
    SELECT
        u.id,
        u.email,
        u."contactId",
        u."partyId",
        p."contactId" AS party_contact_id
    FROM "User" u
    INNER JOIN "Party" p ON p.id = u."partyId"
    WHERE u."contactId" IS NOT NULL
      AND u."contactId" != p."contactId"
) mismatches
LIMIT 10;

\echo ''

-- ============================================================================
-- 5. Legacy column status check
-- ============================================================================

\echo '5. Legacy Column Status'
\echo '------------------------'

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'User'
  AND column_name IN ('contactId', 'partyId')
ORDER BY column_name;

\echo ''
\echo 'Expected: Both contactId and partyId columns exist (before migration)'
\echo ''

-- ============================================================================
-- 6. User distribution by contact/party status
-- ============================================================================

\echo '6. User Contact/Party Status Distribution'
\echo '------------------------------------------'

SELECT
    COUNT(*) AS total_users,
    COUNT("contactId") AS has_contact_id,
    COUNT("partyId") AS has_party_id,
    COUNT(CASE WHEN "contactId" IS NOT NULL AND "partyId" IS NOT NULL THEN 1 END) AS has_both,
    COUNT(CASE WHEN "contactId" IS NULL AND "partyId" IS NULL THEN 1 END) AS has_neither
FROM "User";

\echo ''

-- ============================================================================
-- 7. Sample User rows with Party resolution
-- ============================================================================

\echo '7. Sample User Rows (with Party details)'
\echo '-----------------------------------------'

SELECT
    u.id,
    u.email,
    u.name,
    u."contactId",
    u."partyId",
    p.type AS party_type,
    p.name AS party_name,
    c.id AS resolved_contact_id,
    c.display_name AS contact_name
FROM "User" u
LEFT JOIN "Party" p ON p.id = u."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
WHERE u."partyId" IS NOT NULL
ORDER BY u.id DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 8. Users with contact but no party
-- ============================================================================

\echo '8. Users with Contact but No Party'
\echo '-----------------------------------'

SELECT
    COUNT(*) AS users_with_contact_no_party
FROM "User"
WHERE "contactId" IS NOT NULL
  AND "partyId" IS NULL;

\echo ''
\echo 'Expected: users_with_contact_no_party = 0'
\echo 'If > 0: Run backfill to populate partyId'
\echo ''

-- ============================================================================
-- 9. Party type verification for User parties
-- ============================================================================

\echo '9. User Party Type Distribution'
\echo '--------------------------------'

SELECT
    p.type AS party_type,
    COUNT(*) AS count
FROM "User" u
INNER JOIN "Party" p ON p.id = u."partyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''
\echo 'Expected: All User parties should be type CONTACT'
\echo ''

-- ============================================================================
-- 10. Indexes on contactId
-- ============================================================================

\echo '10. Indexes on User.contactId'
\echo '------------------------------'

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'User'
  AND indexdef LIKE '%contactId%'
ORDER BY indexname;

\echo ''
\echo 'Expected: User_contactId_key unique index exists'
\echo ''

\echo '======================================================================'
\echo 'Pre-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'Review all checks above. If all validations pass:'
\echo '  - missing_party_id = 0'
\echo '  - orphaned_party_refs = 0'
\echo '  - parties_without_contact = 0'
\echo '  - contact_party_mismatch = 0'
\echo '  - users_with_contact_no_party = 0'
\echo ''
\echo 'Then proceed with dropping legacy column via migration.sql'
\echo ''
