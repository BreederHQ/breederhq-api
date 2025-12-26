-- Backfill Organization.partyId by creating Party records for all Organizations
-- This is idempotent and safe to run multiple times.
--
-- Context: Organization.partyId was added to schema but never migrated to PROD.
-- After adding the column via migration, we need to create Party records and link them.

-- Step 1: Create Party records for Organizations that don't have one
-- Insert into Party table with Organization data
INSERT INTO "Party" ("tenantId", "type", "name", "archived", "createdAt", "updatedAt")
SELECT
  o."tenantId",
  'ORGANIZATION' as "type",
  o."name" as "name",
  o."archived" as "archived",
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "Organization" o
WHERE o."partyId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p
    WHERE p."id" IN (SELECT "partyId" FROM "Organization" WHERE "id" = o."id" AND "partyId" IS NOT NULL)
  );

-- Step 2: Update Organization.partyId to link to the newly created Party records
-- We need to match Organizations to their Party records by tenantId and creation order
WITH org_party_mapping AS (
  SELECT
    o."id" as org_id,
    p."id" as party_id,
    ROW_NUMBER() OVER (PARTITION BY o."tenantId" ORDER BY o."id") as org_rank,
    ROW_NUMBER() OVER (PARTITION BY p."tenantId" ORDER BY p."id") as party_rank
  FROM "Organization" o
  CROSS JOIN "Party" p
  WHERE o."tenantId" = p."tenantId"
    AND p."type" = 'ORGANIZATION'
    AND o."partyId" IS NULL
)
UPDATE "Organization" o
SET "partyId" = m.party_id
FROM org_party_mapping m
WHERE o."id" = m.org_id
  AND m.org_rank = m.party_rank
  AND o."partyId" IS NULL;

-- Step 3: Verify backfill completed
DO $$
DECLARE
  missing_party_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_party_count
  FROM "Organization"
  WHERE "partyId" IS NULL;

  IF missing_party_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % organizations still missing partyId', missing_party_count;
  ELSE
    RAISE NOTICE 'Backfill successful: All organizations have partyId';
  END IF;
END $$;
