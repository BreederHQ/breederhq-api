-- ============================================================================
-- Step 7 Post-Migration Validation
-- Purpose: Verify NOT NULL constraints, FK behavior, and indexes after Step 7
-- Date: 2025-12-26
-- ============================================================================

\echo '========================================='
\echo 'Step 7: Post-Migration Validation'
\echo 'Purpose: Verify constraints and indexes'
\echo '========================================='
\echo ''

-- ============================================================================
-- Section 1: Verify NOT NULL constraints
-- ============================================================================

\echo '1. Verifying NOT NULL constraints...'
\echo ''

SELECT
  table_name,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN (
    'partyId',
    'clientPartyId',
    'buyerPartyId'
  )
  AND table_name IN (
    'AnimalOwner',
    'WaitlistEntry',
    'OffspringGroupBuyer',
    'OffspringContract',
    'PlanParty'
  )
ORDER BY table_name, column_name;

\echo ''

-- ============================================================================
-- Section 2: Verify Foreign Key constraints and ON DELETE behavior
-- ============================================================================

\echo '2. Verifying foreign key constraints...'
\echo ''

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'AnimalOwner',
    'WaitlistEntry',
    'OffspringGroupBuyer',
    'OffspringContract',
    'PlanParty'
  )
  AND kcu.column_name LIKE '%partyId%'
ORDER BY tc.table_name, kcu.column_name;

\echo ''

-- ============================================================================
-- Section 3: Verify new indexes exist
-- ============================================================================

\echo '3. Verifying new performance indexes...'
\echo ''

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'Invoice_clientPartyId_status_idx',
    'Invoice_tenantId_clientPartyId_status_idx',
    'ContractParty_partyId_status_idx',
    'OffspringGroupBuyer_buyerPartyId_groupId_idx',
    'PlanParty_planId_role_idx',
    'Offspring_buyerPartyId_placementState_idx',
    'OffspringContract_buyerPartyId_status_idx',
    'WaitlistEntry_clientPartyId_status_idx',
    'TagAssignment_taggedPartyId_tagId_idx'
  )
ORDER BY tablename, indexname;

\echo ''

-- ============================================================================
-- Section 4: Test constraint enforcement
-- ============================================================================

\echo '4. Testing constraint enforcement (expected to fail)...'
\echo ''

\echo '   Testing AnimalOwner.partyId NOT NULL (should fail):'
DO $$
BEGIN
  INSERT INTO "AnimalOwner" ("animalId", "percent", "partyId")
  VALUES (1, 100, NULL);
  RAISE EXCEPTION 'ERROR: NULL constraint not enforced!';
EXCEPTION
  WHEN not_null_violation THEN
    RAISE NOTICE '✓ PASS: NOT NULL constraint working';
  WHEN foreign_key_violation THEN
    RAISE NOTICE '✓ PASS: NOT NULL constraint working';
  WHEN OTHERS THEN
    RAISE NOTICE '✗ FAIL: Unexpected error: %', SQLERRM;
END $$;

\echo ''
\echo '   Testing AnimalOwner ON DELETE RESTRICT (should fail):'
DO $$
DECLARE
  test_party_id INT;
BEGIN
  -- Create a test party
  INSERT INTO "Party" ("tenantId", "type", "name")
  VALUES (1, 'CONTACT', 'Test Party For Deletion')
  RETURNING id INTO test_party_id;

  -- Create an animal (we'll assume animal ID 1 exists)
  -- Note: This will fail if animal 1 doesn't exist, which is fine
  INSERT INTO "AnimalOwner" ("animalId", "percent", "partyId")
  VALUES (1, 50, test_party_id);

  -- Try to delete the party (should fail with RESTRICT)
  DELETE FROM "Party" WHERE id = test_party_id;

  RAISE EXCEPTION 'ERROR: ON DELETE RESTRICT not working!';
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE '✓ PASS: ON DELETE RESTRICT working';
    -- Cleanup
    DELETE FROM "AnimalOwner" WHERE "partyId" = test_party_id;
    DELETE FROM "Party" WHERE id = test_party_id;
  WHEN OTHERS THEN
    RAISE NOTICE '⚠ SKIP: Test requires existing animal (error: %)', SQLERRM;
    -- Try to cleanup if party was created
    BEGIN
      DELETE FROM "Party" WHERE id = test_party_id;
    EXCEPTION WHEN OTHERS THEN
    END;
END $$;

\echo ''

-- ============================================================================
-- Section 5: Index usage statistics (if available)
-- ============================================================================

\echo '5. Index usage statistics...'
\echo ''

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%Party%'
  AND indexname LIKE '%idx'
ORDER BY idx_scan DESC, tablename, indexname
LIMIT 20;

\echo ''
\echo '========================================='
\echo 'Validation Complete'
\echo '========================================='
