-- ============================================================================
-- Step 6F: PlanParty Post-Migration Validation
-- ============================================================================
-- Run this AFTER dropping legacy contactId and organizationId columns.
-- Validates that migration completed successfully and Party-only storage works.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6F Post-Migration Validation: PlanParty'
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
    COALESCE(SUM(CASE WHEN column_name = 'partyId' THEN 1 ELSE 0 END), 0) AS has_party_id
FROM information_schema.columns
WHERE table_name = 'PlanParty'
  AND column_name IN ('contactId', 'organizationId', 'partyId');

\echo ''
\echo 'Expected: has_contact_id = 0, has_organization_id = 0, has_party_id = 1'
\echo ''

-- ============================================================================
-- 2. Current PlanParty schema
-- ============================================================================

\echo '2. Current PlanParty Schema'
\echo '---------------------------'

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'PlanParty'
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
WHERE tablename = 'PlanParty'
  AND indexdef LIKE '%partyId%'
ORDER BY indexname;

\echo ''
\echo 'Expected: At least 2 indexes:'
\echo '  - PlanParty_partyId_idx'
\echo '  - PlanParty_tenantId_partyId_role_idx'
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
WHERE tbl.relname = 'PlanParty'
  AND att.attname = 'partyId'
  AND con.contype = 'f';

\echo ''
\echo 'Expected: PlanParty_partyId_fkey with constraint_type = f (foreign key)'
\echo ''

-- ============================================================================
-- 5. Data coverage metrics
-- ============================================================================

\echo '5. Data Coverage Metrics'
\echo '------------------------'

SELECT
    COUNT(*) AS total_plan_parties,
    COUNT("partyId") AS has_party_id,
    COUNT(*) - COUNT("partyId") AS missing_party_id,
    ROUND(100.0 * COUNT("partyId") / NULLIF(COUNT(*), 0), 2) AS coverage_pct
FROM "PlanParty";

\echo ''
\echo 'Expected: coverage_pct should be high (ideally 100%)'
\echo ''

-- ============================================================================
-- 6. Check for orphaned Party references
-- ============================================================================

\echo '6. Orphaned Party References'
\echo '-----------------------------'

WITH orphans AS (
    SELECT pp.id, pp."partyId"
    FROM "PlanParty" pp
    WHERE pp."partyId" IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM "Party" p WHERE p.id = pp."partyId"
      )
)
SELECT COUNT(*) AS orphaned_party_refs FROM orphans;

\echo ''
\echo 'Expected: orphaned_party_refs = 0'
\echo ''

-- ============================================================================
-- 7. Party type distribution
-- ============================================================================

\echo '7. Party Type Distribution'
\echo '--------------------------'

SELECT
    p.type AS party_type,
    COUNT(*) AS count
FROM "PlanParty" pp
LEFT JOIN "Party" p ON p.id = pp."partyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 8. Party backing entity integrity
-- ============================================================================

\echo '8. Party Backing Entity Integrity'
\echo '----------------------------------'

WITH used_parties AS (
    SELECT DISTINCT "partyId" FROM "PlanParty" WHERE "partyId" IS NOT NULL
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
-- 9. Sample PlanParty rows with derived legacy fields
-- ============================================================================

\echo '9. Sample PlanParty Rows (with derived legacy fields)'
\echo '------------------------------------------------------'

SELECT
    pp.id,
    pp."tenantId",
    pp."planId",
    pp.role,
    pp."partyId",
    p.type AS party_type,
    -- Derived legacy contactId (for backward compatibility checks)
    CASE WHEN p.type = 'CONTACT' THEN c.id ELSE NULL END AS derived_contact_id,
    -- Derived legacy organizationId (for backward compatibility checks)
    CASE WHEN p.type = 'ORGANIZATION' THEN o.id ELSE NULL END AS derived_organization_id,
    -- Derived party name
    CASE
        WHEN p.type = 'CONTACT' THEN c.display_name
        WHEN p.type = 'ORGANIZATION' THEN o.name
        ELSE NULL
    END AS party_name
FROM "PlanParty" pp
LEFT JOIN "Party" p ON p.id = pp."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
ORDER BY pp.id DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 10. Role distribution
-- ============================================================================

\echo '10. Role Distribution'
\echo '---------------------'

SELECT
    role,
    COUNT(*) AS count
FROM "PlanParty"
GROUP BY role
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 11. PlanParty per BreedingPlan
-- ============================================================================

\echo '11. PlanParty Count per BreedingPlan (Top 10)'
\echo '----------------------------------------------'

SELECT
    "planId",
    COUNT(*) AS party_count
FROM "PlanParty"
GROUP BY "planId"
ORDER BY party_count DESC, "planId" DESC
LIMIT 10;

\echo ''
\echo '======================================================================'
\echo 'Post-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'SUCCESS CRITERIA:'
\echo '  ✓ has_contact_id = 0'
\echo '  ✓ has_organization_id = 0'
\echo '  ✓ has_party_id = 1'
\echo '  ✓ Indexes exist: PlanParty_partyId_idx, PlanParty_tenantId_partyId_role_idx'
\echo '  ✓ FK constraint: PlanParty_partyId_fkey'
\echo '  ✓ coverage_pct high (ideally 100%)'
\echo '  ✓ orphaned_party_refs = 0'
\echo '  ✓ parties_without_backing_entity = 0'
\echo ''
\echo 'If all checks pass, PlanParty is now Party-only and legacy columns removed.'
\echo ''
