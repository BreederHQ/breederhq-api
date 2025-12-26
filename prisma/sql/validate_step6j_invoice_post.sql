-- ============================================================================
-- Step 6J: Invoice Post-Migration Validation
-- ============================================================================
-- Run this AFTER dropping legacy contactId and organizationId columns.
-- Validates that migration completed successfully and Party-only storage works.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6J Post-Migration Validation: Invoice'
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
    COALESCE(SUM(CASE WHEN column_name = 'clientPartyId' THEN 1 ELSE 0 END), 0) AS has_client_party_id
FROM information_schema.columns
WHERE table_name = 'Invoice'
  AND column_name IN ('contactId', 'organizationId', 'clientPartyId');

\echo ''
\echo 'Expected: has_contact_id = 0, has_organization_id = 0, has_client_party_id = 1'
\echo ''

-- ============================================================================
-- 2. Current Invoice schema (client-related columns)
-- ============================================================================

\echo '2. Current Invoice Schema (client-related columns)'
\echo '---------------------------------------------------'

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'Invoice'
  AND (column_name LIKE '%client%' OR column_name LIKE '%contact%' OR column_name LIKE '%organization%')
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- 3. Indexes on clientPartyId
-- ============================================================================

\echo '3. Indexes on clientPartyId'
\echo '----------------------------'

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'Invoice'
  AND indexdef LIKE '%clientPartyId%'
ORDER BY indexname;

\echo ''
\echo 'Expected: At least 2 indexes:'
\echo '  - Invoice_clientPartyId_idx'
\echo '  - Invoice_tenantId_clientPartyId_idx'
\echo ''

-- ============================================================================
-- 4. Foreign key constraint on clientPartyId
-- ============================================================================

\echo '4. Foreign Key Constraint on clientPartyId'
\echo '-------------------------------------------'

SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    att.attname AS column_name,
    ref_tbl.relname AS referenced_table
FROM pg_constraint con
INNER JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
INNER JOIN pg_class tbl ON tbl.oid = con.conrelid
LEFT JOIN pg_class ref_tbl ON ref_tbl.oid = con.confrelid
WHERE tbl.relname = 'Invoice'
  AND att.attname = 'clientPartyId'
  AND con.contype = 'f';

\echo ''
\echo 'Expected: Invoice_clientPartyId_fkey with constraint_type = f (foreign key)'
\echo ''

-- ============================================================================
-- 5. Data coverage metrics
-- ============================================================================

\echo '5. Data Coverage Metrics'
\echo '------------------------'

SELECT
    COUNT(*) AS total_invoices,
    COUNT("clientPartyId") AS has_client_party_id,
    COUNT(*) - COUNT("clientPartyId") AS no_client,
    ROUND(100.0 * COUNT("clientPartyId") / NULLIF(COUNT(*), 0), 2) AS client_pct
FROM "Invoice";

\echo ''
\echo 'Note: client_pct represents invoices with clients'
\echo ''

-- ============================================================================
-- 6. Check for orphaned clientPartyId references
-- ============================================================================

\echo '6. Orphaned Client Party References'
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
\echo ''

-- ============================================================================
-- 7. Client Party type distribution
-- ============================================================================

\echo '7. Client Party Type Distribution'
\echo '----------------------------------'

SELECT
    p.type AS client_party_type,
    COUNT(*) AS count
FROM "Invoice" i
LEFT JOIN "Party" p ON p.id = i."clientPartyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 8. Party backing entity integrity
-- ============================================================================

\echo '8. Party Backing Entity Integrity'
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
\echo ''

-- ============================================================================
-- 9. Sample Invoice rows with derived legacy fields
-- ============================================================================

\echo '9. Sample Invoice Rows (with derived legacy fields)'
\echo '----------------------------------------------------'

SELECT
    i.id,
    i."tenantId",
    i.number,
    i.status,
    i.scope,
    i."clientPartyId",
    p.type AS client_party_type,
    -- Derived legacy contactId (for backward compatibility checks)
    CASE WHEN p.type = 'CONTACT' THEN c.id ELSE NULL END AS derived_contact_id,
    -- Derived legacy organizationId (for backward compatibility checks)
    CASE WHEN p.type = 'ORGANIZATION' THEN o.id ELSE NULL END AS derived_organization_id,
    -- Derived client name
    CASE
        WHEN p.type = 'CONTACT' THEN c.display_name
        WHEN p.type = 'ORGANIZATION' THEN o.name
        ELSE NULL
    END AS client_name,
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
-- 10. Invoice status distribution
-- ============================================================================

\echo '10. Invoice Status Distribution'
\echo '--------------------------------'

SELECT
    status,
    COUNT(*) AS total,
    COUNT("clientPartyId") AS with_client,
    COUNT(*) - COUNT("clientPartyId") AS without_client
FROM "Invoice"
GROUP BY status
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 11. Invoice scope distribution
-- ============================================================================

\echo '11. Invoice Scope Distribution'
\echo '-------------------------------'

SELECT
    scope,
    COUNT(*) AS total,
    COUNT("clientPartyId") AS with_client,
    COUNT(*) - COUNT("clientPartyId") AS without_client
FROM "Invoice"
GROUP BY scope
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 12. Invoice amount statistics by client type
-- ============================================================================

\echo '12. Invoice Amount Statistics by Client Type'
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

-- ============================================================================
-- 13. Invoices with payments
-- ============================================================================

\echo '13. Invoices with Payments'
\echo '---------------------------'

SELECT
    COUNT(DISTINCT i.id) AS invoices_with_payments,
    COUNT(i."clientPartyId") AS with_client,
    SUM(p."amountCents") AS total_payment_amount_cents
FROM "Invoice" i
INNER JOIN "Payment" p ON p."invoiceId" = i.id;

\echo ''
\echo '======================================================================'
\echo 'Post-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'SUCCESS CRITERIA:'
\echo '  ✓ has_contact_id = 0'
\echo '  ✓ has_organization_id = 0'
\echo '  ✓ has_client_party_id = 1'
\echo '  ✓ Indexes exist: Invoice_clientPartyId_idx, Invoice_tenantId_clientPartyId_idx'
\echo '  ✓ FK constraint: Invoice_clientPartyId_fkey'
\echo '  ✓ orphaned_client_party_refs = 0'
\echo '  ✓ parties_without_backing_entity = 0'
\echo ''
\echo 'If all checks pass, Invoice is now using Party-only for client references.'
\echo ''
