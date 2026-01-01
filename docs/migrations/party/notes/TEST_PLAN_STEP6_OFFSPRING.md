# Step 6D: Offspring Buyer Test Plan

Test plan for Offspring Party-only storage migration.

## Objective

Verify that Offspring endpoints maintain full backward compatibility after removing legacy `buyerContactId` and `buyerOrganizationId` columns, with buyer identity now stored only via `buyerPartyId`.

## Test Environment

- Database: `bhq_dev` (after Step 6D migration)
- API: Local development server
- Auth: Valid tenant access token

## Prerequisites

1. Run validation queries to confirm schema changes
2. Ensure test tenant has Contact and Organization entities with Party records
3. Ensure existing Offspring have buyerPartyId populated

## Test Cases

### TC1: Create Offspring with Contact Buyer (Legacy API)

**Endpoint:** `POST /api/v1/offspring/individuals`

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/offspring/individuals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": 1,
    "name": "Puppy Test Contact",
    "sex": "MALE",
    "buyerContactId": 123,
    "priceCents": 150000
  }'
```

**Expected Response:**
- Status: `201 Created`
- Response includes `buyerName` matching the Contact's display_name
- Internal storage: Only `buyerPartyId` is persisted (no `buyerContactId`)

**Validation:**
```sql
SELECT id, name, "buyerPartyId", "placementState"
FROM "Offspring"
WHERE name = 'Puppy Test Contact';
```
- `buyerPartyId` should match Contact's partyId
- `placementState` should be `RESERVED` (due to buyer assignment)

---

### TC2: Create Offspring with Organization Buyer (Legacy API)

**Endpoint:** `POST /api/v1/offspring/individuals`

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/offspring/individuals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": 1,
    "name": "Puppy Test Org",
    "sex": "FEMALE",
    "buyerOrganizationId": 456,
    "priceCents": 200000
  }'
```

**Expected Response:**
- Status: `201 Created`
- Response includes `buyerName` matching the Organization's name
- Internal storage: Only `buyerPartyId` is persisted

**Validation:**
```sql
SELECT id, name, "buyerPartyId", "placementState"
FROM "Offspring"
WHERE name = 'Puppy Test Org';
```
- `buyerPartyId` should match Organization's partyId
- `placementState` should be `RESERVED`

---

### TC3: Update Offspring Buyer from Contact to Organization

**Endpoint:** `PATCH /api/v1/offspring/individuals/:id`

**Request:**
```bash
curl -X PATCH http://localhost:3000/api/v1/offspring/individuals/789 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "buyerOrganizationId": 456
  }'
```

**Expected Response:**
- Status: `200 OK`
- Response `buyerName` updated to Organization's name
- Previous Contact buyer is replaced

**Validation:**
```sql
SELECT id, "buyerPartyId", "placementState"
FROM "Offspring"
WHERE id = 789;
```
- `buyerPartyId` should now match Organization's partyId

---

### TC4: Clear Buyer Assignment

**Endpoint:** `PATCH /api/v1/offspring/individuals/:id`

**Request:**
```bash
curl -X PATCH http://localhost:3000/api/v1/offspring/individuals/789 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "buyerContactId": null,
    "buyerOrganizationId": null
  }'
```

**Expected Response:**
- Status: `200 OK`
- Response `buyerName` is `null`
- `placementState` reverts to `UNASSIGNED` (if not PLACED)

**Validation:**
```sql
SELECT id, "buyerPartyId", "placementState"
FROM "Offspring"
WHERE id = 789;
```
- `buyerPartyId` should be `NULL`
- `placementState` should be `UNASSIGNED`

---

### TC5: List Offspring - Buyer Fields Derived from Party

**Endpoint:** `GET /api/v1/offspring/individuals?limit=10`

**Request:**
```bash
curl http://localhost:3000/api/v1/offspring/individuals?limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
- Status: `200 OK`
- Response includes array of Offspring
- Each item with buyer has `buyerName` populated from Party
- Contact buyers show Contact display_name
- Organization buyers show Organization name

**Spot Check:**
Pick one Offspring from response and verify:
```sql
SELECT
  o.id,
  o."buyerPartyId",
  p.type,
  c.display_name AS contact_name,
  org.name AS org_name
FROM "Offspring" o
LEFT JOIN "Party" p ON o."buyerPartyId" = p.id
LEFT JOIN "Contact" c ON p.id = c."partyId" AND p.type = 'CONTACT'
LEFT JOIN "Organization" org ON p.id = org."partyId" AND p.type = 'ORGANIZATION'
WHERE o.id = <OFFSPRING_ID>;
```

---

### TC6: Get Individual Offspring - Buyer Fields Included

**Endpoint:** `GET /api/v1/offspring/individuals/:id`

**Request:**
```bash
curl http://localhost:3000/api/v1/offspring/individuals/789 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
- Status: `200 OK`
- Response includes `buyerName` derived from Party
- If Contact: `buyerName` matches Contact display_name
- If Organization: `buyerName` matches Organization name
- If no buyer: `buyerName` is `null`

---

### TC7: Get Offspring Group Detail - Offspring Buyer Fields

**Endpoint:** `GET /api/v1/offspring/:groupId`

**Request:**
```bash
curl http://localhost:3000/api/v1/offspring/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
- Status: `200 OK`
- Response `Offspring` array includes buyer information
- Each Offspring item has `buyerContact` or `buyerOrg` object with `id` and `name`
- Derived from Party, not legacy columns

**Validation:**
Check that response structure matches:
```json
{
  "Offspring": [
    {
      "id": 123,
      "name": "Puppy 1",
      "buyerContact": {
        "id": 456,
        "name": "John Doe"
      },
      "buyerOrg": null
    },
    {
      "id": 124,
      "name": "Puppy 2",
      "buyerContact": null,
      "buyerOrg": {
        "id": 789,
        "name": "Acme Kennels"
      }
    }
  ]
}
```

---

### TC8: State Normalization with Buyer Assignment

**Endpoint:** `POST /api/v1/offspring/individuals`

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/offspring/individuals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": 1,
    "name": "Puppy State Test",
    "sex": "MALE",
    "buyerContactId": 123,
    "placementState": "UNASSIGNED"
  }'
```

**Expected Response:**
- Status: `201 Created`
- `placementState` in response is `RESERVED` (not UNASSIGNED)
- Buyer assignment forces RESERVED state

**Rationale:**
State normalization logic checks `buyerPartyId` to auto-promote placementState to RESERVED when buyer is assigned.

---

### TC9: Invalid Contact ID (Orphan Prevention)

**Endpoint:** `POST /api/v1/offspring/individuals`

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/offspring/individuals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": 1,
    "name": "Puppy Invalid",
    "sex": "MALE",
    "buyerContactId": 999999
  }'
```

**Expected Response:**
- Status: `201 Created` (or `400` if Contact validation added)
- If Contact doesn't exist, `buyerPartyId` will be `NULL` (party-resolver returns null for missing entities)

**Note:** Current implementation allows creation with null buyerPartyId. Consider adding validation if strict buyer reference is required.

---

### TC10: Legacy Buyer Precedence (Both Provided)

**Endpoint:** `POST /api/v1/offspring/individuals`

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/offspring/individuals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": 1,
    "name": "Puppy Precedence",
    "sex": "MALE",
    "buyerContactId": 123,
    "buyerOrganizationId": 456
  }'
```

**Expected Response:**
- Status: `201 Created`
- `buyerPartyId` resolves to Contact's partyId (Contact takes precedence per current logic)
- Response `buyerName` matches Contact, not Organization

**Validation:**
```sql
SELECT id, "buyerPartyId"
FROM "Offspring"
WHERE name = 'Puppy Precedence';
```
- Confirm `buyerPartyId` matches Contact's partyId

---

## Test Summary

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC1 | Create with buyerContactId | Stores buyerPartyId, returns buyerName |
| TC2 | Create with buyerOrganizationId | Stores buyerPartyId, returns buyerName |
| TC3 | Update buyer from Contact to Org | buyerPartyId updated, response correct |
| TC4 | Clear buyer assignment | buyerPartyId NULL, placementState UNASSIGNED |
| TC5 | List Offspring | All buyers derived from Party |
| TC6 | Get individual Offspring | Buyer fields derived from Party |
| TC7 | Get group detail | Offspring array includes buyer objects |
| TC8 | State normalization | Buyer assignment forces RESERVED |
| TC9 | Invalid buyer ID | Handles gracefully (null partyId) |
| TC10 | Both buyer IDs provided | Contact precedence maintained |

## Acceptance Criteria

- ✅ All legacy API endpoints accept `buyerContactId` and `buyerOrganizationId`
- ✅ All responses include derived buyer fields (no breaking changes)
- ✅ Internal storage uses only `buyerPartyId`
- ✅ Legacy columns removed from schema
- ✅ State normalization logic uses `buyerPartyId`
- ✅ TypeScript compilation passes with strict typing
- ✅ No regressions in existing Offspring functionality
