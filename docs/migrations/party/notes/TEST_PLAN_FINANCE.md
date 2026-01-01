# Finance Domain Party Migration - Test Plan

This document provides testing guidance for the Party migration Step 5 in the Finance domain.

## Overview

The Finance domain includes three models that now have unified Party references:
1. **Invoice** - `clientPartyId` references the invoice client/buyer
2. **OffspringContract** - `buyerPartyId` references the contract buyer
3. **ContractParty** - `partyId` references the contract signer/party

## Migration Status

- ✅ Schema updated with partyId columns and indexes
- ✅ Database schema applied via `db push`
- ✅ Migration SQL created (idempotent)
- ✅ Backfill SQL created
- ✅ Validation SQL created
- ✅ Helper service created for dual-write operations
- ⏳ Finance write endpoints NOT YET IMPLEMENTED

## Pre-Implementation Testing

Since Finance write endpoints are not yet implemented, testing focuses on:
1. Schema validation
2. Backfill script testing
3. Validation script testing
4. Future endpoint preparation

## Test Cases

### 1. Schema Validation Tests

#### Test 1.1: Verify Column Existence
```sql
-- All three partyId columns should exist
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('Invoice', 'OffspringContract', 'ContractParty')
  AND column_name IN ('clientPartyId', 'buyerPartyId', 'partyId');
```

**Expected Result**: 3 rows returned, all with `data_type = 'integer'` and `is_nullable = 'YES'`

#### Test 1.2: Verify Foreign Key Constraints
```sql
-- Check FK constraints point to Party table
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('Invoice', 'OffspringContract', 'ContractParty')
  AND kcu.column_name IN ('clientPartyId', 'buyerPartyId', 'partyId');
```

**Expected Result**: 3 constraints, all pointing to `Party` table with `delete_rule = 'SET NULL'`

#### Test 1.3: Verify Index Existence
```sql
-- Check indexes on partyId columns
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN ('Invoice', 'OffspringContract', 'ContractParty')
  AND (indexname LIKE '%PartyId%' OR indexname LIKE '%partyId%')
ORDER BY tablename, indexname;
```

**Expected Result**: At least 6 indexes (single column + composite tenantId indexes for each model)

### 2. Backfill Script Tests

#### Test 2.1: Dry Run - Invoice Backfill Count
```sql
-- Count how many Invoice rows would be backfilled from Contact
SELECT COUNT(*) as would_backfill_from_contact
FROM "Invoice" AS inv
INNER JOIN "Contact" AS c ON inv."contactId" = c.id
WHERE inv."clientPartyId" IS NULL
  AND c."partyId" IS NOT NULL
  AND inv."organizationId" IS NULL;

-- Count how many Invoice rows would be backfilled from Organization
SELECT COUNT(*) as would_backfill_from_org
FROM "Invoice" AS inv
INNER JOIN "Organization" AS o ON inv."organizationId" = o.id
WHERE inv."clientPartyId" IS NULL
  AND o."partyId" IS NOT NULL
  AND inv."contactId" IS NULL;
```

**Expected Result**: Non-negative integers showing backfill potential

#### Test 2.2: Run Backfill Script
Execute the backfill script:
```powershell
# From breederhq-api directory
$env:PGPASSWORD="your_password"
psql -h your_host -U your_user -d bhq_dev -f prisma/sql/backfill_party_step5_finance.sql
```

**Expected Result**: Script completes without errors, shows counts of backfilled rows

#### Test 2.3: Verify Backfill Results
```sql
-- Check Invoice backfill completeness
SELECT
    COUNT(*) as total,
    COUNT("clientPartyId") as with_party_id,
    ROUND(100.0 * COUNT("clientPartyId") / NULLIF(COUNT(*), 0), 2) as percent
FROM "Invoice";
```

**Expected Result**: High percentage (ideally 100% for rows with valid Contact/Organization)

### 3. Validation Script Tests

#### Test 3.1: Run Full Validation
Execute the validation script:
```powershell
$env:PGPASSWORD="your_password"
psql -h your_host -U your_user -d bhq_dev -f prisma/sql/validate_party_step5_finance.sql
```

**Expected Result**: All checks pass with 0 orphans, 0 type inconsistencies

#### Test 3.2: Orphan Detection
```sql
-- Verify no orphaned partyId references
SELECT 'Invoice' as model, COUNT(*) as orphans
FROM "Invoice" WHERE "clientPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" WHERE id = "Invoice"."clientPartyId")
UNION ALL
SELECT 'OffspringContract', COUNT(*)
FROM "OffspringContract" WHERE "buyerPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" WHERE id = "OffspringContract"."buyerPartyId")
UNION ALL
SELECT 'ContractParty', COUNT(*)
FROM "ContractParty" WHERE "partyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" WHERE id = "ContractParty"."partyId");
```

**Expected Result**: All counts = 0

### 4. Helper Service Tests (Future)

When Finance write endpoints are implemented, test the helper service:

#### Test 4.1: Invoice Creation with Contact
```typescript
// Pseudo-code for future endpoint test
const clientPartyId = await resolveInvoicePartyId(prisma, {
  contactId: 123,
  organizationId: null,
});

// clientPartyId should equal Contact[123].partyId
expect(clientPartyId).toBe(Contact[123].partyId);
```

#### Test 4.2: Invoice Creation with Organization
```typescript
const clientPartyId = await resolveInvoicePartyId(prisma, {
  contactId: null,
  organizationId: 456,
});

// clientPartyId should equal Organization[456].partyId
expect(clientPartyId).toBe(Organization[456].partyId);
```

#### Test 4.3: OffspringContract Creation
```typescript
const buyerPartyId = await resolveOffspringContractPartyId(prisma, {
  buyerContactId: 789,
  buyerOrganizationId: null,
});

expect(buyerPartyId).toBe(Contact[789].partyId);
```

#### Test 4.4: ContractParty Creation with User
```typescript
const partyId = await resolveContractPartyId(prisma, {
  contactId: null,
  organizationId: null,
  userId: "user_abc",
});

// Should use User.partyId if available
expect(partyId).toBe(User["user_abc"].partyId);
```

### 5. End-to-End Future Workflow Tests

When Finance endpoints are implemented:

#### Test 5.1: Create Invoice for Contact
```bash
# POST /api/invoices
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": 1,
    "contactId": 123,
    "scope": "offspring",
    "offspringId": 456,
    "amountCents": 50000,
    "balanceCents": 50000
  }'
```

**Expected Result**:
- Invoice created with both `contactId` and `clientPartyId` set
- `clientPartyId` equals `Contact[123].partyId`

#### Test 5.2: Create Invoice for Organization
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": 1,
    "organizationId": 789,
    "scope": "general",
    "amountCents": 100000,
    "balanceCents": 100000
  }'
```

**Expected Result**:
- Invoice created with both `organizationId` and `clientPartyId` set
- `clientPartyId` equals `Organization[789].partyId`

#### Test 5.3: Create OffspringContract
```bash
# POST /api/offspring-contracts
curl -X POST http://localhost:3000/api/offspring-contracts \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": 1,
    "offspringId": 101,
    "buyerContactId": 202,
    "title": "Puppy Purchase Agreement",
    "status": "DRAFT"
  }'
```

**Expected Result**:
- Contract created with both `buyerContactId` and `buyerPartyId` set
- `buyerPartyId` equals `Contact[202].partyId`

#### Test 5.4: Update Invoice Client
```bash
# PATCH /api/invoices/:id
curl -X PATCH http://localhost:3000/api/invoices/999 \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": 888
  }'
```

**Expected Result**:
- Invoice updated with new `organizationId` AND new `clientPartyId`
- Previous `contactId` cleared or maintained based on business logic
- `clientPartyId` equals `Organization[888].partyId`

## Acceptance Criteria

✅ **Schema Changes**:
- All partyId columns exist and are nullable
- Foreign keys point to Party table with SET NULL on delete
- Indexes exist on partyId columns (single and composite with tenantId)

✅ **Backfill Script**:
- Script is idempotent (can be run multiple times safely)
- Updates only NULL partyId values
- Reports conflict rows without modifying them
- Provides summary statistics

✅ **Validation Script**:
- Checks column existence
- Checks FK constraints
- Checks indexes
- Reports backfill completeness
- Detects orphans
- Validates type consistency
- Confirms legacy column preservation

✅ **Helper Service**:
- `resolveInvoicePartyId()` correctly resolves from Contact or Organization
- `resolveOffspringContractPartyId()` correctly resolves from Contact or Organization
- `resolveContractPartyId()` correctly resolves from Contact, Organization, or User
- Returns null when source has no partyId

✅ **Future Endpoints** (when implemented):
- POST/PATCH operations persist both legacy and partyId columns
- Dual-write is consistent
- No breaking changes to existing DTOs

## Manual Testing Checklist

- [ ] Run schema validation queries
- [ ] Execute backfill script on dev database
- [ ] Run validation script and verify all checks pass
- [ ] Verify no orphaned partyId references
- [ ] Verify type consistency (CONTACT vs ORGANIZATION)
- [ ] Verify legacy columns are preserved
- [ ] Document any conflict rows that need manual resolution
- [ ] Test helper service functions (unit tests when endpoints are built)

## Notes

- **No Finance write endpoints exist yet**, so dual-write testing is deferred until those endpoints are implemented.
- The helper service (`party-resolver-finance.ts`) is ready to use when Finance endpoints are built.
- All Finance models maintain legacy columns for backward compatibility.
- The migration is fully reversible by setting partyId to NULL.

## Files Reference

- Migration SQL: `breederhq-api/prisma/migrations/20251225_party_step5_finance_party/migration.sql`
- Backfill SQL: `breederhq-api/prisma/sql/backfill_party_step5_finance.sql`
- Validation SQL: `breederhq-api/prisma/sql/validate_party_step5_finance.sql`
- Helper Service: `breederhq-api/src/services/finance/party-resolver-finance.ts`
- Validation Guide: `VALIDATION_QUERIES_FINANCE.md`
