-- ============================================================================
-- Step 6M: User Post-Migration Validation
-- ============================================================================
-- Run this AFTER dropping legacy contactId column.
-- Validates that migration completed successfully and data integrity is maintained.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6M Post-Migration Validation: User'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Verify legacy columns removed
-- ============================================================================

\echo '1. Legacy Columns Removed'
\echo '-------------------------'

SELECT
    COUNT(CASE WHEN column_name = 'contactId' THEN 1 END) AS has_contact_id,
    COUNT(CASE WHEN column_name = 'partyId' THEN 1 END) AS has_party_id
FROM information_schema.columns
WHERE table_name = 'User'
  AND column_name IN ('contactId', 'partyId');

\echo ''
\echo 'Expected: has_contact_id = 0, has_party_id = 1'
\echo ''

-- ============================================================================
-- 2. Current User schema (profile-related columns)
-- ============================================================================

\echo '2. Current User Schema (Profile Columns)'
\echo '-----------------------------------------'

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'User'
  AND column_name IN ('partyId', 'phoneE164', 'whatsappE164', 'street', 'city', 'state', 'postalCode', 'country')
ORDER BY column_name;

\echo ''

-- ============================================================================
-- 3. Indexes on partyId
-- ============================================================================

\echo '3. Indexes on User.partyId'
\echo '--------------------------'

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'User'
  AND indexdef LIKE '%partyId%'
ORDER BY indexname;

\echo ''
\echo 'Expected: User_partyId_idx should exist'
\echo ''

-- ============================================================================
-- 4. Foreign Key Constraint
-- ============================================================================

\echo '4. Foreign Key Constraint on partyId'
\echo '-------------------------------------'

SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public."User"'::regclass
  AND conname = 'User_partyId_fkey';

\echo ''
\echo 'Expected: User_partyId_fkey with FOREIGN KEY constraint'
\echo ''

-- ============================================================================
-- 5. Data Coverage Metrics
-- ============================================================================

\echo '5. User Data Coverage Metrics'
\echo '------------------------------'

SELECT
    COUNT(*) AS total_users,
    COUNT("partyId") AS has_party_id,
    COUNT(*) - COUNT("partyId") AS no_party_id,
    ROUND(100.0 * COUNT("partyId") / NULLIF(COUNT(*), 0), 2) AS party_coverage_pct
FROM "User";

\echo ''
\echo 'Note: Not all users may have partyId (some users may not have contact profiles)'
\echo ''

-- ============================================================================
-- 6. Orphaned Party References
-- ============================================================================

\echo '6. Orphaned Party References'
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
\echo ''

-- ============================================================================
-- 7. User Party Type Distribution
-- ============================================================================

\echo '7. User Party Type Distribution'
\echo '--------------------------------'

SELECT
    p.type AS party_type,
    COUNT(*) AS count
FROM "User" u
INNER JOIN "Party" p ON p.id = u."partyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''
\echo 'Expected: All should be type CONTACT (users link to contact parties)'
\echo ''

-- ============================================================================
-- 8. Party Backing Entity Integrity
-- ============================================================================

\echo '8. Party Backing Entity Integrity'
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
\echo ''

-- ============================================================================
-- 9. Sample User Rows with Derived Legacy Fields
-- ============================================================================

\echo '9. Sample User Rows with Derived Legacy Fields'
\echo '-----------------------------------------------'

SELECT
    u.id,
    u.email,
    u.name,
    u."partyId",
    p.type AS party_type,
    p."contactId" AS derived_contact_id,
    c.display_name AS contact_name
FROM "User" u
LEFT JOIN "Party" p ON p.id = u."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
WHERE u."partyId" IS NOT NULL
ORDER BY u.id DESC
LIMIT 10;

\echo ''
\echo 'Note: derived_contact_id shows how to derive legacy contactId from Party'
\echo ''

-- ============================================================================
-- 10. Users by email verification status
-- ============================================================================

\echo '10. User Distribution by Verification Status'
\echo '---------------------------------------------'

SELECT
    COUNT(*) AS total,
    COUNT("emailVerifiedAt") AS verified,
    COUNT(*) - COUNT("emailVerifiedAt") AS unverified,
    COUNT("partyId") AS has_party
FROM "User";

\echo ''

-- ============================================================================
-- 11. Users with Party vs without
-- ============================================================================

\echo '11. Users with/without Party'
\echo '----------------------------'

SELECT
    CASE
        WHEN "partyId" IS NOT NULL THEN 'Has Party'
        ELSE 'No Party'
    END AS party_status,
    COUNT(*) AS user_count
FROM "User"
GROUP BY party_status
ORDER BY user_count DESC;

\echo ''

-- ============================================================================
-- 12. Verify no orphaned Contact.users references
-- ============================================================================

\echo '12. Contact Back-Reference Removed'
\echo '-----------------------------------'

SELECT
    table_name,
    column_name
FROM information_schema.columns
WHERE table_name = 'Contact'
  AND column_name = 'users';

\echo ''
\echo 'Expected: No rows (users array relation should be removed from Contact)'
\echo ''

\echo '======================================================================'
\echo 'Post-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'Review all checks above. Verify:'
\echo '  - has_contact_id = 0 (legacy column removed)'
\echo '  - has_party_id = 1 (partyId column exists)'
\echo '  - orphaned_party_refs = 0'
\echo '  - parties_without_contact = 0'
\echo '  - User_partyId_idx index exists'
\echo '  - User_partyId_fkey constraint exists'
\echo '  - All user parties are type CONTACT'
\echo ''
