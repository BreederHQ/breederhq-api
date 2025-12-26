# Test Plan: Step 6I - BreedingAttempt Stud Owner Party-Only

## Overview

This test plan validates that the BreedingAttempt domain correctly handles the transition from legacy `studOwnerContactId` to Party-only references (`studOwnerPartyId`) while maintaining backward compatibility in the API.

## Test Scope

**In Scope:**
- BreedingAttempt creation/update with `studOwnerContactId` in request
- BreedingAttempt creation/update with `studOwnerOrganizationId` in request
- BreedingAttempt listing returns legacy `studOwnerContactId` for backward compatibility
- Internal storage uses only `studOwnerPartyId`
- Breeding attempt operations (methods, success tracking, etc.)

**Out of Scope:**
- BreedingAttempt deletion (no changes)
- Non-stud-owner breeding attempt fields
- Breeding plan relationships
- Semen batch handling

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
   - Existing breeding plan ID
   - Existing breeding attempts (for update tests)

## Environment Variables

```bash
export API_BASE="http://localhost:6001"
export TENANT_ID="1"
export AUTH_TOKEN="your-dev-token-here"
```

## Test Cases

### Test 1: Create BreedingAttempt with Stud Owner Contact

**Purpose:** Verify that providing `studOwnerContactId` in the request body resolves to `studOwnerPartyId` internally and returns `studOwnerContactId` in the response.

**Endpoint:** `POST /api/v1/breeding-plans/:planId/attempts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/breeding-plans/1/attempts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "method": "AI",
    "studOwnerContactId": 1,
    "attemptAt": "2025-12-26T10:00:00.000Z",
    "notes": "Test attempt with stud owner contact"
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "tenantId": 1,
  "planId": 1,
  "method": "AI",
  "studOwnerContactId": 1,
  "attemptAt": "2025-12-26T10:00:00.000Z",
  "success": null,
  "notes": "Test attempt with stud owner contact",
  "createdAt": "2025-12-26T00:00:00.000Z",
  "updatedAt": "2025-12-26T00:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `studOwnerContactId: 1`
- [ ] Response does NOT include `studOwnerPartyId` (internal only)
- [ ] Response does NOT include `studOwnerOrganizationId`
- [ ] Database row has `studOwnerPartyId` set to the Party ID of Contact 1
- [ ] Database row has NO `studOwnerContactId` column

**DB Validation Query:**
```sql
SELECT id, "tenantId", "planId", method, "studOwnerPartyId", "attemptAt"
FROM "BreedingAttempt"
WHERE id = 123;
```

Expected: `studOwnerPartyId` should be the Party ID associated with Contact 1.

---

### Test 2: Create BreedingAttempt with Stud Owner Organization

**Purpose:** Verify that providing `studOwnerOrganizationId` in the request body resolves to `studOwnerPartyId` for organizations.

**Endpoint:** `POST /api/v1/breeding-plans/:planId/attempts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/breeding-plans/2/attempts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "method": "AI",
    "studOwnerOrganizationId": 5,
    "windowStart": "2025-12-20T00:00:00.000Z",
    "windowEnd": "2025-12-27T00:00:00.000Z",
    "notes": "Test attempt with stud owner organization"
  }'
```

**Expected Response:**
```json
{
  "id": 124,
  "tenantId": 1,
  "planId": 2,
  "method": "AI",
  "studOwnerContactId": null,
  "windowStart": "2025-12-20T00:00:00.000Z",
  "windowEnd": "2025-12-27T00:00:00.000Z",
  "success": null,
  "notes": "Test attempt with stud owner organization",
  "createdAt": "2025-12-26T00:05:00.000Z",
  "updatedAt": "2025-12-26T00:05:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `studOwnerContactId: null` (because Party is ORGANIZATION, not CONTACT)
- [ ] Database row has `studOwnerPartyId` set to the Party ID of Organization 5
- [ ] Database row has NO legacy stud owner columns

**DB Validation Query:**
```sql
SELECT ba.id, ba."tenantId", ba."planId", ba.method, ba."studOwnerPartyId", p.type, p."organizationId"
FROM "BreedingAttempt" ba
JOIN "Party" p ON p.id = ba."studOwnerPartyId"
WHERE ba.id = 124;
```

Expected: `p.type = 'ORGANIZATION'` and `p.organizationId = 5`.

---

### Test 3: Create BreedingAttempt without Stud Owner

**Purpose:** Verify that breeding attempts can be created without a stud owner reference.

**Endpoint:** `POST /api/v1/breeding-plans/:planId/attempts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/breeding-plans/3/attempts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "method": "NATURAL",
    "attemptAt": "2025-12-26T12:00:00.000Z",
    "notes": "Natural breeding attempt"
  }'
```

**Expected Response:**
```json
{
  "id": 125,
  "tenantId": 1,
  "planId": 3,
  "method": "NATURAL",
  "studOwnerContactId": null,
  "attemptAt": "2025-12-26T12:00:00.000Z",
  "success": null,
  "notes": "Natural breeding attempt",
  "createdAt": "2025-12-26T00:10:00.000Z",
  "updatedAt": "2025-12-26T00:10:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `studOwnerContactId: null`
- [ ] Database row has `studOwnerPartyId` = NULL
- [ ] Breeding attempt is successfully created without a stud owner reference

---

### Test 4: Update BreedingAttempt to Add Stud Owner

**Purpose:** Verify that updating a breeding attempt to add a stud owner works correctly.

**Endpoint:** `PATCH /api/v1/breeding-plans/:planId/attempts/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/breeding-plans/3/attempts/125" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "studOwnerContactId": 2,
    "success": true,
    "notes": "Natural breeding with external stud - successful"
  }'
```

**Expected Response:**
```json
{
  "id": 125,
  "tenantId": 1,
  "planId": 3,
  "method": "NATURAL",
  "studOwnerContactId": 2,
  "attemptAt": "2025-12-26T12:00:00.000Z",
  "success": true,
  "notes": "Natural breeding with external stud - successful",
  "updatedAt": "2025-12-26T00:15:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `studOwnerContactId: 2`
- [ ] Response shows `success: true`
- [ ] Database row has `studOwnerPartyId` set to Party ID of Contact 2

---

### Test 5: Update BreedingAttempt to Change Stud Owner

**Purpose:** Verify that changing a stud owner from contact to organization works correctly.

**Endpoint:** `PATCH /api/v1/breeding-plans/:planId/attempts/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/breeding-plans/1/attempts/123" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "studOwnerOrganizationId": 3,
    "studOwnerContactId": null
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "tenantId": 1,
  "planId": 1,
  "method": "AI",
  "studOwnerContactId": null,
  "attemptAt": "2025-12-26T10:00:00.000Z",
  "success": null,
  "updatedAt": "2025-12-26T00:20:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `studOwnerContactId: null` (stud owner is now an organization)
- [ ] Database row has `studOwnerPartyId` set to Party ID of Organization 3
- [ ] Previous stud owner (Contact 1) is no longer associated

**DB Validation Query:**
```sql
SELECT ba.id, ba."studOwnerPartyId", p.type, p."organizationId"
FROM "BreedingAttempt" ba
JOIN "Party" p ON p.id = ba."studOwnerPartyId"
WHERE ba.id = 123;
```

Expected: `p.type = 'ORGANIZATION'` and `p.organizationId = 3`.

---

### Test 6: Update BreedingAttempt to Remove Stud Owner

**Purpose:** Verify that removing a stud owner (setting to null) works correctly.

**Endpoint:** `PATCH /api/v1/breeding-plans/:planId/attempts/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/breeding-plans/1/attempts/123" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "studOwnerOrganizationId": null
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "tenantId": 1,
  "planId": 1,
  "method": "AI",
  "studOwnerContactId": null,
  "attemptAt": "2025-12-26T10:00:00.000Z",
  "success": null,
  "updatedAt": "2025-12-26T00:25:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `studOwnerContactId: null`
- [ ] Database row has `studOwnerPartyId` = NULL
- [ ] Stud owner successfully removed

---

### Test 7: List BreedingAttempts - Verify Legacy Fields in Response

**Purpose:** Verify that when listing breeding attempts, the response includes the derived `studOwnerContactId` for backward compatibility.

**Endpoint:** `GET /api/v1/breeding-plans/:planId/attempts`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/breeding-plans/3/attempts" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response Excerpt:**
```json
{
  "attempts": [
    {
      "id": 125,
      "planId": 3,
      "method": "NATURAL",
      "studOwnerContactId": 2,
      "attemptAt": "2025-12-26T12:00:00.000Z",
      "success": true
    }
  ]
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] All attempts include `studOwnerContactId` field
- [ ] Attempts with CONTACT stud owners show correct `studOwnerContactId`
- [ ] Attempts with ORGANIZATION stud owners show `studOwnerContactId: null`
- [ ] Response does NOT include `studOwnerPartyId` (internal only)

---

### Test 8: Get Single BreedingAttempt - Verify Legacy Fields

**Purpose:** Verify that getting a single breeding attempt returns derived legacy stud owner fields.

**Endpoint:** `GET /api/v1/breeding-plans/:planId/attempts/:id`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/breeding-plans/3/attempts/125" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response:**
```json
{
  "id": 125,
  "tenantId": 1,
  "planId": 3,
  "method": "NATURAL",
  "studOwnerContactId": 2,
  "attemptAt": "2025-12-26T12:00:00.000Z",
  "windowStart": null,
  "windowEnd": null,
  "success": true,
  "notes": "Natural breeding with external stud - successful",
  "createdAt": "2025-12-26T00:10:00.000Z",
  "updatedAt": "2025-12-26T00:15:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `studOwnerContactId: 2`
- [ ] Response does NOT include `studOwnerPartyId` or `studOwnerOrganizationId`
- [ ] All breeding attempt fields present

---

### Test 9: Edge Case - Invalid studOwnerContactId

**Purpose:** Verify that providing an invalid `studOwnerContactId` (non-existent contact) results in appropriate error or null handling.

**Endpoint:** `POST /api/v1/breeding-plans/:planId/attempts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/breeding-plans/1/attempts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "method": "AI",
    "studOwnerContactId": 99999,
    "attemptAt": "2025-12-26T14:00:00.000Z"
  }'
```

**Expected Behavior:**
- Option A: Return error indicating contact not found (preferred)
- Option B: Create attempt with `studOwnerPartyId = null` (fallback)

**Validation:**
- [ ] Response handles invalid contact gracefully
- [ ] No database integrity errors
- [ ] Clear error message if validation fails

---

### Test 10: Breeding Workflow - Complete Attempt Lifecycle

**Purpose:** Verify that a complete breeding attempt workflow works correctly with Party-based stud owner.

**Endpoint:** Multiple endpoints

**Workflow:**
1. Create breeding attempt with stud owner
2. Update with attempt date
3. Mark as successful
4. Verify all data persists

**Request Sequence:**
```bash
# 1. Create breeding attempt
curl -X POST "${API_BASE}/api/v1/breeding-plans/4/attempts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "method": "AI",
    "studOwnerContactId": 1,
    "windowStart": "2025-12-20T00:00:00.000Z",
    "windowEnd": "2025-12-27T00:00:00.000Z"
  }'

# 2. Update with actual attempt date (assume attempt ID = 126)
curl -X PATCH "${API_BASE}/api/v1/breeding-plans/4/attempts/126" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "attemptAt": "2025-12-23T10:00:00.000Z",
    "notes": "Insemination performed"
  }'

# 3. Mark as successful after confirmation
curl -X PATCH "${API_BASE}/api/v1/breeding-plans/4/attempts/126" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "success": true,
    "notes": "Insemination performed - pregnancy confirmed"
  }'
```

**Validation:**
- [ ] All steps complete successfully
- [ ] `studOwnerContactId` is returned at each step
- [ ] `studOwnerPartyId` is consistent in database throughout workflow
- [ ] All attempt fields (method, dates, success, notes) are preserved
- [ ] Stud owner relationship remains intact

---

## Acceptance Criteria

- [ ] All test cases pass
- [ ] Legacy `studOwnerContactId` field is returned in API responses for backward compatibility
- [ ] Internal storage uses only `studOwnerPartyId`
- [ ] No TypeScript errors in build
- [ ] Database validation queries show correct Party relationships
- [ ] No orphaned breeding attempts (all `studOwnerPartyId` values reference valid Parties)
- [ ] Breeding workflow completes successfully with Party-based stud owners
- [ ] Stud owner changes (add, update, remove) work correctly

## Rollback Plan

If tests fail:
1. Revert schema changes in `prisma/schema.prisma`
2. Run `npm run db:dev` to restore previous schema
3. Revert code changes in breeding attempt routes/services
4. Restart dev server

## Notes

- The mapping layer in breeding attempt routes handles backward compatibility
- Helper functions should derive `studOwnerContactId` from Party backing
- Party resolution should use the `resolvePartyId()` service from `src/services/party-resolver.ts`
- Not all breeding attempts have stud owners (depends on breeding method and ownership arrangement)
- Stud owner is typically relevant for AI or when using external stud services
- Natural breeding may or may not have stud owner depending on ownership arrangements
- Success field is nullable until breeding outcome is known

## Related Documentation

- Validation Queries: `VALIDATION_QUERIES_STEP6I_BREEDINGATTEMPT.md`
- Migration SQL: `prisma/migrations/TIMESTAMP_step6i_breedingattempt_studowner_party_only/migration.sql`
- Party Migration Overview: See main project documentation
