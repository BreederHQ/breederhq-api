# Test Plan: Step 6L - OffspringContract Buyer Party-Only

## Overview

This test plan validates that the OffspringContract domain correctly handles the transition from legacy `buyerContactId` and `buyerOrganizationId` to Party-only references (`buyerPartyId`) while maintaining backward compatibility in the API.

## Test Scope

**In Scope:**
- OffspringContract creation/update with `buyerContactId` in request
- OffspringContract creation/update with `buyerOrganizationId` in request
- OffspringContract listing returns legacy `buyerContactId` for backward compatibility
- Internal storage uses only `buyerPartyId`
- E-signature workflow operations (send, view, sign)

**Out of Scope:**
- OffspringContract deletion (no changes)
- Non-buyer contract fields
- Offspring relationships (handled separately)
- E-signature provider integration internals

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
   - Existing offspring record
   - Existing contracts (for update tests)

## Environment Variables

```bash
export API_BASE="http://localhost:6001"
export TENANT_ID="1"
export AUTH_TOKEN="your-dev-token-here"
```

## Test Cases

### Test 1: Create OffspringContract with Buyer Contact

**Purpose:** Verify that providing `buyerContactId` in the request body resolves to `buyerPartyId` internally and returns `buyerContactId` in the response.

**Endpoint:** `POST /api/v1/offspring/:offspringId/contracts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/offspring/1/contracts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "title": "Purchase Agreement - Contact Buyer",
    "version": "1.0",
    "buyerContactId": 1,
    "status": "DRAFT"
  }'
```

**Expected Response:**
```json
{
  "id": 100,
  "tenantId": 1,
  "offspringId": 1,
  "title": "Purchase Agreement - Contact Buyer",
  "version": "1.0",
  "status": "DRAFT",
  "buyerContactId": 1,
  "createdAt": "2025-12-26T02:00:00.000Z",
  "updatedAt": "2025-12-26T02:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `buyerContactId: 1`
- [ ] Response does NOT include `buyerPartyId` (internal only)
- [ ] Response does NOT include `buyerOrganizationId`
- [ ] Database row has `buyerPartyId` set to the Party ID of Contact 1
- [ ] Database row has NO `buyerContactId` or `buyerOrganizationId` columns

**DB Validation Query:**
```sql
SELECT id, "tenantId", title, "buyerPartyId", status
FROM "OffspringContract"
WHERE id = 100;
```

Expected: `buyerPartyId` should be the Party ID associated with Contact 1.

---

### Test 2: Create OffspringContract with Buyer Organization

**Purpose:** Verify that providing `buyerOrganizationId` in the request body resolves to `buyerPartyId` for organizations.

**Endpoint:** `POST /api/v1/offspring/:offspringId/contracts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/offspring/2/contracts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "title": "Purchase Agreement - Organization Buyer",
    "version": "1.0",
    "buyerOrganizationId": 5,
    "status": "DRAFT"
  }'
```

**Expected Response:**
```json
{
  "id": 101,
  "tenantId": 1,
  "offspringId": 2,
  "title": "Purchase Agreement - Organization Buyer",
  "version": "1.0",
  "status": "DRAFT",
  "buyerContactId": null,
  "createdAt": "2025-12-26T02:05:00.000Z",
  "updatedAt": "2025-12-26T02:05:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `buyerContactId: null` (because Party is ORGANIZATION, not CONTACT)
- [ ] Database row has `buyerPartyId` set to the Party ID of Organization 5
- [ ] Database row has NO legacy buyer columns

**DB Validation Query:**
```sql
SELECT oc.id, oc."tenantId", oc.title, oc."buyerPartyId", p.type, p."organizationId"
FROM "OffspringContract" oc
JOIN "Party" p ON p.id = oc."buyerPartyId"
WHERE oc.id = 101;
```

Expected: `p.type = 'ORGANIZATION'` and `p.organizationId = 5`.

---

### Test 3: Create OffspringContract without Buyer

**Purpose:** Verify that contracts can be created without a buyer reference (draft mode).

**Endpoint:** `POST /api/v1/offspring/:offspringId/contracts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/offspring/3/contracts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "title": "Purchase Agreement - No Buyer Yet",
    "version": "1.0",
    "status": "DRAFT"
  }'
```

**Expected Response:**
```json
{
  "id": 102,
  "tenantId": 1,
  "offspringId": 3,
  "title": "Purchase Agreement - No Buyer Yet",
  "version": "1.0",
  "status": "DRAFT",
  "buyerContactId": null,
  "createdAt": "2025-12-26T02:10:00.000Z",
  "updatedAt": "2025-12-26T02:10:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `buyerContactId: null`
- [ ] Database row has `buyerPartyId` = NULL
- [ ] Contract is successfully created without a buyer reference

---

### Test 4: Update OffspringContract to Add Buyer

**Purpose:** Verify that updating a contract to add a buyer works correctly.

**Endpoint:** `PATCH /api/v1/offspring/:offspringId/contracts/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/offspring/3/contracts/102" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "buyerContactId": 2
  }'
```

**Expected Response:**
```json
{
  "id": 102,
  "tenantId": 1,
  "offspringId": 3,
  "title": "Purchase Agreement - No Buyer Yet",
  "version": "1.0",
  "status": "DRAFT",
  "buyerContactId": 2,
  "updatedAt": "2025-12-26T02:15:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `buyerContactId: 2`
- [ ] Database row has `buyerPartyId` set to Party ID of Contact 2

---

### Test 5: Update OffspringContract to Change Buyer

**Purpose:** Verify that changing a buyer from contact to organization works correctly.

**Endpoint:** `PATCH /api/v1/offspring/:offspringId/contracts/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/offspring/1/contracts/100" \
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
  "id": 100,
  "tenantId": 1,
  "offspringId": 1,
  "title": "Purchase Agreement - Contact Buyer",
  "version": "1.0",
  "status": "DRAFT",
  "buyerContactId": null,
  "updatedAt": "2025-12-26T02:20:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `buyerContactId: null` (buyer is now an organization)
- [ ] Database row has `buyerPartyId` set to Party ID of Organization 3
- [ ] Previous buyer (Contact 1) is no longer associated

**DB Validation Query:**
```sql
SELECT oc.id, oc."buyerPartyId", p.type, p."organizationId"
FROM "OffspringContract" oc
JOIN "Party" p ON p.id = oc."buyerPartyId"
WHERE oc.id = 100;
```

Expected: `p.type = 'ORGANIZATION'` and `p.organizationId = 3`.

---

### Test 6: Update OffspringContract to Remove Buyer

**Purpose:** Verify that removing a buyer (setting to null) works correctly.

**Endpoint:** `PATCH /api/v1/offspring/:offspringId/contracts/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/offspring/1/contracts/100" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "buyerOrganizationId": null
  }'
```

**Expected Response:**
```json
{
  "id": 100,
  "tenantId": 1,
  "offspringId": 1,
  "title": "Purchase Agreement - Contact Buyer",
  "version": "1.0",
  "status": "DRAFT",
  "buyerContactId": null,
  "updatedAt": "2025-12-26T02:25:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `buyerContactId: null`
- [ ] Database row has `buyerPartyId` = NULL

---

### Test 7: List OffspringContracts - Verify Legacy Fields in Response

**Purpose:** Verify that when listing contracts, the response includes the derived `buyerContactId` for backward compatibility.

**Endpoint:** `GET /api/v1/offspring/:offspringId/contracts`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/offspring/1/contracts" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response Excerpt:**
```json
{
  "contracts": [
    {
      "id": 100,
      "title": "Purchase Agreement - Contact Buyer",
      "status": "DRAFT",
      "buyerContactId": null
    }
  ]
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] All contracts include `buyerContactId` field
- [ ] Contracts with CONTACT buyers show correct `buyerContactId`
- [ ] Contracts with ORGANIZATION buyers show `buyerContactId: null`
- [ ] Response does NOT include `buyerPartyId` (internal only)

---

### Test 8: Get Single OffspringContract - Verify Legacy Fields

**Purpose:** Verify that getting a single contract returns derived legacy buyer fields.

**Endpoint:** `GET /api/v1/offspring/:offspringId/contracts/:id`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/offspring/3/contracts/102" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response:**
```json
{
  "id": 102,
  "tenantId": 1,
  "offspringId": 3,
  "title": "Purchase Agreement - No Buyer Yet",
  "version": "1.0",
  "status": "DRAFT",
  "buyerContactId": 2,
  "createdAt": "2025-12-26T02:10:00.000Z",
  "updatedAt": "2025-12-26T02:15:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `buyerContactId: 2`
- [ ] Response does NOT include `buyerPartyId` or `buyerOrganizationId`

---

### Test 9: Edge Case - Invalid buyerContactId

**Purpose:** Verify that providing an invalid `buyerContactId` (non-existent contact) results in appropriate error or null handling.

**Endpoint:** `POST /api/v1/offspring/:offspringId/contracts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/offspring/1/contracts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "title": "Invalid Buyer Test",
    "buyerContactId": 99999
  }'
```

**Expected Behavior:**
- Option A: Return error indicating contact not found (preferred)
- Option B: Create contract with `buyerPartyId = null` (fallback)

**Validation:**
- [ ] Response handles invalid contact gracefully
- [ ] No database integrity errors
- [ ] Clear error message if validation fails

---

### Test 10: E-signature Workflow - Send Contract

**Purpose:** Verify that the e-signature send workflow works correctly with Party-based buyer.

**Endpoint:** `POST /api/v1/offspring/:offspringId/contracts/:id/send`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/offspring/3/contracts/102/send" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "provider": "DOCUSIGN"
  }'
```

**Expected Response:**
```json
{
  "id": 102,
  "tenantId": 1,
  "offspringId": 3,
  "title": "Purchase Agreement - No Buyer Yet",
  "version": "1.0",
  "status": "SENT",
  "buyerContactId": 2,
  "provider": "DOCUSIGN",
  "sentAt": "2025-12-26T02:30:00.000Z",
  "updatedAt": "2025-12-26T02:30:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response shows `status: "SENT"`
- [ ] Response includes `sentAt` timestamp
- [ ] Response includes `buyerContactId: 2`
- [ ] `buyerPartyId` is used internally to resolve buyer for e-signature provider
- [ ] E-signature provider receives correct buyer contact information

---

### Test 11: E-signature Workflow - Contract Signed

**Purpose:** Verify that the signature completion callback works correctly.

**Endpoint:** `POST /api/v1/offspring/:offspringId/contracts/:id/signed`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/offspring/3/contracts/102/signed" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "signedAt": "2025-12-26T03:00:00.000Z"
  }'
```

**Expected Response:**
```json
{
  "id": 102,
  "tenantId": 1,
  "offspringId": 3,
  "title": "Purchase Agreement - No Buyer Yet",
  "version": "1.0",
  "status": "SIGNED",
  "buyerContactId": 2,
  "provider": "DOCUSIGN",
  "sentAt": "2025-12-26T02:30:00.000Z",
  "signedAt": "2025-12-26T03:00:00.000Z",
  "updatedAt": "2025-12-26T03:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response shows `status: "SIGNED"`
- [ ] Response includes `signedAt` timestamp
- [ ] `buyerPartyId` is preserved throughout workflow
- [ ] Database row maintains correct buyer reference

---

## Acceptance Criteria

- [ ] All test cases pass
- [ ] Legacy `buyerContactId` field is returned in API responses for backward compatibility
- [ ] Internal storage uses only `buyerPartyId`
- [ ] No TypeScript errors in build
- [ ] Database validation queries show correct Party relationships
- [ ] No orphaned contracts (all `buyerPartyId` values reference valid Parties)
- [ ] E-signature workflow completes successfully with Party-based buyers
- [ ] Buyer changes (add, update, remove) work correctly

## Rollback Plan

If tests fail:
1. Revert schema changes in `prisma/schema.prisma`
2. Run `npx prisma db push` to restore previous schema
3. Revert code changes in contract routes/services
4. Restart dev server

## Notes

- The mapping layer in contract routes handles backward compatibility
- Helper functions should derive `buyerContactId` from Party backing
- Party resolution should use the `resolvePartyId()` service from `src/services/party-resolver.ts`
- Not all contracts have buyers (drafts, templates)
- Contract status workflow: DRAFT → SENT → VIEWED → SIGNED
- E-signature providers (DocuSign, HelloSign, etc.) should receive buyer info from Party
- Multiple contract versions may exist for the same offspring
- Contract buyer is the party purchasing/adopting the offspring

## Related Documentation

- Validation Queries: `VALIDATION_QUERIES_STEP6L_OFFSPRINGCONTRACT.md`
- Migration SQL: `prisma/migrations/20251226020000_step6l_offspringcontract_buyer_party_only/migration.sql`
- Party Migration Overview: See main project documentation
