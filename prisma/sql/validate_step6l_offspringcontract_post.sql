-- ============================================================================
-- Step 6L: OffspringContract Post-Migration Validation
-- ============================================================================
-- Run this AFTER dropping legacy buyerContactId and buyerOrganizationId
-- columns.
-- Validates that migration completed successfully and Party-only storage works.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6L Post-Migration Validation: OffspringContract'
\echo '======================================================================'
\echo ''

-- ============================================================================
-- 1. Verify legacy columns removed
-- ============================================================================

\echo '1. Legacy Columns Removed'
\echo '--------------------------'

SELECT
    COALESCE(SUM(CASE WHEN column_name = 'buyerContactId' THEN 1 ELSE 0 END), 0) AS has_buyer_contact_id,
    COALESCE(SUM(CASE WHEN column_name = 'buyerOrganizationId' THEN 1 ELSE 0 END), 0) AS has_buyer_organization_id,
    COALESCE(SUM(CASE WHEN column_name = 'buyerPartyId' THEN 1 ELSE 0 END), 0) AS has_buyer_party_id
FROM information_schema.columns
WHERE table_name = 'OffspringContract'
  AND column_name IN ('buyerContactId', 'buyerOrganizationId', 'buyerPartyId');

\echo ''
\echo 'Expected: has_buyer_contact_id = 0, has_buyer_organization_id = 0, has_buyer_party_id = 1'
\echo ''

-- ============================================================================
-- 2. Current OffspringContract schema (buyer-related columns)
-- ============================================================================

\echo '2. Current OffspringContract Schema (buyer-related columns)'
\echo '------------------------------------------------------------'

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'OffspringContract'
  AND (column_name LIKE '%buyer%' OR column_name LIKE '%Party%')
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- 3. Indexes on buyerPartyId
-- ============================================================================

\echo '3. Indexes on buyerPartyId'
\echo '--------------------------'

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'OffspringContract'
  AND indexdef LIKE '%buyerPartyId%'
ORDER BY indexname;

\echo ''
\echo 'Expected: At least 2 indexes:'
\echo '  - OffspringContract_buyerPartyId_idx'
\echo '  - OffspringContract_tenantId_buyerPartyId_idx'
\echo ''

-- ============================================================================
-- 4. Foreign key constraint on buyerPartyId
-- ============================================================================

\echo '4. Foreign Key Constraint on buyerPartyId'
\echo '------------------------------------------'

SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    att.attname AS column_name,
    ref_tbl.relname AS referenced_table
FROM pg_constraint con
INNER JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
INNER JOIN pg_class tbl ON tbl.oid = con.conrelid
LEFT JOIN pg_class ref_tbl ON ref_tbl.oid = con.confrelid
WHERE tbl.relname = 'OffspringContract'
  AND att.attname = 'buyerPartyId'
  AND con.contype = 'f';

\echo ''
\echo 'Expected: OffspringContract_buyerPartyId_fkey with constraint_type = f (foreign key)'
\echo ''

-- ============================================================================
-- 5. Data coverage metrics
-- ============================================================================

\echo '5. Data Coverage Metrics'
\echo '------------------------'

SELECT
    COUNT(*) AS total_contracts,
    COUNT("buyerPartyId") AS has_buyer_party_id,
    COUNT(*) - COUNT("buyerPartyId") AS no_buyer,
    ROUND(100.0 * COUNT("buyerPartyId") / NULLIF(COUNT(*), 0), 2) AS buyer_pct
FROM "OffspringContract";

\echo ''
\echo 'Note: buyer_pct represents contracts with buyers (not all contracts have buyers)'
\echo ''

-- ============================================================================
-- 6. Check for orphaned buyerPartyId references
-- ============================================================================

\echo '6. Orphaned Buyer Party References'
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
\echo ''

-- ============================================================================
-- 7. Buyer Party type distribution
-- ============================================================================

\echo '7. Buyer Party Type Distribution'
\echo '---------------------------------'

SELECT
    p.type AS buyer_party_type,
    COUNT(*) AS count
FROM "OffspringContract" oc
LEFT JOIN "Party" p ON p.id = oc."buyerPartyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 8. Party backing entity integrity
-- ============================================================================

\echo '8. Party Backing Entity Integrity'
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
\echo ''

-- ============================================================================
-- 9. Sample OffspringContract rows with derived legacy fields
-- ============================================================================

\echo '9. Sample OffspringContract Rows (with derived legacy fields)'
\echo '--------------------------------------------------------------'

SELECT
    oc.id,
    oc."tenantId",
    oc.title,
    oc.status,
    oc."buyerPartyId",
    p.type AS buyer_party_type,
    -- Derived legacy buyerContactId (for backward compatibility checks)
    CASE WHEN p.type = 'CONTACT' THEN c.id ELSE NULL END AS derived_buyer_contact_id,
    -- Derived legacy buyerOrganizationId (for backward compatibility checks)
    CASE WHEN p.type = 'ORGANIZATION' THEN o.id ELSE NULL END AS derived_buyer_organization_id,
    -- Derived buyer name
    CASE
        WHEN p.type = 'CONTACT' THEN c.display_name
        WHEN p.type = 'ORGANIZATION' THEN o.name
        ELSE NULL
    END AS buyer_name,
    oc."signedAt",
    oc."sentAt"
FROM "OffspringContract" oc
LEFT JOIN "Party" p ON p.id = oc."buyerPartyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE oc."buyerPartyId" IS NOT NULL
ORDER BY oc.id DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 10. OffspringContract status distribution
-- ============================================================================

\echo '10. OffspringContract Status Distribution'
\echo '------------------------------------------'

SELECT
    status,
    COUNT(*) AS total,
    COUNT("buyerPartyId") AS with_buyer,
    COUNT(*) - COUNT("buyerPartyId") AS without_buyer
FROM "OffspringContract"
GROUP BY status
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 11. OffspringContracts with signatures
-- ============================================================================

\echo '11. OffspringContracts with Signatures'
\echo '---------------------------------------'

SELECT
    COUNT(*) AS total_contracts,
    COUNT(CASE WHEN "sentAt" IS NOT NULL THEN 1 END) AS sent,
    COUNT(CASE WHEN "viewedAt" IS NOT NULL THEN 1 END) AS viewed,
    COUNT(CASE WHEN "signedAt" IS NOT NULL THEN 1 END) AS signed,
    COUNT("buyerPartyId") AS has_buyer
FROM "OffspringContract";

\echo ''

-- ============================================================================
-- 12. E-signature provider distribution
-- ============================================================================

\echo '12. E-signature Provider Distribution'
\echo '--------------------------------------'

SELECT
    provider,
    COUNT(*) AS count,
    COUNT("buyerPartyId") AS with_buyer,
    ROUND(100.0 * COUNT("buyerPartyId") / NULLIF(COUNT(*), 0), 2) AS buyer_pct
FROM "OffspringContract"
GROUP BY provider
ORDER BY count DESC;

\echo ''
\echo '======================================================================'
\echo 'Post-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'SUCCESS CRITERIA:'
\echo '  ✓ has_buyer_contact_id = 0'
\echo '  ✓ has_buyer_organization_id = 0'
\echo '  ✓ has_buyer_party_id = 1'
\echo '  ✓ Indexes exist: OffspringContract_buyerPartyId_idx, OffspringContract_tenantId_buyerPartyId_idx'
\echo '  ✓ FK constraint: OffspringContract_buyerPartyId_fkey'
\echo '  ✓ orphaned_buyer_party_refs = 0'
\echo '  ✓ parties_without_backing_entity = 0'
\echo ''
\echo 'If all checks pass, OffspringContract is now using Party-only for buyer references.'
\echo ''
