-- Step 6B: Tags Party-Only Post-Migration Validation
-- Run this AFTER applying the migration to verify success
-- DO NOT execute this from Claude - Aaron will run manually

\echo '═══════════════════════════════════════════════════════════'
\echo 'Step 6B: Tags Post-Migration Validation'
\echo '═══════════════════════════════════════════════════════════'
\echo ''

-- 1. Verify legacy columns are dropped
\echo '1. Verify contactId and organizationId columns are dropped:'
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'TagAssignment'
  AND column_name IN ('contactId', 'organizationId');

\echo ''
\echo '   (Should return 0 rows)'

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 2. Verify taggedPartyId column exists
\echo '2. Verify taggedPartyId column exists:'
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'TagAssignment'
  AND column_name = 'taggedPartyId';

\echo ''
\echo '   (Should show: taggedPartyId, integer, YES)'

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 3. Verify unique constraint on (tagId, taggedPartyId)
\echo '3. Verify unique constraint on (tagId, taggedPartyId):'
SELECT
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'TagAssignment'::regclass
  AND conname = 'TagAssignment_tagId_taggedPartyId_key';

\echo ''
\echo '   (Should show: TagAssignment_tagId_taggedPartyId_key, u)'

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 4. Verify FK constraint on taggedPartyId
\echo '4. Verify FK constraint on taggedPartyId:'
SELECT
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'TagAssignment'::regclass
  AND conname = 'TagAssignment_taggedPartyId_fkey';

\echo ''
\echo '   (Should show: TagAssignment_taggedPartyId_fkey, f)'

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 5. Verify indexes exist
\echo '5. Verify indexes on TagAssignment:'
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'TagAssignment'
  AND indexname IN (
    'TagAssignment_taggedPartyId_idx',
    'TagAssignment_tagId_taggedPartyId_idx'
  )
ORDER BY indexname;

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 6. Verify legacy indexes are dropped
\echo '6. Verify legacy indexes are dropped:'
SELECT
  indexname
FROM pg_indexes
WHERE tablename = 'TagAssignment'
  AND indexname IN (
    'TagAssignment_contactId_idx',
    'TagAssignment_organizationId_idx'
  );

\echo ''
\echo '   (Should return 0 rows)'

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 7. TagAssignment data coverage summary
\echo '7. TagAssignment data coverage after migration:'
SELECT
  COUNT(*) as total_assignments,
  COUNT("taggedPartyId") as has_tagged_party,
  COUNT("animalId") as has_animal,
  COUNT("waitlistEntryId") as has_waitlist,
  COUNT("offspringGroupId") as has_group,
  COUNT("offspringId") as has_offspring
FROM "TagAssignment";

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 8. Verify no orphan taggedPartyId references
\echo '8. TagAssignment rows with orphan taggedPartyId (should be 0):'
SELECT COUNT(*) as orphan_count
FROM "TagAssignment" ta
WHERE ta."taggedPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = ta."taggedPartyId"
  );

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 9. Check Party-based tag assignments by type
\echo '9. Party-based tag assignments by Party type:'
SELECT
  p.type as party_type,
  COUNT(*) as assignment_count
FROM "TagAssignment" ta
JOIN "Party" p ON p.id = ta."taggedPartyId"
WHERE ta."taggedPartyId" IS NOT NULL
GROUP BY p.type
ORDER BY p.type;

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 10. Verify no NULL taggedPartyId for Contact/Organization tags
\echo '10. Contact/Organization tags with NULL taggedPartyId (should be 0):'
SELECT COUNT(*) as null_party_tags
FROM "TagAssignment" ta
JOIN "Tag" t ON t.id = ta."tagId"
WHERE t.module IN ('CONTACT', 'ORGANIZATION')
  AND ta."taggedPartyId" IS NULL;

\echo ''
\echo '═══════════════════════════════════════════════════════════'
\echo 'Post-migration validation complete.'
\echo 'If all checks pass, migration was successful.'
\echo '═══════════════════════════════════════════════════════════'
