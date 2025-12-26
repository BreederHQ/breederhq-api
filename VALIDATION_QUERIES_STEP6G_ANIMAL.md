# Validation Queries: Step 6G - Animal Buyer Party-Only

## Overview

This document contains validation queries for Step 6G of the Party migration, which removes the legacy `buyerContactId`, `buyerOrganizationId`, and `buyerPartyType` columns from the `Animal` table and consolidates on `buyerPartyId` as the single source of truth for buyer references.

## Validation SQL File Locations

The validation queries are located in:
```
breederhq-api/prisma/sql/validate_step6g_animal_pre.sql   (run BEFORE migration)
breederhq-api/prisma/sql/validate_step6g_animal_post.sql  (run AFTER migration)
```

## When to Run

**Before Migration:**
- Run `validate_step6g_animal_pre.sql` before applying the migration to understand the current state
- Capture baseline counts and verify data quality
- Ensure all animals with buyers have `buyerPartyId` populated

**After Migration:**
- Run `validate_step6g_animal_post.sql` after migration to verify:
  - No data loss occurred
  - All animal-buyer relationships are intact
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
psql $env:DATABASE_URL -f validate_step6g_animal_pre.sql

# After migration, execute post-migration validation
psql $env:DATABASE_URL -f validate_step6g_animal_post.sql
```

## Expected Results - Pre-Migration

### 1. Animal buyerPartyId Coverage
- Should show 100% coverage for animals that have legacy buyer fields set
- `missing_buyer_party_id` should be **0** (zero)
- If any animals have `buyerContactId` or `buyerOrganizationId` but no `buyerPartyId`, backfill is required

### 2. Dual Buyer Assignment Conflicts
- Should be **0** (zero)
- Animals should not have both `buyerContactId` AND `buyerOrganizationId` set
- Any conflicts indicate data integrity issues that must be resolved

### 3. Orphaned Buyer Party References
- Should be **0** (zero)
- All `buyerPartyId` values must reference valid Party records
- Any orphans indicate broken foreign key relationships

### 4. Buyer Party Type Mismatch
- Should be **0** (zero)
- The `buyerPartyType` column should match the actual Party type
- Any mismatches indicate data inconsistency

### 5. Party Backing Entity Integrity
- Should be **0** (zero)
- Every Party referenced by `buyerPartyId` must have a backing Contact or Organization
- Any orphaned Parties indicate incomplete data migration

### 6. Legacy Column Status
- All four columns should exist: `buyerContactId`, `buyerOrganizationId`, `buyerPartyType`, `buyerPartyId`
- Confirms pre-migration state

### 7. Animal Buyer Status Distribution
- Shows distribution of animals with/without buyers by status
- Use to understand which animal statuses typically have buyers (e.g., SOLD)

### 8. Sample Animal Rows
- Provides sample of recent animals with buyers
- Verify that buyer Party resolution is correct
- Check that Contact/Organization IDs match expectations

### 9. Animals with Sale Data but No Buyer
- Count of animals with pricing/placement data but no buyer
- Some animals may have planned sale data without a buyer yet (acceptable)

### 10. Buyer Party Type Distribution
- Shows breakdown by CONTACT vs ORGANIZATION buyer types
- Verifies Party type distribution

## Expected Results - Post-Migration

### 1. Legacy Columns Removed
- `has_buyer_contact_id` = 0
- `has_buyer_organization_id` = 0
- `has_buyer_party_type` = 0
- `has_buyer_party_id` = 1
- Confirms migration completed successfully

### 2. Current Animal Schema
- Shows remaining buyer-related columns
- Should only see `buyerPartyId` and sale-related fields (priceCents, placedAt, etc.)

### 3. Indexes on buyerPartyId
- Should show at least 2 indexes:
  - `Animal_buyerPartyId_idx`
  - `Animal_tenantId_buyerPartyId_idx`
- Ensures query performance

### 4. Foreign Key Constraint
- Should show `Animal_buyerPartyId_fkey` with type 'f' (foreign key)
- Ensures referential integrity

### 5. Data Coverage Metrics
- Shows percentage of animals with buyers
- Not all animals have buyers (many are active/not for sale)
- Compare with pre-migration to ensure no data loss

### 6. Orphaned Buyer Party References
- Should be **0** (zero)
- All `buyerPartyId` values must reference valid Party records

### 7. Buyer Party Type Distribution
- Should show breakdown by CONTACT and ORGANIZATION types
- Compare with pre-migration to ensure distribution is preserved

### 8. Party Backing Entity Integrity
- Should be **0** (zero)
- All Parties must have backing Contact or Organization

### 9. Sample Animal Rows with Derived Legacy Fields
- Shows how to derive legacy `buyerContactId`/`buyerOrganizationId` from Party
- Use for API backward compatibility verification
- Verify that derived fields match original values

### 10. Animal Status Distribution
- Shows animals by status with/without buyers
- Should match pre-migration distribution

### 11. Animals with Sale Data
- Count of animals with various sale-related fields
- Verify sale data integrity maintained

### 12. Animals by Species with Buyers
- Shows buyer distribution across species
- Helps identify species-specific patterns

## Red Flags

**Stop and investigate if you see:**

1. **Pre-Migration: missing_buyer_party_id > 0**
   - Indicates animals with legacy buyer fields but no `buyerPartyId`
   - Must run backfill before proceeding with migration

2. **Pre-Migration: conflicting_entries > 0**
   - Indicates animals with both `buyerContactId` AND `buyerOrganizationId`
   - Determine precedence and resolve conflicts

3. **Pre/Post-Migration: orphaned_buyer_party_refs > 0**
   - Indicates `buyerPartyId` references that don't exist in Party table
   - Fix referential integrity before proceeding

4. **Pre-Migration: type_mismatch_count > 0**
   - Indicates `buyerPartyType` doesn't match actual Party type
   - Fix data inconsistencies

5. **Pre/Post-Migration: parties_without_backing_entity > 0**
   - Indicates Parties without Contact or Organization backing
   - Create missing backing entities

6. **Post-Migration: Legacy columns not removed**
   - If any legacy column count > 0, migration didn't complete
   - Re-run migration or investigate

7. **Post-Migration: Missing indexes or FK constraint**
   - Ensures query performance and data integrity
   - Re-run migration if missing

8. **Post-Migration: Significant change in animal count with buyers**
   - Compare pre/post counts
   - Investigate any major discrepancies

## Migration Checklist

- [ ] Run `validate_step6g_animal_pre.sql` validation queries
- [ ] Save baseline results
- [ ] Verify all validation checks pass (all critical counts = 0)
- [ ] Apply schema changes via `npm run db:dev` or `npx prisma db push`
- [ ] Run `validate_step6g_animal_post.sql` validation queries
- [ ] Compare before/after results
- [ ] Verify orphan count is 0
- [ ] Verify total animal counts with buyers match
- [ ] Verify legacy columns removed (counts = 0)
- [ ] Verify indexes and FK constraint exist
- [ ] Spot-check sample animals
- [ ] Test animal buyer operations via API (see TEST_PLAN_STEP6G_ANIMAL.md)

## Notes

- Legacy `buyerContactId`, `buyerOrganizationId`, and `buyerPartyType` columns have been removed
- All animal-buyer relationships now use `buyerPartyId`
- API backward compatibility should be maintained via mapping layer in routes
- Responses should still include `buyerContactId` derived from Party backing for compatibility
- Not all animals have buyers (only SOLD, PLACED, or animals with pending sales)
- Sale-related fields (`priceCents`, `depositCents`, `placedAt`, etc.) are independent of buyer reference

## Related Documentation

- Migration SQL: `prisma/migrations/TIMESTAMP_step6g_animal_buyer_party_only/migration.sql`
- Test Plan: `TEST_PLAN_STEP6G_ANIMAL.md`
- Party Migration Overview: See main project documentation
