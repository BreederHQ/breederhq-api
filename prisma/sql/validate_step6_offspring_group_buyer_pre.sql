-- Step 6C: Pre-migration validation for OffspringGroupBuyer
-- Run BEFORE removing legacy columns to check data quality
--
-- Expected results BEFORE Step 6C:
-- - All rows should have buyerPartyId populated (from Step 5 backfill)
-- - Check for conflicts where both contactId and organizationId are set
-- - Check for duplicate (groupId, buyerPartyId) that would violate new unique constraint

\echo '======================================================================'
\echo 'Step 6C Pre-Migration Validation: OffspringGroupBuyer'
\echo '======================================================================'
\echo ''

\echo '1. Total OffspringGroupBuyer records:'
SELECT COUNT(*) as total_buyers
FROM "OffspringGroupBuyer";

\echo ''
\echo '2. Buyers with buyerPartyId NULL (should be 0 after Step 5 backfill):'
SELECT COUNT(*) as null_buyer_party_id
FROM "OffspringGroupBuyer"
WHERE "buyerPartyId" IS NULL;

\echo ''
\echo '3. Buyers with both contactId and organizationId (conflicts):'
SELECT COUNT(*) as dual_buyer_ids
FROM "OffspringGroupBuyer"
WHERE "contactId" IS NOT NULL
AND "organizationId" IS NOT NULL;

\echo ''
\echo '4. Check for duplicate (groupId, buyerPartyId) combinations:'
\echo '   (would violate new unique constraint - should be 0)'
SELECT "groupId", "buyerPartyId", COUNT(*) as duplicate_count
FROM "OffspringGroupBuyer"
WHERE "buyerPartyId" IS NOT NULL
GROUP BY "groupId", "buyerPartyId"
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

\echo ''
\echo '5. Legacy contactId coverage:'
SELECT
    COUNT(*) as total_with_legacy_contact,
    COUNT(CASE WHEN "buyerPartyId" IS NOT NULL THEN 1 END) as migrated_to_party
FROM "OffspringGroupBuyer"
WHERE "contactId" IS NOT NULL;

\echo ''
\echo '6. Legacy organizationId coverage:'
SELECT
    COUNT(*) as total_with_legacy_org,
    COUNT(CASE WHEN "buyerPartyId" IS NOT NULL THEN 1 END) as migrated_to_party
FROM "OffspringGroupBuyer"
WHERE "organizationId" IS NOT NULL;

\echo ''
\echo '7. Sample of buyers that will lose contactId column:'
SELECT
    id,
    "groupId",
    "contactId",
    "buyerPartyId",
    (SELECT type FROM "Party" WHERE id = "buyerPartyId") as party_type
FROM "OffspringGroupBuyer"
WHERE "contactId" IS NOT NULL
LIMIT 5;

\echo ''
\echo '8. Sample of buyers that will lose organizationId column:'
SELECT
    id,
    "groupId",
    "organizationId",
    "buyerPartyId",
    (SELECT type FROM "Party" WHERE id = "buyerPartyId") as party_type
FROM "OffspringGroupBuyer"
WHERE "organizationId" IS NOT NULL
LIMIT 5;

\echo ''
\echo '======================================================================'
\echo 'Pre-migration validation complete.'
\echo ''
\echo 'Expected state before Step 6C:'
\echo '  - buyerPartyId NULL count: 0 (all backfilled from Step 5)'
\echo '  - Duplicate (groupId, buyerPartyId): 0'
\echo '  - Conflicts (both contactId and organizationId): documented and acceptable'
\echo ''
\echo 'If validation passes, proceed with Step 6C migration.'
\echo '======================================================================'
