-- ============================================================================
-- Step 6K: ContractParty Post-Migration Validation
-- ============================================================================
-- Run this AFTER dropping legacy contactId and organizationId columns.
-- Validates that migration completed successfully and Party-only storage works.
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Step 6K Post-Migration Validation: ContractParty'
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
    COALESCE(SUM(CASE WHEN column_name = 'partyId' THEN 1 ELSE 0 END), 0) AS has_party_id,
    COALESCE(SUM(CASE WHEN column_name = 'userId' THEN 1 ELSE 0 END), 0) AS has_user_id
FROM information_schema.columns
WHERE table_name = 'ContractParty'
  AND column_name IN ('contactId', 'organizationId', 'partyId', 'userId');

\echo ''
\echo 'Expected: has_contact_id = 0, has_organization_id = 0, has_party_id = 1, has_user_id = 1'
\echo ''

-- ============================================================================
-- 2. Current ContractParty schema (party-related columns)
-- ============================================================================

\echo '2. Current ContractParty Schema (party-related columns)'
\echo '--------------------------------------------------------'

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'ContractParty'
  AND (column_name LIKE '%party%' OR column_name LIKE '%user%' OR column_name LIKE '%contact%' OR column_name LIKE '%organization%')
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
WHERE tablename = 'ContractParty'
  AND indexdef LIKE '%partyId%'
ORDER BY indexname;

\echo ''
\echo 'Expected: At least 2 indexes:'
\echo '  - ContractParty_partyId_idx'
\echo '  - ContractParty_tenantId_partyId_idx'
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
WHERE tbl.relname = 'ContractParty'
  AND att.attname = 'partyId'
  AND con.contype = 'f';

\echo ''
\echo 'Expected: ContractParty_partyId_fkey with constraint_type = f (foreign key)'
\echo ''

-- ============================================================================
-- 5. Data coverage metrics
-- ============================================================================

\echo '5. Data Coverage Metrics'
\echo '------------------------'

SELECT
    COUNT(*) AS total_contract_parties,
    COUNT("partyId") AS has_party_id,
    COUNT("userId") AS has_user_id,
    COUNT(CASE WHEN "partyId" IS NOT NULL AND "userId" IS NOT NULL THEN 1 END) AS has_both,
    COUNT(CASE WHEN "partyId" IS NOT NULL AND "userId" IS NULL THEN 1 END) AS party_only,
    COUNT(CASE WHEN "partyId" IS NULL AND "userId" IS NOT NULL THEN 1 END) AS user_only,
    COUNT(CASE WHEN "partyId" IS NULL AND "userId" IS NULL THEN 1 END) AS neither,
    ROUND(100.0 * COUNT("partyId") / NULLIF(COUNT(*), 0), 2) AS party_pct
FROM "ContractParty";

\echo ''
\echo 'Note: party_pct represents contract parties with parties (not all may have parties)'
\echo ''

-- ============================================================================
-- 6. Check for orphaned partyId references
-- ============================================================================

\echo '6. Orphaned Party References'
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
\echo ''

-- ============================================================================
-- 7. Party type distribution
-- ============================================================================

\echo '7. Party Type Distribution'
\echo '--------------------------'

SELECT
    p.type AS party_type,
    COUNT(*) AS count
FROM "ContractParty" cp
LEFT JOIN "Party" p ON p.id = cp."partyId"
GROUP BY p.type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 8. Party backing entity integrity
-- ============================================================================

\echo '8. Party Backing Entity Integrity'
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
\echo ''

-- ============================================================================
-- 9. Sample ContractParty rows with derived legacy fields
-- ============================================================================

\echo '9. Sample ContractParty Rows (with derived legacy fields)'
\echo '----------------------------------------------------------'

SELECT
    cp.id,
    cp."tenantId",
    cp."contractId",
    cp.role,
    cp."partyId",
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
    END AS party_name,
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
-- 10. ContractParty status distribution
-- ============================================================================

\echo '10. ContractParty Status Distribution'
\echo '--------------------------------------'

SELECT
    status,
    COUNT(*) AS total,
    COUNT("partyId") AS with_party,
    COUNT("userId") AS with_user,
    COUNT(*) - COUNT("partyId") AS without_party
FROM "ContractParty"
GROUP BY status
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 11. ContractParty role distribution
-- ============================================================================

\echo '11. ContractParty Role Distribution'
\echo '------------------------------------'

SELECT
    role,
    COUNT(*) AS total,
    COUNT("partyId") AS with_party,
    COUNT("userId") AS with_user
FROM "ContractParty"
GROUP BY role
ORDER BY total DESC;

\echo ''

-- ============================================================================
-- 12. ContractParties by contract status
-- ============================================================================

\echo '12. ContractParties by Contract Status'
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

-- ============================================================================
-- 13. Signer vs non-signer distribution
-- ============================================================================

\echo '13. Signer vs Non-Signer Distribution'
\echo '--------------------------------------'

SELECT
    signer,
    COUNT(*) AS total,
    COUNT("partyId") AS with_party,
    COUNT("userId") AS with_user,
    COUNT(CASE WHEN status = 'signed' THEN 1 END) AS signed_count
FROM "ContractParty"
GROUP BY signer
ORDER BY signer DESC;

\echo ''
\echo '======================================================================'
\echo 'Post-Migration Validation Complete'
\echo '======================================================================'
\echo ''
\echo 'SUCCESS CRITERIA:'
\echo '  ✓ has_contact_id = 0'
\echo '  ✓ has_organization_id = 0'
\echo '  ✓ has_party_id = 1'
\echo '  ✓ has_user_id = 1 (preserved)'
\echo '  ✓ Indexes exist: ContractParty_partyId_idx, ContractParty_tenantId_partyId_idx'
\echo '  ✓ FK constraint: ContractParty_partyId_fkey'
\echo '  ✓ orphaned_party_refs = 0'
\echo '  ✓ parties_without_backing_entity = 0'
\echo ''
\echo 'If all checks pass, ContractParty is now using Party-only for party references.'
\echo 'userId remains separate from the Party system.'
\echo ''
