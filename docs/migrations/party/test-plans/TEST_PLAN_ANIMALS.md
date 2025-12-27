# Test Plan: Animals Domain Party Migration (Step 5)

## Overview
This test plan covers the Party migration for the Animals domain, including schema changes, backfill procedures, API endpoints, and rollback procedures.

---

## 1. Pre-Migration Checklist

### 1.1 Environment Verification
- [ ] Confirm on `dev` branch
- [ ] Working tree is clean (except `.claude/settings.local.json`)
- [ ] Database connection verified
- [ ] Backup of database taken

### 1.2 Schema Review
- [ ] Review Prisma schema changes in `schema.prisma`
- [ ] Verify migration file in `prisma/migrations/20251225_party_step5_animals_party/`
- [ ] Confirm all changes are additive (nullable columns only)

---

## 2. Schema Migration Testing

### 2.1 Apply Migration
```bash
cd breederhq-api
npx prisma migrate deploy
```

**Expected**:
- Migration applies successfully
- No errors or warnings
- Database schema updated

### 2.2 Verify Schema Changes
Run validation queries 1-3 from [`VALIDATION_QUERIES_ANIMALS.md`](../validation-queries/VALIDATION_QUERIES_ANIMALS.md):
- [ ] Animal.buyerPartyId column exists
- [ ] AnimalOwner.partyId column exists
- [ ] AnimalOwnershipChange JSON columns exist

### 2.3 Verify Indexes
Run validation queries 12-15 from [`VALIDATION_QUERIES_ANIMALS.md`](../validation-queries/VALIDATION_QUERIES_ANIMALS.md):
- [ ] Animal.buyerPartyId index exists
- [ ] AnimalOwner.partyId index exists
- [ ] Composite indexes created

### 2.4 Verify Foreign Keys
Run validation queries 9-11 from [`VALIDATION_QUERIES_ANIMALS.md`](../validation-queries/VALIDATION_QUERIES_ANIMALS.md):
- [ ] Animal.buyerPartyId FK to Party
- [ ] AnimalOwner.partyId FK to Party
- [ ] FK ON DELETE SET NULL behavior

---

## 3. Backfill Testing

### 3.1 Run Backfill Script
```bash
cd breederhq-api
npx tsx scripts/backfill-animals-party.ts
```

**Expected Output**:
```
═══════════════════════════════════════════════════════════
Party Migration Step 5: Animals Domain Backfill
═══════════════════════════════════════════════════════════

A) Backfilling Animal.buyerPartyId...
  Total animals: X
  Backfilled from Contact: Y
  Backfilled from Organization: Z
  Conflicts: 0
  No legacy data: N

B) Backfilling AnimalOwner.partyId...
  Total owners: X
  Backfilled from Contact: Y
  Backfilled from Organization: Z
  Conflicts: 0
  No legacy data: 0

C) Backfilling AnimalOwnershipChange JSON...
  Total records: X
  fromOwners processed: Y
  toOwners processed: Z
  Unresolved partyIds: 0
  Errors: 0
```

### 3.2 Verify Backfill Completeness
Run validation queries 4-8 from [`VALIDATION_QUERIES_ANIMALS.md`](../validation-queries/VALIDATION_QUERIES_ANIMALS.md):
- [ ] Animal.buyerPartyId backfill coverage = 100%
- [ ] AnimalOwner.partyId backfill coverage = 100%
- [ ] AnimalOwnershipChange JSON backfill coverage = 100%
- [ ] No unresolved Contact references
- [ ] No unresolved Organization references

### 3.3 Verify Data Consistency
Run validation queries 16-19 from [`VALIDATION_QUERIES_ANIMALS.md`](../validation-queries/VALIDATION_QUERIES_ANIMALS.md):
- [ ] AnimalOwner.partyId matches Contact.partyId
- [ ] AnimalOwner.partyId matches Organization.partyId
- [ ] Party table joins work correctly
- [ ] No orphaned partyId references

### 3.4 Idempotency Test
Run backfill script again:
```bash
npx tsx scripts/backfill-animals-party.ts
```

**Expected**:
- Script completes successfully
- All records show "Already had partyId" or "Already processed"
- No duplicate writes
- No errors

---

## 4. API Endpoint Testing

### 4.1 Prerequisites
Ensure you have:
- Test tenant ID
- Test animal ID
- Test contact ID with partyId
- Test organization ID with partyId
- API running on localhost:6001 (or configured port)
- Valid authentication token

### 4.2 AnimalOwner - Create with Contact (Dual-Write)

**Request**:
```bash
curl -X POST http://localhost:6001/animals/{animalId}/owners \
  -H "Content-Type: application/json" \
  -H "Cookie: bhq_s={your_session_token}" \
  -d '{
    "partyType": "Contact",
    "contactId": 123,
    "percent": 50,
    "isPrimary": false
  }'
```

**Verify**:
```sql
SELECT
  id,
  "animalId",
  "partyType",
  "contactId",
  "partyId",
  "percent",
  "isPrimary"
FROM "AnimalOwner"
WHERE id = {returned_id};
```

**Expected**:
- HTTP 201 Created
- Response contains owner record
- Database row has:
  - `contactId = 123`
  - `partyId = {contact.partyId}` (not null)
  - `organizationId = null`

### 4.3 AnimalOwner - Create with Organization (Dual-Write)

**Request**:
```bash
curl -X POST http://localhost:6001/animals/{animalId}/owners \
  -H "Content-Type: application/json" \
  -H "Cookie: bhq_s={your_session_token}" \
  -d '{
    "partyType": "Organization",
    "organizationId": 456,
    "percent": 50,
    "isPrimary": true
  }'
```

**Verify**:
```sql
SELECT
  id,
  "animalId",
  "partyType",
  "organizationId",
  "partyId",
  "percent",
  "isPrimary"
FROM "AnimalOwner"
WHERE id = {returned_id};
```

**Expected**:
- HTTP 201 Created
- Database row has:
  - `organizationId = 456`
  - `partyId = {org.partyId}` (not null)
  - `contactId = null`

### 4.4 AnimalOwner - Update (Dual-Write)

**Request**:
```bash
curl -X PATCH http://localhost:6001/animals/{animalId}/owners/{ownerId} \
  -H "Content-Type: application/json" \
  -H "Cookie: bhq_s={your_session_token}" \
  -d '{
    "partyType": "Contact",
    "contactId": 789,
    "percent": 100,
    "isPrimary": true
  }'
```

**Verify**:
```sql
SELECT
  id,
  "partyType",
  "contactId",
  "organizationId",
  "partyId",
  "percent",
  "isPrimary"
FROM "AnimalOwner"
WHERE id = {ownerId};
```

**Expected**:
- HTTP 200 OK
- Database row updated with:
  - `contactId = 789`
  - `partyId = {new_contact.partyId}` (updated)
  - `organizationId = null`

### 4.5 AnimalOwner - List (Dual-Read)

**Request**:
```bash
curl -X GET http://localhost:6001/animals/{animalId}/owners \
  -H "Cookie: bhq_s={your_session_token}"
```

**Expected**:
- HTTP 200 OK
- Response includes all owners
- DTO format unchanged (no partyId exposed)
- Owner names displayed correctly (from Contact or Organization)

### 4.6 AnimalOwner - Delete

**Request**:
```bash
curl -X DELETE http://localhost:6001/animals/{animalId}/owners/{ownerId} \
  -H "Cookie: bhq_s={your_session_token}"
```

**Expected**:
- HTTP 200 OK
- Owner record deleted from database
- Related partyId reference removed

---

## 5. Data Integrity Testing

### 5.1 Constraint Validation

**Test**: Try to create AnimalOwner with invalid partyId
```sql
INSERT INTO "AnimalOwner" (
  "animalId",
  "partyType",
  "contactId",
  "partyId",
  "percent",
  "isPrimary"
)
VALUES (
  {test_animal_id},
  'Contact',
  {test_contact_id},
  99999, -- Invalid partyId
  100,
  true
);
```

**Expected**: FK constraint violation error

### 5.2 ON DELETE SET NULL Behavior

**Test**: Delete a Party and verify SET NULL
```sql
-- Create test data
INSERT INTO "Party" (id, "tenantId", type, name)
VALUES (99998, {test_tenant_id}, 'CONTACT', 'Test Delete Party');

INSERT INTO "AnimalOwner" (
  "animalId",
  "partyType",
  "contactId",
  "partyId",
  "percent",
  "isPrimary"
)
VALUES (
  {test_animal_id},
  'Contact',
  {test_contact_id},
  99998,
  100,
  true
);

-- Delete the party
DELETE FROM "Party" WHERE id = 99998;

-- Verify partyId set to null
SELECT "partyId" FROM "AnimalOwner" WHERE "contactId" = {test_contact_id};
```

**Expected**: `partyId = NULL` after Party deletion

### 5.3 JSON Structure Validation

**Test**: Verify AnimalOwnershipChange JSON structure
```sql
SELECT
  id,
  "fromOwnerParties",
  "toOwnerParties"
FROM "AnimalOwnershipChange"
WHERE "fromOwnerParties" IS NOT NULL
LIMIT 1;
```

**Expected JSON Structure**:
```json
{
  "fromOwnerParties": [
    {
      "partyId": 123,
      "kind": "CONTACT",
      "legacyContactId": 456,
      "percent": 100
    }
  ],
  "toOwnerParties": [
    {
      "partyId": 789,
      "kind": "ORGANIZATION",
      "legacyOrganizationId": 101,
      "percent": 100
    }
  ]
}
```

---

## 6. Performance Testing

### 6.1 Query Performance - AnimalOwner by partyId
```sql
EXPLAIN ANALYZE
SELECT *
FROM "AnimalOwner"
WHERE "partyId" = {test_party_id};
```

**Expected**: Index scan on `AnimalOwner_partyId_idx`

### 6.2 Query Performance - Animal by buyerPartyId
```sql
EXPLAIN ANALYZE
SELECT *
FROM "Animal"
WHERE "buyerPartyId" = {test_party_id};
```

**Expected**: Index scan on `Animal_buyerPartyId_idx`

### 6.3 Join Performance - AnimalOwner with Party
```sql
EXPLAIN ANALYZE
SELECT
  ao.*,
  p.name,
  p.type
FROM "AnimalOwner" ao
JOIN "Party" p ON ao."partyId" = p.id
WHERE ao."animalId" = {test_animal_id};
```

**Expected**: Efficient join using indexes

---

## 7. Regression Testing

### 7.1 Existing Functionality
- [ ] Animal CRUD operations work unchanged
- [ ] AnimalOwner CRUD returns expected DTOs
- [ ] No breaking changes to API contracts
- [ ] Frontend applications continue to function

### 7.2 Legacy Field Preservation
Run validation query 22 from [`VALIDATION_QUERIES_ANIMALS.md`](../validation-queries/VALIDATION_QUERIES_ANIMALS.md):
- [ ] All legacy fields still exist
- [ ] Legacy fields can still be read/written

---

## 8. Rollback Testing

### 8.1 Rollback Procedure

**If migration needs to be rolled back**:

1. **DO NOT** drop the new columns (data loss risk)
2. Application can continue using legacy fields
3. New partyId fields remain but are ignored

**Emergency rollback SQL** (use only if necessary):
```sql
-- Remove FK constraints (allows Party deletion without affecting AnimalOwner)
ALTER TABLE "Animal" DROP CONSTRAINT IF EXISTS "Animal_buyerPartyId_fkey";
ALTER TABLE "AnimalOwner" DROP CONSTRAINT IF EXISTS "AnimalOwner_partyId_fkey";

-- Optionally set new fields to NULL (frees up space but loses migration progress)
-- UPDATE "Animal" SET "buyerPartyId" = NULL;
-- UPDATE "AnimalOwner" SET "partyId" = NULL;
-- UPDATE "AnimalOwnershipChange" SET "fromOwnerParties" = NULL, "toOwnerParties" = NULL;
```

### 8.2 Verify Rollback
- [ ] Application functions with legacy fields only
- [ ] No errors accessing Animal or AnimalOwner data
- [ ] Dual-write code paths handle NULL partyId gracefully

---

## 9. Production Readiness

### 9.1 Final Checklist
- [ ] All schema validations pass
- [ ] Backfill 100% complete with no errors
- [ ] All API tests pass
- [ ] Data integrity checks pass
- [ ] Performance acceptable
- [ ] No regressions detected
- [ ] Rollback procedure documented and tested
- [ ] Monitoring/alerting configured for new fields

### 9.2 Deployment Steps
1. Apply migration during maintenance window
2. Run backfill script
3. Verify backfill completeness
4. Deploy application code with dual-write
5. Monitor for errors/issues
6. Run validation queries
7. Verify API endpoints

### 9.3 Post-Deployment Verification
- [ ] Run summary query (validation query 21)
- [ ] Check application logs for errors
- [ ] Verify frontend applications working
- [ ] Monitor database performance
- [ ] Spot-check random AnimalOwner records

---

## 10. Known Issues & Limitations

### 10.1 Current Limitations
- Animal buyer fields (buyerContactId/buyerOrganizationId) have no write paths in current API
- AnimalOwnershipChange records rare/non-existent in current data
- No automated tests run (test framework not configured)

### 10.2 Future Work
- Add NOT NULL constraints after full adoption
- Remove legacy fields after transition period
- Add unique constraint on (animalId, partyId) after confirming no conflicts
- Implement buyer assignment in sales/offspring flows with dual-write

---

## Acceptance Criteria

✅ **Migration is successful if**:
1. All schema changes applied without errors
2. Backfill script completes with 100% coverage and 0 conflicts
3. All validation queries pass
4. API endpoints correctly dual-write partyId
5. No regressions in existing functionality
6. DTOs unchanged (no breaking changes)
7. Foreign key constraints enforced
8. Indexes created and performant
9. Rollback procedure documented and viable
10. Clean working tree (except `.claude/settings.local.json`)
11. Changes committed and pushed to origin/dev

---

## Contact
For questions or issues with this migration, refer to previous migration test plans:
- `TEST_PLAN_TAGS.md`
- `TEST_PLAN_BREEDING.md`
- `TEST_PLAN_USER.md`

