-- ============================================================================
-- Step 6H: AnimalOwner Pre-Migration Validation
-- ============================================================================
-- Run this BEFORE dropping legacy contactId, organizationId, and partyType
-- columns from AnimalOwner.
-- Validates that partyId is fully populated and data is safe to migrate.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6H Pre-Migration Validation: AnimalOwner'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Check partyId coverage for animal owners with legacy fields
-- ============================================================================

\echo '1. AnimalOwner partyId Coverage'
\echo '--------------------------------'

SELECT
    COUNT(*) AS total_animal_owners,
    COUNT(CASE WHEN "contactId" IS NOT NULL OR "organizationId" IS NOT NULL THEN 1 END) AS has_legacy_owner,
    COUNT("partyId") AS has_party_id,
    COUNT(CASE WHEN ("contactId" IS NOT NULL OR "organizationId" IS NOT NULL) AND "partyId" IS NULL THEN 1 END) AS missing_party_id,
    ROUND(100.0 * COUNT("partyId") / NULLIF(COUNT(CASE WHEN "contactId" IS NOT NULL OR "organizationId" IS NOT NULL THEN 1 END), 0), 2) AS coverage_pct
FROM "AnimalOwner";

\echo ''
\echo 'Expected: missing_party_id = 0 (100% coverage for owners with legacy fields)'
\echo 'If missing_party_id > 0: Run backfill before dropping legacy columns'
\echo ''

-- ============================================================================
-- 2. Check for dual assignment conflicts (both contactId and organizationId set)
-- ============================================================================

\echo '2. Dual Owner Assignment Conflicts'
\echo '-----------------------------------'

WITH conflicts AS (
    SELECT
        id,
        "animalId",
        "contactId",
        "organizationId",
        "partyType"
    FROM "AnimalOwner"
    WHERE "contactId" IS NOT NULL
      AND "organizationId" IS NOT NULL
)
SELECT COUNT(*) AS conflicting_entries FROM conflicts;

\echo ''
\echo 'Expected: conflicting_entries = 0'
\echo 'If > 0: Review conflicts and determine precedence'
\echo ''

SELECT * FROM (
    SELECT
        id,
        "animalId",
        "contactId",
        "organizationId",
        "partyType",
        "partyId"
    FROM "AnimalOwner"
    WHERE "contactId" IS NOT NULL
      AND "organizationId" IS NOT NULL
) conflicts
LIMIT 10;

\echo ''

-- ============================================================================
-- 3. Check for orphaned partyId references
-- ============================================================================

\echo '3. Orphaned Party References'
\echo '-----------------------------'

WITH orphans AS (
    SELECT ao.id, ao."partyId"
    FROM "AnimalOwner" ao
    WHERE ao."partyId" IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM "Party" p WHERE p.id = ao."partyId"
      )
)
SELECT COUNT(*) AS orphaned_party_refs FROM orphans;

\echo ''
\echo 'Expected: orphaned_party_refs = 0'
\echo 'If > 0: Fix Party data integrity before proceeding'
\echo ''

-- ============================================================================
-- 4. Check for partyType mismatch with actual Party type
-- ============================================================================

\echo '4. Party Type Mismatch'
\echo '----------------------'

WITH type_mismatches AS (
    SELECT
        ao.id,
        ao."animalId",
        ao."partyType",
        p.type AS actual_party_type
    FROM "AnimalOwner" ao
    INNER JOIN "Party" p ON p.id = ao."partyId"
    WHERE ao."partyType" IS NOT NULL
      AND ao."partyType"::text != p.type::text
)
SELECT COUNT(*) AS type_mismatch_count FROM type_mismatches;

\echo ''
\echo 'Expected: type_mismatch_count = 0'
\echo 'If > 0: Review and fix Party type assignments'
\echo ''

SELECT * FROM (
    SELECT
        ao.id,
        ao."animalId",
        ao."partyType",
        p.type AS actual_party_type
    FROM "AnimalOwner" ao
    INNER JOIN "Party" p ON p.id = ao."partyId"
    WHERE ao."partyType" IS NOT NULL
      AND ao."partyType"::text != p.type::text
) mismatches
LIMIT 10;

\echo ''

-- ============================================================================
-- 5. Verify Party backing entities (every Party must have Contact or Organization)
-- ============================================================================

\echo '5. Party Backing Entity Integrity'
\echo '----------------------------------'

WITH used_parties AS (
    SELECT DISTINCT "partyId" FROM "AnimalOwner" WHERE "partyId" IS NOT NULL
),
orphaned_parties AS (
    SELECT p.id, p.type, p.name
    FROM "Party" p
    INNER JOIN used_parties up ON up."partyId" = p.id
    WHERE NOT EXISTS (SELECT 1 FROM "Contact" c WHERE c."partyId" = p.id)
      AND NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o."partyId" = p.id)
)
SELECT COUNT(*) AS parties_without_backing_entity FROM orphaned_parties;

\echo ''
\echo 'Expected: parties_without_backing_entity = 0'
\echo 'If > 0: Create backing Contact or Organization for orphaned Parties'
\echo ''

-- ============================================================================
-- 6. Legacy column status check
-- ============================================================================

\echo '6. Legacy Column Status'
\echo '------------------------'

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'AnimalOwner'
  AND column_name IN ('contactId', 'organizationId', 'partyType', 'partyId')
ORDER BY column_name;

\echo ''
\echo 'Expected: All owner columns exist (before migration)'
\echo ''

-- ============================================================================
-- 7. AnimalOwner distribution by owner type
-- ============================================================================

\echo '7. AnimalOwner Distribution by Type'
\echo '------------------------------------'

SELECT
    "partyType",
    COUNT(*) AS total,
    COUNT("partyId") AS has_party_id,
    COUNT(*) - COUNT("partyId") AS no_party_id
FROM "AnimalOwner"
GROUP BY "partyType"
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 8. Sample AnimalOwner rows with Party resolution
-- ============================================================================

\echo '8. Sample AnimalOwner Rows (with Party details)'
\echo '------------------------------------------------'

SELECT
    ao.id,
    ao."animalId",
    a.name AS animal_name,
    ao."partyId",
    p.type AS party_type,
    p.name AS party_name,
    CASE
        WHEN p.type = 'CONTACT' THEN c.id
        ELSE NULL
    END AS resolved_contact_id,
    CASE
        WHEN p.type = 'ORGANIZATION' THEN o.id
        ELSE NULL
    END AS resolved_organization_id,
    ao.percent,
    ao."isPrimary"
FROM "AnimalOwner" ao
LEFT JOIN "Animal" a ON a.id = ao."animalId"
LEFT JOIN "Party" p ON p.id = ao."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE ao."partyId" IS NOT NULL
ORDER BY ao.id DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 9. Animals with multiple owners
-- ============================================================================

\echo '9. Animals with Multiple Owners'
\echo '--------------------------------'

SELECT
    COUNT(DISTINCT "animalId") AS animals_with_owners,
    COUNT(*) AS total_ownership_records,
    ROUND(AVG(owner_count), 2) AS avg_owners_per_animal,
    MAX(owner_count) AS max_owners_per_animal
FROM (
    SELECT "animalId", COUNT(*) AS owner_count
    FROM "AnimalOwner"
    GROUP BY "animalId"
) animal_owner_counts;

\echo ''

-- ============================================================================
-- 10. Party type distribution for animal owners
-- ============================================================================

\echo '10. Party Type Distribution'
\echo '----------------------------'

SELECT
    p.type AS party_type,
    COUNT(*) AS count
FROM "AnimalOwner" ao
INNER JOIN "Party" p ON p.id = ao."partyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 11. Primary vs Non-Primary Owners
-- ============================================================================

\echo '11. Primary vs Non-Primary Owners'
\echo '----------------------------------'

SELECT
    "isPrimary",
    COUNT(*) AS count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM "AnimalOwner"
GROUP BY "isPrimary"
ORDER BY "isPrimary" DESC;

\echo ''

-- ============================================================================
-- 12. Unique constraint validation
-- ============================================================================

\echo '12. Check for Duplicate animalId + partyId Combinations'
\echo '--------------------------------------------------------'

WITH duplicates AS (
    SELECT "animalId", "partyId", COUNT(*) AS dup_count
    FROM "AnimalOwner"
    WHERE "partyId" IS NOT NULL
    GROUP BY "animalId", "partyId"
    HAVING COUNT(*) > 1
)
SELECT COUNT(*) AS duplicate_combinations FROM duplicates;

\echo ''
\echo 'Expected: duplicate_combinations = 0'
\echo 'If > 0: Multiple AnimalOwner records exist with same animalId + partyId'
\echo ''

SELECT * FROM (
    SELECT ao.*
    FROM "AnimalOwner" ao
    INNER JOIN (
        SELECT "animalId", "partyId"
        FROM "AnimalOwner"
        WHERE "partyId" IS NOT NULL
        GROUP BY "animalId", "partyId"
        HAVING COUNT(*) > 1
    ) dups ON dups."animalId" = ao."animalId" AND dups."partyId" = ao."partyId"
    ORDER BY ao."animalId", ao."partyId", ao.id
) duplicate_rows
LIMIT 20;

\echo ''
\echo '======================================================================'
\echo 'Pre-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'Review all checks above. If all validations pass:'
\echo '  - missing_party_id = 0'
\echo '  - conflicting_entries = 0'
\echo '  - orphaned_party_refs = 0'
\echo '  - type_mismatch_count = 0'
\echo '  - parties_without_backing_entity = 0'
\echo '  - duplicate_combinations = 0'
\echo ''
\echo 'Then proceed with dropping legacy columns via migration.sql'
\echo ''
