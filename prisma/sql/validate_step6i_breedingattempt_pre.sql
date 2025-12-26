-- ============================================================================
-- Step 6I: BreedingAttempt Pre-Migration Validation
-- ============================================================================
-- Run this BEFORE dropping legacy studOwnerContactId column.
-- Validates that studOwnerPartyId is fully populated and data is safe to migrate.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6I Pre-Migration Validation: BreedingAttempt'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Check studOwnerPartyId coverage for breeding attempts with stud owner
-- ============================================================================

\echo '1. BreedingAttempt studOwnerPartyId Coverage'
\echo '---------------------------------------------'

SELECT
    COUNT(*) AS total_breeding_attempts,
    COUNT(CASE WHEN "studOwnerContactId" IS NOT NULL THEN 1 END) AS has_legacy_stud_owner,
    COUNT("studOwnerPartyId") AS has_stud_owner_party_id,
    COUNT(CASE WHEN "studOwnerContactId" IS NOT NULL AND "studOwnerPartyId" IS NULL THEN 1 END) AS missing_stud_owner_party_id,
    ROUND(100.0 * COUNT("studOwnerPartyId") / NULLIF(COUNT(CASE WHEN "studOwnerContactId" IS NOT NULL THEN 1 END), 0), 2) AS coverage_pct
FROM "BreedingAttempt";

\echo ''
\echo 'Expected: missing_stud_owner_party_id = 0 (100% coverage for attempts with legacy stud owner)'
\echo 'If missing_stud_owner_party_id > 0: Run backfill before dropping legacy column'
\echo ''

-- ============================================================================
-- 2. Check for orphaned studOwnerPartyId references
-- ============================================================================

\echo '2. Orphaned Stud Owner Party References'
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
\echo 'If > 0: Fix Party data integrity before proceeding'
\echo ''

-- ============================================================================
-- 3. Verify Party backing entities (every Party must have Contact or Organization)
-- ============================================================================

\echo '3. Party Backing Entity Integrity'
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
\echo 'If > 0: Create backing Contact or Organization for orphaned Parties'
\echo ''

-- ============================================================================
-- 4. Legacy column status check
-- ============================================================================

\echo '4. Legacy Column Status'
\echo '------------------------'

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'BreedingAttempt'
  AND column_name IN ('studOwnerContactId', 'studOwnerPartyId')
ORDER BY column_name;

\echo ''
\echo 'Expected: Both stud owner columns exist (before migration)'
\echo ''

-- ============================================================================
-- 5. BreedingAttempt stud owner status distribution
-- ============================================================================

\echo '5. BreedingAttempt Stud Owner Distribution'
\echo '-------------------------------------------'

SELECT
    COUNT(*) AS total_attempts,
    COUNT("studOwnerPartyId") AS has_stud_owner,
    COUNT(*) - COUNT("studOwnerPartyId") AS no_stud_owner,
    ROUND(100.0 * COUNT("studOwnerPartyId") / NULLIF(COUNT(*), 0), 2) AS stud_owner_pct
FROM "BreedingAttempt";

\echo ''

-- ============================================================================
-- 6. Sample BreedingAttempt rows with stud owner resolution
-- ============================================================================

\echo '6. Sample BreedingAttempt Rows (with Stud Owner Party details)'
\echo '--------------------------------------------------------------'

SELECT
    ba.id,
    ba."tenantId",
    ba."planId",
    ba.method,
    ba."studOwnerPartyId",
    p.type AS stud_owner_party_type,
    p.name AS stud_owner_party_name,
    CASE
        WHEN p.type = 'CONTACT' THEN c.id
        ELSE NULL
    END AS resolved_contact_id,
    CASE
        WHEN p.type = 'ORGANIZATION' THEN o.id
        ELSE NULL
    END AS resolved_organization_id,
    ba."attemptAt"
FROM "BreedingAttempt" ba
LEFT JOIN "Party" p ON p.id = ba."studOwnerPartyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE ba."studOwnerPartyId" IS NOT NULL
ORDER BY ba.id DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 7. Stud Owner Party type distribution
-- ============================================================================

\echo '7. Stud Owner Party Type Distribution'
\echo '--------------------------------------'

SELECT
    p.type AS stud_owner_type,
    COUNT(*) AS count
FROM "BreedingAttempt" ba
INNER JOIN "Party" p ON p.id = ba."studOwnerPartyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 8. BreedingAttempt by method with stud owner
-- ============================================================================

\echo '8. BreedingAttempt by Method with Stud Owner'
\echo '---------------------------------------------'

SELECT
    method,
    COUNT(*) AS total,
    COUNT("studOwnerPartyId") AS has_stud_owner,
    COUNT(*) - COUNT("studOwnerPartyId") AS no_stud_owner
FROM "BreedingAttempt"
GROUP BY method
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 9. BreedingAttempts with studOwnerContactId mismatch
-- ============================================================================

\echo '9. StudOwnerContactId Mismatch Check'
\echo '-------------------------------------'

WITH mismatches AS (
    SELECT
        ba.id,
        ba."studOwnerContactId" AS legacy_contact_id,
        ba."studOwnerPartyId",
        p.type AS party_type,
        c.id AS party_contact_id
    FROM "BreedingAttempt" ba
    LEFT JOIN "Party" p ON p.id = ba."studOwnerPartyId"
    LEFT JOIN "Contact" c ON c."partyId" = p.id
    WHERE ba."studOwnerContactId" IS NOT NULL
      AND ba."studOwnerPartyId" IS NOT NULL
      AND (
          p.type != 'CONTACT' OR
          c.id != ba."studOwnerContactId"
      )
)
SELECT COUNT(*) AS mismatch_count FROM mismatches;

\echo ''
\echo 'Expected: mismatch_count = 0'
\echo 'If > 0: studOwnerContactId and studOwnerPartyId point to different contacts'
\echo ''

SELECT * FROM (
    SELECT
        ba.id,
        ba."studOwnerContactId" AS legacy_contact_id,
        ba."studOwnerPartyId",
        p.type AS party_type,
        c.id AS party_contact_id
    FROM "BreedingAttempt" ba
    LEFT JOIN "Party" p ON p.id = ba."studOwnerPartyId"
    LEFT JOIN "Contact" c ON c."partyId" = p.id
    WHERE ba."studOwnerContactId" IS NOT NULL
      AND ba."studOwnerPartyId" IS NOT NULL
      AND (
          p.type != 'CONTACT' OR
          c.id != ba."studOwnerContactId"
      )
) mismatches
LIMIT 10;

\echo ''

-- ============================================================================
-- 10. BreedingAttempts by success status with stud owner
-- ============================================================================

\echo '10. BreedingAttempts by Success Status with Stud Owner'
\echo '-------------------------------------------------------'

SELECT
    success,
    COUNT(*) AS total,
    COUNT("studOwnerPartyId") AS has_stud_owner,
    COUNT(*) - COUNT("studOwnerPartyId") AS no_stud_owner
FROM "BreedingAttempt"
GROUP BY success
ORDER BY total DESC;

\echo ''
\echo '======================================================================'
\echo 'Pre-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'Review all checks above. If all validations pass:'
\echo '  - missing_stud_owner_party_id = 0'
\echo '  - orphaned_stud_owner_party_refs = 0'
\echo '  - parties_without_backing_entity = 0'
\echo '  - mismatch_count = 0'
\echo ''
\echo 'Then proceed with dropping legacy column via migration.sql'
\echo ''
