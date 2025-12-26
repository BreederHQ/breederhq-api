-- ============================================================================
-- Step 6G: Animal Post-Migration Validation
-- ============================================================================
-- Run this AFTER dropping legacy buyerContactId, buyerOrganizationId, and
-- buyerPartyType columns.
-- Validates that migration completed successfully and Party-only storage works.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6G Post-Migration Validation: Animal'
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
    COALESCE(SUM(CASE WHEN column_name = 'buyerPartyType' THEN 1 ELSE 0 END), 0) AS has_buyer_party_type,
    COALESCE(SUM(CASE WHEN column_name = 'buyerPartyId' THEN 1 ELSE 0 END), 0) AS has_buyer_party_id
FROM information_schema.columns
WHERE table_name = 'Animal'
  AND column_name IN ('buyerContactId', 'buyerOrganizationId', 'buyerPartyType', 'buyerPartyId');

\echo ''
\echo 'Expected: has_buyer_contact_id = 0, has_buyer_organization_id = 0, has_buyer_party_type = 0, has_buyer_party_id = 1'
\echo ''

-- ============================================================================
-- 2. Current Animal schema (buyer-related columns)
-- ============================================================================

\echo '2. Current Animal Schema (buyer-related columns)'
\echo '-------------------------------------------------'

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'Animal'
  AND (column_name LIKE '%buyer%' OR column_name LIKE '%price%' OR column_name LIKE '%deposit%' OR column_name = 'placedAt')
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
WHERE tablename = 'Animal'
  AND indexdef LIKE '%buyerPartyId%'
ORDER BY indexname;

\echo ''
\echo 'Expected: At least 2 indexes:'
\echo '  - Animal_buyerPartyId_idx'
\echo '  - Animal_tenantId_buyerPartyId_idx'
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
WHERE tbl.relname = 'Animal'
  AND att.attname = 'buyerPartyId'
  AND con.contype = 'f';

\echo ''
\echo 'Expected: Animal_buyerPartyId_fkey with constraint_type = f (foreign key)'
\echo ''

-- ============================================================================
-- 5. Data coverage metrics
-- ============================================================================

\echo '5. Data Coverage Metrics'
\echo '------------------------'

SELECT
    COUNT(*) AS total_animals,
    COUNT("buyerPartyId") AS has_buyer_party_id,
    COUNT(*) - COUNT("buyerPartyId") AS no_buyer,
    ROUND(100.0 * COUNT("buyerPartyId") / NULLIF(COUNT(*), 0), 2) AS buyer_pct
FROM "Animal";

\echo ''
\echo 'Note: buyer_pct represents animals with buyers (not all animals have buyers)'
\echo ''

-- ============================================================================
-- 6. Check for orphaned buyerPartyId references
-- ============================================================================

\echo '6. Orphaned Buyer Party References'
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
\echo ''

-- ============================================================================
-- 7. Buyer Party type distribution
-- ============================================================================

\echo '7. Buyer Party Type Distribution'
\echo '---------------------------------'

SELECT
    p.type AS buyer_party_type,
    COUNT(*) AS count
FROM "Animal" a
LEFT JOIN "Party" p ON p.id = a."buyerPartyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 8. Party backing entity integrity
-- ============================================================================

\echo '8. Party Backing Entity Integrity'
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
\echo ''

-- ============================================================================
-- 9. Sample Animal rows with derived legacy fields
-- ============================================================================

\echo '9. Sample Animal Rows (with derived legacy fields)'
\echo '---------------------------------------------------'

SELECT
    a.id,
    a."tenantId",
    a.name,
    a.status,
    a."buyerPartyId",
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
-- 10. Animal status distribution
-- ============================================================================

\echo '10. Animal Status Distribution'
\echo '-------------------------------'

SELECT
    status,
    COUNT(*) AS total,
    COUNT("buyerPartyId") AS with_buyer,
    COUNT(*) - COUNT("buyerPartyId") AS without_buyer
FROM "Animal"
GROUP BY status
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 11. Animals with sale data
-- ============================================================================

\echo '11. Animals with Sale Data'
\echo '---------------------------'

SELECT
    COUNT(*) AS total_animals,
    COUNT(CASE WHEN "priceCents" IS NOT NULL THEN 1 END) AS has_price,
    COUNT(CASE WHEN "depositCents" IS NOT NULL THEN 1 END) AS has_deposit,
    COUNT(CASE WHEN "placedAt" IS NOT NULL THEN 1 END) AS has_placed_date,
    COUNT(CASE WHEN "paidInFullAt" IS NOT NULL THEN 1 END) AS has_paid_in_full,
    COUNT("buyerPartyId") AS has_buyer
FROM "Animal";

\echo ''

-- ============================================================================
-- 12. Animals by species with buyers
-- ============================================================================

\echo '12. Animals by Species with Buyers'
\echo '-----------------------------------'

SELECT
    species,
    COUNT(*) AS total,
    COUNT("buyerPartyId") AS with_buyer,
    ROUND(100.0 * COUNT("buyerPartyId") / NULLIF(COUNT(*), 0), 2) AS buyer_pct
FROM "Animal"
GROUP BY species
ORDER BY total DESC;

\echo ''
\echo '======================================================================'
\echo 'Post-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'SUCCESS CRITERIA:'
\echo '  ✓ has_buyer_contact_id = 0'
\echo '  ✓ has_buyer_organization_id = 0'
\echo '  ✓ has_buyer_party_type = 0'
\echo '  ✓ has_buyer_party_id = 1'
\echo '  ✓ Indexes exist: Animal_buyerPartyId_idx, Animal_tenantId_buyerPartyId_idx'
\echo '  ✓ FK constraint: Animal_buyerPartyId_fkey'
\echo '  ✓ orphaned_buyer_party_refs = 0'
\echo '  ✓ parties_without_backing_entity = 0'
\echo ''
\echo 'If all checks pass, Animal is now using Party-only for buyer references.'
\echo ''
