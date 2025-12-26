# Validation Queries: Step 6H - AnimalOwner Party-Only

## Overview

This document contains validation queries for Step 6H of the Party migration, which removes the legacy `contactId`, `organizationId`, and `partyType` columns from the `AnimalOwner` table and consolidates on `partyId` as the single source of truth for owner references.

## Validation SQL File Locations

The validation queries are located in:
```
breederhq-api/prisma/sql/validate_step6h_animalowner_pre.sql   (run BEFORE migration)
breederhq-api/prisma/sql/validate_step6h_animalowner_post.sql  (run AFTER migration)
```

## When to Run

**Before Migration:**
- Run `validate_step6h_animalowner_pre.sql` before applying the migration to understand the current state
- Capture baseline counts and verify data quality
- Ensure all animal owners have `partyId` populated

**After Migration:**
- Run `validate_step6h_animalowner_post.sql` after migration to verify:
  - No data loss occurred
  - All animal-owner relationships are intact
  - Legacy columns have been removed
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
psql $env:DATABASE_URL -f validate_step6h_animalowner_pre.sql

# After migration, execute post-migration validation
psql $env:DATABASE_URL -f validate_step6h_animalowner_post.sql
```

## Expected Results - Pre-Migration

### 1. AnimalOwner partyId Coverage
- Should show 100% coverage for animal owners that have legacy owner fields set
- `missing_party_id` should be **0** (zero)
- If any owners have `contactId` or `organizationId` but no `partyId`, backfill is required

### 2. Dual Owner Assignment Conflicts
- Should be **0** (zero)
- AnimalOwner records should not have both `contactId` AND `organizationId` set
- Any conflicts indicate data integrity issues that must be resolved

### 3. Orphaned Party References
- Should be **0** (zero)
- All `partyId` values must reference valid Party records
- Any orphans indicate broken foreign key relationships

### 4. Party Type Mismatch
- Should be **0** (zero)
- The `partyType` column should match the actual Party type
- Any mismatches indicate data inconsistency

### 5. Party Backing Entity Integrity
- Should be **0** (zero)
- Every Party referenced by `partyId` must have a backing Contact or Organization
- Any orphaned Parties indicate incomplete data migration

### 6. Legacy Column Status
- All four columns should exist: `contactId`, `organizationId`, `partyType`, `partyId`
- Confirms pre-migration state

### 7. AnimalOwner Distribution by Type
- Shows distribution of owners by party type (CONTACT vs ORGANIZATION)
- Verify that Party type distribution is reasonable

### 8. Sample AnimalOwner Rows
- Provides sample of recent animal owners
- Verify that owner Party resolution is correct
- Check that Contact/Organization IDs match expectations

### 9. Animals with Multiple Owners
- Shows statistics about co-ownership
- Average and maximum number of owners per animal
- Helps understand co-ownership patterns

### 10. Party Type Distribution
- Shows breakdown by CONTACT vs ORGANIZATION owner types
- Verifies Party type distribution

### 11. Primary vs Non-Primary Owners
- Shows distribution of primary ownership flags
- Typically, each animal should have exactly one primary owner

### 12. Duplicate animalId + partyId Combinations
- Should be **0** (zero)
- Ensures unique constraint will not be violated
- Each animal-party combination should appear only once

## Expected Results - Post-Migration

### 1. Legacy Columns Removed
- `has_contact_id` = 0
- `has_organization_id` = 0
- `has_party_type` = 0
- `has_party_id` = 1
- Confirms migration completed successfully

### 2. Current AnimalOwner Schema
- Shows all remaining columns
- Should only see `id`, `animalId`, `partyId`, `percent`, `isPrimary`, timestamps

### 3. Indexes on partyId
- Should show at least 1 index:
  - `AnimalOwner_partyId_idx`
- Ensures query performance

### 4. Foreign Key Constraint
- Should show `AnimalOwner_partyId_fkey` with type 'f' (foreign key)
- Ensures referential integrity

### 5. Unique Constraint on animalId + partyId
- Should show `AnimalOwner_animalId_partyId_key` with type 'u' (unique)
- Prevents duplicate ownership records

### 6. Data Coverage Metrics
- Shows percentage of animal owners with partyId
- Should be 100% (all owners must have partyId)

### 7. Orphaned Party References
- Should be **0** (zero)
- All `partyId` values must reference valid Party records

### 8. Party Type Distribution
- Should show breakdown by CONTACT and ORGANIZATION types
- Compare with pre-migration to ensure distribution is preserved

### 9. Party Backing Entity Integrity
- Should be **0** (zero)
- All Parties must have backing Contact or Organization

### 10. Sample AnimalOwner Rows with Derived Legacy Fields
- Shows how to derive legacy `contactId`/`organizationId` from Party
- Use for API backward compatibility verification
- Verify that derived fields match original values

### 11. Animals with Multiple Owners
- Shows co-ownership statistics
- Should match pre-migration counts

### 12. Primary vs Non-Primary Owners
- Distribution should match pre-migration
- Verify primary ownership is preserved

### 13. Ownership Percentage Distribution
- Shows distribution of ownership percentages
- Many will be 100% (sole ownership), some will be partial

### 14. Animals with 100% Ownership Verification
- Shows animals with total ownership = 100%
- Some animals may have partial ownership (< 100%)
- Over 100% indicates a data issue

### 15. Verify Old Unique Constraints Removed
- Should only show `AnimalOwner_animalId_partyId_key`
- Old constraints on `animalId_contactId` and `animalId_organizationId` should be removed

## Red Flags

**Stop and investigate if you see:**

1. **Pre-Migration: missing_party_id > 0**
   - Indicates animal owners with legacy owner fields but no `partyId`
   - Must run backfill before proceeding with migration

2. **Pre-Migration: conflicting_entries > 0**
   - Indicates owners with both `contactId` AND `organizationId`
   - Determine precedence and resolve conflicts

3. **Pre/Post-Migration: orphaned_party_refs > 0**
   - Indicates `partyId` references that don't exist in Party table
   - Fix referential integrity before proceeding

4. **Pre-Migration: type_mismatch_count > 0**
   - Indicates `partyType` doesn't match actual Party type
   - Fix data inconsistencies

5. **Pre/Post-Migration: parties_without_backing_entity > 0**
   - Indicates Parties without Contact or Organization backing
   - Create missing backing entities

6. **Pre-Migration: duplicate_combinations > 0**
   - Indicates multiple AnimalOwner records with same animalId + partyId
   - Consolidate duplicates before migration

7. **Post-Migration: Legacy columns not removed**
   - If any legacy column count > 0, migration didn't complete
   - Re-run migration or investigate

8. **Post-Migration: Missing indexes or FK constraint**
   - Ensures query performance and data integrity
   - Re-run migration if missing

9. **Post-Migration: party_pct < 100%**
   - All animal owners must have partyId
   - Investigate any NULL partyId values

10. **Post-Migration: Old unique constraints still exist**
    - Constraints on contactId/organizationId should be removed
    - Only animalId + partyId constraint should remain

## Migration Checklist

- [ ] Run `validate_step6h_animalowner_pre.sql` validation queries
- [ ] Save baseline results
- [ ] Verify all validation checks pass (all critical counts = 0)
- [ ] Apply schema changes via `npm run db:dev` or `npx prisma db push`
- [ ] Run `validate_step6h_animalowner_post.sql` validation queries
- [ ] Compare before/after results
- [ ] Verify orphan count is 0
- [ ] Verify total animal owner counts match
- [ ] Verify legacy columns removed (counts = 0)
- [ ] Verify indexes and FK constraint exist
- [ ] Verify unique constraint on animalId + partyId exists
- [ ] Spot-check sample animal owners
- [ ] Test animal owner operations via API (see TEST_PLAN_STEP6H_ANIMALOWNER.md)

## Notes

- Legacy `contactId`, `organizationId`, and `partyType` columns have been removed
- All animal-owner relationships now use `partyId`
- API backward compatibility should be maintained via mapping layer in routes
- Responses should still include `contactId` or `organizationId` derived from Party backing for compatibility
- Co-ownership is supported via multiple AnimalOwner records for the same animal
- Each AnimalOwner record should have a percentage representing ownership share
- Typically one owner is marked as primary (`isPrimary = true`)
- Total ownership percentages may be < 100% (partial ownership) or > 100% (data issue to investigate)

## Related Documentation

- Migration SQL: `prisma/migrations/20251225185510_step6h_animalowner_party_only/migration.sql`
- Test Plan: `TEST_PLAN_STEP6H_ANIMALOWNER.md`
- Party Migration Overview: See main project documentation
