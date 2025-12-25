-- Step 6E Post-Migration Validation: WaitlistEntry Party-Only
-- Run AFTER dropping legacy contactId/organizationId/partyType columns
-- Confirms schema changes and data integrity

\echo '=================================================='
\echo 'Step 6E WaitlistEntry Post-Migration Validation'
\echo '=================================================='
\echo ''

-- ============================================================
-- 1. Schema Validation: Confirm legacy columns removed
-- ============================================================

\echo '1. Checking legacy columns are removed...'
SELECT
  COUNT(*) FILTER (WHERE column_name = 'contactId') AS has_contact_id,
  COUNT(*) FILTER (WHERE column_name = 'organizationId') AS has_organization_id,
  COUNT(*) FILTER (WHERE column_name = 'partyType') AS has_party_type
FROM information_schema.columns
WHERE table_name = 'WaitlistEntry';

\echo '   Expected: all counts = 0 (columns removed)'
\echo '   If > 0: Legacy columns still exist. Migration incomplete.'
\echo ''

-- ============================================================
-- 2. Schema Validation: Confirm clientPartyId exists
-- ============================================================

\echo '2. Checking clientPartyId column exists...'
SELECT
  COUNT(*) AS has_client_party_id
FROM information_schema.columns
WHERE table_name = 'WaitlistEntry'
  AND column_name = 'clientPartyId';

\echo '   Expected: 1 (column exists)'
\echo '   If 0: clientPartyId column missing. Migration incomplete.'
\echo ''

-- ============================================================
-- 3. Index Validation: Confirm indexes exist
-- ============================================================

\echo '3. Checking indexes on clientPartyId...'
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'WaitlistEntry'
  AND indexname LIKE '%clientPartyId%'
ORDER BY indexname;

\echo '   Expected: At least 2 indexes (clientPartyId, tenantId+clientPartyId)'
\echo ''

-- ============================================================
-- 4. FK Constraint Validation: Confirm FK to Party exists
-- ============================================================

\echo '4. Checking FK constraint to Party...'
SELECT
  conname AS constraint_name,
  contype AS constraint_type
FROM pg_constraint
WHERE conname = 'WaitlistEntry_clientPartyId_fkey';

\echo '   Expected: 1 row with contype = f (foreign key)'
\echo '   If 0: FK constraint missing. Migration incomplete.'
\echo ''

-- ============================================================
-- 5. Data Coverage: clientPartyId population
-- ============================================================

\echo '5. Checking clientPartyId coverage...'
SELECT
  COUNT(*) FILTER (WHERE "clientPartyId" IS NOT NULL) AS entries_with_party,
  COUNT(*) FILTER (WHERE "clientPartyId" IS NULL) AS entries_without_party,
  COUNT(*) AS total_entries,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "clientPartyId" IS NOT NULL) / NULLIF(COUNT(*), 0), 2) AS coverage_pct
FROM "WaitlistEntry";

\echo '   Expected: High coverage % (ideally 100%)'
\echo '   If coverage low: Some entries lack clientPartyId. Review data quality.'
\echo ''

-- ============================================================
-- 6. Orphan Check: clientPartyId references valid Party
-- ============================================================

\echo '6. Checking for orphaned clientPartyId references...'
SELECT
  COUNT(*) AS orphaned_party_refs
FROM "WaitlistEntry" w
WHERE w."clientPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = w."clientPartyId"
  );

\echo '   Expected: 0 orphans'
\echo '   If > 0: clientPartyId references missing Party rows. Fix data integrity.'
\echo ''

-- ============================================================
-- 7. Party Type Distribution: CONTACT vs ORGANIZATION
-- ============================================================

\echo '7. Party type distribution for waitlist entries...'
SELECT
  p.type AS party_type,
  COUNT(*) AS entry_count
FROM "WaitlistEntry" w
JOIN "Party" p ON p.id = w."clientPartyId"
WHERE w."clientPartyId" IS NOT NULL
GROUP BY p.type
ORDER BY p.type;

\echo '   Info: Distribution of CONTACT vs ORGANIZATION parties'
\echo ''

-- ============================================================
-- 8. Backing Entity Integrity: Party has Contact or Organization
-- ============================================================

\echo '8. Checking Party backing entities...'
SELECT
  COUNT(*) AS parties_without_backing_entity
FROM "WaitlistEntry" w
JOIN "Party" p ON p.id = w."clientPartyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE w."clientPartyId" IS NOT NULL
  AND c.id IS NULL
  AND o.id IS NULL;

\echo '   Expected: 0 parties without backing entity'
\echo '   If > 0: Party rows exist without Contact or Organization. Review data integrity.'
\echo ''

-- ============================================================
-- 9. Summary: Total WaitlistEntry count
-- ============================================================

\echo '9. Total WaitlistEntry records:'
SELECT COUNT(*) AS total_waitlist_entries FROM "WaitlistEntry";
\echo ''

\echo '=================================================='
\echo 'Post-Migration Validation Complete'
\echo 'Schema: Legacy columns removed, clientPartyId active'
\echo 'Review all checks above for data integrity.'
\echo '=================================================='
