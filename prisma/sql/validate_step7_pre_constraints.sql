-- ============================================================================
-- Step 7 Pre-Constraint Validation
-- Purpose: Verify data integrity before adding NOT NULL constraints and fixing FK behavior
-- Date: 2025-12-26
-- ============================================================================

\echo '========================================='
\echo 'Step 7: Pre-Constraint Validation'
\echo 'Purpose: Check for NULL values and orphaned references'
\echo '========================================='
\echo ''

-- ============================================================================
-- Section 1: Check for NULL values in columns that should be mandatory
-- ============================================================================

\echo '1. Checking for NULL values in mandatory partyId columns...'
\echo ''

-- AnimalOwner.partyId
\echo '   AnimalOwner.partyId NULL count:'
SELECT COUNT(*) as null_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "AnimalOwner"
WHERE "partyId" IS NULL;

-- WaitlistEntry.clientPartyId
\echo '   WaitlistEntry.clientPartyId NULL count:'
SELECT COUNT(*) as null_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "WaitlistEntry"
WHERE "clientPartyId" IS NULL;

-- OffspringGroupBuyer.buyerPartyId
\echo '   OffspringGroupBuyer.buyerPartyId NULL count:'
SELECT COUNT(*) as null_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "OffspringGroupBuyer"
WHERE "buyerPartyId" IS NULL;

-- OffspringContract.buyerPartyId
\echo '   OffspringContract.buyerPartyId NULL count:'
SELECT COUNT(*) as null_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "OffspringContract"
WHERE "buyerPartyId" IS NULL;

-- PlanParty.partyId
\echo '   PlanParty.partyId NULL count:'
SELECT COUNT(*) as null_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "PlanParty"
WHERE "partyId" IS NULL;

-- Invoice.clientPartyId (excluding general scope)
\echo '   Invoice.clientPartyId NULL count (non-general scope):'
SELECT COUNT(*) as null_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "Invoice"
WHERE "clientPartyId" IS NULL
  AND "scope" != 'general';

\echo ''

-- ============================================================================
-- Section 2: Check for orphaned Party references
-- ============================================================================

\echo '2. Checking for orphaned partyId references...'
\echo ''

-- User.partyId
\echo '   User.partyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "User" u
LEFT JOIN "Party" p ON u."partyId" = p.id
WHERE u."partyId" IS NOT NULL AND p.id IS NULL;

-- TagAssignment.taggedPartyId
\echo '   TagAssignment.taggedPartyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "TagAssignment" ta
LEFT JOIN "Party" p ON ta."taggedPartyId" = p.id
WHERE ta."taggedPartyId" IS NOT NULL AND p.id IS NULL;

-- BreedingAttempt.studOwnerPartyId
\echo '   BreedingAttempt.studOwnerPartyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "BreedingAttempt" ba
LEFT JOIN "Party" p ON ba."studOwnerPartyId" = p.id
WHERE ba."studOwnerPartyId" IS NOT NULL AND p.id IS NULL;

-- PlanParty.partyId
\echo '   PlanParty.partyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "PlanParty" pp
LEFT JOIN "Party" p ON pp."partyId" = p.id
WHERE pp."partyId" IS NOT NULL AND p.id IS NULL;

-- WaitlistEntry.clientPartyId
\echo '   WaitlistEntry.clientPartyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "WaitlistEntry" w
LEFT JOIN "Party" p ON w."clientPartyId" = p.id
WHERE w."clientPartyId" IS NOT NULL AND p.id IS NULL;

-- OffspringGroupBuyer.buyerPartyId
\echo '   OffspringGroupBuyer.buyerPartyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "OffspringGroupBuyer" ogb
LEFT JOIN "Party" p ON ogb."buyerPartyId" = p.id
WHERE ogb."buyerPartyId" IS NOT NULL AND p.id IS NULL;

-- Offspring.buyerPartyId
\echo '   Offspring.buyerPartyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "Offspring" o
LEFT JOIN "Party" p ON o."buyerPartyId" = p.id
WHERE o."buyerPartyId" IS NOT NULL AND p.id IS NULL;

-- Invoice.clientPartyId
\echo '   Invoice.clientPartyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "Invoice" i
LEFT JOIN "Party" p ON i."clientPartyId" = p.id
WHERE i."clientPartyId" IS NOT NULL AND p.id IS NULL;

-- ContractParty.partyId
\echo '   ContractParty.partyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "ContractParty" cp
LEFT JOIN "Party" p ON cp."partyId" = p.id
WHERE cp."partyId" IS NOT NULL AND p.id IS NULL;

-- OffspringContract.buyerPartyId
\echo '   OffspringContract.buyerPartyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "OffspringContract" oc
LEFT JOIN "Party" p ON oc."buyerPartyId" = p.id
WHERE oc."buyerPartyId" IS NOT NULL AND p.id IS NULL;

-- Animal.buyerPartyId
\echo '   Animal.buyerPartyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "Animal" a
LEFT JOIN "Party" p ON a."buyerPartyId" = p.id
WHERE a."buyerPartyId" IS NOT NULL AND p.id IS NULL;

-- AnimalOwner.partyId
\echo '   AnimalOwner.partyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "AnimalOwner" ao
LEFT JOIN "Party" p ON ao."partyId" = p.id
WHERE ao."partyId" IS NOT NULL AND p.id IS NULL;

-- Attachment.attachmentPartyId
\echo '   Attachment.attachmentPartyId orphaned references:'
SELECT COUNT(*) as orphaned_count,
       CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM "Attachment" att
LEFT JOIN "Party" p ON att."attachmentPartyId" = p.id
WHERE att."attachmentPartyId" IS NOT NULL AND p.id IS NULL;

\echo ''

-- ============================================================================
-- Section 3: Verify current foreign key constraints
-- ============================================================================

\echo '3. Verifying existing foreign key constraints...'
\echo ''

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
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
  AND (
    kcu.column_name LIKE '%partyId%'
    OR kcu.column_name LIKE '%PartyId%'
  )
ORDER BY tc.table_name, kcu.column_name;

\echo ''

-- ============================================================================
-- Section 4: Check existing indexes on partyId columns
-- ============================================================================

\echo '4. Checking existing indexes on partyId columns...'
\echo ''

SELECT
  t.relname AS table_name,
  i.relname AS index_name,
  a.attname AS column_name,
  ix.indisunique AS is_unique,
  ix.indisprimary AS is_primary
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relname IN (
  'User', 'TagAssignment', 'BreedingAttempt', 'PlanParty',
  'WaitlistEntry', 'OffspringGroupBuyer', 'Offspring',
  'Invoice', 'ContractParty', 'OffspringContract',
  'Animal', 'AnimalOwner', 'Attachment'
)
  AND (a.attname LIKE '%partyId%' OR a.attname LIKE '%PartyId%')
ORDER BY t.relname, i.relname, a.attname;

\echo ''

-- ============================================================================
-- Section 5: Data coverage statistics
-- ============================================================================

\echo '5. Party data coverage statistics...'
\echo ''

\echo '   User.partyId coverage:'
SELECT
  COUNT(*) as total_users,
  COUNT("partyId") as users_with_party,
  ROUND(100.0 * COUNT("partyId") / NULLIF(COUNT(*), 0), 2) as coverage_pct
FROM "User";

\echo '   WaitlistEntry.clientPartyId coverage:'
SELECT
  COUNT(*) as total_entries,
  COUNT("clientPartyId") as entries_with_party,
  ROUND(100.0 * COUNT("clientPartyId") / NULLIF(COUNT(*), 0), 2) as coverage_pct
FROM "WaitlistEntry";

\echo '   Offspring.buyerPartyId coverage:'
SELECT
  COUNT(*) as total_offspring,
  COUNT("buyerPartyId") as offspring_with_buyer,
  ROUND(100.0 * COUNT("buyerPartyId") / NULLIF(COUNT(*), 0), 2) as coverage_pct
FROM "Offspring";

\echo '   Invoice.clientPartyId coverage (non-general):'
SELECT
  COUNT(*) as total_invoices,
  COUNT("clientPartyId") as invoices_with_client,
  ROUND(100.0 * COUNT("clientPartyId") / NULLIF(COUNT(*), 0), 2) as coverage_pct
FROM "Invoice"
WHERE "scope" != 'general';

\echo '   Animal.buyerPartyId coverage:'
SELECT
  COUNT(*) as total_animals,
  COUNT("buyerPartyId") as animals_with_buyer,
  ROUND(100.0 * COUNT("buyerPartyId") / NULLIF(COUNT(*), 0), 2) as coverage_pct
FROM "Animal";

\echo ''
\echo '========================================='
\echo 'Validation Complete'
\echo '========================================='
