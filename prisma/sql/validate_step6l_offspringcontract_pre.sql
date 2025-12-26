-- ============================================================================
-- Step 6L: OffspringContract Pre-Migration Validation
-- ============================================================================
-- Run this BEFORE dropping legacy buyerContactId and buyerOrganizationId
-- columns.
-- Validates that buyerPartyId is fully populated and data is safe to migrate.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6L Pre-Migration Validation: OffspringContract'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Check buyerPartyId coverage for contracts with buyer fields
-- ============================================================================

\echo '1. OffspringContract buyerPartyId Coverage'
\echo '------------------------------------------'

SELECT
    COUNT(*) AS total_contracts,
    COUNT(CASE WHEN "buyerContactId" IS NOT NULL OR "buyerOrganizationId" IS NOT NULL THEN 1 END) AS has_legacy_buyer,
    COUNT("buyerPartyId") AS has_buyer_party_id,
    COUNT(CASE WHEN ("buyerContactId" IS NOT NULL OR "buyerOrganizationId" IS NOT NULL) AND "buyerPartyId" IS NULL THEN 1 END) AS missing_buyer_party_id,
    ROUND(100.0 * COUNT("buyerPartyId") / NULLIF(COUNT(CASE WHEN "buyerContactId" IS NOT NULL OR "buyerOrganizationId" IS NOT NULL THEN 1 END), 0), 2) AS coverage_pct
FROM "OffspringContract";

\echo ''
\echo 'Expected: missing_buyer_party_id = 0 (100% coverage for contracts with legacy buyer)'
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
        title,
        "buyerContactId",
        "buyerOrganizationId"
    FROM "OffspringContract"
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
        title,
        "buyerContactId",
        "buyerOrganizationId",
        "buyerPartyId"
    FROM "OffspringContract"
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
    SELECT oc.id, oc."buyerPartyId"
    FROM "OffspringContract" oc
    WHERE oc."buyerPartyId" IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM "Party" p WHERE p.id = oc."buyerPartyId"
      )
)
SELECT COUNT(*) AS orphaned_buyer_party_refs FROM orphans;

\echo ''
\echo 'Expected: orphaned_buyer_party_refs = 0'
\echo 'If > 0: Fix Party data integrity before proceeding'
\echo ''

-- ============================================================================
-- 4. Verify Party backing entities (every Party must have Contact or Organization)
-- ============================================================================

\echo '4. Party Backing Entity Integrity'
\echo '----------------------------------'

WITH used_parties AS (
    SELECT DISTINCT "buyerPartyId" FROM "OffspringContract" WHERE "buyerPartyId" IS NOT NULL
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
-- 5. Legacy column status check
-- ============================================================================

\echo '5. Legacy Column Status'
\echo '------------------------'

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'OffspringContract'
  AND column_name IN ('buyerContactId', 'buyerOrganizationId', 'buyerPartyId')
ORDER BY column_name;

\echo ''
\echo 'Expected: All buyer columns exist (before migration)'
\echo ''

-- ============================================================================
-- 6. OffspringContract status distribution
-- ============================================================================

\echo '6. OffspringContract Status Distribution'
\echo '-----------------------------------------'

SELECT
    status,
    COUNT(*) AS total,
    COUNT("buyerPartyId") AS has_buyer,
    COUNT(*) - COUNT("buyerPartyId") AS no_buyer
FROM "OffspringContract"
GROUP BY status
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 7. Sample OffspringContract rows with buyer resolution
-- ============================================================================

\echo '7. Sample OffspringContract Rows (with Buyer Party details)'
\echo '------------------------------------------------------------'

SELECT
    oc.id,
    oc."tenantId",
    oc.title,
    oc.status,
    oc."buyerPartyId",
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
    oc."signedAt"
FROM "OffspringContract" oc
LEFT JOIN "Party" p ON p.id = oc."buyerPartyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE oc."buyerPartyId" IS NOT NULL
ORDER BY oc.id DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 8. OffspringContracts by offspring with buyers
-- ============================================================================

\echo '8. OffspringContracts by Offspring'
\echo '-----------------------------------'

SELECT
    oc."offspringId",
    COUNT(*) AS contract_count,
    COUNT("buyerPartyId") AS with_buyer,
    COUNT(*) - COUNT("buyerPartyId") AS without_buyer
FROM "OffspringContract" oc
GROUP BY oc."offspringId"
HAVING COUNT(*) > 1
ORDER BY contract_count DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 9. Buyer Party type distribution
-- ============================================================================

\echo '9. Buyer Party Type Distribution'
\echo '---------------------------------'

SELECT
    p.type AS buyer_type,
    COUNT(*) AS count
FROM "OffspringContract" oc
INNER JOIN "Party" p ON p.id = oc."buyerPartyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 10. E-signature provider distribution
-- ============================================================================

\echo '10. E-signature Provider Distribution'
\echo '--------------------------------------'

SELECT
    provider,
    COUNT(*) AS count,
    COUNT("buyerPartyId") AS with_buyer
FROM "OffspringContract"
GROUP BY provider
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
\echo '  - parties_without_backing_entity = 0'
\echo ''
\echo 'Then proceed with dropping legacy columns via migration.sql'
\echo ''
