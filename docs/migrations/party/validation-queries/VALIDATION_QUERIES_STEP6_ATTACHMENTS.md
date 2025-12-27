# Validation Queries: Step 6A - Attachments Party-Only

## Overview

This document contains validation queries for Step 6A of the Party migration, which removes the legacy `contactId` column from the `Attachment` table and consolidates on `attachmentPartyId` as the single source of truth for party references.

## Validation SQL File Location

The validation queries are located in:
```
breederhq-api/prisma/sql/validate_step6_attachments_party_only.sql
```

## When to Run

**Before Migration:**
- Run these queries before applying the migration to understand the current state
- Capture baseline counts and verify data quality

**After Migration:**
- Run these queries after migration to verify:
  - No data loss occurred
  - All attachment-party relationships are intact
  - Legacy columns have been removed
  - No orphaned records exist

## How to Execute

### Option 1: pgAdmin
1. Open pgAdmin and connect to the development database
2. Open the SQL file: `breederhq-api/prisma/sql/validate_step6_attachments_party_only.sql`
3. Execute all queries
4. Review results for any anomalies

### Option 2: PowerShell (psql)
```powershell
# Navigate to the SQL directory
cd breederhq-api/prisma/sql

# Execute the validation queries
psql $env:DATABASE_URL -f validate_step6_attachments_party_only.sql
```

## Expected Results

### 1. Total Attachments
- Should match the count before and after migration
- No attachments should be lost

### 2. Attachments with NULL attachmentPartyId
- Attachments are allowed to have NULL `attachmentPartyId` (not all attachments belong to a party)
- Count may be non-zero, which is expected behavior
- Verify this count remains stable before and after migration

### 3. Orphan Attachments
- Should be **0** (zero)
- Any non-zero value indicates data integrity issues
- All `attachmentPartyId` values must reference valid Party records

### 4. Party Type Distribution
- Should show breakdown by CONTACT and ORGANIZATION types
- Verifies that Party backing is correctly set up
- Compare before/after to ensure distribution is preserved

### 5. Attachments by Entity Type
- Shows distribution across plans, animals, litters, groups, offspring
- Verifies that attachments are properly linked to their parent entities
- Should remain stable before and after migration

### 6. Sample Attachments
- Provides a sample of 10 recent attachments with their Party details
- Use to spot-check that Party backing IDs are correct
- Verify that `party_backing_contact_id` or `party_backing_org_id` is populated appropriately

## Red Flags

**Stop and investigate if you see:**

1. **Non-zero orphan count** (Query 3)
   - Indicates `attachmentPartyId` references that don't exist in the Party table
   - Must be resolved before migration

2. **Significant drop in total attachment count** (Query 1)
   - Indicates data loss during migration
   - Roll back and investigate

3. **Unexpected NULL counts** (Query 2)
   - If count changes dramatically, verify that Party resolution logic is working correctly
   - Compare with pre-migration baseline

4. **Missing Party type distribution** (Query 4)
   - If all Party types are NULL, indicates Party relation is broken
   - Verify include clauses and Party data population

## Migration Checklist

- [ ] Run validation queries **before** migration
- [ ] Save baseline results
- [ ] Apply schema changes via `npm run db:dev`
- [ ] Run validation queries **after** migration
- [ ] Compare before/after results
- [ ] Verify orphan count is 0
- [ ] Verify total counts match
- [ ] Spot-check sample attachments
- [ ] Test attachment creation via API (see TEST_PLAN_STEP6_ATTACHMENTS.md)

## Notes

- Legacy `contactId` column has been removed from the Attachment table
- All attachment-party relationships now use `attachmentPartyId`
- API backward compatibility is maintained via mapping layer in routes
- Responses still include `contactId` derived from Party backing for compatibility
