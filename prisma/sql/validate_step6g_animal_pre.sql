-- ============================================================================
-- Step 6G: Animal Pre-Migration Validation
-- ============================================================================
-- Run this BEFORE dropping legacy buyerContactId, buyerOrganizationId, and
-- buyerPartyType columns.
-- Validates that buyerPartyId is fully populated and data is safe to migrate.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6G Pre-Migration Validation: Animal'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Check buyerPartyId coverage for animals with buyer fields
-- ============================================================================

\echo '1. Animal buyerPartyId Coverage'
\echo '--------------------------------'

SELECT
    COUNT(*) AS total_animals,
    COUNT(CASE WHEN "buyerContactId" IS NOT NULL OR "buyerOrganizationId" IS NOT NULL THEN 1 END) AS has_legacy_buyer,
    COUNT("buyerPartyId") AS has_buyer_party_id,
    COUNT(CASE WHEN ("buyerContactId" IS NOT NULL OR "buyerOrganizationId" IS NOT NULL) AND "buyerPartyId" IS NULL THEN 1 END) AS missing_buyer_party_id,
    ROUND(100.0 * COUNT("buyerPartyId") / NULLIF(COUNT(CASE WHEN "buyerContactId" IS NOT NULL OR "buyerOrganizationId" IS NOT NULL THEN 1 END), 0), 2) AS coverage_pct
FROM "Animal";

\echo ''
\echo 'Expected: missing_buyer_party_id = 0 (100% coverage for animals with legacy buyer)'
\echo 'If missing_buyer_party_id > 0: Run backfill before dropping legacy columns'
\echo ''

-- ============================================================================
-- 2. Check for dual assignment conflicts (both buyerContactId and buyerOrganizationId set)
-- ============================================================================

\echo '2. Dual Buyer Assignment Conflicts'
\echo '-----------------------------------'

WITH conflicts AS (
    SELECT
        id,
        "tenantId",
        name,
        "buyerContactId",
        "buyerOrganizationId",
        "buyerPartyType"
    FROM "Animal"
    WHERE "buyerContactId" IS NOT NULL
      AND "buyerOrganizationId" IS NOT NULL
)
SELECT COUNT(*) AS conflicting_entries FROM conflicts;

\echo ''
\echo 'Expected: conflicting_entries = 0'
\echo 'If > 0: Review conflicts and determine precedence'
\echo ''

SELECT * FROM (
    SELECT
        id,
        "tenantId",
        name,
        "buyerContactId",
        "buyerOrganizationId",
        "buyerPartyType",
        "buyerPartyId"
    FROM "Animal"
    WHERE "buyerContactId" IS NOT NULL
      AND "buyerOrganizationId" IS NOT NULL
) conflicts
LIMIT 10;

\echo ''

-- ============================================================================
-- 3. Check for orphaned buyerPartyId references
-- ============================================================================

\echo '3. Orphaned Buyer Party References'
\echo '-----------------------------------'

WITH orphans AS (
    SELECT a.id, a."buyerPartyId"
    FROM "Animal" a
    WHERE a."buyerPartyId" IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM "Party" p WHERE p.id = a."buyerPartyId"
      )
)
SELECT COUNT(*) AS orphaned_buyer_party_refs FROM orphans;

\echo ''
\echo 'Expected: orphaned_buyer_party_refs = 0'
\echo 'If > 0: Fix Party data integrity before proceeding'
\echo ''

-- ============================================================================
-- 4. Check for buyerPartyType mismatch with actual Party type
-- ============================================================================

\echo '4. Buyer Party Type Mismatch'
\echo '-----------------------------'

WITH type_mismatches AS (
    SELECT
        a.id,
        a.name,
        a."buyerPartyType",
        p.type AS actual_party_type
    FROM "Animal" a
    INNER JOIN "Party" p ON p.id = a."buyerPartyId"
    WHERE a."buyerPartyType" IS NOT NULL
      AND a."buyerPartyType"::text != p.type::text
)
SELECT COUNT(*) AS type_mismatch_count FROM type_mismatches;

\echo ''
\echo 'Expected: type_mismatch_count = 0'
\echo 'If > 0: Review and fix Party type assignments'
\echo ''

SELECT * FROM (
    SELECT
        a.id,
        a.name,
        a."buyerPartyType",
        p.type AS actual_party_type
    FROM "Animal" a
    INNER JOIN "Party" p ON p.id = a."buyerPartyId"
    WHERE a."buyerPartyType" IS NOT NULL
      AND a."buyerPartyType"::text != p.type::text
) mismatches
LIMIT 10;

\echo ''

-- ============================================================================
-- 5. Verify Party backing entities (every Party must have Contact or Organization)
-- ============================================================================

\echo '5. Party Backing Entity Integrity'
\echo '----------------------------------'

WITH used_parties AS (
    SELECT DISTINCT "buyerPartyId" FROM "Animal" WHERE "buyerPartyId" IS NOT NULL
),
orphaned_parties AS (
    SELECT p.id, p.type, p.name
    FROM "Party" p
    INNER JOIN used_parties up ON up."buyerPartyId" = p.id
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
WHERE table_name = 'Animal'
  AND column_name IN ('buyerContactId', 'buyerOrganizationId', 'buyerPartyType', 'buyerPartyId')
ORDER BY column_name;

\echo ''
\echo 'Expected: All buyer columns exist (before migration)'
\echo ''

-- ============================================================================
-- 7. Animal buyer status distribution
-- ============================================================================

\echo '7. Animal Buyer Status Distribution'
\echo '------------------------------------'

SELECT
    status,
    COUNT(*) AS total,
    COUNT("buyerPartyId") AS has_buyer,
    COUNT(*) - COUNT("buyerPartyId") AS no_buyer
FROM "Animal"
GROUP BY status
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 8. Sample Animal rows with buyer resolution
-- ============================================================================

\echo '8. Sample Animal Rows (with Buyer Party details)'
\echo '-------------------------------------------------'

SELECT
    a.id,
    a."tenantId",
    a.name,
    a.status,
    a."buyerPartyId",
    p.type AS buyer_party_type,
    p.name AS buyer_party_name,
    CASE
        WHEN p.type = 'CONTACT' THEN c.id
        ELSE NULL
    END AS resolved_contact_id,
    CASE
        WHEN p.type = 'ORGANIZATION' THEN o.id
        ELSE NULL
    END AS resolved_organization_id,
    a."priceCents",
    a."placedAt"
FROM "Animal" a
LEFT JOIN "Party" p ON p.id = a."buyerPartyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE a."buyerPartyId" IS NOT NULL
ORDER BY a.id DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 9. Animals with sale data but no buyer
-- ============================================================================

\echo '9. Animals with Sale Data but No Buyer Party'
\echo '---------------------------------------------'

SELECT
    COUNT(*) AS animals_with_sale_no_buyer
FROM "Animal"
WHERE "buyerPartyId" IS NULL
  AND (
    "priceCents" IS NOT NULL OR
    "depositCents" IS NOT NULL OR
    "placedAt" IS NOT NULL OR
    "paidInFullAt" IS NOT NULL
  );

\echo ''
\echo 'Note: Some animals may have sale data without buyer (e.g., planned sales)'
\echo ''

-- ============================================================================
-- 10. Buyer Party type distribution
-- ============================================================================

\echo '10. Buyer Party Type Distribution'
\echo '----------------------------------'

SELECT
    p.type AS buyer_type,
    COUNT(*) AS count
FROM "Animal" a
INNER JOIN "Party" p ON p.id = a."buyerPartyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''
\echo '======================================================================'
\echo 'Pre-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'Review all checks above. If all validations pass:'
\echo '  - missing_buyer_party_id = 0'
\echo '  - conflicting_entries = 0'
\echo '  - orphaned_buyer_party_refs = 0'
\echo '  - type_mismatch_count = 0'
\echo '  - parties_without_backing_entity = 0'
\echo ''
\echo 'Then proceed with dropping legacy columns via migration.sql'
\echo ''
