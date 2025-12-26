-- Step 6E Pre-Migration Validation: WaitlistEntry Party-Only
-- Run BEFORE dropping legacy contactId/organizationId/partyType columns
-- All checks must pass (return 0 or expected values) before proceeding

\echo '=================================================='
\echo 'Step 6E WaitlistEntry Pre-Migration Validation'
\echo '=================================================='
\echo ''

-- ============================================================
-- 1. Coverage: Ensure all waitlist entries have clientPartyId
-- ============================================================

\echo '1. Checking clientPartyId coverage...'
SELECT
  COUNT(*) FILTER (WHERE "clientPartyId" IS NULL) AS missing_client_party_id,
  COUNT(*) AS total_entries
FROM "WaitlistEntry";

\echo '   Expected: missing_client_party_id = 0'
\echo '   If > 0: Legacy entries exist without clientPartyId. Run backfill before proceeding.'
\echo ''

-- ============================================================
-- 2. Conflict Detection: Rows with both contactId and organizationId set
-- ============================================================

\echo '2. Checking for dual contact/org assignments...'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WaitlistEntry'
    AND column_name IN ('contactId', 'organizationId')
  ) THEN
    EXECUTE '
      SELECT
        COUNT(*) AS conflicting_entries
      FROM "WaitlistEntry"
      WHERE "contactId" IS NOT NULL
        AND "organizationId" IS NOT NULL
    ';
  ELSE
    RAISE NOTICE 'Legacy columns already dropped. Skipping conflict check.';
  END IF;
END $$;

\echo '   Expected: 0 conflicts (or columns already dropped)'
\echo '   If > 0: Entries have both contactId and organizationId set. Review and resolve precedence.'
\echo ''

-- ============================================================
-- 3. Orphan Check: clientPartyId points to non-existent Party
-- ============================================================

\echo '3. Checking for orphaned clientPartyId references...'
SELECT
  COUNT(*) AS orphaned_party_refs
FROM "WaitlistEntry" w
WHERE w."clientPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = w."clientPartyId"
  );

\echo '   Expected: 0 orphans'
\echo '   If > 0: clientPartyId references missing Party rows. Fix data integrity before proceeding.'
\echo ''

-- ============================================================
-- 4. Party Backing Entity Check: Ensure Party has Contact or Organization
-- ============================================================

\echo '4. Checking Party backing entities (Contact or Organization)...'
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
-- 5. Summary: Total WaitlistEntry count
-- ============================================================

\echo '5. Total WaitlistEntry records:'
SELECT COUNT(*) AS total_waitlist_entries FROM "WaitlistEntry";
\echo ''

\echo '=================================================='
\echo 'Pre-Migration Validation Complete'
\echo 'Review all checks above. Proceed only if all pass.'
\echo '=================================================='
