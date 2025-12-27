# Test Plan: Step 6K - ContractParty Party-Only

## Overview

This test plan validates that the ContractParty domain correctly handles the transition from legacy `contactId` and `organizationId` to Party-only references (`partyId`) while maintaining backward compatibility in the API.

**Important:** The `userId` column is NOT part of the Party migration and should remain unchanged. It represents a separate system for user-based contract parties (e.g., internal users signing contracts).

## Test Scope

**In Scope:**
- ContractParty creation with `contactId` in request
- ContractParty creation with `organizationId` in request
- ContractParty listing returns legacy `contactId`/`organizationId` for backward compatibility
- Internal storage uses only `partyId` (plus `userId` separately)
- Contract signing workflows
- Contract party role assignments

**Out of Scope:**
- Contract deletion (no changes)
- Non-party contract fields
- Contract templates
- Contract versioning
- SignatureEvents (separate table)

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
   - Existing user ID (for userId testing)
   - Existing contracts (for update tests)

## Environment Variables

```bash
export API_BASE="http://localhost:6001"
export TENANT_ID="1"
export AUTH_TOKEN="your-dev-token-here"
```

## Test Cases

### Test 1: Create Contract with Contact Party

**Purpose:** Verify that providing `contactId` for a contract party resolves to `partyId` internally and returns `contactId` in the response.

**Endpoint:** `POST /api/v1/contracts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/contracts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "title": "Test Puppy Sales Agreement",
    "type": "SALES",
    "parties": [
      {
        "contactId": 1,
        "role": "buyer",
        "signer": true
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "tenantId": 1,
  "title": "Test Puppy Sales Agreement",
  "type": "SALES",
  "status": "draft",
  "parties": [
    {
      "id": 456,
      "contactId": 1,
      "role": "buyer",
      "signer": true,
      "status": "pending",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "createdAt": "2025-12-26T00:00:00.000Z",
  "updatedAt": "2025-12-26T00:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Party object includes `contactId: 1`
- [ ] Party object does NOT include `partyId` (internal only)
- [ ] Party object does NOT include `organizationId` or `userId`
- [ ] Database ContractParty row has `partyId` set to the Party ID of Contact 1
- [ ] Database ContractParty row has NO `contactId` or `organizationId` columns
- [ ] Database ContractParty row `userId` is NULL

**DB Validation Query:**
```sql
SELECT
  cp.id,
  cp."tenantId",
  cp."contractId",
  cp."partyId",
  cp."userId",
  cp.role,
  cp.signer,
  p.type AS party_type,
  c.id AS resolved_contact_id
FROM "ContractParty" cp
LEFT JOIN "Party" p ON p.id = cp."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
WHERE cp.id = 456;
```

Expected result: `partyId` is set, `userId` is NULL, `party_type` is 'CONTACT', `resolved_contact_id` is 1

---

### Test 2: Create Contract with Organization Party

**Purpose:** Verify that providing `organizationId` for a contract party resolves to `partyId` internally.

**Endpoint:** `POST /api/v1/contracts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/contracts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "title": "Test Organization Agreement",
    "type": "SERVICES",
    "parties": [
      {
        "organizationId": 1,
        "role": "client",
        "signer": true
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "id": 124,
  "tenantId": 1,
  "title": "Test Organization Agreement",
  "type": "SERVICES",
  "status": "draft",
  "parties": [
    {
      "id": 457,
      "organizationId": 1,
      "role": "client",
      "signer": true,
      "status": "pending",
      "name": "Acme Corp",
      "email": "contact@acme.com"
    }
  ],
  "createdAt": "2025-12-26T00:00:00.000Z",
  "updatedAt": "2025-12-26T00:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Party object includes `organizationId: 1`
- [ ] Party object does NOT include `partyId`, `contactId`, or `userId`
- [ ] Database ContractParty row has `partyId` set to the Party ID of Organization 1
- [ ] Database ContractParty row `userId` is NULL

**DB Validation Query:**
```sql
SELECT
  cp.id,
  cp."partyId",
  cp."userId",
  p.type AS party_type,
  o.id AS resolved_organization_id
FROM "ContractParty" cp
LEFT JOIN "Party" p ON p.id = cp."partyId"
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE cp.id = 457;
```

Expected result: `partyId` is set, `userId` is NULL, `party_type` is 'ORGANIZATION', `resolved_organization_id` is 1

---

### Test 3: Create Contract with User Party (userId - separate system)

**Purpose:** Verify that `userId` references work independently of the Party system.

**Endpoint:** `POST /api/v1/contracts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/contracts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "title": "Test Internal User Agreement",
    "type": "INTERNAL",
    "parties": [
      {
        "userId": "user_123",
        "role": "approver",
        "signer": true
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "id": 125,
  "tenantId": 1,
  "title": "Test Internal User Agreement",
  "type": "INTERNAL",
  "status": "draft",
  "parties": [
    {
      "id": 458,
      "userId": "user_123",
      "role": "approver",
      "signer": true,
      "status": "pending",
      "name": "Jane Admin",
      "email": "jane@breeder.com"
    }
  ],
  "createdAt": "2025-12-26T00:00:00.000Z",
  "updatedAt": "2025-12-26T00:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Party object includes `userId: "user_123"`
- [ ] Party object does NOT include `partyId`, `contactId`, or `organizationId`
- [ ] Database ContractParty row has `userId` = "user_123"
- [ ] Database ContractParty row has `partyId` IS NULL (user is separate from Party system)

**DB Validation Query:**
```sql
SELECT
  cp.id,
  cp."partyId",
  cp."userId",
  cp.role,
  cp.signer
FROM "ContractParty" cp
WHERE cp.id = 458;
```

Expected result: `partyId` is NULL, `userId` is "user_123"

---

### Test 4: List Contracts - Backward Compatibility

**Purpose:** Verify that GET requests return legacy `contactId`/`organizationId` fields derived from Party relationships.

**Endpoint:** `GET /api/v1/contracts/{contractId}`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/contracts/123" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response:**
```json
{
  "id": 123,
  "tenantId": 1,
  "title": "Test Puppy Sales Agreement",
  "type": "SALES",
  "status": "draft",
  "parties": [
    {
      "id": 456,
      "contactId": 1,
      "role": "buyer",
      "signer": true,
      "status": "pending",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "createdAt": "2025-12-26T00:00:00.000Z",
  "updatedAt": "2025-12-26T00:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Contact-based party shows `contactId` (derived from partyId → Party → Contact)
- [ ] Response does NOT expose `partyId` (internal only)
- [ ] Party name and email are correctly populated

---

### Test 5: Update Contract Party - Change Contact

**Purpose:** Verify that updating a contract party's contact works correctly.

**Endpoint:** `PATCH /api/v1/contracts/{contractId}/parties/{partyId}`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/contracts/123/parties/456" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "contactId": 2
  }'
```

**Expected Response:**
```json
{
  "id": 456,
  "contactId": 2,
  "role": "buyer",
  "signer": true,
  "status": "pending",
  "name": "Jane Smith",
  "email": "jane@example.com"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Party `contactId` is now 2
- [ ] Database `partyId` is updated to Party ID of Contact 2
- [ ] Old Contact 1 party relationship is broken

**DB Validation Query:**
```sql
SELECT
  cp.id,
  cp."partyId",
  p.type AS party_type,
  c.id AS resolved_contact_id
FROM "ContractParty" cp
LEFT JOIN "Party" p ON p.id = cp."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
WHERE cp.id = 456;
```

Expected result: `partyId` is set to Party ID of Contact 2, `resolved_contact_id` is 2

---

### Test 6: Contract with Mixed Party Types

**Purpose:** Verify that a contract can have multiple parties with different types (Contact, Organization, User).

**Endpoint:** `POST /api/v1/contracts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/contracts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "title": "Multi-Party Agreement",
    "type": "SALES",
    "parties": [
      {
        "contactId": 1,
        "role": "buyer",
        "signer": true
      },
      {
        "organizationId": 1,
        "role": "seller",
        "signer": true
      },
      {
        "userId": "user_123",
        "role": "witness",
        "signer": false
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "id": 126,
  "tenantId": 1,
  "title": "Multi-Party Agreement",
  "type": "SALES",
  "status": "draft",
  "parties": [
    {
      "id": 459,
      "contactId": 1,
      "role": "buyer",
      "signer": true,
      "status": "pending"
    },
    {
      "id": 460,
      "organizationId": 1,
      "role": "seller",
      "signer": true,
      "status": "pending"
    },
    {
      "id": 461,
      "userId": "user_123",
      "role": "witness",
      "signer": false,
      "status": "pending"
    }
  ]
}
```

**Validation:**
- [ ] All three party types created successfully
- [ ] Each party shows only the relevant ID field (contactId, organizationId, or userId)
- [ ] Database has correct `partyId` for Contact and Organization parties
- [ ] Database has NULL `partyId` for User party (userId is separate)

**DB Validation Query:**
```sql
SELECT
  cp.id,
  cp.role,
  cp."partyId",
  cp."userId",
  p.type AS party_type,
  CASE
    WHEN p.type = 'CONTACT' THEN c.id
    WHEN p.type = 'ORGANIZATION' THEN o.id
  END AS resolved_party_id
FROM "ContractParty" cp
LEFT JOIN "Party" p ON p.id = cp."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE cp."contractId" = 126
ORDER BY cp.id;
```

---

### Test 7: Party with Email/Name Override (no partyId)

**Purpose:** Verify that contract parties can have email/name without a linked Party or User.

**Endpoint:** `POST /api/v1/contracts`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/contracts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "title": "Guest Signer Agreement",
    "type": "SALES",
    "parties": [
      {
        "email": "guest@example.com",
        "name": "Guest Signer",
        "role": "buyer",
        "signer": true
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "id": 127,
  "tenantId": 1,
  "title": "Guest Signer Agreement",
  "type": "SALES",
  "status": "draft",
  "parties": [
    {
      "id": 462,
      "email": "guest@example.com",
      "name": "Guest Signer",
      "role": "buyer",
      "signer": true,
      "status": "pending"
    }
  ]
}
```

**Validation:**
- [ ] Response status is `201 Created`
- [ ] Party has NO `contactId`, `organizationId`, `userId`, or `partyId`
- [ ] Party has email and name fields set
- [ ] Database ContractParty row has NULL `partyId` and NULL `userId`

**DB Validation Query:**
```sql
SELECT
  cp.id,
  cp."partyId",
  cp."userId",
  cp.email,
  cp.name,
  cp.role
FROM "ContractParty" cp
WHERE cp.id = 462;
```

Expected result: `partyId` is NULL, `userId` is NULL, email and name are set

---

## Edge Cases

### Edge Case 1: Non-existent Contact ID

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/contracts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "title": "Invalid Contact Test",
    "type": "SALES",
    "parties": [
      {
        "contactId": 99999,
        "role": "buyer",
        "signer": true
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "error": "Contact not found",
  "statusCode": 404
}
```

**Validation:**
- [ ] Response status is `404 Not Found`
- [ ] Error message indicates contact not found
- [ ] No contract or contract party created

---

### Edge Case 2: Contact without Party

**Purpose:** Verify that system handles Contacts that don't have an associated Party (data integrity issue).

**Setup:**
```sql
-- Create contact without partyId
INSERT INTO "Contact" ("tenantId", "firstName", "lastName", email)
VALUES (1, 'Broken', 'Contact', 'broken@example.com');
```

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/contracts" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "title": "Broken Contact Test",
    "type": "SALES",
    "parties": [
      {
        "contactId": <broken_contact_id>,
        "role": "buyer",
        "signer": true
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "error": "Contact does not have an associated Party",
  "statusCode": 400
}
```

**Validation:**
- [ ] Response status is `400 Bad Request`
- [ ] Error message indicates missing Party reference
- [ ] No contract party created

---

## Performance Tests

### Performance Test 1: List Contracts with Many Parties

**Purpose:** Verify that deriving legacy fields doesn't cause N+1 query issues.

**Setup:**
- Create contract with 20+ parties
- Each party has contactId or organizationId

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/contracts?limit=50" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Validation:**
- [ ] Response time < 500ms for 50 contracts
- [ ] SQL query log shows efficient JOIN queries (no N+1)
- [ ] All parties have correct derived contactId/organizationId

---

## Regression Tests

### Regression Test 1: Contract Signing Flow

**Purpose:** Verify that contract signing still works after migration.

**Endpoint:** `POST /api/v1/contracts/{contractId}/parties/{partyId}/sign`

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/contracts/123/parties/456/sign" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "signature": "John Doe",
    "ipAddress": "192.168.1.1"
  }'
```

**Expected Response:**
```json
{
  "id": 456,
  "contactId": 1,
  "role": "buyer",
  "signer": true,
  "status": "signed",
  "signedAt": "2025-12-26T00:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Party status updated to "signed"
- [ ] SignedAt timestamp populated
- [ ] SignatureEvent record created

---

## Database Integrity Checks

After all tests, run these queries to verify data integrity:

```sql
-- 1. Verify no orphaned partyId references
SELECT COUNT(*)
FROM "ContractParty" cp
WHERE cp."partyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = cp."partyId");
-- Expected: 0

-- 2. Verify Parties have backing entities
SELECT COUNT(*)
FROM "Party" p
WHERE EXISTS (SELECT 1 FROM "ContractParty" cp WHERE cp."partyId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "Contact" c WHERE c."partyId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o."partyId" = p.id);
-- Expected: 0

-- 3. Verify legacy columns removed
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'ContractParty'
  AND column_name IN ('contactId', 'organizationId');
-- Expected: 0 rows

-- 4. Verify userId column preserved
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'ContractParty'
  AND column_name = 'userId';
-- Expected: 1 row
```

---

## Test Summary Checklist

- [ ] All test cases pass
- [ ] No orphaned party references
- [ ] All parties with partyId can resolve to Contact or Organization
- [ ] userId references work independently
- [ ] Legacy columns removed from database
- [ ] userId column preserved
- [ ] API returns correct backward-compatible fields
- [ ] No N+1 query issues
- [ ] Contract signing flow works
- [ ] Performance is acceptable
