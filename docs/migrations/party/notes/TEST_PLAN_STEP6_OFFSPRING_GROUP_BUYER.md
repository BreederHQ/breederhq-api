# Step 6C: OffspringGroupBuyer Party-Only Migration Test Plan

This document provides test procedures to verify Step 6C implementation: Party-only storage for OffspringGroupBuyer with API backward compatibility.

## Overview

**What Changed:**
- **Storage**: Only `buyerPartyId` persisted (no `contactId`/`organizationId` in database)
- **API Input**: Still accepts `contactId` or `organizationId` in request body
- **API Output**: Still returns `contactId` or `organizationId`, derived from Party

**Testing Focus:**
1. Create buyers using legacy `contactId` → persists as `buyerPartyId`
2. Create buyers using legacy `organizationId` → persists as `buyerPartyId`
3. Read buyers → response includes derived `contactId` or `organizationId`
4. Delete buyers → works correctly with Party-only storage
5. Database validation → confirms only `buyerPartyId` stored

## Prerequisites

- Step 6C migration applied to dev database
- Dev API server running (`http://localhost:6001`)
- Valid tenant with test data
- Test Contact and Organization exist with `partyId` populated

## Test Environment Setup

**Create test fixtures:**

```powershell
# Set your dev environment variables
$tenantId = 1  # Your test tenant ID
$apiUrl = "http://localhost:6001"

# Create test contact with Party (via Contact creation endpoint)
$contactPayload = @{
    display_name = "Test Contact for Step 6C"
    email = "step6c_contact@example.com"
} | ConvertTo-Json

$contactResponse = Invoke-RestMethod -Method POST -Uri "$apiUrl/contacts" `
    -Headers @{"Content-Type"="application/json"; "x-tenant-id"="$tenantId"} `
    -Body $contactPayload

$testContactId = $contactResponse.id

# Create test organization with Party
$orgPayload = @{
    name = "Test Org for Step 6C"
    email = "step6c_org@example.com"
} | ConvertTo-Json

$orgResponse = Invoke-RestMethod -Method POST -Uri "$apiUrl/organizations" `
    -Headers @{"Content-Type"="application/json"; "x-tenant-id"="$tenantId"} `
    -Body $orgPayload

$testOrgId = $orgResponse.id

# Create test offspring group
$groupPayload = @{
    damId = 100  # Replace with valid dam ID
    species = "DOG"
    name = "Test Group for Step 6C"
} | ConvertTo-Json

$groupResponse = Invoke-RestMethod -Method POST -Uri "$apiUrl/offspring/groups" `
    -Headers @{"Content-Type"="application/json"; "x-tenant-id"="$tenantId"} `
    -Body $groupPayload

$testGroupId = $groupResponse.id
```

## Test Cases

### Test 1: Create Buyer with Legacy contactId

**Objective**: Verify API accepts `contactId`, persists as `buyerPartyId`, returns derived `contactId`.

**Request:**
```powershell
$buyerPayload = @{
    contactId = $testContactId
} | ConvertTo-Json

$response = Invoke-RestMethod -Method POST `
    -Uri "$apiUrl/offspring/groups/$testGroupId/buyers" `
    -Headers @{"Content-Type"="application/json"; "x-tenant-id"="$tenantId"} `
    -Body $buyerPayload

$response | ConvertTo-Json -Depth 5
```

**Expected Response:**
```json
{
  "ok": true,
  "duplicate": false,
  "group": {
    "groupBuyerLinks": [
      {
        "id": <number>,
        "contactId": <testContactId>,
        "organizationId": null,
        "waitlistEntryId": null,
        "contact": {
          "id": <testContactId>,
          "displayName": "Test Contact for Step 6C",
          "email": "step6c_contact@example.com"
        },
        "organization": null
      }
    ]
  }
}
```

**Database Validation:**
```sql
-- Should show only buyerPartyId, not contactId
SELECT id, "groupId", "buyerPartyId", "waitlistEntryId"
FROM "OffspringGroupBuyer"
WHERE "groupId" = <testGroupId>;

-- Verify buyerPartyId links to Contact's Party
SELECT
    gb.id,
    gb."buyerPartyId",
    p.type,
    c.id as contact_id,
    c.display_name
FROM "OffspringGroupBuyer" gb
JOIN "Party" p ON p.id = gb."buyerPartyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
WHERE gb."groupId" = <testGroupId>;
```

**Expected Database State:**
- Column `contactId`: **Does not exist** (dropped in Step 6C)
- Column `buyerPartyId`: **Populated** with Contact's Party ID
- Party type: **CONTACT**
- Backing contact ID matches `$testContactId`

**Pass Criteria:**
- ✅ Response includes `contactId` matching input
- ✅ Database stores only `buyerPartyId` (no `contactId` column)
- ✅ `buyerPartyId` links to Party with type=CONTACT
- ✅ Party backs to correct Contact

---

### Test 2: Create Buyer with Legacy organizationId

**Objective**: Verify API accepts `organizationId`, persists as `buyerPartyId`, returns derived `organizationId`.

**Request:**
```powershell
# First delete previous buyer to test org buyer
Invoke-RestMethod -Method DELETE `
    -Uri "$apiUrl/offspring/groups/$testGroupId/buyers/$($response.group.groupBuyerLinks[0].id)" `
    -Headers @{"x-tenant-id"="$tenantId"}

$buyerPayload = @{
    organizationId = $testOrgId
} | ConvertTo-Json

$response = Invoke-RestMethod -Method POST `
    -Uri "$apiUrl/offspring/groups/$testGroupId/buyers" `
    -Headers @{"Content-Type"="application/json"; "x-tenant-id"="$tenantId"} `
    -Body $buyerPayload

$response | ConvertTo-Json -Depth 5
```

**Expected Response:**
```json
{
  "ok": true,
  "duplicate": false,
  "group": {
    "groupBuyerLinks": [
      {
        "id": <number>,
        "contactId": null,
        "organizationId": <testOrgId>,
        "waitlistEntryId": null,
        "contact": null,
        "organization": {
          "id": <testOrgId>,
          "name": "Test Org for Step 6C",
          "email": "step6c_org@example.com"
        }
      }
    ]
  }
}
```

**Database Validation:**
```sql
SELECT
    gb.id,
    gb."buyerPartyId",
    p.type,
    o.id as org_id,
    o.name
FROM "OffspringGroupBuyer" gb
JOIN "Party" p ON p.id = gb."buyerPartyId"
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE gb."groupId" = <testGroupId>;
```

**Expected Database State:**
- Column `organizationId`: **Does not exist**
- Column `buyerPartyId`: **Populated** with Organization's Party ID
- Party type: **ORGANIZATION**
- Backing organization ID matches `$testOrgId`

**Pass Criteria:**
- ✅ Response includes `organizationId` matching input
- ✅ Database stores only `buyerPartyId`
- ✅ `buyerPartyId` links to Party with type=ORGANIZATION
- ✅ Party backs to correct Organization

---

### Test 3: List Group Buyers Shows Derived Legacy Fields

**Objective**: Verify GET endpoint returns buyers with derived `contactId`/`organizationId`.

**Setup**: Ensure both a Contact buyer and Organization buyer exist for the group.

**Request:**
```powershell
$response = Invoke-RestMethod -Method GET `
    -Uri "$apiUrl/offspring/groups/$testGroupId" `
    -Headers @{"x-tenant-id"="$tenantId"}

$response.BuyerLinks | ConvertTo-Json -Depth 3
```

**Expected Response:**
```json
[
  {
    "id": <number>,
    "contactId": <testContactId>,
    "organizationId": null,
    "contact": { "id": <testContactId>, "displayName": "..." },
    "organization": null
  },
  {
    "id": <number>,
    "contactId": null,
    "organizationId": <testOrgId>,
    "contact": null,
    "organization": { "id": <testOrgId>, "name": "..." }
  }
]
```

**Pass Criteria:**
- ✅ Contact buyer shows `contactId` populated, `organizationId` null
- ✅ Organization buyer shows `organizationId` populated, `contactId` null
- ✅ All buyers include nested `contact` or `organization` objects

---

### Test 4: Delete Buyer Works with Party-Only Storage

**Objective**: Verify DELETE endpoint works correctly.

**Request:**
```powershell
$buyerId = $response.BuyerLinks[0].id

$deleteResponse = Invoke-RestMethod -Method DELETE `
    -Uri "$apiUrl/offspring/groups/$testGroupId/buyers/$buyerId" `
    -Headers @{"x-tenant-id"="$tenantId"}

$deleteResponse | ConvertTo-Json
```

**Expected Response:**
```json
{
  "id": <groupId>,
  "BuyerLinks": [
    // Deleted buyer should be removed
  ]
}
```

**Database Validation:**
```sql
SELECT COUNT(*)
FROM "OffspringGroupBuyer"
WHERE id = <buyerId>;
-- Should return 0
```

**Pass Criteria:**
- ✅ Buyer deleted from database
- ✅ Response no longer includes deleted buyer
- ✅ Other buyers remain intact

---

### Test 5: Duplicate Prevention with buyerPartyId

**Objective**: Verify unique constraint on `(groupId, buyerPartyId)` prevents duplicates.

**Request:**
```powershell
# Try to add same buyer again
$buyerPayload = @{
    contactId = $testContactId
} | ConvertTo-Json

$response = Invoke-RestMethod -Method POST `
    -Uri "$apiUrl/offspring/groups/$testGroupId/buyers" `
    -Headers @{"Content-Type"="application/json"; "x-tenant-id"="$tenantId"} `
    -Body $buyerPayload `
    -ErrorAction Continue

$response | ConvertTo-Json
```

**Expected Behavior:**
- Either: Response indicates duplicate (e.g., `"duplicate": true`)
- Or: Constraint violation error (acceptable)

**Database Validation:**
```sql
SELECT "groupId", "buyerPartyId", COUNT(*)
FROM "OffspringGroupBuyer"
WHERE "groupId" = <testGroupId>
GROUP BY "groupId", "buyerPartyId"
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

**Pass Criteria:**
- ✅ No duplicate `(groupId, buyerPartyId)` in database
- ✅ API handles duplicate gracefully

---

### Test 6: Null buyerPartyId for Waitlist-Only Buyers

**Objective**: Verify buyers can exist with only `waitlistEntryId` (no `buyerPartyId`).

**Request:**
```powershell
# Create waitlist entry first (if not exists)
$waitlistPayload = @{
    contactId = $testContactId
    speciesPref = "DOG"
} | ConvertTo-Json

$waitlistResponse = Invoke-RestMethod -Method POST `
    -Uri "$apiUrl/waitlist" `
    -Headers @{"Content-Type"="application/json"; "x-tenant-id"="$tenantId"} `
    -Body $waitlistPayload

$waitlistId = $waitlistResponse.id

# Link buyer via waitlistEntryId only
$buyerPayload = @{
    waitlistEntryId = $waitlistId
} | ConvertTo-Json

$response = Invoke-RestMethod -Method POST `
    -Uri "$apiUrl/offspring/groups/$testGroupId/buyers" `
    -Headers @{"Content-Type"="application/json"; "x-tenant-id"="$tenantId"} `
    -Body $buyerPayload

$response | ConvertTo-Json -Depth 5
```

**Expected Behavior:**
- Buyer created with `waitlistEntryId` populated
- `buyerPartyId` may be NULL or derived from waitlist entry's `clientPartyId`

**Pass Criteria:**
- ✅ Buyer created successfully
- ✅ `waitlistEntryId` populated

---

## Integration Test Summary

Run all tests in sequence and verify:

1. ✅ Create buyer with `contactId` → stored as `buyerPartyId`, derived in response
2. ✅ Create buyer with `organizationId` → stored as `buyerPartyId`, derived in response
3. ✅ List buyers → returns derived `contactId`/`organizationId`
4. ✅ Delete buyer → works correctly
5. ✅ Duplicate prevention → unique constraint enforced
6. ✅ Waitlist-only buyers → supported

## TypeScript Compilation

**Verify no type errors:**
```powershell
cd breederhq-api
npm run typecheck
```

**Expected**: No errors related to `contactId` or `organizationId` in OffspringGroupBuyer queries.

## Cleanup

**Remove test data:**
```powershell
# Delete test group and buyers
Invoke-RestMethod -Method DELETE `
    -Uri "$apiUrl/offspring/groups/$testGroupId" `
    -Headers @{"x-tenant-id"="$tenantId"}

# Optionally delete test contact and org
```

## Notes

- **API Backward Compatibility**: All existing clients continue to work without changes
- **Database Schema**: Only `buyerPartyId` stored, derived fields computed at read time
- **Performance**: Additional JOIN to Party and Contact/Organization for derived fields
- **Migration Safety**: Idempotent, can be re-run safely
