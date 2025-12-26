# Party Migration Step 5: Attachment Party - Validation Queries

## SQL Verification Queries

### 1. Verify Backfill Correctness

```sql
-- Count of attachments successfully backfilled from contactId
SELECT COUNT(*) AS backfilled_from_contact
FROM "Attachment" a
INNER JOIN "Contact" c ON a."contactId" = c."id"
WHERE a."attachmentPartyId" = c."partyId";

-- Expected: Should match the total count of attachments with contactId
```

### 2. Check for Unresolved Party IDs

```sql
-- Count of attachments with contactId but no partyId
-- This should be 0 if all contacts have been migrated to Party
SELECT COUNT(*) AS missing_party_id
FROM "Attachment" a
INNER JOIN "Contact" c ON a."contactId" = c."id"
WHERE a."attachmentPartyId" IS NULL
  AND c."partyId" IS NOT NULL;

-- Expected: 0 (all contacts should have partyId from earlier migration steps)
```

### 3. Count Null Attachment Party IDs

```sql
-- Count of attachments with null attachmentPartyId
-- These are attachments not linked to contacts (valid scenario)
SELECT COUNT(*) AS null_attachment_party_id
FROM "Attachment"
WHERE "attachmentPartyId" IS NULL;

-- Expected: Should match count of attachments where contactId IS NULL
```

### 4. Detect Data Inconsistencies

```sql
-- Find any mismatches between contactId's partyId and attachmentPartyId
-- This should return 0 rows
SELECT
  a."id" AS attachment_id,
  a."contactId",
  a."attachmentPartyId",
  c."partyId" AS contact_party_id
FROM "Attachment" a
INNER JOIN "Contact" c ON a."contactId" = c."id"
WHERE a."attachmentPartyId" IS NOT NULL
  AND a."attachmentPartyId" != c."partyId";

-- Expected: 0 rows (no inconsistencies)
```

### 5. Verify Foreign Key Constraint

```sql
-- Verify all attachmentPartyId values reference valid Party records
SELECT COUNT(*) AS orphaned_party_refs
FROM "Attachment" a
LEFT JOIN "Party" p ON a."attachmentPartyId" = p."id"
WHERE a."attachmentPartyId" IS NOT NULL
  AND p."id" IS NULL;

-- Expected: 0 (all party IDs should be valid)
```

### 6. Index Performance Check

```sql
-- Verify index exists and can be used
EXPLAIN ANALYZE
SELECT * FROM "Attachment"
WHERE "attachmentPartyId" = 123;

-- Expected: Should show index scan, not seq scan
```

### 7. Distribution Analysis

```sql
-- Analyze distribution of attachments by type
SELECT
  CASE
    WHEN "contactId" IS NOT NULL AND "attachmentPartyId" IS NOT NULL THEN 'Has Contact & Party'
    WHEN "contactId" IS NOT NULL AND "attachmentPartyId" IS NULL THEN 'Has Contact, No Party'
    WHEN "contactId" IS NULL AND "attachmentPartyId" IS NULL THEN 'No Contact or Party'
    ELSE 'Other'
  END AS category,
  COUNT(*) AS count
FROM "Attachment"
GROUP BY category;

-- Expected: Provides insight into migration coverage
```

## Runtime Validation with curl

### Prerequisites

Set environment variables:
```bash
export API_URL="http://localhost:3000"  # or your API URL
export TENANT_ID="1"
export AUTH_TOKEN="your-auth-token"
```

### Test 1: Create Attachment with Contact

```bash
# Step 1: Create a test contact (or use existing)
curl -X POST "$API_URL/contacts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "display_name": "Test Contact",
    "email": "test@example.com"
  }'
# Note the returned contact ID

# Step 2: Get contact to verify it has a partyId
export CONTACT_ID=<contact_id_from_step_1>
curl -X GET "$API_URL/contacts/$CONTACT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN"
# Note the partyId from response

# Step 3: Create an attachment linked to this contact
export GROUP_ID=<existing_offspring_group_id>
curl -X POST "$API_URL/offspring/$GROUP_ID/attachments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "contactId": '$CONTACT_ID',
    "kind": "photo",
    "storageProvider": "local",
    "storageKey": "test-key-123",
    "filename": "test.jpg",
    "mime": "image/jpeg",
    "bytes": 1024
  }'
# Note the returned attachment ID

# Step 4: Verify in database that attachmentPartyId was set
# Run this SQL query:
# SELECT "id", "contactId", "attachmentPartyId"
# FROM "Attachment"
# WHERE "id" = <attachment_id_from_step_3>;
```

**Expected Result**:
- API response should include the created attachment
- Response format should match existing API contract (no new fields exposed)
- Database query should show both contactId and attachmentPartyId populated
- attachmentPartyId should match the Contact's partyId

### Test 2: Retrieve Attachment

```bash
# Retrieve offspring group with attachments
curl -X GET "$API_URL/offspring/$GROUP_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected Result**:
- Response includes attachments array
- Attachment objects have same shape as before migration
- No breaking changes to API response structure

### Test 3: Create Attachment without Contact

```bash
# Create an attachment not linked to a contact
curl -X POST "$API_URL/offspring/$GROUP_ID/attachments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "kind": "document",
    "storageProvider": "local",
    "storageKey": "test-doc-456",
    "filename": "test.pdf",
    "mime": "application/pdf",
    "bytes": 2048
  }'

# Verify in database:
# SELECT "id", "contactId", "attachmentPartyId"
# FROM "Attachment"
# WHERE "storageKey" = 'test-doc-456';
```

**Expected Result**:
- Attachment created successfully
- Both contactId and attachmentPartyId should be NULL
- No errors or warnings

## Performance Validation

### Test Index Usage

```sql
-- Test query performance with index
EXPLAIN ANALYZE
SELECT a.*, p."name" AS party_name
FROM "Attachment" a
LEFT JOIN "Party" p ON a."attachmentPartyId" = p."id"
WHERE a."tenantId" = 1
  AND a."attachmentPartyId" IS NOT NULL
ORDER BY a."createdAt" DESC
LIMIT 50;
```

**Expected**: Query plan should use index on attachmentPartyId

### Test Join Performance

```sql
-- Compare dual-read approach (using Party vs Contact)
-- Via Party (new way - preferred)
EXPLAIN ANALYZE
SELECT a.*, p."name", p."email"
FROM "Attachment" a
LEFT JOIN "Party" p ON a."attachmentPartyId" = p."id"
WHERE a."tenantId" = 1;

-- Via Contact (legacy way - fallback)
EXPLAIN ANALYZE
SELECT a.*, c."display_name", c."email"
FROM "Attachment" a
LEFT JOIN "Contact" c ON a."contactId" = c."id"
WHERE a."tenantId" = 1;
```

## Rollback Verification

If migration needs to be rolled back:

```sql
-- 1. Remove foreign key constraint
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_attachmentPartyId_fkey";

-- 2. Drop index
DROP INDEX "Attachment_attachmentPartyId_idx";

-- 3. Drop column
ALTER TABLE "Attachment" DROP COLUMN "attachmentPartyId";

-- 4. Verify attachments still work
SELECT COUNT(*) FROM "Attachment";
```

## Success Criteria

✅ All verification queries return expected results
✅ curl tests demonstrate backward compatibility
✅ No data integrity violations
✅ Performance acceptable (index being used)
✅ Legacy contactId column still functional
✅ Dual-write persists both contactId and attachmentPartyId
✅ Response DTOs unchanged
