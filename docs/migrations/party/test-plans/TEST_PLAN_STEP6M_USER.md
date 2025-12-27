# Test Plan: Step 6M - User Party-Only

## Overview

This test plan validates that the User domain correctly handles the transition from legacy `contactId` to Party-only references (`partyId`) while maintaining backward compatibility in the API.

## Test Scope

**In Scope:**
- User registration with contact profile creation
- User profile update operations
- User profile retrieval returns legacy `contactId` for backward compatibility
- Internal storage uses only `partyId`
- User authentication and session management

**Out of Scope:**
- User deletion (no changes)
- Non-contact user fields (email, password, etc.)
- User memberships and tenant associations
- Auth ancillaries (passkeys, recovery codes, sessions)

## Prerequisites

1. Development environment running:
   ```bash
   cd breederhq-api
   npm run dev
   ```

2. Valid tenant ID and authentication token

3. Test data:
   - Existing users with Party associations
   - Existing Contact records with associated Party records

## Environment Variables

```bash
export API_BASE="http://localhost:6001"
export TENANT_ID="1"
export AUTH_TOKEN="your-dev-token-here"
```

## Test Cases

### Test 1: User Profile Retrieval - Verify Legacy Fields

**Purpose:** Verify that getting user profile returns derived `contactId` for backward compatibility.

**Endpoint:** `GET /api/v1/users/profile` or `GET /api/v1/users/:id`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/users/profile" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response:**
```json
{
  "id": "cuid123",
  "email": "user@example.com",
  "name": "John Doe",
  "firstName": "John",
  "lastName": "Doe",
  "contactId": 123,
  "phoneE164": "+12025551234",
  "street": "123 Main St",
  "city": "Washington",
  "state": "DC",
  "postalCode": "20001",
  "country": "US"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Response includes `contactId` field (derived from Party backing)
- [ ] Response does NOT include `partyId` (internal only)
- [ ] All profile fields are present
- [ ] Database row has `partyId` set, not `contactId`

**DB Validation Query:**
```sql
SELECT
    u.id,
    u.email,
    u."partyId",
    p."contactId" AS party_contact_id,
    c.display_name
FROM "User" u
LEFT JOIN "Party" p ON p.id = u."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
WHERE u.id = 'cuid123';
```

Expected: `partyId` is set, no `contactId` column exists, `party_contact_id` matches API response.

---

### Test 2: Update User Profile - Contact Info

**Purpose:** Verify that updating user profile fields works correctly and maintains Party association.

**Endpoint:** `PATCH /api/v1/users/profile`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/users/profile" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "phoneE164": "+12025559999",
    "street": "456 Oak Ave",
    "city": "Arlington",
    "state": "VA"
  }'
```

**Expected Response:**
```json
{
  "id": "cuid123",
  "email": "user@example.com",
  "name": "John Doe",
  "contactId": 123,
  "phoneE164": "+12025559999",
  "street": "456 Oak Ave",
  "city": "Arlington",
  "state": "VA",
  "updatedAt": "2025-12-26T01:00:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Profile fields updated correctly
- [ ] `contactId` still returned in response
- [ ] Database `partyId` unchanged
- [ ] Associated Contact record updated (if syncing is implemented)

---

### Test 3: User Registration - New User with Contact

**Purpose:** Verify that creating a new user also creates Party and Contact if needed.

**Endpoint:** `POST /api/v1/auth/register` or similar

**Request:**
```bash
curl -X POST "${API_BASE}/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "firstName": "Jane",
    "lastName": "Smith",
    "phoneE164": "+12025551111"
  }'
```

**Expected Response:**
```json
{
  "user": {
    "id": "cuid456",
    "email": "newuser@example.com",
    "name": "Jane Smith",
    "firstName": "Jane",
    "lastName": "Smith",
    "contactId": 456,
    "phoneE164": "+12025551111"
  },
  "token": "jwt-token-here"
}
```

**Validation:**
- [ ] Response status is `201 Created` or `200 OK`
- [ ] User created successfully
- [ ] `contactId` returned in response
- [ ] Database has `partyId` set (not `contactId`)
- [ ] Party record created with type CONTACT
- [ ] Contact record created and linked to Party

**DB Validation Query:**
```sql
SELECT
    u.id,
    u.email,
    u."partyId",
    p.id AS party_id,
    p.type AS party_type,
    p."contactId" AS party_contact_id,
    c.id AS contact_id,
    c.display_name
FROM "User" u
LEFT JOIN "Party" p ON p.id = u."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
WHERE u.email = 'newuser@example.com';
```

Expected: `partyId` is set, Party type is CONTACT, Contact exists.

---

### Test 4: User Without Contact/Party

**Purpose:** Verify that users without contact profiles work correctly (edge case).

**Endpoint:** `GET /api/v1/users/:id`

**Request:**
```bash
# Assuming user with no party exists
curl -X GET "${API_BASE}/api/v1/users/cuid789" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response:**
```json
{
  "id": "cuid789",
  "email": "minimal@example.com",
  "name": null,
  "contactId": null,
  "phoneE164": null
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] `contactId` is `null`
- [ ] User data returned correctly
- [ ] Database has `partyId` = NULL

---

### Test 5: List Users - Verify Legacy Fields in Response

**Purpose:** Verify that when listing users, the response includes derived `contactId` for backward compatibility.

**Endpoint:** `GET /api/v1/users`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/users" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

**Expected Response Excerpt:**
```json
{
  "users": [
    {
      "id": "cuid123",
      "email": "user1@example.com",
      "name": "John Doe",
      "contactId": 123
    },
    {
      "id": "cuid456",
      "email": "user2@example.com",
      "name": "Jane Smith",
      "contactId": 456
    }
  ]
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] All users include `contactId` field
- [ ] Users with Party/Contact show correct `contactId`
- [ ] Users without Party show `contactId: null`
- [ ] Response does NOT include `partyId` (internal only)

---

### Test 6: Update User Profile - Name Changes

**Purpose:** Verify that name changes update both User and Contact (if syncing).

**Endpoint:** `PATCH /api/v1/users/profile`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/users/profile" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "firstName": "Jonathan",
    "lastName": "Doe-Smith"
  }'
```

**Expected Response:**
```json
{
  "id": "cuid123",
  "email": "user@example.com",
  "firstName": "Jonathan",
  "lastName": "Doe-Smith",
  "name": "Jonathan Doe-Smith",
  "contactId": 123,
  "updatedAt": "2025-12-26T01:05:00.000Z"
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Name fields updated in User
- [ ] `contactId` still returned
- [ ] Associated Contact record updated if syncing is implemented
- [ ] Party name updated if applicable

**DB Validation Query:**
```sql
SELECT
    u.id,
    u."firstName",
    u."lastName",
    u.name,
    c.first_name AS contact_first_name,
    c.last_name AS contact_last_name,
    c.display_name AS contact_display_name
FROM "User" u
LEFT JOIN "Party" p ON p.id = u."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
WHERE u.id = 'cuid123';
```

---

### Test 7: Edge Case - User with Invalid Party Reference

**Purpose:** Verify graceful handling if `partyId` references a non-existent Party (should not happen with FK constraint).

**Endpoint:** `GET /api/v1/users/:id`

**Setup:**
This should not be possible with FK constraints in place, but test error handling.

**Expected Behavior:**
- FK constraint prevents creation of invalid references
- If somehow occurs, API should handle gracefully (return null for `contactId`)

---

### Test 8: Admin User List - Filter by Contact Status

**Purpose:** Verify that admin endpoints can filter/search users by contact presence.

**Endpoint:** `GET /api/v1/admin/users?hasContact=true`

**Request:**
```bash
curl -X GET "${API_BASE}/api/v1/admin/users?hasContact=true" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${ADMIN_AUTH_TOKEN}"
```

**Expected Response:**
```json
{
  "users": [
    {
      "id": "cuid123",
      "email": "user1@example.com",
      "contactId": 123,
      "partyId": 1
    }
  ]
}
```

**Validation:**
- [ ] Response status is `200 OK`
- [ ] Only users with Party/Contact returned
- [ ] Both `contactId` and `partyId` may be included for admin view
- [ ] Filter works correctly

---

### Test 9: User Contact Sync - Update Contact Updates User

**Purpose:** Verify that if a Contact is updated, related User profile reflects changes (if syncing).

**Note:** This test is only applicable if bidirectional sync is implemented.

**Endpoint:** `PATCH /api/v1/contacts/:id`

**Request:**
```bash
curl -X PATCH "${API_BASE}/api/v1/contacts/123" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "phoneE164": "+12025558888",
    "email": "updated@example.com"
  }'
```

**Validation:**
- [ ] Contact updated successfully
- [ ] User associated with this contact reflects updates (if syncing)
- [ ] Party reference intact

---

### Test 10: User Deletion - Cleanup Party/Contact

**Purpose:** Verify that deleting a user handles Party/Contact cleanup appropriately.

**Endpoint:** `DELETE /api/v1/users/:id`

**Request:**
```bash
curl -X DELETE "${API_BASE}/api/v1/users/cuid999" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Authorization: Bearer ${ADMIN_AUTH_TOKEN}"
```

**Expected Behavior:**
- User deleted
- Party reference set to NULL or Party orphaned (depending on business logic)
- Contact may remain (if used elsewhere) or be soft-deleted

**Validation:**
- [ ] User deleted successfully
- [ ] Party/Contact handling follows business rules
- [ ] No orphaned references

---

## Acceptance Criteria

- [ ] All test cases pass
- [ ] Legacy `contactId` field is returned in API responses for backward compatibility
- [ ] Internal storage uses only `partyId`
- [ ] No TypeScript errors in build
- [ ] Database validation queries show correct Party relationships
- [ ] No orphaned users (all `partyId` values reference valid Parties)
- [ ] User registration creates Party and Contact correctly
- [ ] Profile updates maintain Party associations
- [ ] Name and contact info changes sync correctly (if applicable)

## Rollback Plan

If tests fail:
1. Revert schema changes in `prisma/schema.prisma`
2. Run `npx prisma db push` to restore previous schema
3. Revert code changes in user routes/services
4. Restart dev server

## Notes

- The mapping layer in user routes handles backward compatibility
- Helper functions should derive `contactId` from Party backing
- Party resolution should use the `resolvePartyId()` service from `src/services/party-resolver.ts`
- Not all users have parties (some may not have contact profiles)
- User model's `partyId` is for the user's own contact profile
- Different from buyer/seller tracking on animals or contracts

## Related Documentation

- Validation Queries: `VALIDATION_QUERIES_STEP6M_USER.md`
- Migration SQL: `prisma/migrations/20251226013914_step6m_user_party_only/migration.sql`
- Party Migration Overview: See main project documentation
