-- Step 6D: Offspring Buyer Pre-Migration Validation
--
-- Run BEFORE dropping legacy buyer columns.
-- Validates that buyerPartyId is populated for all Offspring with legacy buyer fields.

SELECT 'Offspring Buyer Pre-Migration Validation' AS check_name;

-- 1. Count Offspring rows where buyerPartyId is NULL but legacy buyer fields are non-null
--    (Should be 0 if Step 5 dual-write was complete)
SELECT
  'Offspring missing buyerPartyId with legacy buyer' AS check_type,
  COUNT(*) AS count_should_be_zero
FROM "Offspring"
WHERE "buyerPartyId" IS NULL
  AND ("buyerContactId" IS NOT NULL OR "buyerOrganizationId" IS NOT NULL);

-- 2. Count Offspring where both legacy buyer ids are set (conflict scenario)
--    (Should be 0, as this represents invalid state)
SELECT
  'Offspring with both buyerContactId and buyerOrganizationId' AS check_type,
  COUNT(*) AS count_should_be_zero
FROM "Offspring"
WHERE "buyerContactId" IS NOT NULL
  AND "buyerOrganizationId" IS NOT NULL;

-- 3. Check for orphan buyerPartyId (Party record missing)
SELECT
  'Offspring with orphan buyerPartyId' AS check_type,
  COUNT(*) AS count_should_be_zero
FROM "Offspring" o
WHERE o."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = o."buyerPartyId"
  );

-- 4. Coverage: Offspring with buyer identity via legacy fields
SELECT
  'Total Offspring with legacy buyer (contact)' AS check_type,
  COUNT(*) AS count
FROM "Offspring"
WHERE "buyerContactId" IS NOT NULL;

SELECT
  'Total Offspring with legacy buyer (organization)' AS check_type,
  COUNT(*) AS count
FROM "Offspring"
WHERE "buyerOrganizationId" IS NOT NULL;

-- 5. Coverage: Offspring with buyer identity via Party
SELECT
  'Total Offspring with buyerPartyId' AS check_type,
  COUNT(*) AS count
FROM "Offspring"
WHERE "buyerPartyId" IS NOT NULL;

-- 6. Consistency: Offspring where legacy buyer matches buyerPartyId
SELECT
  'Offspring where buyerContactId matches Party.contact' AS check_type,
  COUNT(*) AS count
FROM "Offspring" o
INNER JOIN "Party" p ON o."buyerPartyId" = p.id
INNER JOIN "Contact" c ON p.id = c."partyId"
WHERE o."buyerContactId" = c.id;

SELECT
  'Offspring where buyerOrganizationId matches Party.organization' AS check_type,
  COUNT(*) AS count
FROM "Offspring" o
INNER JOIN "Party" p ON o."buyerPartyId" = p.id
INNER JOIN "Organization" org ON p.id = org."partyId"
WHERE o."buyerOrganizationId" = org.id;
