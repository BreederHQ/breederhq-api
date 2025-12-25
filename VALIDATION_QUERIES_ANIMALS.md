# Validation Queries: Animals Domain Party Migration (Step 5)

This document provides SQL validation queries to verify the Party migration for the Animals domain.

## Table of Contents
- [Schema Validation](#schema-validation)
- [Backfill Completeness](#backfill-completeness)
- [Foreign Key Integrity](#foreign-key-integrity)
- [Index Verification](#index-verification)
- [Data Quality Checks](#data-quality-checks)

---

## Schema Validation

### 1. Verify Animal.buyerPartyId column exists
```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'Animal'
  AND column_name = 'buyerPartyId';
```
**Expected**: 1 row, `data_type = integer`, `is_nullable = YES`

### 2. Verify AnimalOwner.partyId column exists
```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'AnimalOwner'
  AND column_name = 'partyId';
```
**Expected**: 1 row, `data_type = integer`, `is_nullable = YES`

### 3. Verify AnimalOwnershipChange JSON columns exist
```sql
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'AnimalOwnershipChange'
  AND column_name IN ('fromOwnerParties', 'toOwnerParties')
ORDER BY column_name;
```
**Expected**: 2 rows, both `data_type = jsonb`, `is_nullable = YES`

---

## Backfill Completeness

### 4. Animal.buyerPartyId backfill coverage
```sql
SELECT
  COUNT(*) AS total_animals,
  COUNT(CASE WHEN "buyerPartyId" IS NOT NULL THEN 1 END) AS with_buyer_party_id,
  COUNT(CASE WHEN "buyerContactId" IS NOT NULL THEN 1 END) AS with_legacy_buyer_contact,
  COUNT(CASE WHEN "buyerOrganizationId" IS NOT NULL THEN 1 END) AS with_legacy_buyer_org,
  COUNT(CASE WHEN "buyerPartyId" IS NULL
             AND ("buyerContactId" IS NOT NULL OR "buyerOrganizationId" IS NOT NULL)
        THEN 1 END) AS missing_buyer_party_id
FROM "Animal";
```
**Expected**: `missing_buyer_party_id = 0` (all animals with legacy buyer IDs should have buyerPartyId)

### 5. AnimalOwner.partyId backfill coverage
```sql
SELECT
  COUNT(*) AS total_owners,
  COUNT(CASE WHEN "partyId" IS NOT NULL THEN 1 END) AS with_party_id,
  COUNT(CASE WHEN "contactId" IS NOT NULL THEN 1 END) AS with_legacy_contact,
  COUNT(CASE WHEN "organizationId" IS NOT NULL THEN 1 END) AS with_legacy_org,
  COUNT(CASE WHEN "partyId" IS NULL
             AND ("contactId" IS NOT NULL OR "organizationId" IS NOT NULL)
        THEN 1 END) AS missing_party_id
FROM "AnimalOwner";
```
**Expected**: `missing_party_id = 0` (all owners with legacy IDs should have partyId)

### 6. AnimalOwnershipChange JSON backfill coverage
```sql
SELECT
  COUNT(*) AS total_changes,
  COUNT(CASE WHEN "fromOwnerParties" IS NOT NULL THEN 1 END) AS with_from_parties,
  COUNT(CASE WHEN "toOwnerParties" IS NOT NULL THEN 1 END) AS with_to_parties,
  COUNT(CASE WHEN "fromOwners" IS NOT NULL
             AND "fromOwnerParties" IS NULL
        THEN 1 END) AS missing_from_parties,
  COUNT(CASE WHEN "toOwners" IS NOT NULL
             AND "toOwnerParties" IS NULL
        THEN 1 END) AS missing_to_parties
FROM "AnimalOwnershipChange";
```
**Expected**: `missing_from_parties = 0` and `missing_to_parties = 0` (all records with legacy JSON should have party-based JSON)

### 7. Unresolved partyId references (Contact without partyId)
```sql
SELECT
  ao.id AS animal_owner_id,
  ao."animalId",
  ao."contactId",
  c.id AS contact_id,
  c."partyId" AS contact_party_id
FROM "AnimalOwner" ao
INNER JOIN "Contact" c ON ao."contactId" = c.id
WHERE ao."contactId" IS NOT NULL
  AND c."partyId" IS NULL;
```
**Expected**: 0 rows (all contacts referenced by AnimalOwner should have partyId)

### 8. Unresolved partyId references (Organization without partyId)
```sql
SELECT
  ao.id AS animal_owner_id,
  ao."animalId",
  ao."organizationId",
  o.id AS org_id,
  o."partyId" AS org_party_id
FROM "AnimalOwner" ao
INNER JOIN "Organization" o ON ao."organizationId" = o.id
WHERE ao."organizationId" IS NOT NULL
  AND o."partyId" IS NULL;
```
**Expected**: 0 rows (all organizations referenced by AnimalOwner should have partyId)

---

## Foreign Key Integrity

### 9. Verify FK constraint: Animal.buyerPartyId → Party.id
```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'Animal'
  AND kcu.column_name = 'buyerPartyId';
```
**Expected**: 1 row, `foreign_table_name = Party`, `foreign_column_name = id`

### 10. Verify FK constraint: AnimalOwner.partyId → Party.id
```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'AnimalOwner'
  AND kcu.column_name = 'partyId';
```
**Expected**: 1 row, `foreign_table_name = Party`, `foreign_column_name = id`

### 11. Verify FK constraint ON DELETE behavior
```sql
SELECT
  con.conname AS constraint_name,
  con.confdeltype AS on_delete_action
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname IN ('Animal', 'AnimalOwner')
  AND con.contype = 'f'
  AND EXISTS (
    SELECT 1
    FROM pg_attribute att
    WHERE att.attrelid = con.conrelid
      AND att.attnum = ANY(con.conkey)
      AND att.attname IN ('buyerPartyId', 'partyId')
  );
```
**Expected**: All rows show `on_delete_action = 'n'` (SET NULL, represented as 'n')

---

## Index Verification

### 12. Verify Animal.buyerPartyId index exists
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'Animal'
  AND indexdef LIKE '%buyerPartyId%'
ORDER BY indexname;
```
**Expected**: At least 1 row showing index on `buyerPartyId`

### 13. Verify AnimalOwner.partyId index exists
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'AnimalOwner'
  AND indexdef LIKE '%partyId%'
ORDER BY indexname;
```
**Expected**: At least 1 row showing index on `partyId`

### 14. Verify composite index on (tenantId, buyerPartyId)
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'Animal'
  AND indexdef LIKE '%tenantId%'
  AND indexdef LIKE '%buyerPartyId%';
```
**Expected**: 1 row showing composite index

### 15. Verify composite index on (animalId, partyId)
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'AnimalOwner'
  AND indexdef LIKE '%animalId%'
  AND indexdef LIKE '%partyId%';
```
**Expected**: 1 row showing composite index

---

## Data Quality Checks

### 16. Verify partyId consistency (Contact)
```sql
SELECT
  ao.id,
  ao."animalId",
  ao."contactId",
  ao."partyId" AS owner_party_id,
  c."partyId" AS contact_party_id,
  CASE
    WHEN ao."partyId" = c."partyId" THEN 'MATCH'
    WHEN ao."partyId" IS NULL THEN 'MISSING'
    ELSE 'MISMATCH'
  END AS consistency
FROM "AnimalOwner" ao
INNER JOIN "Contact" c ON ao."contactId" = c.id
WHERE ao."contactId" IS NOT NULL
  AND (ao."partyId" IS NULL OR ao."partyId" != c."partyId")
ORDER BY ao.id;
```
**Expected**: 0 rows (all AnimalOwner.partyId should match Contact.partyId)

### 17. Verify partyId consistency (Organization)
```sql
SELECT
  ao.id,
  ao."animalId",
  ao."organizationId",
  ao."partyId" AS owner_party_id,
  o."partyId" AS org_party_id,
  CASE
    WHEN ao."partyId" = o."partyId" THEN 'MATCH'
    WHEN ao."partyId" IS NULL THEN 'MISSING'
    ELSE 'MISMATCH'
  END AS consistency
FROM "AnimalOwner" ao
INNER JOIN "Organization" o ON ao."organizationId" = o.id
WHERE ao."organizationId" IS NOT NULL
  AND (ao."partyId" IS NULL OR ao."partyId" != o."partyId")
ORDER BY ao.id;
```
**Expected**: 0 rows (all AnimalOwner.partyId should match Organization.partyId)

### 18. Verify Party table joins work correctly
```sql
SELECT
  ao.id AS owner_id,
  ao."animalId",
  ao."partyType",
  ao."percent",
  p.id AS party_id,
  p.name AS party_name,
  p.type AS party_type
FROM "AnimalOwner" ao
LEFT JOIN "Party" p ON ao."partyId" = p.id
WHERE ao."partyId" IS NOT NULL
LIMIT 10;
```
**Expected**: All rows have valid party data, party_type matches owner partyType

### 19. Check for orphaned partyId references
```sql
SELECT
  ao.id,
  ao."animalId",
  ao."partyId"
FROM "AnimalOwner" ao
LEFT JOIN "Party" p ON ao."partyId" = p.id
WHERE ao."partyId" IS NOT NULL
  AND p.id IS NULL;
```
**Expected**: 0 rows (no orphaned partyId references)

### 20. AnimalOwnershipChange JSON structure validation
```sql
SELECT
  id,
  "fromOwnerParties"::jsonb->0->>'partyId' AS first_from_party_id,
  "fromOwnerParties"::jsonb->0->>'kind' AS first_from_kind,
  "toOwnerParties"::jsonb->0->>'partyId' AS first_to_party_id,
  "toOwnerParties"::jsonb->0->>'kind' AS first_to_kind
FROM "AnimalOwnershipChange"
WHERE "fromOwnerParties" IS NOT NULL
  OR "toOwnerParties" IS NOT NULL
LIMIT 5;
```
**Expected**: Valid JSON structure with partyId and kind fields

---

## Summary Query

### 21. Overall migration status summary
```sql
SELECT
  'Animal.buyerPartyId' AS field,
  COUNT(*) AS total_records,
  COUNT(CASE WHEN "buyerPartyId" IS NOT NULL THEN 1 END) AS with_party_id,
  ROUND(100.0 * COUNT(CASE WHEN "buyerPartyId" IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS percent_complete
FROM "Animal"
WHERE "buyerContactId" IS NOT NULL OR "buyerOrganizationId" IS NOT NULL

UNION ALL

SELECT
  'AnimalOwner.partyId' AS field,
  COUNT(*) AS total_records,
  COUNT(CASE WHEN "partyId" IS NOT NULL THEN 1 END) AS with_party_id,
  ROUND(100.0 * COUNT(CASE WHEN "partyId" IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS percent_complete
FROM "AnimalOwner"

UNION ALL

SELECT
  'AnimalOwnershipChange.fromOwnerParties' AS field,
  COUNT(*) AS total_records,
  COUNT(CASE WHEN "fromOwnerParties" IS NOT NULL THEN 1 END) AS with_party_id,
  ROUND(100.0 * COUNT(CASE WHEN "fromOwnerParties" IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS percent_complete
FROM "AnimalOwnershipChange"

UNION ALL

SELECT
  'AnimalOwnershipChange.toOwnerParties' AS field,
  COUNT(*) AS total_records,
  COUNT(CASE WHEN "toOwnerParties" IS NOT NULL THEN 1 END) AS with_party_id,
  ROUND(100.0 * COUNT(CASE WHEN "toOwnerParties" IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS percent_complete
FROM "AnimalOwnershipChange";
```
**Expected**: All fields show 100% completion

---

## Rollback Verification

### 22. Verify legacy fields still exist (backward compatibility)
```sql
SELECT
  column_name
FROM information_schema.columns
WHERE table_name = 'Animal'
  AND column_name IN ('buyerContactId', 'buyerOrganizationId')

UNION

SELECT
  column_name
FROM information_schema.columns
WHERE table_name = 'AnimalOwner'
  AND column_name IN ('contactId', 'organizationId')

UNION

SELECT
  column_name
FROM information_schema.columns
WHERE table_name = 'AnimalOwnershipChange'
  AND column_name IN ('fromOwners', 'toOwners')
ORDER BY column_name;
```
**Expected**: 6 rows (all legacy fields preserved)

---

## Notes
- All queries should be run against the production database after migration
- Expected results assume successful backfill execution
- Any deviations from expected results should be investigated before proceeding
- Keep this document updated as the schema evolves
