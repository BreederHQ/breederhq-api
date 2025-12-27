# Test Plan: Step 6A - Attachments Party-Only

## Overview

This test plan validates that the Attachments domain correctly handles the transition from legacy `contactId` to Party-only references (`attachmentPartyId`) while maintaining backward compatibility in the API.

## Test Scope

**In Scope:**
- Attachment creation with `contactId` in request
- Attachment creation with `organizationId` in request
- Attachment listing returns legacy `contactId` for backward compatibility
- Internal storage uses only `attachmentPartyId`

**Out of Scope:**
- Other domains (Tags, Offspring, Finance, etc.)
- Attachment deletion (no changes)
- Non-party attachment fields

## Prerequisites

1. Development environment running:
   ```bash
   cd breederhq-api
   npm run dev
   ```

2. Valid tenant ID and authentication token

3. Test data:
   - Existing offspring group ID
   - Existing contact ID with associated Party
   - Existing organization ID with associated Party

## Environment Variables

```bash
export API_BASE="http://localhost:6001"
export TENANT_ID="1"
export AUTH_TOKEN="your-dev-token-here"
```

## Test Cases

### Test 1: Create Attachment with contactId

**Purpose:** Verify that providing `contactId` in the request body resolves to `attachmentPartyId` internally and returns `contactId` in the response.

**Endpoint:** `POST /api/v1/offspring/:groupId/attachments`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/offspring/1/attachments" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "contactId": 1,
    "kind": "photo",
    "storageProvider": "s3",
    "storageKey": "test/photo1.jpg",
    "filename": "photo1.jpg",
    "mime": "image/jpeg",
    "bytes": 12345
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "tenantId": 1,
  "offspringGroupId": 1,
  "contactId": 1,
  "kind": "photo",
  "storageProvider": "s3",
  "storageKey": "test/photo1.jpg",
  "filename": "photo1.jpg",
  "mime": "image/jpeg",
  "bytes": 12345,
  "createdAt": "2025-12-25T12:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `contactId: 1`
- [ ] Response does NOT include `attachmentPartyId` (internal only)
- [ ] Database row has `attachmentPartyId` set to the Party ID of Contact 1
- [ ] Database row has `contactId` column removed (no longer exists)

**DB Validation Query:**
```sql
SELECT id, "tenantId", "attachmentPartyId", "offspringGroupId"
FROM "Attachment"
WHERE id = 123;
```

Expected: `attachmentPartyId` should be the Party ID associated with Contact 1.

---

### Test 2: Create Attachment with organizationId

**Purpose:** Verify that providing `organizationId` in the request body resolves to `attachmentPartyId` for organizations.

**Endpoint:** `POST /api/v1/offspring/:groupId/attachments`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/offspring/1/attachments" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "organizationId": 5,
    "kind": "document",
    "storageProvider": "s3",
    "storageKey": "test/doc1.pdf",
    "filename": "doc1.pdf",
    "mime": "application/pdf",
    "bytes": 54321
  }'
```

**Expected Response:**
```json
{
  "id": 124,
  "tenantId": 1,
  "offspringGroupId": 1,
  "contactId": null,
  "kind": "document",
  "storageProvider": "s3",
  "storageKey": "test/doc1.pdf",
  "filename": "doc1.pdf",
  "mime": "application/pdf",
  "bytes": 54321,
  "createdAt": "2025-12-25T12:05:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `contactId: null` (because Party is ORGANIZATION, not CONTACT)
- [ ] Database row has `attachmentPartyId` set to the Party ID of Organization 5
- [ ] Database row has `contactId` column removed (no longer exists)

**DB Validation Query:**
```sql
SELECT a.id, a."tenantId", a."attachmentPartyId", p.type, p."organizationId"
FROM "Attachment" a
JOIN "Party" p ON p.id = a."attachmentPartyId"
WHERE a.id = 124;
```

Expected: `p.type = 'ORGANIZATION'` and `p.organizationId = 5`.

---

### Test 3: Create Attachment without Party Reference

**Purpose:** Verify that attachments can be created without a party reference (both `contactId` and `organizationId` omitted).

**Endpoint:** `POST /api/v1/offspring/:groupId/attachments`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/offspring/1/attachments" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "kind": "note",
    "storageProvider": "s3",
    "storageKey": "test/note1.txt",
    "filename": "note1.txt",
    "mime": "text/plain",
    "bytes": 256
  }'
```

**Expected Response:**
```json
{
  "id": 125,
  "tenantId": 1,
  "offspringGroupId": 1,
  "contactId": null,
  "kind": "note",
  "storageProvider": "s3",
  "storageKey": "test/note1.txt",
  "filename": "note1.txt",
  "mime": "text/plain",
  "bytes": 256,
  "createdAt": "2025-12-25T12:10:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `contactId: null`
- [ ] Database row has `attachmentPartyId` = NULL
- [ ] Attachment is successfully created without a party reference

---

### Test 4: List Attachments - Verify Legacy Fields in Response

**Purpose:** Verify that when listing attachments for an offspring group, the response includes the derived `contactId` for backward compatibility.

**Endpoint:** `GET /api/v1/offspring/:groupId`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/offspring/1" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response Excerpt:**
```json
{
  "id": 1,
  "tenantId": 1,
  "Attachment": [
    {
      "id": 123,
      "contactId": 1,
      "kind": "photo",
      "filename": "photo1.jpg"
    },
    {
      "id": 124,
      "contactId": null,
      "kind": "document",
      "filename": "doc1.pdf"
    },
    {
      "id": 125,
      "contactId": null,
      "kind": "note",
      "filename": "note1.txt"
    }
  ]
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] All attachments include `contactId` field
- [ ] Attachment 123 has `contactId: 1` (derived from Party backing)
- [ ] Attachment 124 has `contactId: null` (Party is ORGANIZATION)
- [ ] Attachment 125 has `contactId: null` (no Party reference)
- [ ] Response does NOT include `attachmentPartyId` (internal only)

---

### Test 5: Edge Case - Invalid contactId

**Purpose:** Verify that providing an invalid `contactId` (non-existent contact) results in `attachmentPartyId = null` and does not cause an error.

**Endpoint:** `POST /api/v1/offspring/:groupId/attachments`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/offspring/1/attachments" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "contactId": 99999,
    "kind": "photo",
    "storageProvider": "s3",
    "storageKey": "test/invalid.jpg",
    "filename": "invalid.jpg",
    "mime": "image/jpeg",
    "bytes": 1000
  }'
```

**Expected Response:**
```json
{
  "id": 126,
  "tenantId": 1,
  "offspringGroupId": 1,
  "contactId": null,
  "kind": "photo",
  "storageProvider": "s3",
  "storageKey": "test/invalid.jpg",
  "filename": "invalid.jpg",
  "mime": "image/jpeg",
  "bytes": 1000,
  "createdAt": "2025-12-25T12:15:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `contactId: null` (because contact 99999 doesn't exist)
- [ ] Database row has `attachmentPartyId` = NULL
- [ ] No error is thrown

---

## Acceptance Criteria

- [ ] All test cases pass
- [ ] Legacy `contactId` field is returned in API responses for backward compatibility
- [ ] Internal storage uses only `attachmentPartyId`
- [ ] No TypeScript errors in build
- [ ] Database validation queries show correct Party relationships
- [ ] No orphaned attachments (all `attachmentPartyId` values reference valid Parties)

## Rollback Plan

If tests fail:
1. Revert schema changes in `prisma/schema.prisma`
2. Run `npm run db:dev` to restore previous schema
3. Revert code changes in `src/routes/offspring.ts`
4. Restart dev server

## Notes

- The mapping layer in `src/routes/offspring.ts` handles backward compatibility
- The `attachmentWithLegacyFields()` helper derives `contactId` from Party backing
- The `ATTACHMENT_INCLUDE_PARTY` constant ensures Party data is fetched for mapping
- Party resolution uses the `resolvePartyId()` service from `src/services/party-resolver.ts`
