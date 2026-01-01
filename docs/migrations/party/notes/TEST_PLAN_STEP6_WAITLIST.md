# Step 6E: WaitlistEntry Party-Only Test Plan

This document outlines the testing strategy for Step 6E, which removes legacy `contactId`, `organizationId`, and `partyType` columns from WaitlistEntry and persists client identity only via `clientPartyId`.

## Overview

**Objective**: Ensure WaitlistEntry persists client identity via Party-only storage while maintaining full backward compatibility with existing API contracts.

**Scope**: WaitlistEntry endpoints in the waitlist API

**Test Environment**: Development database with Step 6E schema applied

## Pre-Test Setup

1. Ensure dev database schema is up to date:
   ```bash
   cd breederhq-api
   npx dotenv -e .env.dev.migrate --override -- prisma db push --schema=prisma/schema.prisma
   ```

2. Verify test tenant, contacts, and organizations exist
3. Ensure Party records exist for all test contacts and organizations

## Unit Tests

**File**: `breederhq-api/tests/waitlist-party.test.ts`

### Test Coverage

#### 1. `resolveClientPartyId` Function

- ✅ Resolves partyId from contactId
- ✅ Resolves partyId from organizationId
- ✅ Prefers organizationId over contactId when both provided
- ✅ Returns null when neither provided
- ✅ Returns null for non-existent contactId

#### 2. `deriveLegacyClientFields` Function

- ✅ Derives contactId from CONTACT Party
- ✅ Derives organizationId from ORGANIZATION Party
- ✅ Returns nulls when clientParty is null
- ✅ Handles orphaned Party (no backing entity)

#### 3. End-to-End Integration

- ✅ Create with contactId → persists as clientPartyId → reads back with derived legacy fields
- ✅ Create with organizationId → persists as clientPartyId → reads back with derived legacy fields

### Running Unit Tests

```bash
cd breederhq-api
npm test tests/waitlist-party.test.ts
```

(Note: If no test script exists, run via test framework directly)

## API Integration Tests

### Setup

**Base URL**: `http://localhost:3000/api/v1`

**Headers**:
```
x-tenant-id: <your-test-tenant-id>
Content-Type: application/json
```

**Test Data**:
- Contact ID: `<test-contact-id>` (with partyId)
- Organization ID: `<test-org-id>` (with partyId)

### Test Cases

#### TC1: Create Waitlist Entry with Contact (Legacy API Contract)

**Endpoint**: `POST /api/v1/waitlist`

**Request**:
```json
{
  "contactId": <test-contact-id>,
  "speciesPref": "DOG",
  "status": "INQUIRY"
}
```

**Expected Response** (201 Created):
```json
{
  "id": <waitlist-entry-id>,
  "tenantId": <tenant-id>,
  "contactId": <test-contact-id>,
  "organizationId": null,
  "contact": {
    "id": <test-contact-id>,
    "display_name": "Test Contact",
    "email": "contact@test.com",
    "phoneE164": null
  },
  "organization": null,
  "status": "INQUIRY",
  "speciesPref": "DOG",
  ...
}
```

**Validation**:
- Response includes legacy `contactId` field
- Response includes legacy `contact` object
- `organizationId` and `organization` are null
- Database stores only `clientPartyId` (verify via SQL)

**cURL**:
```bash
curl -X POST http://localhost:3000/api/v1/waitlist \
  -H "x-tenant-id: <tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": <test-contact-id>,
    "speciesPref": "DOG",
    "status": "INQUIRY"
  }'
```

---

#### TC2: Create Waitlist Entry with Organization (Legacy API Contract)

**Endpoint**: `POST /api/v1/waitlist`

**Request**:
```json
{
  "organizationId": <test-org-id>,
  "speciesPref": "CAT",
  "status": "INQUIRY"
}
```

**Expected Response** (201 Created):
```json
{
  "id": <waitlist-entry-id>,
  "tenantId": <tenant-id>,
  "contactId": null,
  "organizationId": <test-org-id>,
  "contact": null,
  "organization": {
    "id": <test-org-id>,
    "name": "Test Organization",
    "email": "org@test.com",
    "phone": null
  },
  "status": "INQUIRY",
  "speciesPref": "CAT",
  ...
}
```

**Validation**:
- Response includes legacy `organizationId` field
- Response includes legacy `organization` object
- `contactId` and `contact` are null
- Database stores only `clientPartyId` (verify via SQL)

**cURL**:
```bash
curl -X POST http://localhost:3000/api/v1/waitlist \
  -H "x-tenant-id: <tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": <test-org-id>,
    "speciesPref": "CAT",
    "status": "INQUIRY"
  }'
```

---

#### TC3: Get Waitlist Entry (Backward Compatible Response)

**Endpoint**: `GET /api/v1/waitlist/:id`

**Request**: GET with entry created via contactId in TC1

**Expected Response** (200 OK):
```json
{
  "id": <waitlist-entry-id>,
  "contactId": <test-contact-id>,
  "organizationId": null,
  "contact": {
    "id": <test-contact-id>,
    "display_name": "Test Contact",
    "email": "contact@test.com",
    "phoneE164": null
  },
  "organization": null,
  ...
}
```

**Validation**:
- Legacy fields correctly derived from Party
- Response structure unchanged from pre-Step 6E

**cURL**:
```bash
curl -X GET http://localhost:3000/api/v1/waitlist/<waitlist-entry-id> \
  -H "x-tenant-id: <tenant-id>"
```

---

#### TC4: List Waitlist Entries (Search by Client Name)

**Endpoint**: `GET /api/v1/waitlist?q=<search-term>`

**Request**: Search for contact by name

**Expected Response** (200 OK):
```json
{
  "items": [
    {
      "id": <waitlist-entry-id>,
      "contactId": <test-contact-id>,
      "contact": {
        "id": <test-contact-id>,
        "display_name": "Test Contact",
        ...
      },
      ...
    }
  ],
  "total": 1
}
```

**Validation**:
- Search via Party.contact.display_name works
- Response includes legacy client fields

**cURL**:
```bash
curl -X GET "http://localhost:3000/api/v1/waitlist?q=Test%20Contact" \
  -H "x-tenant-id: <tenant-id>"
```

---

#### TC5: Update Waitlist Entry - Reassign Client (Contact to Organization)

**Endpoint**: `PATCH /api/v1/waitlist/:id`

**Request**:
```json
{
  "organizationId": <test-org-id>
}
```

**Expected Response** (200 OK):
```json
{
  "id": <waitlist-entry-id>,
  "contactId": null,
  "organizationId": <test-org-id>,
  "contact": null,
  "organization": {
    "id": <test-org-id>,
    "name": "Test Organization",
    ...
  },
  ...
}
```

**Validation**:
- Entry reassigned from contact to organization
- Legacy fields correctly reflect new Party
- `clientPartyId` updated in database

**cURL**:
```bash
curl -X PATCH http://localhost:3000/api/v1/waitlist/<waitlist-entry-id> \
  -H "x-tenant-id: <tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": <test-org-id>
  }'
```

---

#### TC6: Error - Create Without Client

**Endpoint**: `POST /api/v1/waitlist`

**Request**:
```json
{
  "speciesPref": "HORSE",
  "status": "INQUIRY"
}
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "contactId or organizationId required"
}
```

**cURL**:
```bash
curl -X POST http://localhost:3000/api/v1/waitlist \
  -H "x-tenant-id: <tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "speciesPref": "HORSE",
    "status": "INQUIRY"
  }'
```

---

#### TC7: Error - Invalid Contact ID

**Endpoint**: `POST /api/v1/waitlist`

**Request**:
```json
{
  "contactId": 999999,
  "status": "INQUIRY"
}
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "Unable to resolve party for provided contactId or organizationId"
}
```

**cURL**:
```bash
curl -X POST http://localhost:3000/api/v1/waitlist \
  -H "x-tenant-id: <tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": 999999,
    "status": "INQUIRY"
  }'
```

---

## Database Verification

After each API test, verify the database state:

```sql
-- Check that only clientPartyId is stored (no legacy columns)
SELECT
  id,
  "tenantId",
  "clientPartyId"
FROM "WaitlistEntry"
WHERE id = <waitlist-entry-id>;

-- Verify Party linkage
SELECT
  w.id AS waitlist_id,
  w."clientPartyId",
  p.type AS party_type,
  CASE
    WHEN p.type = 'CONTACT' THEN c.id
    ELSE NULL
  END AS contact_id,
  CASE
    WHEN p.type = 'ORGANIZATION' THEN o.id
    ELSE NULL
  END AS organization_id
FROM "WaitlistEntry" w
JOIN "Party" p ON p.id = w."clientPartyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE w.id = <waitlist-entry-id>;
```

## Regression Testing

Verify that Step 6E does not break existing functionality:

1. **Waitlist lifecycle**: Create → Update → Skip → Delete
2. **Filtering**: By status, species, search query
3. **Tag assignments**: Assign/remove tags on waitlist entries
4. **Plan association**: Link waitlist entry to breeding plan
5. **Offspring allocation**: Allocate offspring to waitlist entry

## Performance Testing

1. List waitlist entries with Party join (verify index usage):
   ```sql
   EXPLAIN ANALYZE
   SELECT w.*, p.type
   FROM "WaitlistEntry" w
   JOIN "Party" p ON p.id = w."clientPartyId"
   WHERE w."tenantId" = <tenant-id>
   LIMIT 25;
   ```

2. Search by client name (verify nested Party index usage):
   ```sql
   EXPLAIN ANALYZE
   SELECT w.*
   FROM "WaitlistEntry" w
   JOIN "Party" p ON p.id = w."clientPartyId"
   JOIN "Contact" c ON c."partyId" = p.id
   WHERE w."tenantId" = <tenant-id>
   AND c.display_name ILIKE '%Test%';
   ```

## Acceptance Criteria

✅ All unit tests pass
✅ All API integration tests return expected responses
✅ Legacy `contactId` and `organizationId` fields present in responses
✅ Legacy `contact` and `organization` objects correctly populated
✅ Database stores only `clientPartyId` (legacy columns removed)
✅ Search by client name works via Party joins
✅ Reassignment (contact ↔ organization) works correctly
✅ Error handling for invalid/missing client IDs works
✅ No TypeScript errors
✅ Performance within acceptable bounds (indexed queries)

## Test Execution Checklist

- [ ] Run pre-migration validation SQL
- [ ] Apply schema changes via db push
- [ ] Run post-migration validation SQL
- [ ] Run unit tests
- [ ] Execute all API integration tests (TC1-TC7)
- [ ] Verify database state after each test
- [ ] Run regression tests
- [ ] Run performance tests
- [ ] Verify TypeScript compilation
- [ ] Document any issues or deviations

## Notes

- Tests assume existing Party infrastructure from Step 5
- All tests use legacy API contracts (contactId/organizationId) to verify backward compatibility
- Database verification confirms Party-only storage
- Frontend should continue to work without changes (sends legacy IDs, receives legacy IDs)
