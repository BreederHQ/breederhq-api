# Test Plan: Breeding Domain Party Migration (Step 5)

**Migration:** `20251224_party_step5_breeding_party`
**Date:** 2024-12-24
**Scope:** Breeding domain party-like references (BreedingAttempt, PlanParty, WaitlistEntry, OffspringGroupBuyer, Offspring, Invoice, ContractParty, OffspringContract)

---

## Test Objectives

1. **Schema Changes:** Verify all new partyId fields and indexes exist
2. **Backfill:** Confirm all existing records have partyId populated where applicable
3. **Dual-Read:** Verify backend reads from partyId with fallback to legacy IDs
4. **Dual-Write:** Verify backend creates/updates persist both legacy and new partyId fields
5. **API Stability:** Confirm DTOs are unchanged and existing client integrations work
6. **Rollback:** Verify migration can be safely rolled back if needed

---

## Pre-Test Prerequisites

- [ ] Migration `20251224_party_step5_breeding_party` applied to database
- [ ] Backfill script executed successfully
- [ ] All validation queries pass (see VALIDATION_QUERIES_BREEDING.md)
- [ ] Backend code changes deployed
- [ ] Test database snapshot taken for rollback testing

---

## Test Scenarios

### 1. Schema Validation

#### 1.1 Verify Column Existence

**Test:** Check that all new partyId columns exist in the database.

**SQL:**
```sql
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'BreedingAttempt',
    'PlanParty',
    'WaitlistEntry',
    'OffspringGroupBuyer',
    'Offspring',
    'Invoice',
    'ContractParty',
    'OffspringContract'
  )
  AND column_name IN (
    'studOwnerPartyId',
    'partyId',
    'clientPartyId',
    'buyerPartyId'
  )
ORDER BY table_name, column_name;
```

**Expected Output:**
- 8 rows returned
- All columns have `data_type = 'integer'`
- All columns have `is_nullable = 'YES'`

**Status:** [ ] PASS / [ ] FAIL

---

#### 1.2 Verify Index Existence

**Test:** Confirm all new indexes were created.

**SQL:** See VALIDATION_QUERIES_BREEDING.md Section 4.

**Expected Output:** 16 indexes listed.

**Status:** [ ] PASS / [ ] FAIL

---

#### 1.3 Verify Foreign Key Constraints

**Test:** Check that FK constraints exist for all new partyId fields.

**SQL:**
```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'Party'
  AND tc.table_name IN (
    'BreedingAttempt',
    'PlanParty',
    'WaitlistEntry',
    'OffspringGroupBuyer',
    'Offspring',
    'Invoice',
    'ContractParty',
    'OffspringContract'
  )
ORDER BY tc.table_name;
```

**Expected Output:** 8 foreign key constraints returned.

**Status:** [ ] PASS / [ ] FAIL

---

### 2. Backfill Validation

Run all queries from VALIDATION_QUERIES_BREEDING.md sections 1-3.

**Expected:** All backfill completeness checks pass with no missing partyId values.

**Status:** [ ] PASS / [ ] FAIL

---

### 3. Backend Dual-Read Tests

These tests verify that backend services correctly read from partyId and fall back to legacy IDs when partyId is null.

#### 3.1 BreedingAttempt - Read with partyId

**Test:** Fetch a BreedingAttempt that has `studOwnerPartyId` populated.

**Endpoint:** `GET /api/breeding/attempts/:id`

**Steps:**
1. Query DB for a BreedingAttempt with non-null `studOwnerPartyId`:
   ```sql
   SELECT id FROM "BreedingAttempt" WHERE "studOwnerPartyId" IS NOT NULL LIMIT 1;
   ```
2. Call API: `GET /api/breeding/attempts/{id}`
3. Verify response includes stud owner details resolved from Party

**Expected:**
- Response includes stud owner name/email from Party table
- DTO structure unchanged from previous version

**Status:** [ ] PASS / [ ] FAIL

---

#### 3.2 PlanParty - List Plan Parties

**Test:** List all parties for a breeding plan.

**Endpoint:** `GET /api/breeding/plans/:planId/parties`

**Steps:**
1. Query DB for a plan with PlanParty records:
   ```sql
   SELECT "planId" FROM "PlanParty" GROUP BY "planId" HAVING COUNT(*) > 0 LIMIT 1;
   ```
2. Call API: `GET /api/breeding/plans/{planId}/parties`
3. Verify all parties are returned with details from Party table

**Expected:**
- All parties returned with role, name, contact info
- DTO unchanged

**Status:** [ ] PASS / [ ] FAIL

---

#### 3.3 WaitlistEntry - Fetch with clientPartyId

**Test:** Retrieve a waitlist entry with client details.

**Endpoint:** `GET /api/waitlist/:id`

**Steps:**
1. Find waitlist entry with `clientPartyId`:
   ```sql
   SELECT id FROM "WaitlistEntry" WHERE "clientPartyId" IS NOT NULL LIMIT 1;
   ```
2. Call API: `GET /api/waitlist/{id}`
3. Verify client details resolved from Party

**Expected:**
- Client name, email, phone populated from Party
- DTO unchanged

**Status:** [ ] PASS / [ ] FAIL

---

#### 3.4 Offspring - Fetch with buyerPartyId

**Test:** Get offspring record with buyer details.

**Endpoint:** `GET /api/offspring/:id`

**Steps:**
1. Find offspring with buyer:
   ```sql
   SELECT id FROM "Offspring" WHERE "buyerPartyId" IS NOT NULL LIMIT 1;
   ```
2. Call API: `GET /api/offspring/{id}`
3. Verify buyer info resolved from Party

**Expected:**
- Buyer name and contact info present
- DTO unchanged

**Status:** [ ] PASS / [ ] FAIL

---

#### 3.5 Invoice - Fetch with clientPartyId

**Test:** Retrieve invoice with client info.

**Endpoint:** `GET /api/invoices/:id`

**Steps:**
1. Find invoice with client:
   ```sql
   SELECT id FROM "Invoice" WHERE "clientPartyId" IS NOT NULL LIMIT 1;
   ```
2. Call API: `GET /api/invoices/{id}`
3. Verify client details from Party

**Expected:**
- Client details populated
- DTO unchanged

**Status:** [ ] PASS / [ ] FAIL

---

### 4. Backend Dual-Write Tests

These tests verify that creates and updates correctly populate both legacy and new partyId fields.

#### 4.1 BreedingAttempt - Create with studOwnerContactId

**Test:** Create a new breeding attempt with a stud owner contact.

**Endpoint:** `POST /api/breeding/attempts`

**Payload:**
```json
{
  "planId": <valid_plan_id>,
  "method": "AI_TCI",
  "studOwnerContactId": <valid_contact_id>,
  "attemptAt": "2024-12-24T10:00:00Z",
  "notes": "Test attempt"
}
```

**Steps:**
1. Get a valid contact with partyId:
   ```sql
   SELECT id, "partyId" FROM "Contact" WHERE "partyId" IS NOT NULL LIMIT 1;
   ```
2. POST to create breeding attempt
3. Query created record:
   ```sql
   SELECT "studOwnerContactId", "studOwnerPartyId"
   FROM "BreedingAttempt"
   WHERE id = <created_id>;
   ```

**Expected:**
- `studOwnerContactId` = input contact ID
- `studOwnerPartyId` = Contact's partyId (dual-write successful)

**Status:** [ ] PASS / [ ] FAIL

---

#### 4.2 PlanParty - Add party to plan (Contact)

**Test:** Add a contact as a party to a breeding plan.

**Endpoint:** `POST /api/breeding/plans/:planId/parties`

**Payload:**
```json
{
  "role": "veterinarian",
  "contactId": <valid_contact_id>
}
```

**Steps:**
1. Get valid contact with partyId
2. POST to add party
3. Query created PlanParty record
4. Verify both `contactId` and `partyId` are set

**Expected:**
- `contactId` = input
- `partyId` = Contact's partyId

**Status:** [ ] PASS / [ ] FAIL

---

#### 4.3 PlanParty - Add party to plan (Organization)

**Test:** Add an organization as a party to a breeding plan.

**Endpoint:** `POST /api/breeding/plans/:planId/parties`

**Payload:**
```json
{
  "role": "clinic",
  "organizationId": <valid_org_id>
}
```

**Steps:**
1. Get valid organization with partyId
2. POST to add party
3. Query created PlanParty record
4. Verify both `organizationId` and `partyId` are set

**Expected:**
- `organizationId` = input
- `partyId` = Organization's partyId

**Status:** [ ] PASS / [ ] FAIL

---

#### 4.4 WaitlistEntry - Create with contactId

**Test:** Add a contact to the waitlist.

**Endpoint:** `POST /api/waitlist`

**Payload:**
```json
{
  "planId": <valid_plan_id>,
  "partyType": "Contact",
  "contactId": <valid_contact_id>,
  "speciesPref": "DOG",
  "status": "INQUIRY"
}
```

**Steps:**
1. Get valid contact with partyId
2. POST to create waitlist entry
3. Query created record
4. Verify `contactId` and `clientPartyId` both set

**Expected:**
- `contactId` = input
- `clientPartyId` = Contact's partyId

**Status:** [ ] PASS / [ ] FAIL

---

#### 4.5 Offspring - Update buyer (Contact)

**Test:** Assign a buyer to an offspring.

**Endpoint:** `PATCH /api/offspring/:id`

**Payload:**
```json
{
  "buyerPartyType": "Contact",
  "buyerContactId": <valid_contact_id>
}
```

**Steps:**
1. Find offspring without buyer
2. PATCH with buyer contact
3. Query updated record
4. Verify both `buyerContactId` and `buyerPartyId` set

**Expected:**
- `buyerContactId` = input
- `buyerPartyId` = Contact's partyId

**Status:** [ ] PASS / [ ] FAIL

---

#### 4.6 Invoice - Create with organizationId

**Test:** Create invoice for an organization.

**Endpoint:** `POST /api/invoices`

**Payload:**
```json
{
  "scope": "general",
  "organizationId": <valid_org_id>,
  "amountCents": 50000,
  "currency": "USD",
  "status": "draft"
}
```

**Steps:**
1. Get valid organization with partyId
2. POST to create invoice
3. Query created record
4. Verify `organizationId` and `clientPartyId` both set

**Expected:**
- `organizationId` = input
- `clientPartyId` = Organization's partyId

**Status:** [ ] PASS / [ ] FAIL

---

### 5. API Stability Tests

#### 5.1 DTO Backward Compatibility

**Test:** Verify that all API responses maintain the same shape as before migration.

**Method:** Compare API responses before and after migration for same record IDs.

**Endpoints to Test:**
- `GET /api/breeding/plans/:id`
- `GET /api/breeding/attempts/:id`
- `GET /api/waitlist/:id`
- `GET /api/offspring/:id`
- `GET /api/invoices/:id`

**Expected:**
- Response JSON structure identical
- No new fields exposed to clients (partyId fields are internal only)
- No removed or renamed fields

**Status:** [ ] PASS / [ ] FAIL

---

#### 5.2 Existing Filters and Queries

**Test:** Verify existing query params and filters still work.

**Examples:**
- `GET /api/breeding/plans?status=COMMITTED`
- `GET /api/waitlist?status=DEPOSIT_PAID`
- `GET /api/offspring?placementState=PLACED`
- `GET /api/invoices?status=open`

**Expected:** All queries return expected results.

**Status:** [ ] PASS / [ ] FAIL

---

### 6. Edge Cases and Error Handling

#### 6.1 Create with invalid contactId

**Test:** Attempt to create a record with a non-existent contactId.

**Endpoint:** `POST /api/waitlist`

**Payload:**
```json
{
  "contactId": 999999999,
  "status": "INQUIRY"
}
```

**Expected:** 400 or 404 error, appropriate error message.

**Status:** [ ] PASS / [ ] FAIL

---

#### 6.2 Null party references

**Test:** Verify records without party references (e.g., Offspring with no buyer) are handled correctly.

**Steps:**
1. Create offspring without buyer
2. Fetch via API
3. Verify buyer fields are null or absent

**Expected:** No errors, buyer fields null.

**Status:** [ ] PASS / [ ] FAIL

---

### 7. Integration Tests

#### 7.1 End-to-End Breeding Plan Workflow

**Test:** Complete breeding plan workflow with party interactions.

**Steps:**
1. Create breeding plan
2. Add veterinarian (Contact) via PlanParty
3. Add clinic (Organization) via PlanParty
4. Create breeding attempt with stud owner
5. Add waitlist entries (Contacts and Organizations)
6. Create offspring group
7. Assign buyers to offspring
8. Create invoices for buyers
9. Verify all party references resolve correctly throughout

**Expected:** All party details visible and consistent.

**Status:** [ ] PASS / [ ] FAIL

---

### 8. Performance Tests

#### 8.1 Query Performance with partyId Joins

**Test:** Measure query performance for breeding plan list with party joins.

**Query:**
```sql
SELECT
  bp.id,
  bp.name,
  p.name as stud_owner_name
FROM "BreedingPlan" bp
LEFT JOIN "BreedingAttempt" ba ON ba."planId" = bp.id
LEFT JOIN "Party" p ON p.id = ba."studOwnerPartyId"
WHERE bp."tenantId" = <tenant_id>
LIMIT 100;
```

**Expected:** Query completes in < 100ms with proper indexes.

**Status:** [ ] PASS / [ ] FAIL

---

### 9. Rollback Testing

#### 9.1 Simulate Migration Rollback

**Test:** Verify system functions if partyId columns are dropped.

**Steps:**
1. Take database snapshot
2. Drop all new partyId columns (simulate rollback):
   ```sql
   ALTER TABLE "BreedingAttempt" DROP COLUMN "studOwnerPartyId";
   ALTER TABLE "PlanParty" DROP COLUMN "partyId";
   -- ... etc for all tables
   ```
3. Test backend endpoints that previously worked
4. Restore database snapshot

**Expected:** Backend gracefully falls back to legacy fields only.

**Status:** [ ] PASS / [ ] FAIL

---

## Manual Testing Checklist

- [ ] Create breeding plan with Contact and Organization parties
- [ ] Create breeding attempt with stud owner
- [ ] Add waitlist entries for different party types
- [ ] Create offspring and assign buyers
- [ ] Generate invoices for Contacts and Organizations
- [ ] Create contracts with multiple parties
- [ ] Verify all party names/emails display correctly in UI (if applicable)
- [ ] Test filtering/searching by party in breeding lists
- [ ] Verify party details in breeding plan summary
- [ ] Test exporting breeding data (if applicable)

---

## cURL Test Examples

### Create Breeding Attempt
```bash
curl -X POST https://api.breederhq.com/api/breeding/attempts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": 123,
    "method": "AI_TCI",
    "studOwnerContactId": 456,
    "attemptAt": "2024-12-24T10:00:00Z"
  }'
```

**Verify DB:**
```sql
SELECT id, "studOwnerContactId", "studOwnerPartyId"
FROM "BreedingAttempt"
ORDER BY "createdAt" DESC
LIMIT 1;
```

---

### Add Party to Plan
```bash
curl -X POST https://api.breederhq.com/api/breeding/plans/123/parties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "veterinarian",
    "contactId": 789
  }'
```

**Verify DB:**
```sql
SELECT id, role, "contactId", "partyId"
FROM "PlanParty"
WHERE "planId" = 123
ORDER BY "id" DESC
LIMIT 1;
```

---

### Create Waitlist Entry
```bash
curl -X POST https://api.breederhq.com/api/waitlist \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": 123,
    "partyType": "Contact",
    "contactId": 456,
    "status": "INQUIRY"
  }'
```

**Verify DB:**
```sql
SELECT id, "contactId", "clientPartyId"
FROM "WaitlistEntry"
ORDER BY "createdAt" DESC
LIMIT 1;
```

---

## Acceptance Criteria

**Migration is successful if:**

✅ All schema validation tests pass
✅ All backfill validation queries return expected results
✅ All dual-read tests correctly resolve party details from partyId
✅ All dual-write tests populate both legacy and partyId fields
✅ All API responses maintain backward compatibility (DTOs unchanged)
✅ No errors in existing queries, filters, or workflows
✅ All integration tests pass
✅ Performance is acceptable with new indexes
✅ Rollback scenario tested and documented

**If any test fails, investigate root cause before proceeding to production deployment.**

---

## Rollback Plan

If critical issues are discovered:

1. **Stop writes:** Put API in read-only mode
2. **Identify issue:** Check logs, query failing records
3. **Apply fix or rollback:**
   - Minor fix: Patch backend code, redeploy
   - Major issue: Drop partyId columns, revert backend code, rollback migration
4. **Verify:** Re-run test suite
5. **Resume:** Return to normal operation

**Rollback SQL:**
```sql
-- Drop foreign keys
ALTER TABLE "BreedingAttempt" DROP CONSTRAINT IF EXISTS "BreedingAttempt_studOwnerPartyId_fkey";
ALTER TABLE "PlanParty" DROP CONSTRAINT IF EXISTS "PlanParty_partyId_fkey";
ALTER TABLE "WaitlistEntry" DROP CONSTRAINT IF EXISTS "WaitlistEntry_clientPartyId_fkey";
ALTER TABLE "OffspringGroupBuyer" DROP CONSTRAINT IF EXISTS "OffspringGroupBuyer_buyerPartyId_fkey";
ALTER TABLE "Offspring" DROP CONSTRAINT IF EXISTS "Offspring_buyerPartyId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_clientPartyId_fkey";
ALTER TABLE "ContractParty" DROP CONSTRAINT IF EXISTS "ContractParty_partyId_fkey";
ALTER TABLE "OffspringContract" DROP CONSTRAINT IF EXISTS "OffspringContract_buyerPartyId_fkey";

-- Drop columns
ALTER TABLE "BreedingAttempt" DROP COLUMN IF EXISTS "studOwnerPartyId";
ALTER TABLE "PlanParty" DROP COLUMN IF EXISTS "partyId";
ALTER TABLE "WaitlistEntry" DROP COLUMN IF EXISTS "clientPartyId";
ALTER TABLE "OffspringGroupBuyer" DROP COLUMN IF EXISTS "buyerPartyId";
ALTER TABLE "Offspring" DROP COLUMN IF EXISTS "buyerPartyId";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "clientPartyId";
ALTER TABLE "ContractParty" DROP COLUMN IF EXISTS "partyId";
ALTER TABLE "OffspringContract" DROP COLUMN IF EXISTS "buyerPartyId";

-- Mark migration as rolled back
DELETE FROM "_prisma_migrations" WHERE migration_name = '20251224_party_step5_breeding_party';
```

---

## Sign-Off

- [ ] All tests executed
- [ ] All tests passed
- [ ] Documentation updated
- [ ] Stakeholders informed
- [ ] Ready for production deployment

**Tested by:** ________________
**Date:** ________________
**Approved by:** ________________
**Date:** ________________
