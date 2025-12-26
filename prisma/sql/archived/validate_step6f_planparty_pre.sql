-- ============================================================================
-- Step 6F: PlanParty Pre-Migration Validation
-- ============================================================================
-- Run this BEFORE dropping legacy contactId and organizationId columns.
-- Validates that partyId is fully populated and data is safe to migrate.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6F Pre-Migration Validation: PlanParty'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Check partyId coverage
-- ============================================================================

\echo '1. PlanParty partyId Coverage'
\echo '------------------------------'

SELECT
    COUNT(*) AS total_plan_parties,
    COUNT("partyId") AS has_party_id,
    COUNT(*) - COUNT("partyId") AS missing_party_id,
    ROUND(100.0 * COUNT("partyId") / NULLIF(COUNT(*), 0), 2) AS coverage_pct
FROM "PlanParty";

\echo ''
\echo 'Expected: missing_party_id = 0 (100% coverage)'
\echo 'If missing_party_id > 0: Run backfill before dropping legacy columns'
\echo ''

-- ============================================================================
-- 2. Check for dual assignment conflicts (both contactId and organizationId set)
-- ============================================================================

\echo '2. Dual Assignment Conflicts'
\echo '-----------------------------'

WITH conflicts AS (
    SELECT
        id,
        "tenantId",
        "planId",
        role,
        "contactId",
        "organizationId"
    FROM "PlanParty"
    WHERE "contactId" IS NOT NULL
      AND "organizationId" IS NOT NULL
)
SELECT COUNT(*) AS conflicting_entries FROM conflicts;

\echo ''
\echo 'Expected: conflicting_entries = 0'
\echo 'If > 0: Review conflicts and determine precedence (typically organizationId wins)'
\echo ''

SELECT * FROM (
    SELECT
        id,
        "tenantId",
        "planId",
        role,
        "contactId",
        "organizationId",
        "partyId"
    FROM "PlanParty"
    WHERE "contactId" IS NOT NULL
      AND "organizationId" IS NOT NULL
) conflicts
LIMIT 10;

\echo ''

-- ============================================================================
-- 3. Check for orphaned Party references
-- ============================================================================

\echo '3. Orphaned Party References'
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
\echo 'If > 0: Fix Party data integrity before proceeding'
\echo ''

-- ============================================================================
-- 4. Verify Party backing entities (every Party must have Contact or Organization)
-- ============================================================================

\echo '4. Party Backing Entity Integrity'
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
\echo 'If > 0: Create backing Contact or Organization for orphaned Parties'
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
WHERE table_name = 'PlanParty'
  AND column_name IN ('contactId', 'organizationId', 'partyId')
ORDER BY column_name;

\echo ''
\echo 'Expected: contactId and organizationId columns exist (before migration)'
\echo ''

-- ============================================================================
-- 6. Sample PlanParty rows with party resolution
-- ============================================================================

\echo '6. Sample PlanParty Rows (with Party details)'
\echo '----------------------------------------------'

SELECT
    pp.id,
    pp."tenantId",
    pp."planId",
    pp.role,
    pp."partyId",
    p.type AS party_type,
    p.name AS party_name,
    CASE
        WHEN p.type = 'CONTACT' THEN c.id
        ELSE NULL
    END AS resolved_contact_id,
    CASE
        WHEN p.type = 'ORGANIZATION' THEN o.id
        ELSE NULL
    END AS resolved_organization_id
FROM "PlanParty" pp
LEFT JOIN "Party" p ON p.id = pp."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
ORDER BY pp.id DESC
LIMIT 10;

\echo ''
\echo '======================================================================'
\echo 'Pre-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'Review all checks above. If all validations pass:'
\echo '  - missing_party_id = 0'
\echo '  - conflicting_entries = 0'
\echo '  - orphaned_party_refs = 0'
\echo '  - parties_without_backing_entity = 0'
\echo ''
\echo 'Then proceed with dropping legacy columns via migration.sql'
\echo ''
