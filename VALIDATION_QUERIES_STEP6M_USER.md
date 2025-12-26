# Validation Queries: Step 6M - User Party-Only

## Overview

This document contains validation queries for Step 6M of the Party migration, which removes the legacy `contactId` column from the `User` table and consolidates on `partyId` as the single source of truth for user profile party references.

## Validation SQL File Locations

The validation queries are located in:
```
breederhq-api/prisma/sql/validate_step6m_user_pre.sql   (run BEFORE migration)
breederhq-api/prisma/sql/validate_step6m_user_post.sql  (run AFTER migration)
```

## When to Run

**Before Migration:**
- Run `validate_step6m_user_pre.sql` before applying the migration to understand the current state
- Capture baseline counts and verify data quality
- Ensure all users with `contactId` have `partyId` populated

**After Migration:**
- Run `validate_step6m_user_post.sql` after migration to verify:
  - No data loss occurred
  - All user-contact relationships are intact via Party
  - Legacy `contactId` column has been removed
  - No orphaned records exist

## How to Execute

### Option 1: pgAdmin
1. Open pgAdmin and connect to the development database
2. Open the appropriate SQL file
3. Execute all queries
4. Review results for any anomalies

### Option 2: PowerShell (psql)
```powershell
# Navigate to the SQL directory
cd breederhq-api/prisma/sql

# Execute pre-migration validation
psql $env:DATABASE_URL -f validate_step6m_user_pre.sql

# After migration, execute post-migration validation
psql $env:DATABASE_URL -f validate_step6m_user_post.sql
```

## Expected Results - Pre-Migration

### 1. User partyId Coverage
- Should show 100% coverage for users that have `contactId` set
- `missing_party_id` should be **0** (zero)
- If any users have `contactId` but no `partyId`, backfill is required

### 2. Orphaned Party References
- Should be **0** (zero)
- All `partyId` values must reference valid Party records
- Any orphans indicate broken foreign key relationships

### 3. Party Backing Entity Integrity
- Should be **0** (zero)
- Every Party referenced by `partyId` must have a backing Contact
- Any orphaned Parties indicate incomplete data migration

### 4. ContactId vs PartyId Consistency
- Should be **0** (zero)
- The `contactId` on User should match the `contactId` on the Party referenced by `partyId`
- Any mismatches indicate data inconsistency

### 5. Legacy Column Status
- Both columns should exist: `contactId` and `partyId`
- Confirms pre-migration state

### 6. User Contact/Party Status Distribution
- Shows distribution of users with/without contact and party references
- Use to understand data coverage

### 7. Sample User Rows
- Provides sample of recent users with parties
- Verify that Party resolution is correct
- Check that Contact IDs match expectations

### 8. Users with Contact but No Party
- Count of users with `contactId` but no `partyId`
- Should be **0** - all users with contacts must have parties before migration

### 9. User Party Type Distribution
- Shows Party type breakdown
- All User parties should be type **CONTACT** (not ORGANIZATION)

### 10. Indexes on contactId
- Shows existing indexes on `contactId`
- Should see `User_contactId_key` unique index

## Expected Results - Post-Migration

### 1. Legacy Columns Removed
- `has_contact_id` = 0
- `has_party_id` = 1
- Confirms migration completed successfully

### 2. Current User Schema
- Shows remaining profile-related columns
- Should only see `partyId` and profile fields (phoneE164, street, etc.)

### 3. Indexes on partyId
- Should show `User_partyId_idx`
- Ensures query performance

### 4. Foreign Key Constraint
- Should show `User_partyId_fkey` with type 'f' (foreign key)
- Ensures referential integrity

### 5. Data Coverage Metrics
- Shows percentage of users with parties
- Not all users may have parties (some may not have contact profiles)
- Compare with pre-migration to ensure no data loss

### 6. Orphaned Party References
- Should be **0** (zero)
- All `partyId` values must reference valid Party records

### 7. User Party Type Distribution
- Should show all parties are type **CONTACT**
- Compare with pre-migration to ensure distribution is preserved

### 8. Party Backing Entity Integrity
- Should be **0** (zero)
- All Parties must have backing Contact

### 9. Sample User Rows with Derived Legacy Fields
- Shows how to derive legacy `contactId` from Party
- Use for API backward compatibility verification
- Verify that derived fields match original values

### 10. User Distribution by Verification Status
- Shows users by email verification status
- Verify data integrity maintained

### 11. Users with/without Party
- Shows distribution of users with and without parties
- Should match pre-migration distribution

### 12. Contact Back-Reference Removed
- Should return no rows
- Confirms that the `users User[]` relation was removed from Contact model

## Red Flags

**Stop and investigate if you see:**

1. **Pre-Migration: missing_party_id > 0**
   - Indicates users with `contactId` but no `partyId`
   - Must run backfill before proceeding with migration

2. **Pre/Post-Migration: orphaned_party_refs > 0**
   - Indicates `partyId` references that don't exist in Party table
   - Fix referential integrity before proceeding

3. **Pre-Migration: parties_without_contact > 0**
   - Indicates Parties without Contact backing
   - Create missing backing entities

4. **Pre-Migration: contact_party_mismatch > 0**
   - Indicates `contactId` doesn't match Party's `contactId`
   - Fix data inconsistencies

5. **Pre-Migration: users_with_contact_no_party > 0**
   - Same as missing_party_id, but explicit check
   - Run backfill to populate `partyId`

6. **Post-Migration: Legacy column not removed**
   - If `has_contact_id` > 0, migration didn't complete
   - Re-run migration or investigate

7. **Post-Migration: Missing index or FK constraint**
   - Ensures query performance and data integrity
   - Re-run migration if missing

8. **Post-Migration: Significant change in user count with parties**
   - Compare pre/post counts
   - Investigate any major discrepancies

9. **Post-Migration: Non-CONTACT party types**
   - User parties should always be CONTACT type
   - Investigate any ORGANIZATION types

## Migration Checklist

- [ ] Run `validate_step6m_user_pre.sql` validation queries
- [ ] Save baseline results
- [ ] Verify all validation checks pass (all critical counts = 0)
- [ ] Apply schema changes via `npx prisma db push`
- [ ] Run `validate_step6m_user_post.sql` validation queries
- [ ] Compare before/after results
- [ ] Verify orphan count is 0
- [ ] Verify total user counts with parties match
- [ ] Verify legacy `contactId` column removed (count = 0)
- [ ] Verify index and FK constraint exist
- [ ] Spot-check sample users
- [ ] Test user profile operations via API (see TEST_PLAN_STEP6M_USER.md)

## Notes

- Legacy `contactId` column has been removed
- All user-contact relationships now use `partyId`
- API backward compatibility should be maintained via mapping layer in routes
- Responses should still include `contactId` derived from Party backing for compatibility
- Not all users have parties (some users may not have contact profiles yet)
- User model's party reference is for the user's own contact profile (not buyer/seller tracking)

## Related Documentation

- Migration SQL: `prisma/migrations/20251226013914_step6m_user_party_only/migration.sql`
- Test Plan: `TEST_PLAN_STEP6M_USER.md`
- Party Migration Overview: See main project documentation
