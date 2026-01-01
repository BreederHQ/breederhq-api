# Test Plan: Users Domain Party Migration (Step 5)

**Migration:** `20251225_party_step5_user_party`
**Date:** 2024-12-25
**Scope:** Users domain party-like references (User.partyId from User.contactId)

---

## Test Objectives

1. **Schema Changes:** Verify new partyId field and index exist on User table
2. **Backfill:** Confirm all existing User records with contactId have partyId populated
3. **Dual-Read:** Verify backend reads tolerate both legacy contactId and new partyId
4. **Dual-Write:** Verify backend updates to contactId also persist partyId
5. **API Stability:** Confirm User DTOs are unchanged and existing client integrations work
6. **Rollback:** Verify migration can be safely rolled back if needed

---

## Pre-Test Prerequisites

- [ ] Migration `20251225_party_step5_user_party` applied to database
- [ ] Backfill script executed successfully
- [ ] All validation queries pass (see VALIDATION_QUERIES_USER.md)
- [ ] Backend code changes deployed (user.ts route updated)
- [ ] Test database snapshot taken for rollback testing
- [ ] Unit tests passing (`npm test tests/user-party.test.ts`)

---

## Test Scenarios

### 1. Schema Validation

#### 1.1 Verify Column Existence

**Test:** Check that the new partyId column exists in the User table.

**SQL:**
```sql
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'User'
  AND column_name = 'partyId';
```

**Expected Output:**
- 1 row returned
- `data_type = 'integer'`
- `is_nullable = 'YES'`

**Status:** [ ] PASS / [ ] FAIL

---

#### 1.2 Verify Index Existence

**Test:** Confirm the new index on User.partyId was created.

**SQL:**
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'User'
  AND indexdef LIKE '%partyId%';
```

**Expected Output:**
- At least 1 index returned
- Index name includes `User_partyId_idx`

**Status:** [ ] PASS / [ ] FAIL

---

#### 1.3 Verify Foreign Key Constraint

**Test:** Check that FK constraint exists for User.partyId → Party.id.

**SQL:**
```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'User'
  AND kcu.column_name = 'partyId'
  AND ccu.table_name = 'Party';
```

**Expected Output:**
- 1 foreign key constraint returned
- `delete_rule = 'SET NULL'`
- `update_rule = 'CASCADE'`

**Status:** [ ] PASS / [ ] FAIL

---

### 2. Backfill Validation

#### 2.1 Backfill Completeness

**Test:** Verify all users with contactId have partyId populated.

Run query from VALIDATION_QUERIES_USER.md section 1.1.

**Expected:**
- `missing_party_id = 0`
- `orphan_party_id = 0`
- `backfilled` count equals count of users with non-null contactId

**Status:** [ ] PASS / [ ] FAIL

---

#### 2.2 No Unresolved Contact IDs

**Test:** Verify no users have contactId pointing to a Contact without partyId.

Run query from VALIDATION_QUERIES_USER.md section 2.1.

**Expected:** 0 rows returned.

**Status:** [ ] PASS / [ ] FAIL

---

#### 2.3 FK Integrity

**Test:** Verify all User.partyId values reference valid Party records.

Run queries from VALIDATION_QUERIES_USER.md section 3.

**Expected:** All integrity checks pass with 0 violations.

**Status:** [ ] PASS / [ ] FAIL

---

### 3. Backend Dual-Read Tests

These tests verify that backend services correctly read user data with partyId and tolerate legacy contactId-only records.

#### 3.1 GET /user - Current User

**Test:** Fetch current authenticated user profile.

**Endpoint:** `GET /api/user`

**Steps:**
1. Authenticate as a test user
2. Call `GET /api/user`
3. Verify response includes user data

**Expected:**
- Response includes id, email, name, firstName, lastName, etc.
- DTO structure unchanged from previous version
- No partyId exposed in public API response (internal field only)

**Status:** [ ] PASS / [ ] FAIL

---

#### 3.2 GET /users/:id - User Profile

**Test:** Fetch detailed user profile by ID.

**Endpoint:** `GET /api/users/:id`

**Steps:**
1. Query DB for a user with partyId:
   ```sql
   SELECT id FROM "User" WHERE "partyId" IS NOT NULL LIMIT 1;
   ```
2. Authenticate as super admin or the user themselves
3. Call `GET /api/users/{id}`
4. Verify response includes full profile with contactId

**Expected:**
- Response includes contactId field (legacy field maintained)
- partyId not exposed in DTO
- All user profile fields present and correct

**Status:** [ ] PASS / [ ] FAIL

---

#### 3.3 GET /users - List Users (Super Admin)

**Test:** List all users with search and filtering.

**Endpoint:** `GET /api/users?q=&tenantId=&page=1&limit=25`

**Steps:**
1. Authenticate as super admin
2. Call `GET /api/users`
3. Verify response includes users with correct data

**Expected:**
- Users returned with email, name, firstName, lastName, memberships
- DTO unchanged from previous version
- Pagination works correctly

**Status:** [ ] PASS / [ ] FAIL

---

### 4. Backend Dual-Write Tests

These tests verify that backend creates/updates persist both contactId and partyId correctly.

#### 4.1 PATCH /users/:id/contact - Set Contact ID

**Test:** Update user's contactId and verify partyId is also set.

**Endpoint:** `PATCH /api/users/:id/contact`

**Steps:**
1. Create or identify a test user without contactId
2. Create or identify a test contact with partyId
3. Call `PATCH /api/users/{userId}/contact` with `{ contactId: <contactId> }`
4. Query DB to verify both contactId and partyId were set:
   ```sql
   SELECT id, email, "contactId", "partyId"
   FROM "User"
   WHERE id = '<userId>';
   ```

**Expected:**
- API responds with 200 OK
- User.contactId matches the provided contactId
- User.partyId matches Contact.partyId
- DTO includes contactId (legacy field)

**Status:** [ ] PASS / [ ] FAIL

---

#### 4.2 PATCH /users/:id/contact - Clear Contact ID

**Test:** Clear user's contactId and verify partyId is also cleared.

**Endpoint:** `PATCH /api/users/:id/contact`

**Steps:**
1. Identify a test user with contactId and partyId set
2. Call `PATCH /api/users/{userId}/contact` with `{ contactId: null }`
3. Query DB to verify both fields were cleared:
   ```sql
   SELECT id, email, "contactId", "partyId"
   FROM "User"
   WHERE id = '<userId>';
   ```

**Expected:**
- API responds with 200 OK
- User.contactId is null
- User.partyId is null

**Status:** [ ] PASS / [ ] FAIL

---

#### 4.3 PATCH /users/:id/contact - Invalid Contact ID

**Test:** Attempt to set contactId to non-existent contact.

**Endpoint:** `PATCH /api/users/:id/contact`

**Steps:**
1. Call `PATCH /api/users/{userId}/contact` with `{ contactId: 999999 }`

**Expected:**
- API responds with 404 Not Found
- Error: `contact_not_found`
- User contactId and partyId remain unchanged

**Status:** [ ] PASS / [ ] FAIL

---

#### 4.4 PATCH /users/:id/contact - Contact Without Party

**Test:** Set contactId to a contact that has no partyId.

**Endpoint:** `PATCH /api/users/:id/contact`

**Steps:**
1. Create a contact without partyId (legacy data scenario):
   ```sql
   INSERT INTO "Contact" ("tenantId", "display_name", "partyId")
   VALUES (<testTenantId>, 'Contact Without Party', NULL)
   RETURNING id;
   ```
2. Call `PATCH /api/users/{userId}/contact` with the new contactId
3. Query DB to verify contactId is set but partyId remains null

**Expected:**
- API responds with 200 OK
- User.contactId set to provided value
- User.partyId is null (because Contact has no partyId)
- This is valid state during migration period

**Status:** [ ] PASS / [ ] FAIL

---

### 5. API Stability and DTO Validation

#### 5.1 No Breaking Changes in User DTOs

**Test:** Verify all User API responses match previous DTO structure.

**Endpoints:**
- `GET /api/user`
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PATCH /api/users/:id`
- `PATCH /api/users/:id/contact`

**Expected:**
- All responses include same fields as before migration
- No new partyId field exposed in public API
- contactId field still present and functional
- No additional required fields in request bodies

**Status:** [ ] PASS / [ ] FAIL

---

### 6. Unit Tests

#### 6.1 Run Jest Unit Tests

**Test:** Execute the user-party unit test suite.

**Command:**
```bash
npm test tests/user-party.test.ts
```

**Expected:**
- All tests pass
- Coverage includes:
  - partyId resolution from contactId
  - Dual-write verification
  - User-Party relation queries
  - Backfill simulation

**Status:** [ ] PASS / [ ] FAIL

---

### 7. Integration Tests

#### 7.1 End-to-End User Profile Update

**Test:** Full workflow of updating user contact through UI/API.

**Steps:**
1. Create test user, tenant, contact, and party
2. Assign user to tenant
3. Update user contact via API: `PATCH /users/:id/contact`
4. Verify in DB that partyId was set correctly
5. Fetch user profile and confirm contactId is returned
6. Clear user contact via API
7. Verify both contactId and partyId are null

**Expected:** All steps succeed with correct data at each stage.

**Status:** [ ] PASS / [ ] FAIL

---

### 8. Rollback Testing

#### 8.1 Verify Rollback Safety

**Test:** Check if removing partyId column would cause data loss.

Run query from VALIDATION_QUERIES_USER.md section 6.1.

**Expected:**
- 0 orphan parties (partyId without contactId)
- Safe to rollback if needed

**Status:** [ ] PASS / [ ] FAIL

---

#### 8.2 Execute Rollback Migration (Test Environment Only)

**Test:** Rollback the migration and verify system still works.

**Steps:**
1. Take database snapshot
2. Execute rollback migration:
   ```sql
   -- Drop FK constraint
   ALTER TABLE "User" DROP CONSTRAINT "User_partyId_fkey";

   -- Drop index
   DROP INDEX "User_partyId_idx";

   -- Drop column
   ALTER TABLE "User" DROP COLUMN "partyId";
   ```
3. Verify User API endpoints still work with contactId only
4. Restore from snapshot

**Expected:**
- Rollback executes without errors
- Legacy contactId-based operations continue to work
- No data loss

**Status:** [ ] PASS / [ ] FAIL

---

## Summary Checklist

- [ ] Schema changes validated (column, index, FK)
- [ ] Backfill 100% complete
- [ ] All GET endpoints return correct data
- [ ] All PATCH endpoints dual-write contactId and partyId
- [ ] DTOs unchanged, no breaking changes
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Rollback verified safe
- [ ] No errors in application logs during testing

---

## Test Execution Commands

### Run Unit Tests
```bash
cd ../breederhq-api
npm test tests/user-party.test.ts
```

### Run Validation Queries
```bash
cd ../breederhq-api
npx prisma db execute --file <(cat <<'EOF'
-- Paste queries from VALIDATION_QUERIES_USER.md
EOF
) --schema prisma/schema.prisma
```

### Manual API Testing with curl

**Get Current User:**
```bash
curl -X GET http://localhost:3000/api/user \
  -H "Cookie: bhq_s=<session-cookie>" \
  -H "Content-Type: application/json"
```

**Update User Contact:**
```bash
curl -X PATCH http://localhost:3000/api/users/<user-id>/contact \
  -H "Cookie: bhq_s=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"contactId": <contact-id>}'
```

**Clear User Contact:**
```bash
curl -X PATCH http://localhost:3000/api/users/<user-id>/contact \
  -H "Cookie: bhq_s=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"contactId": null}'
```

---

## Notes

- The User model has only one party-like relationship: `contactId` → `partyId`
- Unlike Breeding/Offspring domains, User does not have Organization linkage
- The partyId field is internal only - not exposed in public DTOs at this stage
- Dual-write is implemented in `PATCH /users/:id/contact` endpoint
- Legacy contactId field remains fully functional and is the primary API interface
- Future phase may expose Party-based queries, but Step 5 maintains backward compatibility

---

## Sign-Off

**Tester:** ___________________
**Date:** ___________________
**Result:** [ ] PASS / [ ] FAIL
**Notes:** ___________________
