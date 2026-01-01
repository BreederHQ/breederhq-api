# Validation Queries: Users Domain Party Migration (Step 5)

**Migration:** `20251225_party_step5_user_party`
**Date:** 2024-12-25
**Scope:** Users domain party-like references

---

## Overview

This document provides SQL validation queries to verify the success of the Users domain Party migration (Step 5). These queries check:
1. Backfill completeness for the new partyId field
2. Data integrity and FK consistency
3. Index existence
4. Unresolvable legacy contactId values

---

## 1. Backfill Completeness Checks

### 1.1 User - partyId

```sql
-- Count rows by backfill status
SELECT
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "partyId" IS NOT NULL) as backfilled,
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "partyId" IS NULL) as missing_party_id,
  COUNT(*) FILTER (WHERE "contactId" IS NULL AND "partyId" IS NULL) as no_contact,
  COUNT(*) FILTER (WHERE "contactId" IS NULL AND "partyId" IS NOT NULL) as orphan_party_id,
  COUNT(*) as total
FROM "User";
```

**Expected:**
- `missing_party_id` should be 0 if all referenced Contacts have valid partyId values.
- `orphan_party_id` should be 0 (partyId should not exist without contactId in normal operation).

**Interpretation:**
- `backfilled`: Users with contactId successfully mapped to partyId
- `missing_party_id`: Users with contactId but Contact has no partyId (data quality issue to investigate)
- `no_contact`: Users without a linked Contact (valid state)
- `orphan_party_id`: Users with partyId but no contactId (should not occur in normal operation)

---

## 2. Unresolved Legacy IDs

### 2.1 Users with contactId but Contact has no partyId

```sql
-- Find users where contactId exists but the Contact has no partyId
SELECT
  u.id,
  u.email,
  u."contactId",
  u."partyId",
  c."partyId" as contact_party_id
FROM "User" u
JOIN "Contact" c ON u."contactId" = c.id
WHERE u."contactId" IS NOT NULL
  AND c."partyId" IS NULL;
```

**Expected:** Should return 0 rows if all Contacts have been backfilled with partyId.

**Action if rows exist:**
1. Investigate why the Contact records lack partyId
2. Run Contact party backfill if not yet completed
3. Re-run User party backfill after Contact backfill completes

### 2.2 Users with invalid contactId references

```sql
-- Find users with contactId that don't exist in Contact table
SELECT
  u.id,
  u.email,
  u."contactId",
  u."partyId"
FROM "User" u
LEFT JOIN "Contact" c ON u."contactId" = c.id
WHERE u."contactId" IS NOT NULL
  AND c.id IS NULL;
```

**Expected:** Should return 0 rows (FK constraint should prevent this).

**Action if rows exist:** This indicates a data integrity issue. Investigate and fix FK violations.

---

## 3. Foreign Key Integrity

### 3.1 Verify User.partyId FK to Party table

```sql
-- Check for partyId values that don't exist in Party table
SELECT
  u.id,
  u.email,
  u."partyId"
FROM "User" u
LEFT JOIN "Party" p ON u."partyId" = p.id
WHERE u."partyId" IS NOT NULL
  AND p.id IS NULL;
```

**Expected:** Should return 0 rows.

**Action if rows exist:** FK constraint violation - should be impossible with proper migration.

### 3.2 Verify partyId matches contactId's party

```sql
-- Verify that User.partyId matches Contact.partyId for all users with contactId
SELECT
  u.id,
  u.email,
  u."contactId",
  u."partyId" as user_party_id,
  c."partyId" as contact_party_id
FROM "User" u
JOIN "Contact" c ON u."contactId" = c.id
WHERE u."contactId" IS NOT NULL
  AND u."partyId" IS NOT NULL
  AND c."partyId" IS NOT NULL
  AND u."partyId" != c."partyId";
```

**Expected:** Should return 0 rows.

**Action if rows exist:** Data inconsistency detected. User.partyId should always match Contact.partyId.

---

## 4. Index Verification

### 4.1 Check for User.partyId index

```sql
-- PostgreSQL: Check if index exists on User.partyId
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'User'
  AND indexdef LIKE '%partyId%';
```

**Expected:** Should return at least one index on `partyId` column.

**Index name expected:** `User_partyId_idx`

---

## 5. Data Quality Metrics

### 5.1 Users with contact linkage summary

```sql
-- Summary of user contact and party linkages
SELECT
  COUNT(*) as total_users,
  COUNT("contactId") as users_with_contact,
  COUNT("partyId") as users_with_party,
  COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "partyId" IS NOT NULL) as fully_linked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "contactId" IS NOT NULL AND "partyId" IS NOT NULL) / NULLIF(COUNT("contactId"), 0), 2) as backfill_percentage
FROM "User";
```

**Expected:** `backfill_percentage` should be 100.00 if all contacts have valid parties.

### 5.2 Party type distribution for user-linked parties

```sql
-- Check the type of parties linked to users
SELECT
  p.type,
  COUNT(*) as count
FROM "User" u
JOIN "Party" p ON u."partyId" = p.id
WHERE u."partyId" IS NOT NULL
GROUP BY p.type
ORDER BY count DESC;
```

**Expected:** Should primarily show `CONTACT` type parties, as users link to contacts, not organizations.

---

## 6. Rollback Verification (if needed)

### 6.1 Verify rollback safety

```sql
-- Check if removing partyId column would lose data not in contactId
SELECT COUNT(*) as orphan_parties
FROM "User"
WHERE "partyId" IS NOT NULL
  AND "contactId" IS NULL;
```

**Expected:** Should return 0.

**Action if > 0:** Do not roll back - there are partyId values without corresponding contactId. Investigate first.

---

## 7. Post-Deployment Smoke Tests

### 7.1 Verify dual-write on contact update

After deployment, verify that updating a user's contactId also updates partyId:

```sql
-- Before update: record current state
SELECT id, email, "contactId", "partyId" FROM "User" WHERE id = '<test-user-id>';

-- (Perform PATCH /users/:id/contact via API)

-- After update: verify both contactId and partyId were updated
SELECT id, email, "contactId", "partyId" FROM "User" WHERE id = '<test-user-id>';
```

**Expected:** Both `contactId` and `partyId` should be updated together.

### 7.2 Verify partyId is resolved correctly

```sql
-- Verify that partyId resolution matches the contact's partyId
SELECT
  u.id,
  u.email,
  u."contactId",
  u."partyId",
  c."partyId" as expected_party_id,
  CASE
    WHEN u."partyId" = c."partyId" THEN 'OK'
    WHEN u."partyId" IS NULL AND c."partyId" IS NULL THEN 'OK (both null)'
    ELSE 'MISMATCH'
  END as status
FROM "User" u
LEFT JOIN "Contact" c ON u."contactId" = c.id
WHERE u."contactId" IS NOT NULL
LIMIT 100;
```

**Expected:** All rows should show `status = 'OK'` or `'OK (both null)'`.

---

## 8. Summary Checklist

- [ ] Backfill completeness: 100% of users with contactId have partyId
- [ ] No missing partyId for users with contactId
- [ ] No orphan partyId values (partyId without contactId)
- [ ] FK integrity: all partyId values reference valid Party records
- [ ] partyId matches Contact.partyId for all users with contactId
- [ ] Index on User.partyId exists and is functional
- [ ] No conflicting or invalid data detected
- [ ] Dual-write verified in API endpoint testing
- [ ] Legacy contactId field remains unchanged and functional

---

## Notes

- The User model has only one party-like relationship: `contactId` → `partyId`
- Unlike other domains (Breeding, Offspring), User does not support Organization linkage
- The `partyId` field is nullable, matching the optionality of `contactId`
- Backfill is idempotent and can be safely re-run
- All DTOs remain unchanged; partyId is internal only at this stage
