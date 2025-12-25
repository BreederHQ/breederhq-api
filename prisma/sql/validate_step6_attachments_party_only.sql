-- Step 6A: Validation queries for Attachments Party-only migration
-- Run these queries before and after migration to validate data integrity
-- Execute manually in pgAdmin or PowerShell

-- ============================================================================
-- 1. Count total attachments
-- ============================================================================
SELECT
  'Total attachments' AS check_name,
  COUNT(*) AS count
FROM "Attachment";

-- ============================================================================
-- 2. Attachments with NULL attachmentPartyId
-- ============================================================================
SELECT
  'Attachments with NULL attachmentPartyId' AS check_name,
  COUNT(*) AS count
FROM "Attachment"
WHERE "attachmentPartyId" IS NULL;

-- ============================================================================
-- 3. Orphan check: Attachments with attachmentPartyId that don't exist in Party
-- ============================================================================
SELECT
  'Orphan attachments (invalid Party reference)' AS check_name,
  COUNT(*) AS count
FROM "Attachment" a
WHERE a."attachmentPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = a."attachmentPartyId"
  );

-- ============================================================================
-- 4. Party type distribution for attachments
-- ============================================================================
SELECT
  'Party type distribution' AS check_name,
  p.type AS party_type,
  COUNT(*) AS count
FROM "Attachment" a
JOIN "Party" p ON p.id = a."attachmentPartyId"
GROUP BY p.type
ORDER BY count DESC;

-- ============================================================================
-- 5. Attachments by entity type (plan, animal, litter, group, offspring)
-- ============================================================================
SELECT
  'Attachments by entity type' AS check_name,
  CASE
    WHEN "planId" IS NOT NULL THEN 'plan'
    WHEN "animalId" IS NOT NULL THEN 'animal'
    WHEN "litterId" IS NOT NULL THEN 'litter'
    WHEN "offspringGroupId" IS NOT NULL THEN 'offspring_group'
    WHEN "offspringId" IS NOT NULL THEN 'offspring'
    ELSE 'none'
  END AS entity_type,
  COUNT(*) AS count
FROM "Attachment"
GROUP BY entity_type
ORDER BY count DESC;

-- ============================================================================
-- 6. Sample of attachments with their Party details (first 10)
-- ============================================================================
SELECT
  a.id AS attachment_id,
  a."tenantId",
  a."attachmentPartyId",
  p.type AS party_type,
  p."contactId" AS party_backing_contact_id,
  p."organizationId" AS party_backing_org_id,
  a."offspringGroupId",
  a."planId",
  a.filename,
  a."createdAt"
FROM "Attachment" a
LEFT JOIN "Party" p ON p.id = a."attachmentPartyId"
ORDER BY a.id DESC
LIMIT 10;
