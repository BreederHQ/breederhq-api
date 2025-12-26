# Validation Queries: Step 6I - BreedingAttempt Stud Owner Party-Only

## Overview

This document contains validation queries for Step 6I of the Party migration, which removes the legacy `studOwnerContactId` column from the `BreedingAttempt` table and consolidates on `studOwnerPartyId` as the single source of truth for stud owner references.

## Validation SQL File Locations

The validation queries are located in:
```
breederhq-api/prisma/sql/validate_step6i_breedingattempt_pre.sql   (run BEFORE migration)
breederhq-api/prisma/sql/validate_step6i_breedingattempt_post.sql  (run AFTER migration)
```

## When to Run

**Before Migration:**
- Run `validate_step6i_breedingattempt_pre.sql` before applying the migration to understand the current state
- Capture baseline counts and verify data quality
- Ensure all breeding attempts with stud owners have `studOwnerPartyId` populated

**After Migration:**
- Run `validate_step6i_breedingattempt_post.sql` after migration to verify:
  - No data loss occurred
  - All stud owner relationships are intact
  - Legacy column has been removed
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
psql $env:DATABASE_URL -f validate_step6i_breedingattempt_pre.sql

# After migration, execute post-migration validation
psql $env:DATABASE_URL -f validate_step6i_breedingattempt_post.sql
```

## Expected Results - Pre-Migration

### 1. BreedingAttempt studOwnerPartyId Coverage
- Should show 100% coverage for breeding attempts that have legacy stud owner fields set
- `missing_stud_owner_party_id` should be **0** (zero)
- If any attempts have `studOwnerContactId` but no `studOwnerPartyId`, backfill is required

### 2. Orphaned Stud Owner Party References
- Should be **0** (zero)
- All `studOwnerPartyId` values must reference valid Party records
- Any orphans indicate broken foreign key relationships

### 3. Party Backing Entity Integrity
- Should be **0** (zero)
- Every Party referenced by `studOwnerPartyId` must have a backing Contact or Organization
- Any orphaned Parties indicate incomplete data migration

### 4. Legacy Column Status
- Both columns should exist: `studOwnerContactId`, `studOwnerPartyId`
- Confirms pre-migration state

### 5. BreedingAttempt Stud Owner Distribution
- Shows distribution of attempts with/without stud owners
- Provides baseline percentage for comparison after migration

### 6. Sample BreedingAttempt Rows
- Provides sample of recent attempts with stud owners
- Verify that stud owner Party resolution is correct
- Check that Contact/Organization IDs match expectations

### 7. Stud Owner Party Type Distribution
- Shows breakdown by CONTACT vs ORGANIZATION stud owner types
- Verifies Party type distribution

### 8. BreedingAttempt by Method
- Shows breeding attempts by method (NATURAL, AI, etc.) with stud owner status
- Helps identify patterns in stud owner usage by breeding method

### 9. StudOwnerContactId Mismatch Check
- Verifies that `studOwnerContactId` and `studOwnerPartyId` point to the same contact
- `mismatch_count` should be **0** (zero)
- Any mismatches indicate data integrity issues

### 10. BreedingAttempts by Success Status
- Shows distribution by success status with/without stud owners
- Helps verify data patterns

## Expected Results - Post-Migration

### 1. Legacy Column Removed
- `has_stud_owner_contact_id` = 0
- `has_stud_owner_party_id` = 1
- Confirms migration completed successfully

### 2. Current BreedingAttempt Schema
- Shows remaining stud owner-related columns
- Should only see `studOwnerPartyId` and semen-related fields

### 3. Indexes on studOwnerPartyId
- Should show at least:
  - `BreedingAttempt_studOwnerPartyId_idx`
- Ensures query performance

### 4. Foreign Key Constraint
- Should show `BreedingAttempt_studOwnerPartyId_fkey` with type 'f' (foreign key)
- Ensures referential integrity

### 5. Data Coverage Metrics
- Shows percentage of breeding attempts with stud owners
- Not all attempts have stud owners (depends on breeding method)
- Compare with pre-migration to ensure no data loss

### 6. Orphaned Stud Owner Party References
- Should be **0** (zero)
- All `studOwnerPartyId` values must reference valid Party records

### 7. Stud Owner Party Type Distribution
- Should show breakdown by CONTACT and ORGANIZATION types
- Compare with pre-migration to ensure distribution is preserved

### 8. Party Backing Entity Integrity
- Should be **0** (zero)
- All Parties must have backing Contact or Organization

### 9. Sample BreedingAttempt Rows with Derived Legacy Fields
- Shows how to derive legacy `studOwnerContactId` from Party
- Use for API backward compatibility verification
- Verify that derived fields match original values

### 10. BreedingAttempt by Method Distribution
- Shows attempts by breeding method with/without stud owners
- Should match pre-migration distribution

### 11. BreedingAttempt by Success Status
- Shows attempts by success status with/without stud owners
- Should match pre-migration distribution

### 12. Recent BreedingAttempts with Stud Owners
- Sample of recent attempts showing stud owner details
- Verify stud owner names and types are correctly resolved

## Red Flags

**Stop and investigate if you see:**

1. **Pre-Migration: missing_stud_owner_party_id > 0**
   - Indicates attempts with legacy stud owner field but no `studOwnerPartyId`
   - Must run backfill before proceeding with migration

2. **Pre/Post-Migration: orphaned_stud_owner_party_refs > 0**
   - Indicates `studOwnerPartyId` references that don't exist in Party table
   - Fix referential integrity before proceeding

3. **Pre/Post-Migration: parties_without_backing_entity > 0**
   - Indicates Parties without Contact or Organization backing
   - Create missing backing entities

4. **Pre-Migration: mismatch_count > 0**
   - Indicates `studOwnerContactId` and `studOwnerPartyId` point to different contacts
   - Fix data inconsistencies before migration

5. **Post-Migration: Legacy column not removed**
   - If `has_stud_owner_contact_id` > 0, migration didn't complete
   - Re-run migration or investigate

6. **Post-Migration: Missing indexes or FK constraint**
   - Ensures query performance and data integrity
   - Re-run migration if missing

7. **Post-Migration: Significant change in attempt count with stud owners**
   - Compare pre/post counts
   - Investigate any major discrepancies

## Migration Checklist

- [ ] Run `validate_step6i_breedingattempt_pre.sql` validation queries
- [ ] Save baseline results
- [ ] Verify all validation checks pass (all critical counts = 0)
- [ ] Apply schema changes via `npm run db:dev` or `npx prisma db push`
- [ ] Run `validate_step6i_breedingattempt_post.sql` validation queries
- [ ] Compare before/after results
- [ ] Verify orphan count is 0
- [ ] Verify total attempt counts with stud owners match
- [ ] Verify legacy column removed (count = 0)
- [ ] Verify indexes and FK constraint exist
- [ ] Spot-check sample breeding attempts
- [ ] Test breeding attempt operations via API (see TEST_PLAN_STEP6I_BREEDINGATTEMPT.md)

## Notes

- Legacy `studOwnerContactId` column has been removed
- All stud owner relationships now use `studOwnerPartyId`
- API backward compatibility should be maintained via mapping layer in routes
- Responses should still include `studOwnerContactId` derived from Party backing for compatibility
- Not all breeding attempts have stud owners (depends on breeding method and scenario)
- Stud owner is typically relevant for AI (artificial insemination) or when using external stud services
- Natural breeding may or may not have stud owner depending on ownership arrangements

## Related Documentation

- Migration SQL: `prisma/migrations/TIMESTAMP_step6i_breedingattempt_studowner_party_only/migration.sql`
- Test Plan: `TEST_PLAN_STEP6I_BREEDINGATTEMPT.md`
- Party Migration Overview: See main project documentation
