# Validation Queries: Step 6L - OffspringContract Buyer Party-Only

## Overview

This document contains validation queries for Step 6L of the Party migration, which removes the legacy `buyerContactId` and `buyerOrganizationId` columns from the `OffspringContract` table and consolidates on `buyerPartyId` as the single source of truth for buyer references.

## Validation SQL File Locations

The validation queries are located in:
```
breederhq-api/prisma/sql/validate_step6l_offspringcontract_pre.sql   (run BEFORE migration)
breederhq-api/prisma/sql/validate_step6l_offspringcontract_post.sql  (run AFTER migration)
```

## When to Run

**Before Migration:**
- Run `validate_step6l_offspringcontract_pre.sql` before applying the migration to understand the current state
- Capture baseline counts and verify data quality
- Ensure all contracts with buyers have `buyerPartyId` populated

**After Migration:**
- Run `validate_step6l_offspringcontract_post.sql` after migration to verify:
  - No data loss occurred
  - All contract-buyer relationships are intact
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
psql $env:DATABASE_URL -f validate_step6l_offspringcontract_pre.sql

# After migration, execute post-migration validation
psql $env:DATABASE_URL -f validate_step6l_offspringcontract_post.sql
```

## Expected Results - Pre-Migration

### 1. OffspringContract buyerPartyId Coverage
- Should show 100% coverage for contracts that have legacy buyer fields set
- `missing_buyer_party_id` should be **0** (zero)
- If any contracts have `buyerContactId` or `buyerOrganizationId` but no `buyerPartyId`, backfill is required

### 2. Dual Buyer Assignment Conflicts
- Should be **0** (zero)
- Contracts should not have both `buyerContactId` AND `buyerOrganizationId` set
- Any conflicts indicate data integrity issues that must be resolved

### 3. Orphaned Buyer Party References
- Should be **0** (zero)
- All `buyerPartyId` values must reference valid Party records
- Any orphans indicate broken foreign key relationships

### 4. Party Backing Entity Integrity
- Should be **0** (zero)
- Every Party referenced by `buyerPartyId` must have a backing Contact or Organization
- Any orphaned Parties indicate incomplete data migration

### 5. Legacy Column Status
- All three columns should exist: `buyerContactId`, `buyerOrganizationId`, `buyerPartyId`
- Confirms pre-migration state

### 6. OffspringContract Status Distribution
- Shows distribution of contracts with/without buyers by status
- Use to understand which contract statuses typically have buyers (e.g., SIGNED, SENT)

### 7. Sample OffspringContract Rows
- Provides sample of recent contracts with buyers
- Verify that buyer Party resolution is correct
- Check that Contact/Organization IDs match expectations

### 8. OffspringContracts by Offspring
- Shows how many contracts exist per offspring
- Some offspring may have multiple contracts (versions, different buyers, etc.)

### 9. Buyer Party Type Distribution
- Shows breakdown by CONTACT vs ORGANIZATION buyer types
- Verifies Party type distribution

### 10. E-signature Provider Distribution
- Shows breakdown by provider (e.g., DocuSign, HelloSign, etc.)
- Helps understand e-signature integration usage

## Expected Results - Post-Migration

### 1. Legacy Columns Removed
- `has_buyer_contact_id` = 0
- `has_buyer_organization_id` = 0
- `has_buyer_party_id` = 1
- Confirms migration completed successfully

### 2. Current OffspringContract Schema
- Shows remaining buyer-related columns
- Should only see `buyerPartyId`

### 3. Indexes on buyerPartyId
- Should show at least 2 indexes:
  - `OffspringContract_buyerPartyId_idx`
  - `OffspringContract_tenantId_buyerPartyId_idx`
- Ensures query performance

### 4. Foreign Key Constraint
- Should show `OffspringContract_buyerPartyId_fkey` with type 'f' (foreign key)
- Ensures referential integrity

### 5. Data Coverage Metrics
- Shows percentage of contracts with buyers
- Not all contracts have buyers (some may be drafts or templates)
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

### 9. Sample OffspringContract Rows with Derived Legacy Fields
- Shows how to derive legacy `buyerContactId`/`buyerOrganizationId` from Party
- Use for API backward compatibility verification
- Verify that derived fields match original values

### 10. OffspringContract Status Distribution
- Shows contracts by status with/without buyers
- Should match pre-migration distribution

### 11. OffspringContracts with Signatures
- Count of contracts at various stages (sent, viewed, signed)
- Verify signature workflow data integrity maintained

### 12. E-signature Provider Distribution
- Shows provider distribution with buyer percentages
- Should match pre-migration distribution

## Red Flags

**Stop and investigate if you see:**

1. **Pre-Migration: missing_buyer_party_id > 0**
   - Indicates contracts with legacy buyer fields but no `buyerPartyId`
   - Must run backfill before proceeding with migration

2. **Pre-Migration: conflicting_entries > 0**
   - Indicates contracts with both `buyerContactId` AND `buyerOrganizationId`
   - Determine precedence and resolve conflicts

3. **Pre/Post-Migration: orphaned_buyer_party_refs > 0**
   - Indicates `buyerPartyId` references that don't exist in Party table
   - Fix referential integrity before proceeding

4. **Pre/Post-Migration: parties_without_backing_entity > 0**
   - Indicates Parties without Contact or Organization backing
   - Create missing backing entities

5. **Post-Migration: Legacy columns not removed**
   - If any legacy column count > 0, migration didn't complete
   - Re-run migration or investigate

6. **Post-Migration: Missing indexes or FK constraint**
   - Ensures query performance and data integrity
   - Re-run migration if missing

7. **Post-Migration: Significant change in contract count with buyers**
   - Compare pre/post counts
   - Investigate any major discrepancies

## Migration Checklist

- [ ] Run `validate_step6l_offspringcontract_pre.sql` validation queries
- [ ] Save baseline results
- [ ] Verify all validation checks pass (all critical counts = 0)
- [ ] Apply schema changes via `npx prisma db push`
- [ ] Run `validate_step6l_offspringcontract_post.sql` validation queries
- [ ] Compare before/after results
- [ ] Verify orphan count is 0
- [ ] Verify total contract counts with buyers match
- [ ] Verify legacy columns removed (counts = 0)
- [ ] Verify indexes and FK constraint exist
- [ ] Spot-check sample contracts
- [ ] Test contract buyer operations via API (see TEST_PLAN_STEP6L_OFFSPRINGCONTRACT.md)

## Notes

- Legacy `buyerContactId` and `buyerOrganizationId` columns have been removed
- All contract-buyer relationships now use `buyerPartyId`
- API backward compatibility should be maintained via mapping layer in routes
- Responses should still include `buyerContactId` derived from Party backing for compatibility
- Not all contracts have buyers (drafts, templates, or unsigned contracts may not have buyers yet)
- Contract status transitions: DRAFT → SENT → VIEWED → SIGNED
- E-signature provider integrations should continue to work with Party-based buyer references

## Related Documentation

- Migration SQL: `prisma/migrations/20251226020000_step6l_offspringcontract_buyer_party_only/migration.sql`
- Test Plan: `TEST_PLAN_STEP6L_OFFSPRINGCONTRACT.md`
- Party Migration Overview: See main project documentation
