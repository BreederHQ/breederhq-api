# Test Plan: Step 6H - AnimalOwner Party-Only

## Overview

This test plan validates that the AnimalOwner domain correctly handles the transition from legacy `contactId`, `organizationId`, and `partyType` to Party-only references (`partyId`) while maintaining backward compatibility in the API.

## Test Scope

**In Scope:**
- AnimalOwner creation with `contactId` in request
- AnimalOwner creation with `organizationId` in request
- AnimalOwner listing returns legacy `contactId` or `organizationId` for backward compatibility
- Internal storage uses only `partyId`
- Co-ownership scenarios (multiple owners per animal)
- Primary owner designation
- Ownership percentage tracking

**Out of Scope:**
- AnimalOwner deletion (no changes to deletion logic)
- Animal CRUD operations (handled separately)
- Other animal relationships (buyers, litters, offspring)

## Prerequisites

1. Development environment running:
   ```bash
   cd breederhq-api
   npm run dev
   ```

2. Valid tenant ID and authentication token

3. Test data:
   - Existing contact ID with associated Party
   - Existing organization ID with associated Party
   - Existing animals (for owner assignment tests)

## Environment Variables

```bash
export API_BASE="http://localhost:6001"
export TENANT_ID="1"
export AUTH_TOKEN="your-dev-token-here"
```

## Test Cases

### Test 1: Add Contact Owner to Animal

**Purpose:** Verify that providing `contactId` in the request body resolves to `partyId` internally and returns `contactId` in the response.

**Endpoint:** `POST /api/v1/animals/:animalId/owners`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/animals/1/owners" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "contactId": 1,
    "percent": 100,
    "isPrimary": true
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "animalId": 1,
  "contactId": 1,
  "percent": 100,
  "isPrimary": true,
  "createdAt": "2025-12-25T00:00:00.000Z",
  "updatedAt": "2025-12-25T00:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `contactId: 1`
- [ ] Response does NOT include `partyId` (internal only)
- [ ] Response does NOT include `organizationId` or `partyType`
- [ ] Database row has `partyId` set to the Party ID of Contact 1
- [ ] Database row has NO `contactId`, `organizationId`, or `partyType` columns

**DB Validation Query:**
```sql
SELECT id, "animalId", "partyId", percent, "isPrimary"
FROM "AnimalOwner"
WHERE id = 123;
```

Expected: `partyId` should be the Party ID associated with Contact 1.

---

### Test 2: Add Organization Owner to Animal

**Purpose:** Verify that providing `organizationId` in the request body resolves to `partyId` for organizations.

**Endpoint:** `POST /api/v1/animals/:animalId/owners`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/animals/2/owners" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "organizationId": 5,
    "percent": 100,
    "isPrimary": true
  }'
```

**Expected Response:**
```json
{
  "id": 124,
  "animalId": 2,
  "organizationId": 5,
  "percent": 100,
  "isPrimary": true,
  "createdAt": "2025-12-25T00:05:00.000Z",
  "updatedAt": "2025-12-25T00:05:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `organizationId: 5`
- [ ] Response does NOT include `contactId` (because Party is ORGANIZATION, not CONTACT)
- [ ] Database row has `partyId` set to the Party ID of Organization 5
- [ ] Database row has NO legacy owner columns

**DB Validation Query:**
```sql
SELECT ao.id, ao."animalId", ao."partyId", p.type, p."organizationId"
FROM "AnimalOwner" ao
JOIN "Party" p ON p.id = ao."partyId"
WHERE ao.id = 124;
```

Expected: `p.type = 'ORGANIZATION'` and `p.organizationId = 5`.

---

### Test 3: Add Co-Owner (Multiple Owners)

**Purpose:** Verify that multiple owners can be added to the same animal with different ownership percentages.

**Endpoint:** `POST /api/v1/animals/:animalId/owners`

**Request Sequence:**
```bash
# Add first owner (50%)
curl -X POST "${API_BASE}/api/v1/animals/3/owners" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "contactId": 1,
    "percent": 50,
    "isPrimary": true
  }'

# Add second owner (50%)
curl -X POST "${API_BASE}/api/v1/animals/3/owners" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "contactId": 2,
    "percent": 50,
    "isPrimary": false
  }'
```

**Expected Response (second request):**
```json
{
  "id": 126,
  "animalId": 3,
  "contactId": 2,
  "percent": 50,
  "isPrimary": false,
  "createdAt": "2025-12-25T00:10:00.000Z",
  "updatedAt": "2025-12-25T00:10:00.000Z"
}
```

**Validation:**
- [ ] Both requests succeed with `201 Created`
- [ ] Database has two AnimalOwner records for animal 3
- [ ] Total ownership percentage = 100%
- [ ] One owner is marked as primary
- [ ] Each owner has correct partyId

---

### Test 4: List Animal Owners - Verify Legacy Fields

**Purpose:** Verify that when listing animal owners, the response includes the derived `contactId` or `organizationId` for backward compatibility.

**Endpoint:** `GET /api/v1/animals/:animalId/owners`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/animals/3/owners" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response:**
```json
{
  "owners": [
    {
      "id": 125,
      "animalId": 3,
      "contactId": 1,
      "percent": 50,
      "isPrimary": true
    },
    {
      "id": 126,
      "animalId": 3,
      "contactId": 2,
      "percent": 50,
      "isPrimary": false
    }
  ]
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] All owners include `contactId` or `organizationId` field (based on Party type)
- [ ] Response does NOT include `partyId` (internal only)
- [ ] Primary owner is correctly flagged
- [ ] Ownership percentages are correct

---

### Test 5: Update Owner Percentage

**Purpose:** Verify that updating an owner's percentage works correctly.

**Endpoint:** `PATCH /api/v1/animals/:animalId/owners/:ownerId`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/animals/3/owners/125" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "percent": 60
  }'
```

**Expected Response:**
```json
{
  "id": 125,
  "animalId": 3,
  "contactId": 1,
  "percent": 60,
  "isPrimary": true,
  "updatedAt": "2025-12-25T00:15:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Ownership percentage updated to 60%
- [ ] Other fields remain unchanged
- [ ] Database reflects the change

---

### Test 6: Change Primary Owner

**Purpose:** Verify that changing which owner is primary works correctly.

**Endpoint:** `PATCH /api/v1/animals/:animalId/owners/:ownerId`

**Request:**
```bash
# Set first owner to non-primary
curl -X PATCH "${API_BASE}/api/v1/animals/3/owners/125" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "isPrimary": false
  }'

# Set second owner to primary
curl -X PATCH "${API_BASE}/api/v1/animals/3/owners/126" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "isPrimary": true
  }'
```

**Validation:**
- [ ] Both requests succeed with `200 OK`
- [ ] Only one owner is marked as primary
- [ ] Primary flag is correctly updated

---

### Test 7: Remove Owner

**Purpose:** Verify that removing an owner works correctly.

**Endpoint:** `DELETE /api/v1/animals/:animalId/owners/:ownerId`

**Request:**
```bash
curl -X DELETE "${API_BASE}/api/v1/animals/3/owners/126" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response:**
```json
{
  "message": "Owner removed successfully"
}
```

**Validation:**
- [ ] Response status is `200 OK` or `204 No Content`
- [ ] AnimalOwner record is deleted from database
- [ ] Animal 3 now has only one owner
- [ ] Remaining owner's data is intact

---

### Test 8: Replace Owner (Contact to Organization)

**Purpose:** Verify that replacing a contact owner with an organization owner works correctly.

**Endpoint:** Multiple endpoints

**Workflow:**
1. Remove existing contact owner
2. Add organization owner

**Request Sequence:**
```bash
# Remove contact owner
curl -X DELETE "${API_BASE}/api/v1/animals/1/owners/123" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"

# Add organization owner
curl -X POST "${API_BASE}/api/v1/animals/1/owners" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "organizationId": 3,
    "percent": 100,
    "isPrimary": true
  }'
```

**Validation:**
- [ ] Both operations succeed
- [ ] Animal 1 now has organization owner instead of contact owner
- [ ] Response includes `organizationId`, not `contactId`
- [ ] Database has correct partyId for organization

---

### Test 9: Edge Case - Invalid contactId

**Purpose:** Verify that providing an invalid `contactId` (non-existent contact) results in appropriate error.

**Endpoint:** `POST /api/v1/animals/:animalId/owners`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/animals/1/owners" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "contactId": 99999,
    "percent": 100,
    "isPrimary": true
  }'
```

**Expected Behavior:**
- Return error indicating contact not found (preferred)

**Validation:**
- [ ] Response status is `400 Bad Request` or `404 Not Found`
- [ ] Error message clearly indicates contact not found
- [ ] No database record created
- [ ] No orphaned Party records

---

### Test 10: Edge Case - Duplicate Owner

**Purpose:** Verify that adding the same owner twice to the same animal is prevented.

**Endpoint:** `POST /api/v1/animals/:animalId/owners`

**Request:**
```bash
# Add owner first time
curl -X POST "${API_BASE}/api/v1/animals/5/owners" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "contactId": 1,
    "percent": 50,
    "isPrimary": true
  }'

# Try to add same owner again
curl -X POST "${API_BASE}/api/v1/animals/5/owners" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "contactId": 1,
    "percent": 50,
    "isPrimary": false
  }'
```

**Expected Behavior:**
- Second request should fail with unique constraint violation

**Validation:**
- [ ] First request succeeds with `201 Created`
- [ ] Second request fails with `400 Bad Request` or `409 Conflict`
- [ ] Error message indicates duplicate owner
- [ ] Only one AnimalOwner record exists in database

---

### Test 11: Get Animal with Owners

**Purpose:** Verify that fetching an animal includes owner information with legacy fields.

**Endpoint:** `GET /api/v1/animals/:id` (with owners included)

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/animals/3?include=owners" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response:**
```json
{
  "id": 3,
  "name": "Test Animal",
  "species": "DOG",
  "owners": [
    {
      "id": 125,
      "animalId": 3,
      "contactId": 1,
      "percent": 60,
      "isPrimary": true
    }
  ]
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Animal object includes owners array
- [ ] Each owner includes `contactId` or `organizationId`
- [ ] Owners do NOT include `partyId` (internal only)

---

### Test 12: Ownership Transfer Workflow

**Purpose:** Verify a complete ownership transfer scenario.

**Endpoint:** Multiple endpoints

**Workflow:**
1. Create animal with initial owner (Contact 1, 100%)
2. Add second owner (Contact 2, 50%)
3. Update first owner to 50%
4. Change primary to second owner
5. Remove first owner
6. Update second owner to 100%

**Request Sequence:**
```bash
# 1. Create animal (assume created with default owner or no owner)
# 2. Add first owner
curl -X POST "${API_BASE}/api/v1/animals/10/owners" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "contactId": 1,
    "percent": 100,
    "isPrimary": true
  }'

# 3. Add second owner
curl -X POST "${API_BASE}/api/v1/animals/10/owners" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "contactId": 2,
    "percent": 50,
    "isPrimary": false
  }'

# 4. Update first owner to 50%
curl -X PATCH "${API_BASE}/api/v1/animals/10/owners/{owner1_id}" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "percent": 50
  }'

# 5. Change primary to second owner
curl -X PATCH "${API_BASE}/api/v1/animals/10/owners/{owner2_id}" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "isPrimary": true
  }'

# 6. Remove first owner
curl -X DELETE "${API_BASE}/api/v1/animals/10/owners/{owner1_id}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"

# 7. Update second owner to 100%
curl -X PATCH "${API_BASE}/api/v1/animals/10/owners/{owner2_id}" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "percent": 100
  }'
```

**Validation:**
- [ ] All steps complete successfully
- [ ] Final state: Animal 10 has only Contact 2 as 100% owner
- [ ] Owner history is correctly managed
- [ ] Database integrity maintained throughout

---

## Acceptance Criteria

- [ ] All test cases pass
- [ ] Legacy `contactId` and `organizationId` fields are returned in API responses for backward compatibility
- [ ] Internal storage uses only `partyId`
- [ ] No TypeScript errors in build
- [ ] Database validation queries show correct Party relationships
- [ ] No orphaned animal owners (all `partyId` values reference valid Parties)
- [ ] Co-ownership scenarios work correctly
- [ ] Ownership transfer workflows complete successfully
- [ ] Unique constraint prevents duplicate owners
- [ ] Primary owner flag works correctly

## Rollback Plan

If tests fail:
1. Revert schema changes in `prisma/schema.prisma`
2. Run `npm run db:dev` to restore previous schema
3. Revert code changes in animal owner routes/services
4. Restart dev server

## Notes

- The mapping layer in animal owner routes handles backward compatibility
- Helper functions should derive `contactId` or `organizationId` from Party backing
- Party resolution should use the `resolvePartyId()` service from `src/services/party-resolver.ts`
- Co-ownership is a common pattern for breeding programs
- Each owner should have a percentage representing their ownership share
- Total ownership percentages should ideally sum to 100%, but may vary
- Typically one owner is designated as primary for communication purposes
- AnimalOwner is separate from buyer tracking (Animal.buyerPartyId)

## Related Documentation

- Validation Queries: `VALIDATION_QUERIES_STEP6H_ANIMALOWNER.md`
- Migration SQL: `prisma/migrations/20251225185510_step6h_animalowner_party_only/migration.sql`
- Party Migration Overview: See main project documentation
