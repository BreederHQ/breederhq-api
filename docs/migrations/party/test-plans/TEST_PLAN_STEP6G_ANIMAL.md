# Test Plan: Step 6G - Animal Buyer Party-Only

## Overview

This test plan validates that the Animal domain correctly handles the transition from legacy `buyerContactId`, `buyerOrganizationId`, and `buyerPartyType` to Party-only references (`buyerPartyId`) while maintaining backward compatibility in the API.

## Test Scope

**In Scope:**
- Animal creation/update with `buyerContactId` in request
- Animal creation/update with `buyerOrganizationId` in request
- Animal listing returns legacy `buyerContactId` for backward compatibility
- Internal storage uses only `buyerPartyId`
- Sale-related operations (pricing, placement, etc.)

**Out of Scope:**
- Animal deletion (no changes)
- Non-buyer animal fields
- Animal ownership (handled separately via AnimalOwner)
- Other animal relationships (litters, offspring, etc.)

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
   - Existing animals (for update tests)

## Environment Variables

```bash
export API_BASE="http://localhost:6001"
export TENANT_ID="1"
export AUTH_TOKEN="your-dev-token-here"
```

## Test Cases

### Test 1: Create Animal with Buyer Contact

**Purpose:** Verify that providing `buyerContactId` in the request body resolves to `buyerPartyId` internally and returns `buyerContactId` in the response.

**Endpoint:** `POST /api/v1/animals`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/animals" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "name": "Test Puppy 1",
    "species": "DOG",
    "sex": "MALE",
    "buyerContactId": 1,
    "priceCents": 150000,
    "depositCents": 50000
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "tenantId": 1,
  "name": "Test Puppy 1",
  "species": "DOG",
  "sex": "MALE",
  "status": "ACTIVE",
  "buyerContactId": 1,
  "priceCents": 150000,
  "depositCents": 50000,
  "createdAt": "2025-12-26T00:00:00.000Z",
  "updatedAt": "2025-12-26T00:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `buyerContactId: 1`
- [ ] Response does NOT include `buyerPartyId` (internal only)
- [ ] Response does NOT include `buyerOrganizationId` or `buyerPartyType`
- [ ] Database row has `buyerPartyId` set to the Party ID of Contact 1
- [ ] Database row has NO `buyerContactId`, `buyerOrganizationId`, or `buyerPartyType` columns

**DB Validation Query:**
```sql
SELECT id, "tenantId", name, "buyerPartyId", "priceCents"
FROM "Animal"
WHERE id = 123;
```

Expected: `buyerPartyId` should be the Party ID associated with Contact 1.

---

### Test 2: Create Animal with Buyer Organization

**Purpose:** Verify that providing `buyerOrganizationId` in the request body resolves to `buyerPartyId` for organizations.

**Endpoint:** `POST /api/v1/animals`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/animals" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "name": "Test Horse 1",
    "species": "HORSE",
    "sex": "FEMALE",
    "buyerOrganizationId": 5,
    "priceCents": 5000000,
    "depositCents": 1000000
  }'
```

**Expected Response:**
```json
{
  "id": 124,
  "tenantId": 1,
  "name": "Test Horse 1",
  "species": "HORSE",
  "sex": "FEMALE",
  "status": "ACTIVE",
  "buyerContactId": null,
  "priceCents": 5000000,
  "depositCents": 1000000,
  "createdAt": "2025-12-26T00:05:00.000Z",
  "updatedAt": "2025-12-26T00:05:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `buyerContactId: null` (because Party is ORGANIZATION, not CONTACT)
- [ ] Database row has `buyerPartyId` set to the Party ID of Organization 5
- [ ] Database row has NO legacy buyer columns

**DB Validation Query:**
```sql
SELECT a.id, a."tenantId", a.name, a."buyerPartyId", p.type, p."organizationId"
FROM "Animal" a
JOIN "Party" p ON p.id = a."buyerPartyId"
WHERE a.id = 124;
```

Expected: `p.type = 'ORGANIZATION'` and `p.organizationId = 5`.

---

### Test 3: Create Animal without Buyer

**Purpose:** Verify that animals can be created without a buyer reference.

**Endpoint:** `POST /api/v1/animals`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/animals" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "name": "Test Cat 1",
    "species": "CAT",
    "sex": "FEMALE"
  }'
```

**Expected Response:**
```json
{
  "id": 125,
  "tenantId": 1,
  "name": "Test Cat 1",
  "species": "CAT",
  "sex": "FEMALE",
  "status": "ACTIVE",
  "buyerContactId": null,
  "createdAt": "2025-12-26T00:10:00.000Z",
  "updatedAt": "2025-12-26T00:10:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `buyerContactId: null`
- [ ] Database row has `buyerPartyId` = NULL
- [ ] Animal is successfully created without a buyer reference

---

### Test 4: Update Animal to Add Buyer

**Purpose:** Verify that updating an animal to add a buyer works correctly.

**Endpoint:** `PATCH /api/v1/animals/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/animals/125" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "buyerContactId": 2,
    "priceCents": 80000,
    "status": "SOLD"
  }'
```

**Expected Response:**
```json
{
  "id": 125,
  "tenantId": 1,
  "name": "Test Cat 1",
  "species": "CAT",
  "sex": "FEMALE",
  "status": "SOLD",
  "buyerContactId": 2,
  "priceCents": 80000,
  "updatedAt": "2025-12-26T00:15:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `buyerContactId: 2`
- [ ] Response shows `status: "SOLD"`
- [ ] Database row has `buyerPartyId` set to Party ID of Contact 2

---

### Test 5: Update Animal to Change Buyer

**Purpose:** Verify that changing a buyer from contact to organization works correctly.

**Endpoint:** `PATCH /api/v1/animals/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/animals/123" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "buyerOrganizationId": 3,
    "buyerContactId": null
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "tenantId": 1,
  "name": "Test Puppy 1",
  "species": "DOG",
  "sex": "MALE",
  "status": "ACTIVE",
  "buyerContactId": null,
  "priceCents": 150000,
  "updatedAt": "2025-12-26T00:20:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `buyerContactId: null` (buyer is now an organization)
- [ ] Database row has `buyerPartyId` set to Party ID of Organization 3
- [ ] Previous buyer (Contact 1) is no longer associated

**DB Validation Query:**
```sql
SELECT a.id, a."buyerPartyId", p.type, p."organizationId"
FROM "Animal" a
JOIN "Party" p ON p.id = a."buyerPartyId"
WHERE a.id = 123;
```

Expected: `p.type = 'ORGANIZATION'` and `p.organizationId = 3`.

---

### Test 6: Update Animal to Remove Buyer

**Purpose:** Verify that removing a buyer (setting to null) works correctly.

**Endpoint:** `PATCH /api/v1/animals/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/animals/123" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "buyerOrganizationId": null,
    "status": "ACTIVE"
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "tenantId": 1,
  "name": "Test Puppy 1",
  "species": "DOG",
  "sex": "MALE",
  "status": "ACTIVE",
  "buyerContactId": null,
  "priceCents": 150000,
  "updatedAt": "2025-12-26T00:25:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `buyerContactId: null`
- [ ] Database row has `buyerPartyId` = NULL
- [ ] Animal status changed back to ACTIVE

---

### Test 7: List Animals - Verify Legacy Fields in Response

**Purpose:** Verify that when listing animals, the response includes the derived `buyerContactId` for backward compatibility.

**Endpoint:** `GET /api/v1/animals`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/animals?status=SOLD" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response Excerpt:**
```json
{
  "animals": [
    {
      "id": 125,
      "name": "Test Cat 1",
      "species": "CAT",
      "status": "SOLD",
      "buyerContactId": 2,
      "priceCents": 80000
    }
  ]
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] All animals include `buyerContactId` field
- [ ] Animals with CONTACT buyers show correct `buyerContactId`
- [ ] Animals with ORGANIZATION buyers show `buyerContactId: null`
- [ ] Response does NOT include `buyerPartyId` (internal only)

---

### Test 8: Get Single Animal - Verify Legacy Fields

**Purpose:** Verify that getting a single animal returns derived legacy buyer fields.

**Endpoint:** `GET /api/v1/animals/:id`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/animals/125" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response:**
```json
{
  "id": 125,
  "tenantId": 1,
  "name": "Test Cat 1",
  "species": "CAT",
  "sex": "FEMALE",
  "status": "SOLD",
  "buyerContactId": 2,
  "priceCents": 80000,
  "depositCents": null,
  "placedAt": null,
  "createdAt": "2025-12-26T00:10:00.000Z",
  "updatedAt": "2025-12-26T00:15:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `buyerContactId: 2`
- [ ] Response does NOT include `buyerPartyId`, `buyerOrganizationId`, or `buyerPartyType`
- [ ] All sale-related fields present (priceCents, depositCents, placedAt, etc.)

---

### Test 9: Edge Case - Invalid buyerContactId

**Purpose:** Verify that providing an invalid `buyerContactId` (non-existent contact) results in appropriate error or null handling.

**Endpoint:** `POST /api/v1/animals`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/animals" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "name": "Test Invalid Buyer",
    "species": "DOG",
    "sex": "MALE",
    "buyerContactId": 99999
  }'
```

**Expected Behavior:**
- Option A: Return error indicating contact not found (preferred)
- Option B: Create animal with `buyerPartyId = null` (fallback)

**Validation:**
- [ ] Response handles invalid contact gracefully
- [ ] No database integrity errors
- [ ] Clear error message if validation fails

---

### Test 10: Sale Workflow - Complete Purchase

**Purpose:** Verify that a complete sale workflow works correctly with Party-based buyer.

**Endpoint:** Multiple endpoints

**Workflow:**
1. Create animal without buyer
2. Add buyer and price (mark as reserved)
3. Add deposit payment
4. Mark as placed
5. Mark as paid in full

**Request Sequence:**
```bash
# 1. Create animal
curl -X POST "${API_BASE}/api/v1/animals" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "name": "Sale Test Puppy",
    "species": "DOG",
    "sex": "FEMALE"
  }'

# 2. Add buyer and reserve (assume animal ID = 126)
curl -X PATCH "${API_BASE}/api/v1/animals/126" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "buyerContactId": 1,
    "priceCents": 200000,
    "depositCents": 50000,
    "status": "RESERVED"
  }'

# 3. Mark as placed
curl -X PATCH "${API_BASE}/api/v1/animals/126" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "placedAt": "2025-12-26T00:00:00.000Z",
    "status": "PLACED"
  }'

# 4. Mark as paid in full
curl -X PATCH "${API_BASE}/api/v1/animals/126" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "paidInFullAt": "2025-12-26T01:00:00.000Z",
    "status": "SOLD"
  }'
```

**Validation:**
- [ ] All steps complete successfully
- [ ] `buyerContactId` is returned at each step
- [ ] `buyerPartyId` is consistent in database throughout workflow
- [ ] Status transitions correctly (ACTIVE → RESERVED → PLACED → SOLD)
- [ ] All sale fields (price, deposit, dates) are preserved

---

## Acceptance Criteria

- [ ] All test cases pass
- [ ] Legacy `buyerContactId` field is returned in API responses for backward compatibility
- [ ] Internal storage uses only `buyerPartyId`
- [ ] No TypeScript errors in build
- [ ] Database validation queries show correct Party relationships
- [ ] No orphaned animals (all `buyerPartyId` values reference valid Parties)
- [ ] Sale workflow completes successfully with Party-based buyers
- [ ] Buyer changes (add, update, remove) work correctly

## Rollback Plan

If tests fail:
1. Revert schema changes in `prisma/schema.prisma`
2. Run `npm run db:dev` to restore previous schema
3. Revert code changes in animal routes/services
4. Restart dev server

## Notes

- The mapping layer in animal routes handles backward compatibility
- Helper functions should derive `buyerContactId` from Party backing
- Party resolution should use the `resolvePartyId()` service from `src/services/party-resolver.ts`
- Not all animals have buyers (only SOLD, RESERVED, PLACED status typically)
- Animal ownership (via AnimalOwner) is separate from buyer tracking
- Sale-related fields (priceCents, depositCents, placedAt, etc.) are independent of buyer reference

## Related Documentation

- Validation Queries: `VALIDATION_QUERIES_STEP6G_ANIMAL.md`
- Migration SQL: `prisma/migrations/TIMESTAMP_step6g_animal_buyer_party_only/migration.sql`
- Party Migration Overview: See main project documentation
