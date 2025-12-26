-- Step 6C: Post-migration validation for OffspringGroupBuyer
-- Run AFTER removing legacy columns to confirm schema and data integrity
--
-- Expected results AFTER Step 6C:
-- - contactId and organizationId columns should NOT exist
-- - buyerPartyId should be the only buyer identifier
-- - All indexes and FK constraints should be in place
-- - Data integrity maintained through Party relations

\echo '======================================================================'
\echo 'Step 6C Post-Migration Validation: OffspringGroupBuyer'
\echo '======================================================================'
\echo ''

\echo '1. Schema Validation: Confirm legacy columns removed'
\echo ''
\echo '   Columns in OffspringGroupBuyer (contactId and organizationId should be ABSENT):'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'OffspringGroupBuyer'
ORDER BY ordinal_position;

\echo ''
\echo '2. buyerPartyId column validation:'
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'OffspringGroupBuyer'
AND column_name = 'buyerPartyId';

\echo ''
\echo '3. Indexes on OffspringGroupBuyer (should include buyerPartyId indexes):'
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'OffspringGroupBuyer'
ORDER BY indexname;

\echo ''
\echo '4. Foreign key constraints (should include buyerPartyId FK to Party):'
SELECT
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'OffspringGroupBuyer'
AND contype = 'f'
ORDER BY conname;

\echo ''
\echo '5. Unique constraints (should include groupId,buyerPartyId):'
SELECT
    conname as constraint_name,
    pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'OffspringGroupBuyer'
AND contype = 'u'
ORDER BY conname;

\echo ''
\echo '6. Data Coverage: Total OffspringGroupBuyer records:'
SELECT COUNT(*) as total_buyers
FROM "OffspringGroupBuyer";

\echo ''
\echo '7. Buyers with buyerPartyId NULL (acceptable if waitlistEntry-only):'
SELECT COUNT(*) as null_buyer_party_id
FROM "OffspringGroupBuyer"
WHERE "buyerPartyId" IS NULL;

\echo ''
\echo '8. Buyers with buyerPartyId populated:'
SELECT COUNT(*) as with_buyer_party_id
FROM "OffspringGroupBuyer"
WHERE "buyerPartyId" IS NOT NULL;

\echo ''
\echo '9. Orphan check: Buyers with buyerPartyId pointing to non-existent Party:'
SELECT COUNT(*) as orphan_buyers
FROM "OffspringGroupBuyer" gb
WHERE gb."buyerPartyId" IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM "Party" p WHERE p.id = gb."buyerPartyId"
);

\echo ''
\echo '10. Type consistency: Verify Party types match expected buyer types:'
SELECT
    p.type as party_type,
    COUNT(*) as buyer_count
FROM "OffspringGroupBuyer" gb
JOIN "Party" p ON p.id = gb."buyerPartyId"
GROUP BY p.type
ORDER BY buyer_count DESC;

\echo ''
\echo '11. Sample buyers with Party backing Contact:'
SELECT
    gb.id,
    gb."groupId",
    gb."buyerPartyId",
    p.type,
    p.name as party_name,
    c.id as backing_contact_id,
    c.display_name
FROM "OffspringGroupBuyer" gb
JOIN "Party" p ON p.id = gb."buyerPartyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
WHERE p.type = 'CONTACT'
LIMIT 5;

\echo ''
\echo '12. Sample buyers with Party backing Organization:'
SELECT
    gb.id,
    gb."groupId",
    gb."buyerPartyId",
    p.type,
    p.name as party_name,
    o.id as backing_org_id,
    o.name as org_name
FROM "OffspringGroupBuyer" gb
JOIN "Party" p ON p.id = gb."buyerPartyId"
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE p.type = 'ORGANIZATION'
LIMIT 5;

\echo ''
\echo '13. Uniqueness validation: Check for duplicate (groupId, buyerPartyId):'
SELECT "groupId", "buyerPartyId", COUNT(*) as duplicate_count
FROM "OffspringGroupBuyer"
WHERE "buyerPartyId" IS NOT NULL
GROUP BY "groupId", "buyerPartyId"
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

\echo ''
\echo '======================================================================'
\echo 'Post-migration validation complete.'
\echo ''
\echo 'Expected state after Step 6C:'
\echo '  - contactId and organizationId columns: ABSENT'
\echo '  - buyerPartyId column: EXISTS'
\echo '  - buyerPartyId index: EXISTS'
\echo '  - buyerPartyId FK to Party: EXISTS'
\echo '  - Unique constraint (groupId, buyerPartyId): EXISTS'
\echo '  - Orphan buyers: 0'
\echo '  - Duplicate (groupId, buyerPartyId): 0'
\echo ''
\echo 'If all checks pass, Step 6C migration is successful.'
\echo '======================================================================'
