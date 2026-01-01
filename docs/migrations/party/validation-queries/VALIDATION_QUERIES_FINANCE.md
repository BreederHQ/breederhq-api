# Finance Domain Party Migration - Validation Queries

This document provides instructions for validating the Party migration Step 5 for the Finance domain.

## Overview

The Finance domain Party migration adds unified `partyId` references to three models:
- **Invoice**: `clientPartyId` (replaces `contactId` and `organizationId`)
- **OffspringContract**: `buyerPartyId` (replaces `buyerContactId` and `buyerOrganizationId`)
- **ContractParty**: `partyId` (replaces `contactId`, `organizationId`, and `userId`)

## Validation Steps

### 1. Schema Validation

Run the validation SQL script to check schema objects, indexes, and constraints:

```powershell
# From breederhq-api directory
$env:PGPASSWORD="your_password"
psql -h your_host -U your_user -d bhq_dev -f prisma/sql/validate_party_step5_finance.sql
```

Or in pgAdmin, open and execute: `prisma/sql/validate_party_step5_finance.sql`

### 2. What the Validation Script Checks

The validation script performs the following checks:

#### 2.1 Column Existence
Verifies that the following columns exist:
- `Invoice.clientPartyId`
- `OffspringContract.buyerPartyId`
- `ContractParty.partyId`

#### 2.2 Foreign Key Constraints
Confirms that foreign key constraints exist and point to `Party.id` with correct `ON DELETE SET NULL` behavior.

#### 2.3 Index Existence
Checks for indexes on:
- Single column indexes: `clientPartyId`, `buyerPartyId`, `partyId`
- Composite indexes: `(tenantId, clientPartyId)`, `(tenantId, buyerPartyId)`, `(tenantId, partyId)`

#### 2.4 Backfill Completeness
Reports metrics on how many rows have been backfilled:
- Total rows vs rows with partyId set
- Percentage complete
- Rows with legacy IDs but no partyId (not yet backfilled)
- Conflict rows (multiple legacy IDs set)

#### 2.5 Orphan Detection
Identifies rows where partyId is set but the referenced Party record doesn't exist.

#### 2.6 Type Consistency
Validates that when a partyId is derived from a Contact, the Party.type is CONTACT, and when derived from an Organization, the Party.type is ORGANIZATION.

#### 2.7 Legacy Column Integrity
Ensures that legacy columns (contactId, organizationId, userId) are preserved alongside the new partyId columns.

### 3. Expected Results

After running the backfill script, you should see:

- **100% backfill completeness** for rows that have a valid Contact or Organization with a partyId
- **0 orphans** (all partyId references should point to existing Party records)
- **0 type inconsistencies** (Party.type should match the source: CONTACT or ORGANIZATION)
- **Legacy columns preserved** for all rows where partyId is set

### 4. Handling Conflicts

Rows with conflicts (e.g., both contactId and organizationId set) will NOT be backfilled automatically. These require manual resolution:

1. Identify conflict rows using the validation script
2. Determine the correct party source (contact or organization)
3. Manually set the partyId and clear the incorrect legacy ID, OR
4. Leave both legacy IDs intact and manually set partyId to the correct value

### 5. Query Examples

#### Count total rows needing backfill
```sql
SELECT
  COUNT(*) as needs_backfill
FROM "Invoice"
WHERE "clientPartyId" IS NULL
  AND ("contactId" IS NOT NULL OR "organizationId" IS NOT NULL);
```

#### Find Invoice rows with conflicts
```sql
SELECT id, "contactId", "organizationId", "clientPartyId"
FROM "Invoice"
WHERE "contactId" IS NOT NULL
  AND "organizationId" IS NOT NULL;
```

#### Verify a specific Invoice backfill
```sql
SELECT
  i.id,
  i."contactId",
  i."organizationId",
  i."clientPartyId",
  p.type as party_type,
  p.name as party_name
FROM "Invoice" i
LEFT JOIN "Party" p ON i."clientPartyId" = p.id
WHERE i.id = 123;  -- Replace with actual ID
```

## Troubleshooting

### Problem: Backfill completeness is less than 100%

**Causes:**
- Contact or Organization records don't have a partyId yet (they need to be migrated first)
- Conflict rows (multiple legacy IDs set)
- Orphaned legacy IDs (contactId/organizationId points to deleted records)

**Solution:**
1. Run Contact and Organization Party migrations first
2. Resolve conflicts manually
3. Clean up orphaned legacy references

### Problem: Type inconsistencies detected

**Causes:**
- Manual data manipulation
- Backfill script error

**Solution:**
- Review the inconsistent rows
- Correct the partyId to point to the right Party record
- Re-run the backfill script

### Problem: Orphan partyId references

**Causes:**
- Party records were deleted after backfill
- Manual incorrect partyId assignment

**Solution:**
- Either restore the deleted Party records, or
- Set partyId to NULL for orphaned rows

## Files

- **Migration SQL**: `breederhq-api/prisma/migrations/20251225_party_step5_finance_party/migration.sql`
- **Backfill SQL**: `breederhq-api/prisma/sql/backfill_party_step5_finance.sql`
- **Validation SQL**: `breederhq-api/prisma/sql/validate_party_step5_finance.sql`
- **Helper Service**: `breederhq-api/src/services/finance/party-resolver-finance.ts`

## Next Steps

After validation passes:
1. Run the backfill script in production (during maintenance window)
2. Monitor application logs for any partyId-related errors
3. Implement Finance write endpoints using the dual-write helper service
4. Eventually deprecate and remove legacy contactId/organizationId columns (future phase)
