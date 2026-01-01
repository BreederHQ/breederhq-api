# Test Plan: Party Migration Step 5 - Tags Domain

## Overview
This test plan validates the Party migration implementation for the Tags domain, ensuring dual-read and dual-write functionality works correctly while maintaining backward compatibility.

## Test Environment Setup

### Prerequisites
- Database with Party migration steps 1-4 completed
- All Contacts and Organizations have valid partyId values
- Test tenant with sample data

### Test Data Requirements
- At least 3 contacts with partyId
- At least 2 organizations with partyId
- At least 1 contact without partyId (legacy scenario)
- Multiple tags of different modules (CONTACT, ORGANIZATION, ANIMAL)
- Existing tag assignments (legacy data)

## Unit Tests

### UT-1: Party ID Resolution
**File**: `tests/tag-service.test.ts`

**Test Cases**:
1. ✅ Resolve partyId from valid contactId
2. ✅ Resolve partyId from valid organizationId
3. ✅ Return null for non-existent contactId
4. ✅ Return null for non-existent organizationId
5. ✅ Return null for contact without partyId
6. ✅ Return null for organization without partyId

**Run Command**:
```bash
cd ../breederhq-api
npm test -- tag-service.test.ts
```

**Expected Result**: All tests pass, 100% coverage on resolution functions.

---

### UT-2: Dual Write - createTagAssignment
**File**: `tests/tag-service.test.ts`

**Test Cases**:
1. ✅ Create contact tag assignment sets both contactId and taggedPartyId
2. ✅ Create org tag assignment sets both organizationId and taggedPartyId
3. ✅ Create animal tag assignment (no party, legacy behavior)
4. ✅ Create assignment for contact without partyId (taggedPartyId remains null)
5. ✅ Verify duplicate prevention (unique constraints still work)

**Run Command**:
```bash
cd ../breederhq-api
npm test -- tag-service.test.ts -t "createTagAssignment"
```

**Expected Result**: All dual-write tests pass, data persisted correctly in DB.

---

### UT-3: Dual Read - getTagsForContact
**File**: `tests/tag-service.test.ts`

**Test Cases**:
1. ✅ Retrieve tags assigned via legacy contactId
2. ✅ Retrieve tags assigned via new taggedPartyId only
3. ✅ Deduplicate tags present in both contactId and taggedPartyId
4. ✅ Return empty array for contact with no tags
5. ✅ Return empty array for non-existent contact

**Run Command**:
```bash
cd ../breederhq-api
npm test -- tag-service.test.ts -t "getTagsForContact"
```

**Expected Result**: All dual-read tests pass, no duplicates, correct deduplication.

---

### UT-4: Dual Read - getTagsForOrganization
**File**: `tests/tag-service.test.ts`

**Test Cases**:
1. ✅ Retrieve tags assigned via organizationId
2. ✅ Retrieve tags assigned via taggedPartyId only
3. ✅ Deduplicate tags correctly
4. ✅ Return empty array for org with no tags

**Run Command**:
```bash
cd ../breederhq-api
npm test -- tag-service.test.ts -t "getTagsForOrganization"
```

**Expected Result**: All tests pass.

---

## Integration Tests

### IT-1: Tag Assignment API - Contact
**Endpoint**: `POST /tags/:id/assign`

**Setup**:
1. Create a test tenant
2. Create a contact with partyId
3. Create a CONTACT tag

**Test Steps**:
```bash
# Assign tag to contact
curl -X POST http://localhost:3000/tags/{tagId}/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"contactId": 123}'
```

**Verification**:
```sql
SELECT
  "contactId",
  "taggedPartyId"
FROM "TagAssignment"
WHERE "tagId" = {tagId} AND "contactId" = 123;
```

**Expected Result**:
- API returns 201 Created
- Database row has both contactId=123 and taggedPartyId=(contact's partyId)
- Response body: `{"ok": true}`

---

### IT-2: Tag Assignment API - Organization
**Endpoint**: `POST /tags/:id/assign`

**Setup**:
1. Create an ORGANIZATION tag
2. Have an organization with partyId

**Test Steps**:
```bash
curl -X POST http://localhost:3000/tags/{tagId}/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"organizationId": 456}'
```

**Verification**:
```sql
SELECT
  "organizationId",
  "taggedPartyId"
FROM "TagAssignment"
WHERE "tagId" = {tagId} AND "organizationId" = 456;
```

**Expected Result**:
- API returns 201 Created
- Both organizationId and taggedPartyId are set correctly

---

### IT-3: Get Contact Tags API
**Endpoint**: `GET /contacts/:id/tags`

**Setup**:
1. Create contact with partyId
2. Assign multiple tags using POST /tags/:id/assign

**Test Steps**:
```bash
curl http://localhost:3000/contacts/123/tags \
  -H "Authorization: Bearer {token}"
```

**Expected Result**:
- Returns all tags assigned to the contact
- No duplicate tags in response
- Response format unchanged (backward compatible):
```json
{
  "items": [
    {
      "id": 1,
      "name": "VIP",
      "module": "CONTACT",
      "color": "#FF0000",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

---

### IT-4: Legacy Data Compatibility
**Scenario**: Existing tag assignments created before migration

**Setup**:
1. Identify existing TagAssignment rows with contactId/organizationId but no taggedPartyId
2. Do NOT run backfill yet

**Test Steps**:
```bash
# Get tags for a contact with legacy assignments
curl http://localhost:3000/contacts/{legacyContactId}/tags \
  -H "Authorization: Bearer {token}"
```

**Expected Result**:
- API still returns tags correctly via legacy contactId
- Dual-read works even when taggedPartyId is null

---

### IT-5: Post-Backfill Consistency
**Scenario**: Verify data after backfill

**Setup**:
1. Run migration: `psql -f prisma/migrations/20251224122510_party_step5_tags_party/migration.sql`
2. Run backfill: `psql -f prisma/sql/backfill_party_step5_tags.sql`

**Test Steps**:
```bash
# Get tags for same contact as IT-4
curl http://localhost:3000/contacts/{legacyContactId}/tags \
  -H "Authorization: Bearer {token}"
```

**Verification**:
```sql
SELECT COUNT(*) FROM "TagAssignment"
WHERE "taggedPartyId" IS NOT NULL;
```

**Expected Result**:
- API returns same tags as before backfill (no data loss)
- taggedPartyId is now populated for existing rows
- No duplicate tags in response

---

### IT-6: Tag Unassignment
**Endpoint**: `POST /tags/:id/unassign`

**Test Steps**:
```bash
# Unassign tag
curl -X POST http://localhost:3000/tags/{tagId}/unassign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"contactId": 123}'
```

**Verification**:
```sql
SELECT COUNT(*) FROM "TagAssignment"
WHERE "tagId" = {tagId} AND "contactId" = 123;
```

**Expected Result**:
- API returns 200 OK
- Row is deleted from database
- Subsequent GET /contacts/123/tags doesn't include this tag

---

## Regression Tests

### RT-1: Existing Tag Functionality
**Verify that non-party tag assignments still work**:

**Test Cases**:
1. ✅ Assign tag to Animal (animalId)
2. ✅ Assign tag to WaitlistEntry
3. ✅ Assign tag to OffspringGroup
4. ✅ Assign tag to Offspring
5. ✅ Unique constraints still prevent duplicates
6. ✅ Tag CRUD operations (create, read, update, delete) unchanged

---

### RT-2: API Response Format
**Verify no breaking changes to API responses**

**Test**: Compare response schemas before and after migration

**Expected Result**:
- GET /tags returns same format
- GET /contacts/:id/tags returns same format
- POST /tags/:id/assign returns same format
- POST /tags/:id/unassign returns same format
- All existing fields present, no fields removed

---

### RT-3: Module Validation
**Verify tag module matching still works**

**Test Cases**:
1. ❌ Cannot assign CONTACT tag to organization
2. ❌ Cannot assign ORGANIZATION tag to contact
3. ❌ Cannot assign ANIMAL tag to contact
4. ✅ Can assign CONTACT tag to contact
5. ✅ Can assign ORGANIZATION tag to organization
6. ✅ Can assign ANIMAL tag to animal

---

## Performance Tests

### PT-1: Query Performance
**Test that indexes are being used**

**Query 1**: Find tags for contact
```sql
EXPLAIN ANALYZE
SELECT ta.*, t.*
FROM "TagAssignment" ta
JOIN "Tag" t ON t.id = ta."tagId"
WHERE ta."taggedPartyId" = 123;
```
**Expected**: Index scan on `TagAssignment_taggedPartyId_idx`, execution time < 10ms.

**Query 2**: Find assignments for a tag and party
```sql
EXPLAIN ANALYZE
SELECT * FROM "TagAssignment"
WHERE "tagId" = 5 AND "taggedPartyId" = 123;
```
**Expected**: Uses composite index `TagAssignment_tagId_taggedPartyId_idx`.

---

### PT-2: Bulk Operations
**Test performance with large datasets**

**Setup**: Create 1000 tag assignments

**Test**:
```bash
time curl http://localhost:3000/contacts/{contactWithManyTags}/tags
```

**Expected Result**:
- Response time < 200ms
- No N+1 query issues
- Deduplication doesn't cause performance degradation

---

## Manual Testing Checklist

### Pre-Migration
- [ ] Document current number of TagAssignment rows
- [ ] Document current number of contact tag assignments
- [ ] Document current number of organization tag assignments
- [ ] Export sample tag data for comparison
- [ ] Verify API returns correct tags for sample contacts

### Post-Migration
- [ ] Verify taggedPartyId column exists
- [ ] Verify indexes created successfully
- [ ] Run all validation queries (VALIDATION_QUERIES_TAGS.md)
- [ ] Verify API still returns correct tags for same sample contacts
- [ ] Create new tag assignment and verify dual-write
- [ ] Test tag assignment via frontend (if applicable)

### Post-Backfill
- [ ] Verify backfill completion percentage > 99%
- [ ] Verify no orphaned taggedPartyId references
- [ ] Verify no data loss (tag count unchanged)
- [ ] Spot-check 10 random contacts for correct tags
- [ ] Run all integration tests
- [ ] Monitor error logs for 24 hours

---

## Acceptance Criteria

### Must Pass
1. ✅ All unit tests pass (100%)
2. ✅ All integration tests pass
3. ✅ No breaking API changes (response schemas unchanged)
4. ✅ Backfill completion >= 99%
5. ✅ Zero data integrity violations
6. ✅ Dual-write creates both legacy and new columns
7. ✅ Dual-read returns consistent results
8. ✅ Indexes are created and used
9. ✅ No performance regression (response times within 10% of baseline)
10. ✅ Legacy columns remain intact

### Should Pass
1. ✅ Deduplication works correctly
2. ✅ Frontend tag functionality unchanged (if exists)
3. ✅ No errors in production logs after deployment
4. ✅ Query performance improved (using indexes)

---

## Rollback Plan

If tests fail:

1. **Before deploying migration**:
   - Fix issues in code
   - Re-run tests
   - Do not proceed until all tests pass

2. **After deploying migration but before backfill**:
   - Migration is additive, safe to leave in place
   - Fix code issues
   - Redeploy code
   - Run backfill when ready

3. **After backfill**:
   - Migration is reversible (can drop column)
   - Backfill is reversible (can set taggedPartyId to NULL)
   - Code can be rolled back to previous version
   - Legacy columns still work

**Rollback Script**:
```sql
-- Emergency rollback (removes new column)
ALTER TABLE "TagAssignment" DROP COLUMN "taggedPartyId";
DROP INDEX IF EXISTS "TagAssignment_taggedPartyId_idx";
DROP INDEX IF EXISTS "TagAssignment_tagId_taggedPartyId_idx";
```

---

## Test Execution Log

| Test ID | Description | Status | Date | Notes |
|---------|-------------|--------|------|-------|
| UT-1 | Party ID Resolution | ⏳ Pending | | |
| UT-2 | Dual Write | ⏳ Pending | | |
| UT-3 | Dual Read Contact | ⏳ Pending | | |
| UT-4 | Dual Read Org | ⏳ Pending | | |
| IT-1 | Tag Assignment Contact | ⏳ Pending | | |
| IT-2 | Tag Assignment Org | ⏳ Pending | | |
| IT-3 | Get Contact Tags | ⏳ Pending | | |
| IT-4 | Legacy Compatibility | ⏳ Pending | | |
| IT-5 | Post-Backfill | ⏳ Pending | | |
| IT-6 | Unassignment | ⏳ Pending | | |
| RT-1 | Existing Functionality | ⏳ Pending | | |
| RT-2 | API Format | ⏳ Pending | | |
| RT-3 | Module Validation | ⏳ Pending | | |
| PT-1 | Query Performance | ⏳ Pending | | |
| PT-2 | Bulk Operations | ⏳ Pending | | |

**Legend**: ✅ Pass | ❌ Fail | ⏳ Pending | ⚠️ Warning
