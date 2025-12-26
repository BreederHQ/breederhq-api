-- ============================================================================
-- Party Migration Step 5: Tags Domain - POST-MIGRATION REPAIR TOOL
-- ============================================================================
-- PURPOSE:
--   This is a post-migration repair tool for operational recovery.
--   Use this script to backfill the taggedPartyId column in TagAssignment
--   from existing contactId and organizationId values if data inconsistencies
--   are discovered after migration.
--
-- SAFETY:
--   - This script is IDEMPOTENT and safe to run multiple times
--   - Only updates rows where taggedPartyId is NULL
--   - Does not modify existing taggedPartyId values
--
-- USAGE:
--   psql $DATABASE_URL -f prisma/sql/backfills/backfill_party_step5_tags.sql
--
-- NOTE:
--   This is NOT part of the validation suite (does not match validate*.sql pattern)
-- ============================================================================

-- ============================================================================
-- PRE-BACKFILL VALIDATION QUERIES
-- ============================================================================

-- Check total TagAssignment rows
SELECT
  'Total TagAssignment rows' AS check_name,
  COUNT(*) AS count
FROM "TagAssignment";

-- Check rows with contactId set
SELECT
  'TagAssignment with contactId' AS check_name,
  COUNT(*) AS count
FROM "TagAssignment"
WHERE "contactId" IS NOT NULL;

-- Check rows with organizationId set
SELECT
  'TagAssignment with organizationId' AS check_name,
  COUNT(*) AS count
FROM "TagAssignment"
WHERE "organizationId" IS NOT NULL;

-- Check rows with BOTH contactId AND organizationId set (CONFLICT!)
SELECT
  'CONFLICT: Both contactId and organizationId set' AS check_name,
  COUNT(*) AS count
FROM "TagAssignment"
WHERE "contactId" IS NOT NULL
  AND "organizationId" IS NOT NULL;

-- Check rows where contactId is set but cannot resolve partyId
SELECT
  'Cannot resolve contactId to partyId' AS check_name,
  COUNT(*) AS count
FROM "TagAssignment" ta
LEFT JOIN "Contact" c ON c.id = ta."contactId"
WHERE ta."contactId" IS NOT NULL
  AND c."partyId" IS NULL;

-- Check rows where organizationId is set but cannot resolve partyId
SELECT
  'Cannot resolve organizationId to partyId' AS check_name,
  COUNT(*) AS count
FROM "TagAssignment" ta
LEFT JOIN "Organization" o ON o.id = ta."organizationId"
WHERE ta."organizationId" IS NOT NULL
  AND o."partyId" IS NULL;

-- ============================================================================
-- BACKFILL OPERATIONS
-- ============================================================================

-- Backfill taggedPartyId from contactId
UPDATE "TagAssignment" ta
SET "taggedPartyId" = c."partyId"
FROM "Contact" c
WHERE ta."contactId" = c.id
  AND c."partyId" IS NOT NULL
  AND ta."taggedPartyId" IS NULL;

-- Backfill taggedPartyId from organizationId
UPDATE "TagAssignment" ta
SET "taggedPartyId" = o."partyId"
FROM "Organization" o
WHERE ta."organizationId" = o.id
  AND o."partyId" IS NOT NULL
  AND ta."taggedPartyId" IS NULL;

-- ============================================================================
-- POST-BACKFILL VALIDATION QUERIES
-- ============================================================================

-- Check total rows with taggedPartyId now set
SELECT
  'TagAssignment with taggedPartyId set' AS check_name,
  COUNT(*) AS count
FROM "TagAssignment"
WHERE "taggedPartyId" IS NOT NULL;

-- Check rows still missing taggedPartyId but have contactId
SELECT
  'Still missing taggedPartyId (has contactId)' AS check_name,
  COUNT(*) AS count
FROM "TagAssignment"
WHERE "contactId" IS NOT NULL
  AND "taggedPartyId" IS NULL;

-- Check rows still missing taggedPartyId but have organizationId
SELECT
  'Still missing taggedPartyId (has organizationId)' AS check_name,
  COUNT(*) AS count
FROM "TagAssignment"
WHERE "organizationId" IS NOT NULL
  AND "taggedPartyId" IS NULL;

-- Check FK integrity: all taggedPartyId values must exist in Party
SELECT
  'FK integrity: invalid taggedPartyId references' AS check_name,
  COUNT(*) AS count
FROM "TagAssignment" ta
LEFT JOIN "Party" p ON p.id = ta."taggedPartyId"
WHERE ta."taggedPartyId" IS NOT NULL
  AND p.id IS NULL;

-- Summary: Show distribution of tagged entities
SELECT
  'TagAssignment distribution by entity type' AS summary,
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL) AS contact_count,
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL) AS organization_count,
  COUNT(*) FILTER (WHERE "animalId" IS NOT NULL) AS animal_count,
  COUNT(*) FILTER (WHERE "waitlistEntryId" IS NOT NULL) AS waitlist_count,
  COUNT(*) FILTER (WHERE "offspringGroupId" IS NOT NULL) AS offspring_group_count,
  COUNT(*) FILTER (WHERE "offspringId" IS NOT NULL) AS offspring_count,
  COUNT(*) FILTER (WHERE "taggedPartyId" IS NOT NULL) AS party_count,
  COUNT(*) AS total_count
FROM "TagAssignment";

-- ============================================================================
-- DETAILED CONFLICT REPORT (if any conflicts exist)
-- ============================================================================

-- Show specific rows with both contactId and organizationId
SELECT
  ta.id,
  ta."tagId",
  ta."contactId",
  ta."organizationId",
  ta."taggedPartyId",
  c."partyId" AS contact_party_id,
  o."partyId" AS org_party_id
FROM "TagAssignment" ta
LEFT JOIN "Contact" c ON c.id = ta."contactId"
LEFT JOIN "Organization" o ON o.id = ta."organizationId"
WHERE ta."contactId" IS NOT NULL
  AND ta."organizationId" IS NOT NULL
ORDER BY ta.id
LIMIT 10;

-- ============================================================================
-- UNRESOLVABLE REFERENCES REPORT
-- ============================================================================

-- Show specific contactId that cannot be resolved to partyId
SELECT
  ta.id AS tag_assignment_id,
  ta."contactId",
  'Contact not found or missing partyId' AS issue
FROM "TagAssignment" ta
LEFT JOIN "Contact" c ON c.id = ta."contactId"
WHERE ta."contactId" IS NOT NULL
  AND (c.id IS NULL OR c."partyId" IS NULL)
ORDER BY ta.id
LIMIT 10;

-- Show specific organizationId that cannot be resolved to partyId
SELECT
  ta.id AS tag_assignment_id,
  ta."organizationId",
  'Organization not found or missing partyId' AS issue
FROM "TagAssignment" ta
LEFT JOIN "Organization" o ON o.id = ta."organizationId"
WHERE ta."organizationId" IS NOT NULL
  AND (o.id IS NULL OR o."partyId" IS NULL)
ORDER BY ta.id
LIMIT 10;
