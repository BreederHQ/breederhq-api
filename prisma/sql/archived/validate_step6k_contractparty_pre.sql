-- ============================================================================
-- Step 6K: ContractParty Pre-Migration Validation
-- ============================================================================
-- Run this BEFORE dropping legacy contactId and organizationId columns.
-- Validates that partyId is fully populated and data is safe to migrate.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6K Pre-Migration Validation: ContractParty'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Check partyId coverage for contract parties with party fields
-- ============================================================================

\echo '1. ContractParty partyId Coverage'
\echo '---------------------------------'

SELECT
    COUNT(*) AS total_contract_parties,
    COUNT(CASE WHEN "contactId" IS NOT NULL OR "organizationId" IS NOT NULL THEN 1 END) AS has_legacy_party,
    COUNT("partyId") AS has_party_id,
    COUNT(CASE WHEN ("contactId" IS NOT NULL OR "organizationId" IS NOT NULL) AND "partyId" IS NULL THEN 1 END) AS missing_party_id,
    ROUND(100.0 * COUNT("partyId") / NULLIF(COUNT(CASE WHEN "contactId" IS NOT NULL OR "organizationId" IS NOT NULL THEN 1 END), 0), 2) AS coverage_pct
FROM "ContractParty";

\echo ''
\echo 'Expected: missing_party_id = 0 (100% coverage for contract parties with legacy party)'
\echo 'If missing_party_id > 0: Run backfill before dropping legacy columns'
\echo ''

-- ============================================================================
-- 2. Check for dual assignment conflicts (both contactId and organizationId set)
-- ============================================================================

\echo '2. Dual Party Assignment Conflicts'
\echo '-----------------------------------'

WITH conflicts AS (
    SELECT
        id,
        "tenantId",
        "contractId",
        "contactId",
        "organizationId",
        role
    FROM "ContractParty"
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
        "tenantId",
        "contractId",
        "contactId",
        "organizationId",
        role,
        "partyId"
    FROM "ContractParty"
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
    SELECT cp.id, cp."partyId"
    FROM "ContractParty" cp
    WHERE cp."partyId" IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM "Party" p WHERE p.id = cp."partyId"
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
    SELECT DISTINCT "partyId" FROM "ContractParty" WHERE "partyId" IS NOT NULL
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
WHERE table_name = 'ContractParty'
  AND column_name IN ('contactId', 'organizationId', 'partyId', 'userId')
ORDER BY column_name;

\echo ''
\echo 'Expected: All columns exist (before migration)'
\echo 'Note: userId should remain as it is separate from the Party system'
\echo ''

-- ============================================================================
-- 6. ContractParty status distribution
-- ============================================================================

\echo '6. ContractParty Status Distribution'
\echo '-------------------------------------'

SELECT
    status,
    COUNT(*) AS total,
    COUNT("partyId") AS has_party,
    COUNT(*) - COUNT("partyId") AS no_party
FROM "ContractParty"
GROUP BY status
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 7. ContractParty role distribution
-- ============================================================================

\echo '7. ContractParty Role Distribution'
\echo '-----------------------------------'

SELECT
    role,
    COUNT(*) AS total,
    COUNT("partyId") AS has_party,
    COUNT("userId") AS has_user
FROM "ContractParty"
GROUP BY role
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 8. Sample ContractParty rows with party resolution
-- ============================================================================

\echo '8. Sample ContractParty Rows (with Party details)'
\echo '--------------------------------------------------'

SELECT
    cp.id,
    cp."tenantId",
    cp."contractId",
    cp.role,
    cp."partyId",
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
    cp."userId",
    cp.status,
    cp.signer
FROM "ContractParty" cp
LEFT JOIN "Party" p ON p.id = cp."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE cp."partyId" IS NOT NULL
ORDER BY cp.id DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 9. ContractParties with userId (separate from Party system)
-- ============================================================================

\echo '9. ContractParties with userId'
\echo '-------------------------------'

SELECT
    COUNT(*) AS total_contract_parties,
    COUNT("userId") AS has_user_id,
    COUNT("partyId") AS has_party_id,
    COUNT(CASE WHEN "userId" IS NOT NULL AND "partyId" IS NOT NULL THEN 1 END) AS has_both,
    COUNT(CASE WHEN "userId" IS NOT NULL AND "partyId" IS NULL THEN 1 END) AS user_only,
    COUNT(CASE WHEN "userId" IS NULL AND "partyId" IS NOT NULL THEN 1 END) AS party_only
FROM "ContractParty";

\echo ''
\echo 'Note: userId is separate from Party system and should be preserved'
\echo ''

-- ============================================================================
-- 10. Party type distribution for ContractParties
-- ============================================================================

\echo '10. Party Type Distribution'
\echo '----------------------------'

SELECT
    p.type AS party_type,
    COUNT(*) AS count
FROM "ContractParty" cp
INNER JOIN "Party" p ON p.id = cp."partyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 11. ContractParties by contract status
-- ============================================================================

\echo '11. ContractParties by Contract Status'
\echo '---------------------------------------'

SELECT
    c.status AS contract_status,
    COUNT(cp.id) AS party_count,
    COUNT(cp."partyId") AS with_party,
    COUNT(cp."userId") AS with_user
FROM "ContractParty" cp
INNER JOIN "Contract" c ON c.id = cp."contractId"
GROUP BY c.status
ORDER BY party_count DESC;

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
