-- Step 6B: Tags Party-Only Pre-Migration Validation
-- Run this BEFORE applying the migration to identify potential issues
-- DO NOT execute this from Claude - Aaron will run manually

\echo '═══════════════════════════════════════════════════════════'
\echo 'Step 6B: Tags Pre-Migration Validation'
\echo '═══════════════════════════════════════════════════════════'
\echo ''

-- 1. Check TagAssignment rows with NULL taggedPartyId
\echo '1. TagAssignment rows with NULL taggedPartyId (should be 0):'
SELECT COUNT(*) as null_tagged_party_count
FROM "TagAssignment"
WHERE "taggedPartyId" IS NULL
  AND ("contactId" IS NOT NULL OR "organizationId" IS NOT NULL);

\echo ''
\echo '   Sample rows with NULL taggedPartyId:'
SELECT id, "tagId", "contactId", "organizationId", "taggedPartyId", "animalId"
FROM "TagAssignment"
WHERE "taggedPartyId" IS NULL
  AND ("contactId" IS NOT NULL OR "organizationId" IS NOT NULL)
LIMIT 10;

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 2. Check for conflicts where both contactId and organizationId are set
\echo '2. TagAssignment rows with both contactId and organizationId (should be 0):'
SELECT COUNT(*) as conflict_count
FROM "TagAssignment"
WHERE "contactId" IS NOT NULL
  AND "organizationId" IS NOT NULL;

\echo ''
\echo '   Sample conflict rows:'
SELECT id, "tagId", "contactId", "organizationId", "taggedPartyId"
FROM "TagAssignment"
WHERE "contactId" IS NOT NULL
  AND "organizationId" IS NOT NULL
LIMIT 10;

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 3. Check for duplicate (tagId, taggedPartyId) combinations
\echo '3. Duplicate (tagId, taggedPartyId) combinations that would violate uniqueness:'
SELECT "tagId", "taggedPartyId", COUNT(*) as dup_count
FROM "TagAssignment"
WHERE "taggedPartyId" IS NOT NULL
GROUP BY "tagId", "taggedPartyId"
HAVING COUNT(*) > 1
ORDER BY dup_count DESC;

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 4. Verify all Contacts and Organizations have partyId
\echo '4. Contacts without partyId (should be 0):'
SELECT COUNT(*) as contacts_without_party
FROM "Contact"
WHERE "partyId" IS NULL;

\echo ''
\echo '   Organizations without partyId (should be 0):'
SELECT COUNT(*) as orgs_without_party
FROM "Organization"
WHERE "partyId" IS NULL;

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 5. Check TagAssignment coverage
\echo '5. TagAssignment coverage summary:'
SELECT
  COUNT(*) as total_tag_assignments,
  COUNT("contactId") as has_contact_id,
  COUNT("organizationId") as has_org_id,
  COUNT("taggedPartyId") as has_tagged_party_id,
  COUNT("animalId") as has_animal_id,
  COUNT("waitlistEntryId") as has_waitlist_id,
  COUNT("offspringGroupId") as has_group_id,
  COUNT("offspringId") as has_offspring_id
FROM "TagAssignment";

\echo ''
\echo '─────────────────────────────────────────────────────────────'

-- 6. Check for orphan taggedPartyId references
\echo '6. TagAssignment rows with taggedPartyId not in Party table:'
SELECT COUNT(*) as orphan_party_refs
FROM "TagAssignment" ta
WHERE ta."taggedPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = ta."taggedPartyId"
  );

\echo ''
\echo '═══════════════════════════════════════════════════════════'
\echo 'Pre-migration validation complete.'
\echo 'Review the output above before proceeding with migration.'
\echo '═══════════════════════════════════════════════════════════'
