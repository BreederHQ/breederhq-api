-- ============================================================================
-- Step 6H: AnimalOwner Post-Migration Validation
-- ============================================================================
-- Run this AFTER dropping legacy contactId, organizationId, and partyType
-- columns from AnimalOwner.
-- Validates that migration completed successfully and Party-only storage works.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6H Post-Migration Validation: AnimalOwner'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Verify legacy columns removed
-- ============================================================================

\echo '1. Legacy Columns Removed'
\echo '--------------------------'

SELECT
    COALESCE(SUM(CASE WHEN column_name = 'contactId' THEN 1 ELSE 0 END), 0) AS has_contact_id,
    COALESCE(SUM(CASE WHEN column_name = 'organizationId' THEN 1 ELSE 0 END), 0) AS has_organization_id,
    COALESCE(SUM(CASE WHEN column_name = 'partyType' THEN 1 ELSE 0 END), 0) AS has_party_type,
    COALESCE(SUM(CASE WHEN column_name = 'partyId' THEN 1 ELSE 0 END), 0) AS has_party_id
FROM information_schema.columns
WHERE table_name = 'AnimalOwner'
  AND column_name IN ('contactId', 'organizationId', 'partyType', 'partyId');

\echo ''
\echo 'Expected: has_contact_id = 0, has_organization_id = 0, has_party_type = 0, has_party_id = 1'
\echo ''

-- ============================================================================
-- 2. Current AnimalOwner schema (owner-related columns)
-- ============================================================================

\echo '2. Current AnimalOwner Schema'
\echo '------------------------------'

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'AnimalOwner'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- 3. Indexes on partyId
-- ============================================================================

\echo '3. Indexes on partyId'
\echo '---------------------'

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'AnimalOwner'
  AND indexdef LIKE '%partyId%'
ORDER BY indexname;

\echo ''
\echo 'Expected: At least 1 index:'
\echo '  - AnimalOwner_partyId_idx'
\echo ''

-- ============================================================================
-- 4. Foreign key constraint on partyId
-- ============================================================================

\echo '4. Foreign Key Constraint on partyId'
\echo '-------------------------------------'

SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    att.attname AS column_name,
    ref_tbl.relname AS referenced_table
FROM pg_constraint con
INNER JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
INNER JOIN pg_class tbl ON tbl.oid = con.conrelid
LEFT JOIN pg_class ref_tbl ON ref_tbl.oid = con.confrelid
WHERE tbl.relname = 'AnimalOwner'
  AND att.attname = 'partyId'
  AND con.contype = 'f';

\echo ''
\echo 'Expected: AnimalOwner_partyId_fkey with constraint_type = f (foreign key)'
\echo ''

-- ============================================================================
-- 5. Unique constraint on animalId + partyId
-- ============================================================================

\echo '5. Unique Constraint on animalId + partyId'
\echo '-------------------------------------------'

SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type
FROM pg_constraint con
INNER JOIN pg_class tbl ON tbl.oid = con.conrelid
WHERE tbl.relname = 'AnimalOwner'
  AND con.conname = 'AnimalOwner_animalId_partyId_key'
  AND con.contype = 'u';

\echo ''
\echo 'Expected: AnimalOwner_animalId_partyId_key with constraint_type = u (unique)'
\echo ''

-- ============================================================================
-- 6. Data coverage metrics
-- ============================================================================

\echo '6. Data Coverage Metrics'
\echo '------------------------'

SELECT
    COUNT(*) AS total_animal_owners,
    COUNT("partyId") AS has_party_id,
    COUNT(*) - COUNT("partyId") AS no_party_id,
    ROUND(100.0 * COUNT("partyId") / NULLIF(COUNT(*), 0), 2) AS party_pct
FROM "AnimalOwner";

\echo ''
\echo 'Expected: party_pct = 100% (all owners should have partyId)'
\echo ''

-- ============================================================================
-- 7. Check for orphaned partyId references
-- ============================================================================

\echo '7. Orphaned Party References'
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
\echo ''

-- ============================================================================
-- 8. Party type distribution
-- ============================================================================

\echo '8. Party Type Distribution'
\echo '--------------------------'

SELECT
    p.type AS party_type,
    COUNT(*) AS count
FROM "AnimalOwner" ao
LEFT JOIN "Party" p ON p.id = ao."partyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 9. Party backing entity integrity
-- ============================================================================

\echo '9. Party Backing Entity Integrity'
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
\echo ''

-- ============================================================================
-- 10. Sample AnimalOwner rows with derived legacy fields
-- ============================================================================

\echo '10. Sample AnimalOwner Rows (with derived legacy fields)'
\echo '---------------------------------------------------------'

SELECT
    ao.id,
    ao."animalId",
    a.name AS animal_name,
    ao."partyId",
    p.type AS party_type,
    -- Derived legacy contactId (for backward compatibility checks)
    CASE WHEN p.type = 'CONTACT' THEN c.id ELSE NULL END AS derived_contact_id,
    -- Derived legacy organizationId (for backward compatibility checks)
    CASE WHEN p.type = 'ORGANIZATION' THEN o.id ELSE NULL END AS derived_organization_id,
    -- Derived owner name
    CASE
        WHEN p.type = 'CONTACT' THEN c.display_name
        WHEN p.type = 'ORGANIZATION' THEN o.name
        ELSE NULL
    END AS owner_name,
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
-- 11. Animals with multiple owners
-- ============================================================================

\echo '11. Animals with Multiple Owners'
\echo '---------------------------------'

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
-- 12. Primary vs Non-Primary Owners
-- ============================================================================

\echo '12. Primary vs Non-Primary Owners'
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
-- 13. Ownership percentage distribution
-- ============================================================================

\echo '13. Ownership Percentage Distribution'
\echo '--------------------------------------'

SELECT
    percent,
    COUNT(*) AS count
FROM "AnimalOwner"
GROUP BY percent
ORDER BY percent DESC;

\echo ''

-- ============================================================================
-- 14. Animals with 100% ownership verification
-- ============================================================================

\echo '14. Animals with 100% Ownership Verification'
\echo '---------------------------------------------'

WITH ownership_totals AS (
    SELECT
        "animalId",
        SUM(percent) AS total_percent,
        COUNT(*) AS owner_count
    FROM "AnimalOwner"
    GROUP BY "animalId"
)
SELECT
    COUNT(*) AS total_animals_with_owners,
    COUNT(CASE WHEN total_percent = 100 THEN 1 END) AS animals_with_100_pct,
    COUNT(CASE WHEN total_percent < 100 THEN 1 END) AS animals_under_100_pct,
    COUNT(CASE WHEN total_percent > 100 THEN 1 END) AS animals_over_100_pct
FROM ownership_totals;

\echo ''
\echo 'Note: Some animals may have < 100% ownership (partial ownership) or > 100% (data issue)'
\echo ''

-- ============================================================================
-- 15. Verify old unique constraints removed
-- ============================================================================

\echo '15. Verify Old Unique Constraints Removed'
\echo '------------------------------------------'

SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type
FROM pg_constraint con
INNER JOIN pg_class tbl ON tbl.oid = con.conrelid
WHERE tbl.relname = 'AnimalOwner'
  AND con.contype = 'u'
  AND (
    con.conname LIKE '%contactId%' OR
    con.conname LIKE '%organizationId%' OR
    con.conname = 'AnimalOwner_animalId_partyId_key'
  );

\echo ''
\echo 'Expected: Only AnimalOwner_animalId_partyId_key should exist'
\echo 'Old constraints (animalId_contactId, animalId_organizationId) should be removed'
\echo ''

\echo ''
\echo '======================================================================'
\echo 'Post-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'SUCCESS CRITERIA:'
\echo '  ✓ has_contact_id = 0'
\echo '  ✓ has_organization_id = 0'
\echo '  ✓ has_party_type = 0'
\echo '  ✓ has_party_id = 1'
\echo '  ✓ Index exists: AnimalOwner_partyId_idx'
\echo '  ✓ FK constraint: AnimalOwner_partyId_fkey'
\echo '  ✓ Unique constraint: AnimalOwner_animalId_partyId_key'
\echo '  ✓ orphaned_party_refs = 0'
\echo '  ✓ parties_without_backing_entity = 0'
\echo '  ✓ party_pct = 100%'
\echo ''
\echo 'If all checks pass, AnimalOwner is now using Party-only for owner references.'
\echo ''
