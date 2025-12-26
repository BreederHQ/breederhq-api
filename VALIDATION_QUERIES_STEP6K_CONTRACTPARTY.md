# Validation Queries: Step 6K - ContractParty Party-Only

## Overview

This document contains validation queries for Step 6K of the Party migration, which removes the legacy `contactId` and `organizationId` columns from the `ContractParty` table and consolidates on `partyId` as the single source of truth for party references.

**Note:** The `userId` column is NOT part of the Party migration and is preserved as it represents a separate system for user-based contract parties (e.g., internal users signing contracts).

## Validation SQL File Locations

The validation queries are located in:
```
breederhq-api/prisma/sql/validate_step6k_contractparty_pre.sql   (run BEFORE migration)
breederhq-api/prisma/sql/validate_step6k_contractparty_post.sql  (run AFTER migration)
```

## When to Run

**Before Migration:**
- Run `validate_step6k_contractparty_pre.sql` before applying the migration to understand the current state
- Capture baseline counts and verify data quality
- Ensure all contract parties with contacts/organizations have `partyId` populated

**After Migration:**
- Run `validate_step6k_contractparty_post.sql` after migration to verify:
  - No data loss occurred
  - All contract party relationships are intact
  - Legacy columns have been removed (except userId which is preserved)
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
psql $env:DATABASE_URL -f validate_step6k_contractparty_pre.sql

# After migration, execute post-migration validation
psql $env:DATABASE_URL -f validate_step6k_contractparty_post.sql
```

## Expected Results - Pre-Migration

### 1. ContractParty partyId Coverage
- Should show 100% coverage for contract parties that have legacy party fields set
- `missing_party_id` should be **0** (zero)
- If any contract parties have `contactId` or `organizationId` but no `partyId`, backfill is required

### 2. Dual Party Assignment Conflicts
- Should be **0** (zero)
- Contract parties should not have both `contactId` AND `organizationId` set
- Any conflicts indicate data integrity issues that must be resolved

### 3. Orphaned Party References
- Should be **0** (zero)
- All `partyId` values must reference valid Party records
- Any orphans indicate broken foreign key relationships

### 4. Party Backing Entity Integrity
- Should be **0** (zero)
- Every Party referenced by `partyId` must have a backing Contact or Organization
- Any orphaned Parties indicate incomplete data migration

### 5. Legacy Column Status
- All four columns should exist: `contactId`, `organizationId`, `partyId`, `userId`
- Confirms pre-migration state
- `userId` will be preserved after migration

### 6. ContractParty Status Distribution
- Shows distribution of contract parties with/without parties by signature status
- Use to understand which statuses typically have parties assigned

### 7. ContractParty Role Distribution
- Shows distribution by role (e.g., "buyer", "seller", "witness")
- Helps understand which roles use Party vs User references
- Shows counts of `partyId` and `userId` by role

### 8. Sample ContractParty Rows
- Provides sample of recent contract parties with parties
- Verify that party resolution is correct
- Check that Contact/Organization IDs match expectations

### 9. ContractParties with userId
- Shows distribution of contract parties using `userId` (separate from Party system)
- Helps understand overlap between Party and User references
- Some contract parties may have both `partyId` and `userId`

### 10. Party Type Distribution
- Shows breakdown by CONTACT vs ORGANIZATION party types
- Verifies Party type distribution

### 11. ContractParties by Contract Status
- Shows contract party counts grouped by contract status
- Helps understand party assignment patterns across contract lifecycle

## Expected Results - Post-Migration

### 1. Legacy Columns Removed
- `has_contact_id` = 0 (removed)
- `has_organization_id` = 0 (removed)
- `has_party_id` = 1 (preserved)
- `has_user_id` = 1 (PRESERVED - not part of Party migration)

### 2. Current ContractParty Schema
- Shows remaining columns related to parties and users
- Verifies `partyId` and `userId` columns exist
- Verifies `contactId` and `organizationId` columns are gone

### 3. Indexes on partyId
- At least 2 indexes should exist:
  - `ContractParty_partyId_idx`
  - `ContractParty_tenantId_partyId_idx`
- Ensures efficient querying by party

### 4. Foreign Key Constraint on partyId
- `ContractParty_partyId_fkey` should exist
- Constraint type should be `f` (foreign key)
- References `Party` table

### 5. Data Coverage Metrics
- Shows total contract parties vs those with `partyId` and/or `userId`
- Not all contract parties require a party (some may only have userId)
- Shows various combinations of party/user assignments

### 6. Orphaned Party References
- Should be **0** (zero)
- All `partyId` values must reference valid Party records
- Any orphans indicate data integrity issues

### 7. Party Type Distribution
- Shows CONTACT vs ORGANIZATION vs NULL distribution
- NULL is acceptable if contract party uses userId only

### 8. Party Backing Entity Integrity
- Should be **0** (zero)
- All Parties must have backing Contact or Organization

### 9. Sample ContractParty Rows with Derived Legacy Fields
- Shows how to derive `contactId` and `organizationId` from Party relationship
- Demonstrates backward compatibility approach
- Verifies party names can be resolved correctly

### 10-13. Distribution Metrics
- **Status Distribution:** Contract parties by signature status
- **Role Distribution:** Contract parties by role
- **Contract Status:** Contract parties grouped by contract status
- **Signer Distribution:** Signers vs non-signers with party/user counts

## Data Integrity Checklist

Before proceeding with the migration, ensure:

- [ ] `missing_party_id` = 0 (all contract parties with legacy fields have partyId)
- [ ] `conflicting_entries` = 0 (no dual contactId + organizationId assignments)
- [ ] `orphaned_party_refs` = 0 (all partyIds reference valid Parties)
- [ ] `parties_without_backing_entity` = 0 (all Parties have Contact or Organization)
- [ ] All legacy columns exist in pre-migration state
- [ ] Understand distribution of userId usage (separate from Party system)

After migration, verify:

- [ ] `has_contact_id` = 0 (removed)
- [ ] `has_organization_id` = 0 (removed)
- [ ] `has_party_id` = 1 (preserved)
- [ ] `has_user_id` = 1 (PRESERVED)
- [ ] Required indexes exist
- [ ] Foreign key constraint exists
- [ ] No orphaned references
- [ ] No data loss (compare pre/post counts)

## Notes

- **userId is NOT part of Party migration:** The `userId` column represents a separate system for user-based contract parties (e.g., internal users signing contracts). It is preserved and independent of the Party system.
- Contract parties may have `partyId`, `userId`, both, or neither depending on the type of party
- The migration only affects Contact/Organization references, not User references
- API backward compatibility is handled by deriving `contactId`/`organizationId` from Party relationships
- Some contract parties may intentionally have no party if they only store email/name
