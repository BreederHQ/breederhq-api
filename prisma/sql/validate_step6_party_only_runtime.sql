-- =====================================================================
-- Step 6 Party-Only Runtime Validation
-- =====================================================================
-- This query validates that Step 6 Party-only migration was completed
-- successfully and that no legacy columns remain for the target models.
--
-- Models validated (Party-only after Step 6):
-- - AnimalOwner: partyId only (no contactId, organizationId, partyType)
-- - BreedingAttempt: studOwnerPartyId only (no studOwnerContactId)
-- - Invoice: clientPartyId only (no contactId, organizationId)
-- - ContractParty: partyId, userId (no contactId, organizationId)
-- - OffspringContract: buyerPartyId only (no buyerContactId, buyerOrganizationId)
-- - User: partyId only (no contactId)
-- - Animal: buyerPartyId only (no buyerContactId, buyerOrganizationId, buyerPartyType)
-- =====================================================================

-- ===========================================================================
-- 1. Verify Legacy Columns Do NOT Exist
-- ===========================================================================

SELECT
  'LEGACY_COLUMN_CHECK' AS check_type,
  table_name,
  column_name,
  'FAIL: Legacy column still exists' AS result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    -- AnimalOwner legacy columns
    (table_name = 'AnimalOwner' AND column_name IN ('contactId', 'organizationId', 'partyType'))
    -- BreedingAttempt legacy columns
    OR (table_name = 'BreedingAttempt' AND column_name = 'studOwnerContactId')
    -- Invoice legacy columns
    OR (table_name = 'Invoice' AND column_name IN ('contactId', 'organizationId'))
    -- ContractParty legacy columns (keep userId)
    OR (table_name = 'ContractParty' AND column_name IN ('contactId', 'organizationId'))
    -- OffspringContract legacy columns
    OR (table_name = 'OffspringContract' AND column_name IN ('buyerContactId', 'buyerOrganizationId'))
    -- User legacy columns
    OR (table_name = 'User' AND column_name = 'contactId')
    -- Animal buyer legacy columns
    OR (table_name = 'Animal' AND column_name IN ('buyerContactId', 'buyerOrganizationId', 'buyerPartyType'))
  )
UNION ALL
SELECT
  'LEGACY_COLUMN_CHECK' AS check_type,
  'ALL_TABLES' AS table_name,
  'N/A' AS column_name,
  'PASS: No legacy columns found' AS result
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      (table_name = 'AnimalOwner' AND column_name IN ('contactId', 'organizationId', 'partyType'))
      OR (table_name = 'BreedingAttempt' AND column_name = 'studOwnerContactId')
      OR (table_name = 'Invoice' AND column_name IN ('contactId', 'organizationId'))
      OR (table_name = 'ContractParty' AND column_name IN ('contactId', 'organizationId'))
      OR (table_name = 'OffspringContract' AND column_name IN ('buyerContactId', 'buyerOrganizationId'))
      OR (table_name = 'User' AND column_name = 'contactId')
      OR (table_name = 'Animal' AND column_name IN ('buyerContactId', 'buyerOrganizationId', 'buyerPartyType'))
    )
);

-- ===========================================================================
-- 2. Verify Party-Only Columns Exist and Have Foreign Keys
-- ===========================================================================

SELECT
  'PARTY_COLUMN_CHECK' AS check_type,
  c.table_name,
  c.column_name,
  CASE
    WHEN fk.constraint_name IS NOT NULL THEN 'PASS: Column exists with FK'
    ELSE 'FAIL: Column exists but no FK constraint'
  END AS result
FROM information_schema.columns c
LEFT JOIN (
  SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
WHERE c.table_schema = 'public'
  AND (
    (c.table_name = 'AnimalOwner' AND c.column_name = 'partyId')
    OR (c.table_name = 'BreedingAttempt' AND c.column_name = 'studOwnerPartyId')
    OR (c.table_name = 'Invoice' AND c.column_name = 'clientPartyId')
    OR (c.table_name = 'ContractParty' AND c.column_name = 'partyId')
    OR (c.table_name = 'OffspringContract' AND c.column_name = 'buyerPartyId')
    OR (c.table_name = 'User' AND c.column_name = 'partyId')
    OR (c.table_name = 'Animal' AND c.column_name = 'buyerPartyId')
  )
ORDER BY c.table_name, c.column_name;

-- ===========================================================================
-- 3. Check for Orphaned Party References (Data Integrity)
-- ===========================================================================

-- AnimalOwner orphaned parties
SELECT
  'ORPHANED_PARTY_CHECK' AS check_type,
  'AnimalOwner' AS table_name,
  COUNT(*) AS orphaned_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL: Orphaned parties found' END AS result
FROM "AnimalOwner" ao
WHERE ao."partyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = ao."partyId"
  )

UNION ALL

-- BreedingAttempt orphaned parties
SELECT
  'ORPHANED_PARTY_CHECK' AS check_type,
  'BreedingAttempt' AS table_name,
  COUNT(*) AS orphaned_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL: Orphaned parties found' END AS result
FROM "BreedingAttempt" ba
WHERE ba."studOwnerPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = ba."studOwnerPartyId"
  )

UNION ALL

-- Invoice orphaned parties
SELECT
  'ORPHANED_PARTY_CHECK' AS check_type,
  'Invoice' AS table_name,
  COUNT(*) AS orphaned_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL: Orphaned parties found' END AS result
FROM "Invoice" i
WHERE i."clientPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = i."clientPartyId"
  )

UNION ALL

-- ContractParty orphaned parties
SELECT
  'ORPHANED_PARTY_CHECK' AS check_type,
  'ContractParty' AS table_name,
  COUNT(*) AS orphaned_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL: Orphaned parties found' END AS result
FROM "ContractParty" cp
WHERE cp."partyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = cp."partyId"
  )

UNION ALL

-- OffspringContract orphaned parties
SELECT
  'ORPHANED_PARTY_CHECK' AS check_type,
  'OffspringContract' AS table_name,
  COUNT(*) AS orphaned_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL: Orphaned parties found' END AS result
FROM "OffspringContract" oc
WHERE oc."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = oc."buyerPartyId"
  )

UNION ALL

-- User orphaned parties
SELECT
  'ORPHANED_PARTY_CHECK' AS check_type,
  'User' AS table_name,
  COUNT(*) AS orphaned_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL: Orphaned parties found' END AS result
FROM "User" u
WHERE u."partyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = u."partyId"
  )

UNION ALL

-- Animal orphaned buyer parties
SELECT
  'ORPHANED_PARTY_CHECK' AS check_type,
  'Animal' AS table_name,
  COUNT(*) AS orphaned_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL: Orphaned parties found' END AS result
FROM "Animal" a
WHERE a."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = a."buyerPartyId"
  );

-- ===========================================================================
-- Summary Report
-- ===========================================================================

SELECT
  'SUMMARY' AS check_type,
  'Step 6 Party-Only Validation' AS description,
  'Review results above for any FAIL status' AS result;
