-- ============================================================================
-- Step 6I: BreedingAttempt Post-Migration Validation
-- ============================================================================
-- Run this AFTER dropping legacy studOwnerContactId column.
-- Validates that migration completed successfully and Party-only storage works.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6I Post-Migration Validation: BreedingAttempt'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Verify legacy column removed
-- ============================================================================

\echo '1. Legacy Column Removed'
\echo '------------------------'

SELECT
    COALESCE(SUM(CASE WHEN column_name = 'studOwnerContactId' THEN 1 ELSE 0 END), 0) AS has_stud_owner_contact_id,
    COALESCE(SUM(CASE WHEN column_name = 'studOwnerPartyId' THEN 1 ELSE 0 END), 0) AS has_stud_owner_party_id
FROM information_schema.columns
WHERE table_name = 'BreedingAttempt'
  AND column_name IN ('studOwnerContactId', 'studOwnerPartyId');

\echo ''
\echo 'Expected: has_stud_owner_contact_id = 0, has_stud_owner_party_id = 1'
\echo ''

-- ============================================================================
-- 2. Current BreedingAttempt schema (stud owner-related columns)
-- ============================================================================

\echo '2. Current BreedingAttempt Schema (stud owner-related columns)'
\echo '--------------------------------------------------------------'

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'BreedingAttempt'
  AND (column_name LIKE '%studOwner%' OR column_name LIKE '%semen%')
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- 3. Indexes on studOwnerPartyId
-- ============================================================================

\echo '3. Indexes on studOwnerPartyId'
\echo '------------------------------'

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'BreedingAttempt'
  AND indexdef LIKE '%studOwnerPartyId%'
ORDER BY indexname;

\echo ''
\echo 'Expected: At least BreedingAttempt_studOwnerPartyId_idx'
\echo ''

-- ============================================================================
-- 4. Foreign key constraint on studOwnerPartyId
-- ============================================================================

\echo '4. Foreign Key Constraint on studOwnerPartyId'
\echo '----------------------------------------------'

SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    att.attname AS column_name,
    ref_tbl.relname AS referenced_table
FROM pg_constraint con
INNER JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
INNER JOIN pg_class tbl ON tbl.oid = con.conrelid
LEFT JOIN pg_class ref_tbl ON ref_tbl.oid = con.confrelid
WHERE tbl.relname = 'BreedingAttempt'
  AND att.attname = 'studOwnerPartyId'
  AND con.contype = 'f';

\echo ''
\echo 'Expected: BreedingAttempt_studOwnerPartyId_fkey with constraint_type = f (foreign key)'
\echo ''

-- ============================================================================
-- 5. Data coverage metrics
-- ============================================================================

\echo '5. Data Coverage Metrics'
\echo '------------------------'

SELECT
    COUNT(*) AS total_breeding_attempts,
    COUNT("studOwnerPartyId") AS has_stud_owner_party_id,
    COUNT(*) - COUNT("studOwnerPartyId") AS no_stud_owner,
    ROUND(100.0 * COUNT("studOwnerPartyId") / NULLIF(COUNT(*), 0), 2) AS stud_owner_pct
FROM "BreedingAttempt";

\echo ''
\echo 'Note: stud_owner_pct represents attempts with stud owners (not all attempts have stud owners)'
\echo ''

-- ============================================================================
-- 6. Check for orphaned studOwnerPartyId references
-- ============================================================================

\echo '6. Orphaned Stud Owner Party References'
\echo '----------------------------------------'

WITH orphans AS (
    SELECT ba.id, ba."studOwnerPartyId"
    FROM "BreedingAttempt" ba
    WHERE ba."studOwnerPartyId" IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM "Party" p WHERE p.id = ba."studOwnerPartyId"
      )
)
SELECT COUNT(*) AS orphaned_stud_owner_party_refs FROM orphans;

\echo ''
\echo 'Expected: orphaned_stud_owner_party_refs = 0'
\echo ''

-- ============================================================================
-- 7. Stud Owner Party type distribution
-- ============================================================================

\echo '7. Stud Owner Party Type Distribution'
\echo '--------------------------------------'

SELECT
    p.type AS stud_owner_party_type,
    COUNT(*) AS count
FROM "BreedingAttempt" ba
LEFT JOIN "Party" p ON p.id = ba."studOwnerPartyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 8. Party backing entity integrity
-- ============================================================================

\echo '8. Party Backing Entity Integrity'
\echo '----------------------------------'

WITH used_parties AS (
    SELECT DISTINCT "studOwnerPartyId" FROM "BreedingAttempt" WHERE "studOwnerPartyId" IS NOT NULL
),
orphaned_parties AS (
    SELECT p.id, p.type, p.name
    FROM "Party" p
    INNER JOIN used_parties up ON up."studOwnerPartyId" = p.id
    WHERE NOT EXISTS (SELECT 1 FROM "Contact" c WHERE c."partyId" = p.id)
      AND NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o."partyId" = p.id)
)
SELECT COUNT(*) AS parties_without_backing_entity FROM orphaned_parties;

\echo ''
\echo 'Expected: parties_without_backing_entity = 0'
\echo ''

-- ============================================================================
-- 9. Sample BreedingAttempt rows with derived legacy fields
-- ============================================================================

\echo '9. Sample BreedingAttempt Rows (with derived legacy fields)'
\echo '------------------------------------------------------------'

SELECT
    ba.id,
    ba."tenantId",
    ba."planId",
    ba.method,
    ba."studOwnerPartyId",
    p.type AS stud_owner_party_type,
    -- Derived legacy studOwnerContactId (for backward compatibility checks)
    CASE WHEN p.type = 'CONTACT' THEN c.id ELSE NULL END AS derived_stud_owner_contact_id,
    -- Derived stud owner name
    CASE
        WHEN p.type = 'CONTACT' THEN c.display_name
        WHEN p.type = 'ORGANIZATION' THEN o.name
        ELSE NULL
    END AS stud_owner_name,
    ba."attemptAt",
    ba.success
FROM "BreedingAttempt" ba
LEFT JOIN "Party" p ON p.id = ba."studOwnerPartyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE ba."studOwnerPartyId" IS NOT NULL
ORDER BY ba.id DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 10. BreedingAttempt by method distribution
-- ============================================================================

\echo '10. BreedingAttempt by Method Distribution'
\echo '-------------------------------------------'

SELECT
    method,
    COUNT(*) AS total,
    COUNT("studOwnerPartyId") AS with_stud_owner,
    COUNT(*) - COUNT("studOwnerPartyId") AS without_stud_owner
FROM "BreedingAttempt"
GROUP BY method
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 11. BreedingAttempt by success status
-- ============================================================================

\echo '11. BreedingAttempt by Success Status'
\echo '--------------------------------------'

SELECT
    success,
    COUNT(*) AS total,
    COUNT("studOwnerPartyId") AS with_stud_owner,
    COUNT(*) - COUNT("studOwnerPartyId") AS without_stud_owner
FROM "BreedingAttempt"
GROUP BY success
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 12. Recent BreedingAttempts with stud owners
-- ============================================================================

\echo '12. Recent BreedingAttempts with Stud Owners'
\echo '---------------------------------------------'

SELECT
    ba.id,
    ba."planId",
    ba.method,
    ba."attemptAt",
    ba.success,
    p.name AS stud_owner_name,
    p.type AS stud_owner_type
FROM "BreedingAttempt" ba
INNER JOIN "Party" p ON p.id = ba."studOwnerPartyId"
ORDER BY ba."createdAt" DESC
LIMIT 10;

\echo ''
\echo '======================================================================'
\echo 'Post-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'SUCCESS CRITERIA:'
\echo '  ✓ has_stud_owner_contact_id = 0'
\echo '  ✓ has_stud_owner_party_id = 1'
\echo '  ✓ Index exists: BreedingAttempt_studOwnerPartyId_idx'
\echo '  ✓ FK constraint: BreedingAttempt_studOwnerPartyId_fkey'
\echo '  ✓ orphaned_stud_owner_party_refs = 0'
\echo '  ✓ parties_without_backing_entity = 0'
\echo ''
\echo 'If all checks pass, BreedingAttempt is now using Party-only for stud owner references.'
\echo ''
