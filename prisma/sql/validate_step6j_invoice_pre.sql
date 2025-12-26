-- ============================================================================
-- Step 6J: Invoice Pre-Migration Validation
-- ============================================================================
-- Run this BEFORE dropping legacy contactId and organizationId columns.
-- Validates that clientPartyId is fully populated and data is safe to migrate.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6J Pre-Migration Validation: Invoice'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Check clientPartyId coverage for invoices with client fields
-- ============================================================================

\echo '1. Invoice clientPartyId Coverage'
\echo '----------------------------------'

SELECT
    COUNT(*) AS total_invoices,
    COUNT(CASE WHEN "contactId" IS NOT NULL OR "organizationId" IS NOT NULL THEN 1 END) AS has_legacy_client,
    COUNT("clientPartyId") AS has_client_party_id,
    COUNT(CASE WHEN ("contactId" IS NOT NULL OR "organizationId" IS NOT NULL) AND "clientPartyId" IS NULL THEN 1 END) AS missing_client_party_id,
    ROUND(100.0 * COUNT("clientPartyId") / NULLIF(COUNT(CASE WHEN "contactId" IS NOT NULL OR "organizationId" IS NOT NULL THEN 1 END), 0), 2) AS coverage_pct
FROM "Invoice";

\echo ''
\echo 'Expected: missing_client_party_id = 0 (100% coverage for invoices with legacy client)'
\echo 'If missing_client_party_id > 0: Run backfill before dropping legacy columns'
\echo ''

-- ============================================================================
-- 2. Check for dual assignment conflicts (both contactId and organizationId set)
-- ============================================================================

\echo '2. Dual Client Assignment Conflicts'
\echo '------------------------------------'

WITH conflicts AS (
    SELECT
        id,
        "tenantId",
        number,
        "contactId",
        "organizationId"
    FROM "Invoice"
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
        number,
        scope,
        status,
        "contactId",
        "organizationId",
        "clientPartyId"
    FROM "Invoice"
    WHERE "contactId" IS NOT NULL
      AND "organizationId" IS NOT NULL
) conflicts
LIMIT 10;

\echo ''

-- ============================================================================
-- 3. Check for orphaned clientPartyId references
-- ============================================================================

\echo '3. Orphaned Client Party References'
\echo '------------------------------------'

WITH orphans AS (
    SELECT i.id, i."clientPartyId"
    FROM "Invoice" i
    WHERE i."clientPartyId" IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM "Party" p WHERE p.id = i."clientPartyId"
      )
)
SELECT COUNT(*) AS orphaned_client_party_refs FROM orphans;

\echo ''
\echo 'Expected: orphaned_client_party_refs = 0'
\echo 'If > 0: Fix Party data integrity before proceeding'
\echo ''

-- ============================================================================
-- 4. Verify Party backing entities (every Party must have Contact or Organization)
-- ============================================================================

\echo '4. Party Backing Entity Integrity'
\echo '----------------------------------'

WITH used_parties AS (
    SELECT DISTINCT "clientPartyId" FROM "Invoice" WHERE "clientPartyId" IS NOT NULL
),
orphaned_parties AS (
    SELECT p.id, p.type, p.name
    FROM "Party" p
    INNER JOIN used_parties up ON up."clientPartyId" = p.id
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
WHERE table_name = 'Invoice'
  AND column_name IN ('contactId', 'organizationId', 'clientPartyId')
ORDER BY column_name;

\echo ''
\echo 'Expected: All client columns exist (before migration)'
\echo ''

-- ============================================================================
-- 6. Invoice client status distribution
-- ============================================================================

\echo '6. Invoice Client Status Distribution'
\echo '--------------------------------------'

SELECT
    status,
    COUNT(*) AS total,
    COUNT("clientPartyId") AS has_client,
    COUNT(*) - COUNT("clientPartyId") AS no_client
FROM "Invoice"
GROUP BY status
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 7. Sample Invoice rows with client resolution
-- ============================================================================

\echo '7. Sample Invoice Rows (with Client Party details)'
\echo '---------------------------------------------------'

SELECT
    i.id,
    i."tenantId",
    i.number,
    i.status,
    i.scope,
    i."clientPartyId",
    p.type AS client_party_type,
    p.name AS client_party_name,
    CASE
        WHEN p.type = 'CONTACT' THEN c.id
        ELSE NULL
    END AS resolved_contact_id,
    CASE
        WHEN p.type = 'ORGANIZATION' THEN o.id
        ELSE NULL
    END AS resolved_organization_id,
    i."amountCents",
    i."balanceCents"
FROM "Invoice" i
LEFT JOIN "Party" p ON p.id = i."clientPartyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE i."clientPartyId" IS NOT NULL
ORDER BY i.id DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 8. Invoices by scope with clients
-- ============================================================================

\echo '8. Invoices by Scope'
\echo '--------------------'

SELECT
    scope,
    COUNT(*) AS total,
    COUNT("clientPartyId") AS has_client,
    COUNT(*) - COUNT("clientPartyId") AS no_client
FROM "Invoice"
GROUP BY scope
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 9. Client Party type distribution
-- ============================================================================

\echo '9. Client Party Type Distribution'
\echo '----------------------------------'

SELECT
    p.type AS client_type,
    COUNT(*) AS count
FROM "Invoice" i
INNER JOIN "Party" p ON p.id = i."clientPartyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 10. Invoice amount statistics by client type
-- ============================================================================

\echo '10. Invoice Amount Statistics by Client Type'
\echo '---------------------------------------------'

SELECT
    p.type AS client_type,
    COUNT(*) AS invoice_count,
    SUM(i."amountCents") AS total_amount_cents,
    AVG(i."amountCents") AS avg_amount_cents,
    SUM(i."balanceCents") AS total_balance_cents
FROM "Invoice" i
INNER JOIN "Party" p ON p.id = i."clientPartyId"
GROUP BY p.type
ORDER BY invoice_count DESC;

\echo ''
\echo '======================================================================'
\echo 'Pre-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'Review all checks above. If all validations pass:'
\echo '  - missing_client_party_id = 0'
\echo '  - conflicting_entries = 0'
\echo '  - orphaned_client_party_refs = 0'
\echo '  - parties_without_backing_entity = 0'
\echo ''
\echo 'Then proceed with dropping legacy columns via migration.sql'
\echo ''
