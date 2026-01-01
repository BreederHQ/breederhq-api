# Step 6B: Tags Party-Only - Test Plan

This document contains manual test cases for Step 6B of the Party migration, which removes legacy `contactId` and `organizationId` columns from `TagAssignment`.

## Overview

**Domain**: Tags (TagAssignment)
**Migration**: Step 6B - Party-only storage
**Risk Level**: Medium (column drop, but API remains compatible)

## Prerequisites

1. Step 5 completed successfully (all Contacts and Organizations have `partyId`)
2. Migration applied via `db push` or manual migration script
3. Backend service restarted with updated Prisma client
4. Valid auth token with tenant access

## Environment Setup

```bash
# Set your dev API URL
export API_URL="http://localhost:3000"

# Get auth token (replace with your method)
export AUTH_TOKEN="your-token-here"

# Set tenant ID
export TENANT_ID="1"
```

## Test Cases

### TC1: Create Tag for Contacts

**Endpoint**: `POST /tags`

```bash
curl -X POST "$API_URL/tags" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP Client",
    "module": "CONTACT",
    "color": "#FF5733"
  }'
```

**Expected Response**: `201 Created`
```json
{
  "id": 123,
  "name": "VIP Client",
  "module": "CONTACT",
  "color": "#FF5733",
  "createdAt": "2025-12-25T12:00:00.000Z",
  "updatedAt": "2025-12-25T12:00:00.000Z"
}
```

**Save the tag ID** for use in subsequent tests.

### TC2: Assign Tag to Contact (Legacy API)

**Endpoint**: `POST /tags/:tagId/assign`

This tests backward compatibility - API still accepts `contactId` as input.

```bash
# Replace TAG_ID and CONTACT_ID with actual values
export TAG_ID="123"
export CONTACT_ID="456"

curl -X POST "$API_URL/tags/$TAG_ID/assign" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"contactId\": $CONTACT_ID}"
```

**Expected Response**: `201 Created`
```json
{
  "ok": true
}
```

**Database Verification**:
```sql
-- Should show assignment with ONLY taggedPartyId (no contactId column)
SELECT id, "tagId", "taggedPartyId", "animalId"
FROM "TagAssignment"
WHERE "tagId" = 123;
```

### TC3: List Tags for Contact (Legacy API)

**Endpoint**: `GET /contacts/:contactId/tags`

This tests backward compatibility - API still works with contactId path parameter.

```bash
curl -X GET "$API_URL/contacts/$CONTACT_ID/tags" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected Response**: `200 OK`
```json
{
  "items": [
    {
      "id": 123,
      "name": "VIP Client",
      "module": "CONTACT",
      "color": "#FF5733",
      "createdAt": "2025-12-25T12:00:00.000Z",
      "updatedAt": "2025-12-25T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

### TC4: Create Tag for Organizations

**Endpoint**: `POST /tags`

```bash
curl -X POST "$API_URL/tags" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Preferred Vendor",
    "module": "ORGANIZATION",
    "color": "#3498DB"
  }'
```

**Expected Response**: `201 Created`

**Save the organization tag ID**.

### TC5: Assign Tag to Organization (Legacy API)

**Endpoint**: `POST /tags/:tagId/assign`

```bash
# Replace ORG_TAG_ID and ORG_ID with actual values
export ORG_TAG_ID="124"
export ORG_ID="789"

curl -X POST "$API_URL/tags/$ORG_TAG_ID/assign" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"organizationId\": $ORG_ID}"
```

**Expected Response**: `201 Created`
```json
{
  "ok": true
}
```

**Database Verification**:
```sql
-- Should show assignment with ONLY taggedPartyId (no organizationId column)
SELECT id, "tagId", "taggedPartyId"
FROM "TagAssignment"
WHERE "tagId" = 124;
```

### TC6: List Tags for Organization (NEW Endpoint)

**Endpoint**: `GET /organizations/:organizationId/tags`

This endpoint was added in Step 6B.

```bash
curl -X GET "$API_URL/organizations/$ORG_ID/tags" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected Response**: `200 OK`
```json
{
  "items": [
    {
      "id": 124,
      "name": "Preferred Vendor",
      "module": "ORGANIZATION",
      "color": "#3498DB",
      "createdAt": "2025-12-25T12:00:00.000Z",
      "updatedAt": "2025-12-25T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

### TC7: Unassign Tag from Contact

**Endpoint**: `POST /tags/:tagId/unassign`

```bash
curl -X POST "$API_URL/tags/$TAG_ID/unassign" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"contactId\": $CONTACT_ID}"
```

**Expected Response**: `200 OK`
```json
{
  "ok": true
}
```

**Verification**:
```bash
# Should return empty list
curl -X GET "$API_URL/contacts/$CONTACT_ID/tags" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected**:
```json
{
  "items": [],
  "total": 0
}
```

### TC8: Unassign Tag from Organization

**Endpoint**: `POST /tags/:tagId/unassign`

```bash
curl -X POST "$API_URL/tags/$ORG_TAG_ID/unassign" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"organizationId\": $ORG_ID}"
```

**Expected Response**: `200 OK`
```json
{
  "ok": true
}
```

### TC9: Error - Assign Tag with Module Mismatch

**Test**: Try to assign an ORGANIZATION tag to a Contact

```bash
curl -X POST "$API_URL/tags/$ORG_TAG_ID/assign" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"contactId\": $CONTACT_ID}"
```

**Expected Response**: `400 Bad Request`
```json
{
  "error": "module_mismatch"
}
```

### TC10: Error - Contact Without PartyId

**Setup**:
```sql
-- Create a contact without partyId (should not exist in production)
INSERT INTO "Contact" ("tenantId", "display_name")
VALUES (1, 'Legacy Contact Without Party')
RETURNING id;
```

**Test**:
```bash
# Use the returned contact ID
export LEGACY_CONTACT_ID="999"

curl -X POST "$API_URL/tags/$TAG_ID/assign" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"contactId\": $LEGACY_CONTACT_ID}"
```

**Expected Response**: `500 Internal Server Error`
Error message should indicate contact has no partyId.

**Cleanup**:
```sql
DELETE FROM "Contact" WHERE id = 999;
```

## Edge Cases

### EC1: Duplicate Assignment Prevention

**Test**: Try to assign the same tag to the same contact twice

```bash
# First assignment
curl -X POST "$API_URL/tags/$TAG_ID/assign" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"contactId\": $CONTACT_ID}"

# Second assignment (duplicate)
curl -X POST "$API_URL/tags/$TAG_ID/assign" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"contactId\": $CONTACT_ID}"
```

**Expected**: Second request returns `409 Conflict` with error `already_assigned`

### EC2: Cross-Tenant Tag Assignment

**Test**: Try to assign a tag from Tenant A to a contact in Tenant B

This should fail at the authorization/validation layer before reaching tag service.

### EC3: List Tags for Non-Existent Contact

```bash
curl -X GET "$API_URL/contacts/999999/tags" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected Response**: `404 Not Found`
```json
{
  "error": "contact_not_found"
}
```

## Database Schema Verification

After all tests, verify the schema changes:

```sql
-- 1. Verify legacy columns are dropped
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'TagAssignment'
  AND column_name IN ('contactId', 'organizationId');
-- Expected: 0 rows

-- 2. Verify taggedPartyId exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'TagAssignment'
  AND column_name = 'taggedPartyId';
-- Expected: 1 row (integer, YES)

-- 3. Verify unique constraint
SELECT conname
FROM pg_constraint
WHERE conrelid = 'TagAssignment'::regclass
  AND conname = 'TagAssignment_tagId_taggedPartyId_key';
-- Expected: 1 row

-- 4. Verify FK constraint
SELECT conname
FROM pg_constraint
WHERE conrelid = 'TagAssignment'::regclass
  AND conname = 'TagAssignment_taggedPartyId_fkey';
-- Expected: 1 row
```

## Unit Test Execution

Run the updated unit tests:

```bash
cd ../breederhq-api
npm test -- tests/tag-service.test.ts
```

**Expected**: All tests pass

## Success Criteria

- ✅ All API endpoints remain backward compatible
- ✅ Tag assignment accepts legacy `contactId` and `organizationId` inputs
- ✅ Tag reads work correctly for both contacts and organizations
- ✅ Database stores only `taggedPartyId` (no legacy columns)
- ✅ Unique constraint on (tagId, taggedPartyId) is enforced
- ✅ No orphan references or NULL taggedPartyId values
- ✅ Unit tests pass
- ✅ No TypeScript errors

## Rollback Testing

If rollback is required, test the rollback procedure from `VALIDATION_QUERIES_STEP6_TAGS.md` in a non-production environment first.

## Notes

- API contract unchanged - clients don't need updates
- Backend maps legacy IDs to Party IDs transparently
- New GET /organizations/:id/tags endpoint added
- This completes Party migration for Tags domain
