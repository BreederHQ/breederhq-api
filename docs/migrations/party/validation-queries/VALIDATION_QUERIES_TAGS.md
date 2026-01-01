# Validation Queries: Party Migration Step 5 - Tags Domain

This document contains SQL validation queries to verify the correctness and completeness of the Party migration for the Tags domain.

## 1. Schema Validation

### 1.1 Verify New Column Exists
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'TagAssignment'
  AND column_name = 'taggedPartyId';
```
**Expected**: One row showing `taggedPartyId` column exists as integer, nullable.

### 1.2 Verify Foreign Key Constraint
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
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'TagAssignment'
  AND kcu.column_name = 'taggedPartyId';
```
**Expected**: One row showing FK from `TagAssignment.taggedPartyId` to `Party.id`.

### 1.3 Verify Indexes Exist
```sql
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'TagAssignment'
  AND indexdef LIKE '%taggedPartyId%';
```
**Expected**: At least 2 indexes:
- `TagAssignment_taggedPartyId_idx`
- `TagAssignment_tagId_taggedPartyId_idx`

## 2. Backfill Validation

### 2.1 Total TagAssignment Count
```sql
SELECT COUNT(*) AS total_tag_assignments
FROM "TagAssignment";
```

### 2.2 TagAssignments with Party-like References
```sql
SELECT
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL) AS has_contact_id,
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL) AS has_org_id,
  COUNT(*) FILTER (WHERE "taggedPartyId" IS NOT NULL) AS has_party_id,
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL OR "organizationId" IS NOT NULL) AS has_legacy_party_ref,
  COUNT(*) AS total
FROM "TagAssignment";
```
**Expected**: `has_party_id` should equal or be close to `has_legacy_party_ref` (allowing for contacts/orgs without partyId).

### 2.3 Backfill Completeness - Contact
```sql
SELECT
  COUNT(*) AS contact_assignments_total,
  COUNT(*) FILTER (WHERE ta."taggedPartyId" IS NOT NULL) AS contact_assignments_with_party_id,
  COUNT(*) FILTER (WHERE ta."taggedPartyId" IS NULL AND c."partyId" IS NOT NULL) AS missing_party_id_but_resolvable,
  COUNT(*) FILTER (WHERE ta."taggedPartyId" IS NULL AND c."partyId" IS NULL) AS missing_party_id_unresolvable
FROM "TagAssignment" ta
LEFT JOIN "Contact" c ON c.id = ta."contactId"
WHERE ta."contactId" IS NOT NULL;
```
**Expected**: `missing_party_id_but_resolvable` should be 0 after backfill.

### 2.4 Backfill Completeness - Organization
```sql
SELECT
  COUNT(*) AS org_assignments_total,
  COUNT(*) FILTER (WHERE ta."taggedPartyId" IS NOT NULL) AS org_assignments_with_party_id,
  COUNT(*) FILTER (WHERE ta."taggedPartyId" IS NULL AND o."partyId" IS NOT NULL) AS missing_party_id_but_resolvable,
  COUNT(*) FILTER (WHERE ta."taggedPartyId" IS NULL AND o."partyId" IS NULL) AS missing_party_id_unresolvable
FROM "TagAssignment" ta
LEFT JOIN "Organization" o ON o.id = ta."organizationId"
WHERE ta."organizationId" IS NOT NULL;
```
**Expected**: `missing_party_id_but_resolvable` should be 0 after backfill.

### 2.5 Check for Conflicts (Both contactId and organizationId)
```sql
SELECT
  ta.id,
  ta."contactId",
  ta."organizationId",
  ta."taggedPartyId"
FROM "TagAssignment" ta
WHERE ta."contactId" IS NOT NULL
  AND ta."organizationId" IS NOT NULL;
```
**Expected**: 0 rows (no conflicts).

## 3. Data Integrity Validation

### 3.1 Orphaned taggedPartyId References
```sql
SELECT
  ta.id AS tag_assignment_id,
  ta."taggedPartyId"
FROM "TagAssignment" ta
LEFT JOIN "Party" p ON p.id = ta."taggedPartyId"
WHERE ta."taggedPartyId" IS NOT NULL
  AND p.id IS NULL;
```
**Expected**: 0 rows (all taggedPartyId values must reference valid Party records).

### 3.2 Verify taggedPartyId Matches Legacy Reference
```sql
-- For Contact assignments
SELECT
  ta.id,
  ta."contactId",
  ta."taggedPartyId",
  c."partyId" AS expected_party_id,
  CASE
    WHEN ta."taggedPartyId" = c."partyId" THEN 'MATCH'
    WHEN ta."taggedPartyId" IS NULL AND c."partyId" IS NULL THEN 'BOTH_NULL'
    ELSE 'MISMATCH'
  END AS status
FROM "TagAssignment" ta
JOIN "Contact" c ON c.id = ta."contactId"
WHERE ta."contactId" IS NOT NULL;
```
**Expected**: All rows should have status 'MATCH' or 'BOTH_NULL', no 'MISMATCH'.

```sql
-- For Organization assignments
SELECT
  ta.id,
  ta."organizationId",
  ta."taggedPartyId",
  o."partyId" AS expected_party_id,
  CASE
    WHEN ta."taggedPartyId" = o."partyId" THEN 'MATCH'
    WHEN ta."taggedPartyId" IS NULL AND o."partyId" IS NULL THEN 'BOTH_NULL'
    ELSE 'MISMATCH'
  END AS status
FROM "TagAssignment" ta
JOIN "Organization" o ON o.id = ta."organizationId"
WHERE ta."organizationId" IS NOT NULL;
```
**Expected**: All rows should have status 'MATCH' or 'BOTH_NULL', no 'MISMATCH'.

### 3.3 Verify Party Type Consistency
```sql
-- Contact assignments should reference CONTACT-type parties
SELECT
  ta.id,
  ta."contactId",
  ta."taggedPartyId",
  p.type AS party_type
FROM "TagAssignment" ta
JOIN "Party" p ON p.id = ta."taggedPartyId"
WHERE ta."contactId" IS NOT NULL
  AND p.type != 'CONTACT';
```
**Expected**: 0 rows (all contact assignments should reference CONTACT-type parties).

```sql
-- Organization assignments should reference ORGANIZATION-type parties
SELECT
  ta.id,
  ta."organizationId",
  ta."taggedPartyId",
  p.type AS party_type
FROM "TagAssignment" ta
JOIN "Party" p ON p.id = ta."taggedPartyId"
WHERE ta."organizationId" IS NOT NULL
  AND p.type != 'ORGANIZATION';
```
**Expected**: 0 rows (all organization assignments should reference ORGANIZATION-type parties).

## 4. Dual-Read Validation

### 4.1 Verify Dual-Read Coverage
```sql
-- Check that we can find tag assignments via either legacy ID or partyId
WITH contact_sample AS (
  SELECT id, "partyId", "tenantId"
  FROM "Contact"
  WHERE "partyId" IS NOT NULL
  LIMIT 10
)
SELECT
  cs.id AS contact_id,
  cs."partyId",
  COUNT(*) FILTER (WHERE ta."contactId" = cs.id) AS via_contact_id,
  COUNT(*) FILTER (WHERE ta."taggedPartyId" = cs."partyId") AS via_party_id
FROM contact_sample cs
LEFT JOIN "TagAssignment" ta ON (ta."contactId" = cs.id OR ta."taggedPartyId" = cs."partyId")
GROUP BY cs.id, cs."partyId";
```
**Expected**: For contacts with tags, both `via_contact_id` and `via_party_id` should be equal (dual-write working).

## 5. Performance Validation

### 5.1 Index Usage Check
```sql
EXPLAIN ANALYZE
SELECT ta.*, t.*
FROM "TagAssignment" ta
JOIN "Tag" t ON t.id = ta."tagId"
WHERE ta."taggedPartyId" = 123;
```
**Expected**: Query plan should show index scan on `TagAssignment_taggedPartyId_idx`.

### 5.2 Composite Index Usage
```sql
EXPLAIN ANALYZE
SELECT ta.*
FROM "TagAssignment" ta
WHERE ta."tagId" = 5
  AND ta."taggedPartyId" = 123;
```
**Expected**: Query plan should use `TagAssignment_tagId_taggedPartyId_idx`.

## 6. Summary Report

### 6.1 Complete Migration Summary
```sql
SELECT
  'TagAssignment Migration Summary' AS report_name,
  (SELECT COUNT(*) FROM "TagAssignment") AS total_assignments,
  (SELECT COUNT(*) FROM "TagAssignment" WHERE "contactId" IS NOT NULL) AS contact_assignments,
  (SELECT COUNT(*) FROM "TagAssignment" WHERE "organizationId" IS NOT NULL) AS org_assignments,
  (SELECT COUNT(*) FROM "TagAssignment" WHERE "taggedPartyId" IS NOT NULL) AS party_assignments,
  (SELECT COUNT(*) FROM "TagAssignment" WHERE "animalId" IS NOT NULL) AS animal_assignments,
  (SELECT COUNT(*) FROM "TagAssignment" WHERE "waitlistEntryId" IS NOT NULL) AS waitlist_assignments,
  (SELECT COUNT(*) FROM "TagAssignment" WHERE "offspringGroupId" IS NOT NULL) AS offspring_group_assignments,
  (SELECT COUNT(*) FROM "TagAssignment" WHERE "offspringId" IS NOT NULL) AS offspring_assignments;
```

## 7. Regression Testing

### 7.1 Verify Legacy Columns Unchanged
```sql
-- Check that contactId and organizationId columns still exist and contain data
SELECT
  COUNT(*) AS total,
  COUNT("contactId") AS has_contact_id,
  COUNT("organizationId") AS has_org_id
FROM "TagAssignment";
```
**Expected**: Counts should be same as before migration (no data loss in legacy columns).

### 7.2 Verify Unique Constraints Still Work
```sql
-- This should fail with unique constraint violation if working correctly
-- (Run only in test environment)
-- INSERT INTO "TagAssignment" ("tagId", "contactId")
-- SELECT "tagId", "contactId" FROM "TagAssignment" WHERE "contactId" IS NOT NULL LIMIT 1;
```
**Expected**: Unique constraint violation error.

## Pass Criteria

Migration is successful if:
1. ✅ All schema validations pass (column exists, FK exists, indexes exist)
2. ✅ Backfill completeness >= 99% (allowing for edge cases)
3. ✅ Zero data integrity violations (no orphans, no mismatches)
4. ✅ Dual-read returns consistent results
5. ✅ Indexes are being used by queries
6. ✅ Legacy columns remain intact and functional
