# Party Step 5: Offspring and Waitlist Test Plan

This document provides manual API tests to verify dual-write functionality for Offspring and Waitlist Party references.

## Test Environment Setup

**Prerequisites:**
1. Dev database with Party migration applied
2. Backfill script executed (see VALIDATION_QUERIES_OFFSPRING_WAITLIST.md)
3. API server running on dev environment
4. Valid tenant with test data

**Test Data Required:**
- At least one Contact with `partyId` populated
- At least one Organization with `partyId` populated
- At least one BreedingPlan in COMMITTED status
- At least one OffspringGroup

## Test 1: Waitlist Entry Creation (POST /api/v1/waitlist)

### Test 1A: Create waitlist entry with Contact

**Endpoint:** `POST /api/v1/waitlist`

**Headers:**
```
x-tenant-id: <your-tenant-id>
Content-Type: application/json
```

**Request Body:**
```json
{
  "contactId": <valid-contact-id>,
  "speciesPref": "DOG",
  "status": "INQUIRY",
  "notes": "Party migration test - contact client"
}
```

**Expected Response:**
- Status: 201 Created
- Response includes `contactId` matching request
- Response should NOT expose `clientPartyId` (backward compatibility)

**Verification Query:**
```sql
SELECT
  id,
  "contactId",
  "organizationId",
  "clientPartyId",
  "partyType"
FROM "WaitlistEntry"
WHERE id = <returned-id>;
```

**Expected Database State:**
- `contactId` = provided contact ID
- `organizationId` = NULL
- `clientPartyId` = Contact's partyId (NOT NULL if Contact has partyId)
- `partyType` = 'Contact'

---

### Test 1B: Create waitlist entry with Organization

**Endpoint:** `POST /api/v1/waitlist`

**Request Body:**
```json
{
  "organizationId": <valid-organization-id>,
  "speciesPref": "DOG",
  "status": "INQUIRY",
  "notes": "Party migration test - organization client"
}
```

**Expected Response:**
- Status: 201 Created
- Response includes `organizationId` matching request

**Verification Query:**
```sql
SELECT
  id,
  "contactId",
  "organizationId",
  "clientPartyId",
  "partyType"
FROM "WaitlistEntry"
WHERE id = <returned-id>;
```

**Expected Database State:**
- `contactId` = NULL
- `organizationId` = provided organization ID
- `clientPartyId` = Organization's partyId (NOT NULL if Organization has partyId)
- `partyType` = 'Organization'

---

## Test 2: Waitlist Entry Update (PATCH /api/v1/waitlist/:id)

### Test 2A: Update waitlist entry - change from Contact to Organization

**Setup:** Use waitlist entry created in Test 1A

**Endpoint:** `PATCH /api/v1/waitlist/<waitlist-id>`

**Request Body:**
```json
{
  "contactId": null,
  "organizationId": <valid-organization-id>
}
```

**Expected Response:**
- Status: 200 OK
- Response includes updated `organizationId`

**Verification Query:**
```sql
SELECT
  id,
  "contactId",
  "organizationId",
  "clientPartyId",
  "partyType"
FROM "WaitlistEntry"
WHERE id = <waitlist-id>;
```

**Expected Database State:**
- `contactId` = NULL
- `organizationId` = new organization ID
- `clientPartyId` = new Organization's partyId
- `partyType` = 'Organization' (should be updated)

---

### Test 2B: Update waitlist entry - clear client

**Endpoint:** `PATCH /api/v1/waitlist/<waitlist-id>`

**Request Body:**
```json
{
  "contactId": null,
  "organizationId": null
}
```

**Expected Response:**
- Status: 200 OK

**Verification Query:**
```sql
SELECT
  id,
  "contactId",
  "organizationId",
  "clientPartyId"
FROM "WaitlistEntry"
WHERE id = <waitlist-id>;
```

**Expected Database State:**
- `contactId` = NULL
- `organizationId` = NULL
- `clientPartyId` = NULL (should be cleared)

---

## Test 3: Offspring Individual Creation (POST /api/v1/offspring/individuals)

### Test 3A: Create offspring with Contact buyer

**Endpoint:** `POST /api/v1/offspring/individuals`

**Headers:**
```
x-tenant-id: <your-tenant-id>
Content-Type: application/json
```

**Request Body:**
```json
{
  "groupId": <valid-offspring-group-id>,
  "name": "Party Test Offspring",
  "sex": "MALE",
  "buyerContactId": <valid-contact-id>,
  "placementState": "RESERVED",
  "financialState": "DEPOSIT_PAID"
}
```

**Expected Response:**
- Status: 201 Created
- Response includes `buyerContactId` matching request
- Response should NOT expose `buyerPartyId` (backward compatibility)

**Verification Query:**
```sql
SELECT
  id,
  name,
  "buyerContactId",
  "buyerOrganizationId",
  "buyerPartyId"
FROM "Offspring"
WHERE id = <returned-id>;
```

**Expected Database State:**
- `buyerContactId` = provided contact ID
- `buyerOrganizationId` = NULL
- `buyerPartyId` = Contact's partyId (NOT NULL if Contact has partyId)

---

### Test 3B: Create offspring with Organization buyer

**Endpoint:** `POST /api/v1/offspring/individuals`

**Request Body:**
```json
{
  "groupId": <valid-offspring-group-id>,
  "name": "Party Test Offspring Org",
  "sex": "FEMALE",
  "buyerOrganizationId": <valid-organization-id>,
  "placementState": "RESERVED"
}
```

**Expected Response:**
- Status: 201 Created
- Response includes `buyerOrganizationId` matching request

**Verification Query:**
```sql
SELECT
  id,
  name,
  "buyerContactId",
  "buyerOrganizationId",
  "buyerPartyId"
FROM "Offspring"
WHERE id = <returned-id>;
```

**Expected Database State:**
- `buyerContactId` = NULL
- `buyerOrganizationId` = provided organization ID
- `buyerPartyId` = Organization's partyId (NOT NULL if Organization has partyId)

---

## Test 4: Offspring Individual Update (PATCH /api/v1/offspring/individuals/:id)

### Test 4A: Update offspring - assign buyer Contact

**Setup:** Create offspring without buyer first

**Endpoint:** `PATCH /api/v1/offspring/individuals/<offspring-id>`

**Request Body:**
```json
{
  "buyerContactId": <valid-contact-id>,
  "placementState": "RESERVED",
  "financialState": "DEPOSIT_PAID"
}
```

**Expected Response:**
- Status: 200 OK

**Verification Query:**
```sql
SELECT
  id,
  "buyerContactId",
  "buyerOrganizationId",
  "buyerPartyId"
FROM "Offspring"
WHERE id = <offspring-id>;
```

**Expected Database State:**
- `buyerContactId` = provided contact ID
- `buyerOrganizationId` = NULL (or previous value if not in update)
- `buyerPartyId` = Contact's partyId

---

### Test 4B: Update offspring - change from Contact to Organization buyer

**Setup:** Use offspring from Test 3A or 4A

**Endpoint:** `PATCH /api/v1/offspring/individuals/<offspring-id>`

**Request Body:**
```json
{
  "buyerContactId": null,
  "buyerOrganizationId": <valid-organization-id>
}
```

**Expected Response:**
- Status: 200 OK

**Verification Query:**
```sql
SELECT
  id,
  "buyerContactId",
  "buyerOrganizationId",
  "buyerPartyId"
FROM "Offspring"
WHERE id = <offspring-id>;
```

**Expected Database State:**
- `buyerContactId` = NULL
- `buyerOrganizationId` = new organization ID
- `buyerPartyId` = new Organization's partyId

---

### Test 4C: Update offspring - clear buyer

**Endpoint:** `PATCH /api/v1/offspring/individuals/<offspring-id>`

**Request Body:**
```json
{
  "buyerContactId": null,
  "buyerOrganizationId": null,
  "placementState": "UNASSIGNED"
}
```

**Expected Response:**
- Status: 200 OK

**Verification Query:**
```sql
SELECT
  id,
  "buyerContactId",
  "buyerOrganizationId",
  "buyerPartyId"
FROM "Offspring"
WHERE id = <offspring-id>;
```

**Expected Database State:**
- `buyerContactId` = NULL
- `buyerOrganizationId` = NULL
- `buyerPartyId` = NULL (should be cleared)

---

## Test 5: OffspringGroupBuyer Creation (POST /api/v1/offspring/:id/buyers)

### Test 5A: Add Contact buyer to group

**Endpoint:** `POST /api/v1/offspring/<group-id>/buyers`

**Headers:**
```
x-tenant-id: <your-tenant-id>
Content-Type: application/json
```

**Request Body:**
```json
{
  "contactId": <valid-contact-id>
}
```

**Expected Response:**
- Status: 200 OK
- Response includes updated group with buyer list

**Verification Query:**
```sql
SELECT
  id,
  "groupId",
  "contactId",
  "organizationId",
  "buyerPartyId"
FROM "OffspringGroupBuyer"
WHERE "groupId" = <group-id>
  AND "contactId" = <contact-id>;
```

**Expected Database State:**
- `contactId` = provided contact ID
- `organizationId` = NULL
- `buyerPartyId` = Contact's partyId (NOT NULL if Contact has partyId)

---

### Test 5B: Add Organization buyer to group

**Endpoint:** `POST /api/v1/offspring/<group-id>/buyers`

**Request Body:**
```json
{
  "organizationId": <valid-organization-id>
}
```

**Expected Response:**
- Status: 200 OK

**Verification Query:**
```sql
SELECT
  id,
  "groupId",
  "contactId",
  "organizationId",
  "buyerPartyId"
FROM "OffspringGroupBuyer"
WHERE "groupId" = <group-id>
  AND "organizationId" = <organization-id>;
```

**Expected Database State:**
- `contactId` = NULL
- `organizationId` = provided organization ID
- `buyerPartyId` = Organization's partyId (NOT NULL if Organization has partyId)

---

## Test 6: Edge Cases

### Test 6A: Contact without partyId

**Setup:** Create a Contact that doesn't have `partyId` populated

**Test:** Create waitlist entry or offspring with this Contact

**Expected Result:**
- Operation succeeds
- `buyerPartyId` or `clientPartyId` = NULL (graceful degradation)
- Legacy `contactId` is still set correctly

---

### Test 6B: Organization without partyId

**Setup:** Create an Organization that doesn't have `partyId` populated

**Test:** Create waitlist entry or offspring with this Organization

**Expected Result:**
- Operation succeeds
- `buyerPartyId` or `clientPartyId` = NULL (graceful degradation)
- Legacy `organizationId` is still set correctly

---

## Test Summary Checklist

After running all tests, verify:

- [ ] All CREATE operations set both legacy and new partyId fields
- [ ] All UPDATE operations update both legacy and new partyId fields
- [ ] Clearing buyer/client also clears partyId
- [ ] Changing from Contact to Organization updates partyId correctly
- [ ] Changing from Organization to Contact updates partyId correctly
- [ ] API responses DO NOT expose partyId fields (backward compatibility)
- [ ] Operations succeed gracefully when Contact/Organization lacks partyId
- [ ] No breaking changes to existing API contracts

## Curl Examples

### Create Waitlist Entry with Contact
```bash
curl -X POST http://localhost:3000/api/v1/waitlist \
  -H "x-tenant-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": 123,
    "speciesPref": "DOG",
    "status": "INQUIRY"
  }'
```

### Create Offspring with Buyer
```bash
curl -X POST http://localhost:3000/api/v1/offspring/individuals \
  -H "x-tenant-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": 456,
    "name": "Test Offspring",
    "sex": "MALE",
    "buyerContactId": 123,
    "placementState": "RESERVED"
  }'
```

### Update Offspring Buyer
```bash
curl -X PATCH http://localhost:3000/api/v1/offspring/individuals/789 \
  -H "x-tenant-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "buyerOrganizationId": 456,
    "buyerContactId": null
  }'
```

## Notes

- All tests assume you have valid test data IDs
- Replace `<placeholder-id>` with actual IDs from your dev database
- Tests should be run in order for dependent tests
- Verify database state after each test using the provided SQL queries
