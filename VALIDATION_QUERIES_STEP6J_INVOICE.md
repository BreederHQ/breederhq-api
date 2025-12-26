# Validation Queries: Step 6J - Invoice Client Party-Only

## Overview

This document contains validation queries for Step 6J of the Party migration, which removes the legacy `contactId` and `organizationId` columns from the `Invoice` table and consolidates on `clientPartyId` as the single source of truth for client references.

## Validation SQL File Locations

The validation queries are located in:
```
breederhq-api/prisma/sql/validate_step6j_invoice_pre.sql   (run BEFORE migration)
breederhq-api/prisma/sql/validate_step6j_invoice_post.sql  (run AFTER migration)
```

## When to Run

**Before Migration:**
- Run `validate_step6j_invoice_pre.sql` before applying the migration to understand the current state
- Capture baseline counts and verify data quality
- Ensure all invoices with clients have `clientPartyId` populated

**After Migration:**
- Run `validate_step6j_invoice_post.sql` after migration to verify:
  - No data loss occurred
  - All invoice-client relationships are intact
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
psql $env:DATABASE_URL -f validate_step6j_invoice_pre.sql

# After migration, execute post-migration validation
psql $env:DATABASE_URL -f validate_step6j_invoice_post.sql
```

## Expected Results - Pre-Migration

### 1. Invoice clientPartyId Coverage
- Should show 100% coverage for invoices that have legacy client fields set
- `missing_client_party_id` should be **0** (zero)
- If any invoices have `contactId` or `organizationId` but no `clientPartyId`, backfill is required

### 2. Dual Client Assignment Conflicts
- Should be **0** (zero)
- Invoices should not have both `contactId` AND `organizationId` set
- Any conflicts indicate data integrity issues that must be resolved

### 3. Orphaned Client Party References
- Should be **0** (zero)
- All `clientPartyId` values must reference valid Party records
- Any orphans indicate broken foreign key relationships

### 4. Party Backing Entity Integrity
- Should be **0** (zero)
- Every Party referenced by `clientPartyId` must have a backing Contact or Organization
- Any orphaned Parties indicate incomplete data migration

### 5. Legacy Column Status
- All three columns should exist: `contactId`, `organizationId`, `clientPartyId`
- Confirms pre-migration state

### 6. Invoice Client Status Distribution
- Shows distribution of invoices with/without clients by status
- Use to understand which invoice statuses typically have clients

### 7. Sample Invoice Rows
- Provides sample of recent invoices with clients
- Verify that client Party resolution is correct
- Check that Contact/Organization IDs match expectations

### 8. Invoices by Scope
- Shows distribution by scope (offspring, group, etc.)
- Verifies scope-specific patterns

### 9. Client Party Type Distribution
- Shows breakdown by CONTACT vs ORGANIZATION client types
- Verifies Party type distribution

### 10. Invoice Amount Statistics by Client Type
- Shows financial metrics by client type
- Helps identify business patterns

## Expected Results - Post-Migration

### 1. Legacy Columns Removed
- `has_contact_id` = 0
- `has_organization_id` = 0
- `has_client_party_id` = 1
- Confirms migration completed successfully

### 2. Current Invoice Schema
- Shows remaining client-related columns
- Should only see `clientPartyId` and finance-related fields

### 3. Indexes on clientPartyId
- Should show at least 2 indexes:
  - `Invoice_clientPartyId_idx`
  - `Invoice_tenantId_clientPartyId_idx`
- Ensures query performance

### 4. Foreign Key Constraint
- Should show `Invoice_clientPartyId_fkey` with type 'f' (foreign key)
- Ensures referential integrity

### 5. Data Coverage Metrics
- Shows percentage of invoices with clients
- Compare with pre-migration to ensure no data loss

### 6. Orphaned Client Party References
- Should be **0** (zero)
- All `clientPartyId` values must reference valid Party records

### 7. Client Party Type Distribution
- Should show breakdown by CONTACT and ORGANIZATION types
- Compare with pre-migration to ensure distribution is preserved

### 8. Party Backing Entity Integrity
- Should be **0** (zero)
- All Parties must have backing Contact or Organization

### 9. Sample Invoice Rows with Derived Legacy Fields
- Shows how to derive legacy `contactId`/`organizationId` from Party
- Use for API backward compatibility verification
- Verify that derived fields match original values

### 10. Invoice Status Distribution
- Shows invoices by status with/without clients
- Should match pre-migration distribution

### 11. Invoice Scope Distribution
- Shows invoices by scope with/without clients
- Verify scope data integrity maintained

### 12. Invoice Amount Statistics by Client Type
- Shows financial metrics by client type
- Compare with pre-migration to ensure consistency

### 13. Invoices with Payments
- Count of invoices with payment records
- Verify payment relationships intact

## Red Flags

**Stop and investigate if you see:**

1. **Pre-Migration: missing_client_party_id > 0**
   - Indicates invoices with legacy client fields but no `clientPartyId`
   - Must run backfill before proceeding with migration

2. **Pre-Migration: conflicting_entries > 0**
   - Indicates invoices with both `contactId` AND `organizationId`
   - Determine precedence and resolve conflicts

3. **Pre/Post-Migration: orphaned_client_party_refs > 0**
   - Indicates `clientPartyId` references that don't exist in Party table
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

7. **Post-Migration: Significant change in invoice count with clients**
   - Compare pre/post counts
   - Investigate any major discrepancies

## Migration Checklist

- [ ] Run `validate_step6j_invoice_pre.sql` validation queries
- [ ] Save baseline results
- [ ] Verify all validation checks pass (all critical counts = 0)
- [ ] Apply schema changes via `npm run db:dev` or `npx prisma db push`
- [ ] Run `validate_step6j_invoice_post.sql` validation queries
- [ ] Compare before/after results
- [ ] Verify orphan count is 0
- [ ] Verify total invoice counts with clients match
- [ ] Verify legacy columns removed (counts = 0)
- [ ] Verify indexes and FK constraint exist
- [ ] Spot-check sample invoices
- [ ] Test invoice client operations via API (see TEST_PLAN_STEP6J_INVOICE.md)

## Notes

- Legacy `contactId` and `organizationId` columns have been removed
- All invoice-client relationships now use `clientPartyId`
- API backward compatibility should be maintained via mapping layer in routes
- Responses should still include `contactId`/`organizationId` derived from Party backing for compatibility
- Invoices can exist without clients in some cases
- Finance-related fields (`amountCents`, `balanceCents`, etc.) are independent of client reference

## Related Documentation

- Migration SQL: `prisma/migrations/TIMESTAMP_step6j_invoice_client_party_only/migration.sql`
- Test Plan: `TEST_PLAN_STEP6J_INVOICE.md`
- Party Migration Overview: See main project documentation
