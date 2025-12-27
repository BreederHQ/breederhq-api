# Test Plan: Step 6J - Invoice Client Party-Only

## Overview

This test plan validates that the Invoice domain correctly handles the transition from legacy `contactId` and `organizationId` to Party-only references (`clientPartyId`) while maintaining backward compatibility in the API.

## Test Scope

**In Scope:**
- Invoice creation/update with `contactId` in request
- Invoice creation/update with `organizationId` in request
- Invoice listing returns legacy `contactId`/`organizationId` for backward compatibility
- Internal storage uses only `clientPartyId`
- Finance-related operations (payments, line items, etc.)

**Out of Scope:**
- Invoice deletion (no changes)
- Non-client invoice fields
- Payment processing (handled separately)
- Contract relationships (handled separately)

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
   - Existing invoices (for update tests)
   - Existing offspring or offspring group (for scope testing)

## Environment Variables

```bash
export API_BASE="http://localhost:6001"
export TENANT_ID="1"
export AUTH_TOKEN="your-dev-token-here"
```

## Test Cases

### Test 1: Create Invoice with Contact Client

**Purpose:** Verify that providing `contactId` in the request body resolves to `clientPartyId` internally and returns `contactId` in the response.

**Endpoint:** `POST /api/v1/invoices`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/invoices" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "scope": "offspring",
    "offspringId": 1,
    "contactId": 1,
    "number": "INV-2025-001",
    "amountCents": 150000,
    "balanceCents": 150000,
    "status": "draft"
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "tenantId": 1,
  "scope": "offspring",
  "offspringId": 1,
  "contactId": 1,
  "organizationId": null,
  "number": "INV-2025-001",
  "currency": "USD",
  "amountCents": 150000,
  "balanceCents": 150000,
  "status": "draft",
  "createdAt": "2025-12-26T00:00:00.000Z",
  "updatedAt": "2025-12-26T00:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `contactId: 1`
- [ ] Response includes `organizationId: null`
- [ ] Response does NOT include `clientPartyId` (internal only)
- [ ] Database row has `clientPartyId` set to the Party ID of Contact 1
- [ ] Database row has NO `contactId` or `organizationId` columns

**DB Validation Query:**
```sql
SELECT id, "tenantId", number, "clientPartyId", "amountCents"
FROM "Invoice"
WHERE id = 123;
```

Expected: `clientPartyId` should be the Party ID associated with Contact 1.

---

### Test 2: Create Invoice with Organization Client

**Purpose:** Verify that providing `organizationId` in the request body resolves to `clientPartyId` for organizations.

**Endpoint:** `POST /api/v1/invoices`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/invoices" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "scope": "group",
    "groupId": 1,
    "organizationId": 5,
    "number": "INV-2025-002",
    "amountCents": 500000,
    "balanceCents": 500000,
    "status": "draft"
  }'
```

**Expected Response:**
```json
{
  "id": 124,
  "tenantId": 1,
  "scope": "group",
  "groupId": 1,
  "contactId": null,
  "organizationId": 5,
  "number": "INV-2025-002",
  "currency": "USD",
  "amountCents": 500000,
  "balanceCents": 500000,
  "status": "draft",
  "createdAt": "2025-12-26T00:05:00.000Z",
  "updatedAt": "2025-12-26T00:05:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `organizationId: 5`
- [ ] Response includes `contactId: null`
- [ ] Database row has `clientPartyId` set to the Party ID of Organization 5
- [ ] Database row has NO legacy client columns

**DB Validation Query:**
```sql
SELECT i.id, i."tenantId", i.number, i."clientPartyId", p.type, p."organizationId"
FROM "Invoice" i
JOIN "Party" p ON p.id = i."clientPartyId"
WHERE i.id = 124;
```

Expected: `p.type = 'ORGANIZATION'` and `p.organizationId = 5`.

---

### Test 3: Create Invoice without Client

**Purpose:** Verify that invoices can be created without a client reference.

**Endpoint:** `POST /api/v1/invoices`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/invoices" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "scope": "offspring",
    "offspringId": 2,
    "number": "INV-2025-003",
    "amountCents": 75000,
    "balanceCents": 75000,
    "status": "draft"
  }'
```

**Expected Response:**
```json
{
  "id": 125,
  "tenantId": 1,
  "scope": "offspring",
  "offspringId": 2,
  "contactId": null,
  "organizationId": null,
  "number": "INV-2025-003",
  "currency": "USD",
  "amountCents": 75000,
  "balanceCents": 75000,
  "status": "draft",
  "createdAt": "2025-12-26T00:10:00.000Z",
  "updatedAt": "2025-12-26T00:10:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Response includes `contactId: null` and `organizationId: null`
- [ ] Database row has `clientPartyId` = NULL
- [ ] Invoice is successfully created without a client reference

---

### Test 4: Update Invoice to Add Client

**Purpose:** Verify that updating an invoice to add a client works correctly.

**Endpoint:** `PATCH /api/v1/invoices/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/invoices/125" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "contactId": 2,
    "status": "issued",
    "issuedAt": "2025-12-26T00:00:00.000Z"
  }'
```

**Expected Response:**
```json
{
  "id": 125,
  "tenantId": 1,
  "scope": "offspring",
  "offspringId": 2,
  "contactId": 2,
  "organizationId": null,
  "number": "INV-2025-003",
  "currency": "USD",
  "amountCents": 75000,
  "balanceCents": 75000,
  "status": "issued",
  "issuedAt": "2025-12-26T00:00:00.000Z",
  "updatedAt": "2025-12-26T00:15:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `contactId: 2`
- [ ] Response shows `status: "issued"`
- [ ] Database row has `clientPartyId` set to Party ID of Contact 2

---

### Test 5: Update Invoice to Change Client

**Purpose:** Verify that changing a client from contact to organization works correctly.

**Endpoint:** `PATCH /api/v1/invoices/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/invoices/123" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "organizationId": 3,
    "contactId": null
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "tenantId": 1,
  "scope": "offspring",
  "offspringId": 1,
  "contactId": null,
  "organizationId": 3,
  "number": "INV-2025-001",
  "currency": "USD",
  "amountCents": 150000,
  "balanceCents": 150000,
  "status": "draft",
  "updatedAt": "2025-12-26T00:20:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `organizationId: 3` and `contactId: null`
- [ ] Database row has `clientPartyId` set to Party ID of Organization 3
- [ ] Previous client (Contact 1) is no longer associated

**DB Validation Query:**
```sql
SELECT i.id, i."clientPartyId", p.type, p."organizationId"
FROM "Invoice" i
JOIN "Party" p ON p.id = i."clientPartyId"
WHERE i.id = 123;
```

Expected: `p.type = 'ORGANIZATION'` and `p.organizationId = 3`.

---

### Test 6: Update Invoice to Remove Client

**Purpose:** Verify that removing a client (setting to null) works correctly.

**Endpoint:** `PATCH /api/v1/invoices/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/invoices/123" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "organizationId": null
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "tenantId": 1,
  "scope": "offspring",
  "offspringId": 1,
  "contactId": null,
  "organizationId": null,
  "number": "INV-2025-001",
  "currency": "USD",
  "amountCents": 150000,
  "balanceCents": 150000,
  "status": "draft",
  "updatedAt": "2025-12-26T00:25:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `contactId: null` and `organizationId: null`
- [ ] Database row has `clientPartyId` = NULL

---

### Test 7: List Invoices - Verify Legacy Fields in Response

**Purpose:** Verify that when listing invoices, the response includes the derived `contactId`/`organizationId` for backward compatibility.

**Endpoint:** `GET /api/v1/invoices`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/invoices?status=issued" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response Excerpt:**
```json
{
  "invoices": [
    {
      "id": 125,
      "scope": "offspring",
      "offspringId": 2,
      "contactId": 2,
      "organizationId": null,
      "number": "INV-2025-003",
      "status": "issued",
      "amountCents": 75000,
      "balanceCents": 75000
    }
  ]
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] All invoices include `contactId` and `organizationId` fields
- [ ] Invoices with CONTACT clients show correct `contactId`
- [ ] Invoices with ORGANIZATION clients show correct `organizationId`
- [ ] Response does NOT include `clientPartyId` (internal only)

---

### Test 8: Get Single Invoice - Verify Legacy Fields

**Purpose:** Verify that getting a single invoice returns derived legacy client fields.

**Endpoint:** `GET /api/v1/invoices/:id`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/invoices/125" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response:**
```json
{
  "id": 125,
  "tenantId": 1,
  "scope": "offspring",
  "offspringId": 2,
  "contactId": 2,
  "organizationId": null,
  "number": "INV-2025-003",
  "currency": "USD",
  "amountCents": 75000,
  "balanceCents": 75000,
  "depositCents": null,
  "status": "issued",
  "issuedAt": "2025-12-26T00:00:00.000Z",
  "createdAt": "2025-12-26T00:10:00.000Z",
  "updatedAt": "2025-12-26T00:15:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `contactId: 2` and `organizationId: null`
- [ ] Response does NOT include `clientPartyId`
- [ ] All finance-related fields present (amountCents, balanceCents, etc.)

---

### Test 9: Edge Case - Invalid contactId

**Purpose:** Verify that providing an invalid `contactId` (non-existent contact) results in appropriate error or null handling.

**Endpoint:** `POST /api/v1/invoices`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/invoices" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "scope": "offspring",
    "offspringId": 1,
    "contactId": 99999,
    "number": "INV-INVALID",
    "amountCents": 100000,
    "balanceCents": 100000,
    "status": "draft"
  }'
```

**Expected Behavior:**
- Option A: Return error indicating contact not found (preferred)
- Option B: Create invoice with `clientPartyId = null` (fallback)

**Validation:**
- [ ] Response handles invalid contact gracefully
- [ ] No database integrity errors
- [ ] Clear error message if validation fails

---

### Test 10: Invoice Payment Workflow

**Purpose:** Verify that a complete invoice payment workflow works correctly with Party-based client.

**Endpoint:** Multiple endpoints

**Workflow:**
1. Create invoice with client
2. Issue invoice
3. Add payment to reduce balance
4. Mark as paid

**Request Sequence:**
```bash
# 1. Create invoice
curl -X POST "${API_BASE}/api/v1/invoices" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "scope": "offspring",
    "offspringId": 1,
    "contactId": 1,
    "number": "INV-PAYMENT-TEST",
    "amountCents": 200000,
    "balanceCents": 200000,
    "status": "draft"
  }'

# 2. Issue invoice (assume invoice ID = 126)
curl -X PATCH "${API_BASE}/api/v1/invoices/126" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "status": "issued",
    "issuedAt": "2025-12-26T00:00:00.000Z"
  }'

# 3. Add payment
curl -X POST "${API_BASE}/api/v1/payments" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "invoiceId": 126,
    "amountCents": 200000,
    "method": "credit_card",
    "receivedAt": "2025-12-26T01:00:00.000Z"
  }'

# 4. Verify invoice is marked as paid
curl -X GET "${API_BASE}/api/v1/invoices/126" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Validation:**
- [ ] All steps complete successfully
- [ ] `contactId` is returned at each step
- [ ] `clientPartyId` is consistent in database throughout workflow
- [ ] Status transitions correctly (draft → issued → paid)
- [ ] Balance is updated correctly after payment
- [ ] `paidAt` timestamp is set when balance reaches zero

---

## Acceptance Criteria

- [ ] All test cases pass
- [ ] Legacy `contactId` and `organizationId` fields are returned in API responses for backward compatibility
- [ ] Internal storage uses only `clientPartyId`
- [ ] No TypeScript errors in build
- [ ] Database validation queries show correct Party relationships
- [ ] No orphaned invoices (all `clientPartyId` values reference valid Parties)
- [ ] Invoice workflow completes successfully with Party-based clients
- [ ] Client changes (add, update, remove) work correctly

## Rollback Plan

If tests fail:
1. Revert schema changes in `prisma/schema.prisma`
2. Run `npm run db:dev` to restore previous schema
3. Revert code changes in invoice routes/services
4. Restart dev server

## Notes

- The mapping layer in invoice routes handles backward compatibility
- Helper functions should derive `contactId`/`organizationId` from Party backing
- Party resolution should use the `resolvePartyId()` service from `src/services/party-resolver.ts`
- Invoices can exist without clients in some cases
- Finance-related fields (amountCents, balanceCents, etc.) are independent of client reference
- Invoice scope determines the context (offspring, group, etc.)

## Related Documentation

- Validation Queries: `VALIDATION_QUERIES_STEP6J_INVOICE.md`
- Migration SQL: `prisma/migrations/TIMESTAMP_step6j_invoice_client_party_only/migration.sql`
- Party Migration Overview: See main project documentation
