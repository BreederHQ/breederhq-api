-- Step 6D: Offspring Buyer Post-Migration Validation
--
-- Run AFTER dropping legacy buyer columns.
-- Validates that legacy columns are removed and buyerPartyId is properly indexed.

SELECT 'Offspring Buyer Post-Migration Validation' AS check_name;

-- 1. Confirm legacy buyer columns are removed
SELECT
  'buyerContactId column exists (should be false)' AS check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Offspring'
      AND column_name = 'buyerContactId'
  ) AS should_be_false;

SELECT
  'buyerOrganizationId column exists (should be false)' AS check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Offspring'
      AND column_name = 'buyerOrganizationId'
  ) AS should_be_false;

SELECT
  'buyerPartyType column exists (should be false)' AS check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Offspring'
      AND column_name = 'buyerPartyType'
  ) AS should_be_false;

-- 2. Confirm buyerPartyId column exists
SELECT
  'buyerPartyId column exists (should be true)' AS check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Offspring'
      AND column_name = 'buyerPartyId'
  ) AS should_be_true;

-- 3. Confirm indexes exist
SELECT
  'Index Offspring_buyerPartyId_idx exists (should be true)' AS check_type,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'Offspring'
      AND indexname = 'Offspring_buyerPartyId_idx'
  ) AS should_be_true;

SELECT
  'Index Offspring_tenantId_buyerPartyId_idx exists (should be true)' AS check_type,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'Offspring'
      AND indexname = 'Offspring_tenantId_buyerPartyId_idx'
  ) AS should_be_true;

-- 4. Confirm legacy indexes are removed
SELECT
  'Index Offspring_buyerContactId_idx exists (should be false)' AS check_type,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'Offspring'
      AND indexname = 'Offspring_buyerContactId_idx'
  ) AS should_be_false;

SELECT
  'Index Offspring_buyerOrganizationId_idx exists (should be false)' AS check_type,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'Offspring'
      AND indexname = 'Offspring_buyerOrganizationId_idx'
  ) AS should_be_false;

-- 5. Confirm FK exists for buyerPartyId
SELECT
  'FK Offspring_buyerPartyId_fkey exists (should be true)' AS check_type,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offspring_buyerPartyId_fkey'
      AND conrelid = 'public."Offspring"'::regclass
  ) AS should_be_true;

-- 6. Confirm legacy FKs are removed
SELECT
  'FK Offspring_buyerContactId_fkey exists (should be false)' AS check_type,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offspring_buyerContactId_fkey'
      AND conrelid = 'public."Offspring"'::regclass
  ) AS should_be_false;

SELECT
  'FK Offspring_buyerOrganizationId_fkey exists (should be false)' AS check_type,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offspring_buyerOrganizationId_fkey'
      AND conrelid = 'public."Offspring"'::regclass
  ) AS should_be_false;

-- 7. Coverage: Offspring with buyerPartyId
SELECT
  'Total Offspring rows' AS check_type,
  COUNT(*) AS count
FROM "Offspring";

SELECT
  'Offspring with buyerPartyId' AS check_type,
  COUNT(*) AS count
FROM "Offspring"
WHERE "buyerPartyId" IS NOT NULL;

SELECT
  'Offspring without buyerPartyId (available/unassigned)' AS check_type,
  COUNT(*) AS count
FROM "Offspring"
WHERE "buyerPartyId" IS NULL;

-- 8. Check for orphan buyerPartyId (Party record missing)
SELECT
  'Offspring with orphan buyerPartyId (should be 0)' AS check_type,
  COUNT(*) AS count_should_be_zero
FROM "Offspring" o
WHERE o."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = o."buyerPartyId"
  );

-- 9. Distribution by Party type
SELECT
  'Offspring buyer Party type distribution' AS check_type,
  p.type AS party_type,
  COUNT(*) AS count
FROM "Offspring" o
INNER JOIN "Party" p ON o."buyerPartyId" = p.id
GROUP BY p.type
ORDER BY p.type;
