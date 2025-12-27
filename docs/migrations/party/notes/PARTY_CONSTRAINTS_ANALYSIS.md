# Party Constraints and Index Analysis

**Date**: 2025-12-26
**Purpose**: Identify missing constraints and indexes after Party migration completion
**Scope**: All partyId columns introduced in Steps 5-6

## Current State Analysis

### Party Column Inventory

| Table | Column | Nullable | Has FK | Has Index | Composite Index | Business Rule |
|-------|--------|----------|--------|-----------|-----------------|---------------|
| User | partyId | YES | YES | YES (single) | - | Optional: Users may not have associated Party |
| TagAssignment | taggedPartyId | YES | YES | YES (single, composite) | tagId+taggedPartyId (unique) | Optional: Tags can apply to Animals too |
| BreedingAttempt | studOwnerPartyId | YES | YES | YES (single) | - | Optional: External stud owner may not be tracked |
| PlanParty | partyId | YES | YES | YES (single, composite) | tenantId+partyId+role | **SHOULD BE MANDATORY** |
| WaitlistEntry | clientPartyId | YES | YES | YES (single, composite) | tenantId+clientPartyId | **SHOULD BE MANDATORY** |
| OffspringGroupBuyer | buyerPartyId | YES | YES | YES (single, composite) | groupId+buyerPartyId (unique), tenantId+buyerPartyId | **SHOULD BE MANDATORY** |
| Offspring | buyerPartyId | YES | YES | YES (single, composite) | tenantId+buyerPartyId | Optional: Not all offspring are sold |
| Invoice | clientPartyId | YES | YES | YES (single, composite) | tenantId+clientPartyId | **SHOULD BE MANDATORY** |
| ContractParty | partyId | YES | YES | YES (single, composite) | tenantId+partyId | Optional: User can also be party signer |
| OffspringContract | buyerPartyId | YES | YES | YES (single, composite) | tenantId+buyerPartyId | **SHOULD BE MANDATORY** |
| Animal | buyerPartyId | YES | YES | YES (single, composite) | tenantId+buyerPartyId | Optional: Not all animals are sold |
| AnimalOwner | partyId | YES | **WRONG DELETE** | YES (single) | animalId+partyId (unique) | **MUST BE MANDATORY** |
| Attachment | attachmentPartyId | YES | YES | YES (single) | - | Optional: Attachments can be for other entities |
| Party (core) | - | - | - | Multiple | tenantId+type, tenantId+name, tenantId+email | Core table |

## Issues Identified

### 1. Missing NOT NULL Constraints

Based on business logic, these columns should NEVER be null:

#### **CRITICAL (Must Fix)**
- **AnimalOwner.partyId**: Every co-owner MUST be a Party
  - Current: NULL allowed
  - Required: NOT NULL
  - Rationale: AnimalOwner exists solely to link Animals to Party owners

- **WaitlistEntry.clientPartyId**: Every waitlist entry MUST have a client
  - Current: NULL allowed
  - Required: NOT NULL
  - Rationale: Cannot have anonymous waitlist entries

- **OffspringGroupBuyer.buyerPartyId**: Every buyer link MUST reference a Party
  - Current: NULL allowed
  - Required: NOT NULL
  - Rationale: This table exists to track buyers, null buyerPartyId defeats the purpose

- **OffspringContract.buyerPartyId**: Every contract MUST have a buyer
  - Current: NULL allowed
  - Required: NOT NULL
  - Rationale: Cannot have a contract without knowing who the buyer is

- **Invoice.clientPartyId**: Every invoice MUST have a client
  - Current: NULL allowed (but scope-dependent)
  - Required: NOT NULL (with exceptions)
  - Rationale: Invoices need a billing party, but scope='general' may be exception
  - **ACTION**: Add NOT NULL with exception handling for scope='general'

- **PlanParty.partyId**: Every plan party role MUST reference a Party
  - Current: NULL allowed
  - Required: NOT NULL
  - Rationale: PlanParty exists to link parties to breeding plans

### 2. Incorrect ON DELETE Behavior

#### **AnimalOwner.partyId**
- Current: `ON DELETE SET NULL`
- Required: `ON DELETE RESTRICT` or `ON DELETE CASCADE`
- Rationale: If a Party is deleted, we need to either:
  - RESTRICT: Prevent deletion if they own animals (safest)
  - CASCADE: Remove ownership records (acceptable if Party deletion is controlled)
- **Recommendation**: Use `ON DELETE RESTRICT` to prevent accidental data loss

### 3. Missing Indexes for Common Query Patterns

Based on domain logic, these indexes are missing:

#### **Query Pattern**: Find all waitlist entries for a client
```sql
-- Current: Has index on (clientPartyId), (tenantId, clientPartyId)
-- GOOD: Properly indexed
```

#### **Query Pattern**: Find all offspring for a buyer
```sql
-- Current: Has index on (buyerPartyId), (tenantId, buyerPartyId)
-- GOOD: Properly indexed
```

#### **Query Pattern**: Find all invoices for a client by status
```sql
-- Current: Has (clientPartyId), (tenantId, clientPartyId), (status)
-- MISSING: (clientPartyId, status) for efficient filtering
-- MISSING: (tenantId, clientPartyId, status) for tenant-scoped queries
```

#### **Query Pattern**: Find all contracts for a party
```sql
-- Current: Has (partyId), (tenantId, partyId)
-- MISSING: (partyId, status) for filtering by contract status
-- MISSING: (tenantId, partyId, status) for tenant-scoped queries
```

#### **Query Pattern**: Find plan parties by role
```sql
-- Current: Has (partyId), (tenantId, partyId, role)
-- GOOD: (tenantId, partyId, role) covers role filtering
-- CONSIDER: (planId, role) for finding all parties of a role in a plan
```

### 4. Missing Composite Indexes for Association Tables

Association tables join two entities and should have indexes supporting lookups from both directions:

#### **OffspringGroupBuyer**
- Current: `groupId+buyerPartyId (unique)`, `buyerPartyId`, `tenantId+buyerPartyId`
- Missing: `buyerPartyId+groupId` (reverse lookup)
- Query: "What groups has this buyer purchased from?"
- **ACTION**: Add index on (buyerPartyId, groupId) for reverse lookups

#### **TagAssignment**
- Current: `tagId+taggedPartyId (unique)`, `taggedPartyId`, `tagId+taggedPartyId (index)`
- Status: **GOOD** - has both directions covered

#### **AnimalOwner**
- Current: `animalId+partyId (unique)`, `animalId`, `partyId`
- Status: **GOOD** - has both directions covered

## Validation Queries Needed

Before applying constraints, we must verify data integrity:

### 1. Check for NULL values in mandatory columns

```sql
-- AnimalOwner.partyId
SELECT COUNT(*) as null_count
FROM "AnimalOwner"
WHERE "partyId" IS NULL;

-- WaitlistEntry.clientPartyId
SELECT COUNT(*) as null_count
FROM "WaitlistEntry"
WHERE "clientPartyId" IS NULL;

-- OffspringGroupBuyer.buyerPartyId
SELECT COUNT(*) as null_count
FROM "OffspringGroupBuyer"
WHERE "buyerPartyId" IS NULL;

-- OffspringContract.buyerPartyId
SELECT COUNT(*) as null_count
FROM "OffspringContract"
WHERE "buyerPartyId" IS NULL;

-- Invoice.clientPartyId (excluding general scope)
SELECT COUNT(*) as null_count
FROM "Invoice"
WHERE "clientPartyId" IS NULL
  AND "scope" != 'general';

-- PlanParty.partyId
SELECT COUNT(*) as null_count
FROM "PlanParty"
WHERE "partyId" IS NULL;
```

### 2. Check for orphaned references

```sql
-- Check all partyId columns for references to non-existent Party records
SELECT 'AnimalOwner' as table_name, COUNT(*) as orphaned_count
FROM "AnimalOwner" ao
LEFT JOIN "Party" p ON ao."partyId" = p.id
WHERE ao."partyId" IS NOT NULL AND p.id IS NULL

UNION ALL

SELECT 'WaitlistEntry', COUNT(*)
FROM "WaitlistEntry" w
LEFT JOIN "Party" p ON w."clientPartyId" = p.id
WHERE w."clientPartyId" IS NOT NULL AND p.id IS NULL

-- ... repeat for all tables with partyId columns
```

## Proposed Migration Steps

### Step 7A: Data Validation and Cleanup

1. Run all validation queries above
2. Fix any NULL values or orphaned references
3. Document any exceptions that require business logic changes

### Step 7B: Add NOT NULL Constraints

Migration: `20251226_step7_add_party_not_null_constraints`

```sql
-- Verify no NULLs exist before adding constraints
DO $$
DECLARE
  null_count INT;
BEGIN
  -- Check AnimalOwner.partyId
  SELECT COUNT(*) INTO null_count FROM "AnimalOwner" WHERE "partyId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot add NOT NULL constraint: AnimalOwner.partyId has % NULL values', null_count;
  END IF;

  -- Check WaitlistEntry.clientPartyId
  SELECT COUNT(*) INTO null_count FROM "WaitlistEntry" WHERE "clientPartyId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot add NOT NULL constraint: WaitlistEntry.clientPartyId has % NULL values', null_count;
  END IF;

  -- Check OffspringGroupBuyer.buyerPartyId
  SELECT COUNT(*) INTO null_count FROM "OffspringGroupBuyer" WHERE "buyerPartyId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot add NOT NULL constraint: OffspringGroupBuyer.buyerPartyId has % NULL values', null_count;
  END IF;

  -- Check OffspringContract.buyerPartyId
  SELECT COUNT(*) INTO null_count FROM "OffspringContract" WHERE "buyerPartyId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot add NOT NULL constraint: OffspringContract.buyerPartyId has % NULL values', null_count;
  END IF;

  -- Check PlanParty.partyId
  SELECT COUNT(*) INTO null_count FROM "PlanParty" WHERE "partyId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot add NOT NULL constraint: PlanParty.partyId has % NULL values', null_count;
  END IF;
END $$;

-- Add NOT NULL constraints
ALTER TABLE "AnimalOwner" ALTER COLUMN "partyId" SET NOT NULL;
ALTER TABLE "WaitlistEntry" ALTER COLUMN "clientPartyId" SET NOT NULL;
ALTER TABLE "OffspringGroupBuyer" ALTER COLUMN "buyerPartyId" SET NOT NULL;
ALTER TABLE "OffspringContract" ALTER COLUMN "buyerPartyId" SET NOT NULL;
ALTER TABLE "PlanParty" ALTER COLUMN "partyId" SET NOT NULL;

-- Invoice is more complex - depends on scope
-- For now, keep nullable but add CHECK constraint
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientPartyId_check"
  CHECK (
    ("scope" = 'general' AND "clientPartyId" IS NULL) OR
    ("scope" != 'general' AND "clientPartyId" IS NOT NULL)
  );
```

### Step 7C: Fix ON DELETE Behavior

Migration: `20251226_step7_fix_party_delete_behavior`

```sql
-- Fix AnimalOwner.partyId foreign key
ALTER TABLE "AnimalOwner"
  DROP CONSTRAINT IF EXISTS "AnimalOwner_partyId_fkey";

ALTER TABLE "AnimalOwner"
  ADD CONSTRAINT "AnimalOwner_partyId_fkey"
    FOREIGN KEY ("partyId")
    REFERENCES "Party"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
```

### Step 7D: Add Performance Indexes

Migration: `20251226_step7_add_party_performance_indexes`

```sql
-- Invoice queries by client and status
CREATE INDEX IF NOT EXISTS "Invoice_clientPartyId_status_idx"
  ON "Invoice"("clientPartyId", "status")
  WHERE "clientPartyId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Invoice_tenantId_clientPartyId_status_idx"
  ON "Invoice"("tenantId", "clientPartyId", "status")
  WHERE "clientPartyId" IS NOT NULL;

-- Contract queries by party and status
CREATE INDEX IF NOT EXISTS "ContractParty_partyId_status_idx"
  ON "ContractParty"("partyId", "status")
  WHERE "partyId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ContractParty_tenantId_partyId_status_idx"
  ON "ContractParty"("tenantId", "partyId", "status")
  WHERE "partyId" IS NOT NULL;

-- OffspringGroupBuyer reverse lookup
CREATE INDEX IF NOT EXISTS "OffspringGroupBuyer_buyerPartyId_groupId_idx"
  ON "OffspringGroupBuyer"("buyerPartyId", "groupId");

-- PlanParty by role within plan
CREATE INDEX IF NOT EXISTS "PlanParty_planId_role_idx"
  ON "PlanParty"("planId", "role");

-- Offspring by buyer and placement state
CREATE INDEX IF NOT EXISTS "Offspring_buyerPartyId_placementState_idx"
  ON "Offspring"("buyerPartyId", "placementState")
  WHERE "buyerPartyId" IS NOT NULL;

-- OffspringContract by buyer and status
CREATE INDEX IF NOT EXISTS "OffspringContract_buyerPartyId_status_idx"
  ON "OffspringContract"("buyerPartyId", "status");
```

## Query Analysis Required

Before finalizing indexes, we should run EXPLAIN ANALYZE on these queries:

### 1. Party List Query
```sql
EXPLAIN ANALYZE
SELECT * FROM "Party"
WHERE "tenantId" = 1
  AND "archived" = false
ORDER BY "name"
LIMIT 50;
```

### 2. Contact/Organization List
```sql
EXPLAIN ANALYZE
SELECT p.*, c.*, o.*
FROM "Party" p
LEFT JOIN "Contact" c ON p.id = c."partyId"
LEFT JOIN "Organization" o ON p.id = o."partyId"
WHERE p."tenantId" = 1
  AND p."archived" = false
ORDER BY p."name"
LIMIT 50;
```

### 3. Waitlist with Client Details
```sql
EXPLAIN ANALYZE
SELECT w.*, p."name" as client_name, p."email" as client_email
FROM "WaitlistEntry" w
INNER JOIN "Party" p ON w."clientPartyId" = p.id
WHERE w."tenantId" = 1
  AND w."status" = 'DEPOSIT_DUE'
ORDER BY w."createdAt" DESC;
```

### 4. Offspring Group Buyers
```sql
EXPLAIN ANALYZE
SELECT ogb.*, p."name" as buyer_name
FROM "OffspringGroupBuyer" ogb
INNER JOIN "Party" p ON ogb."buyerPartyId" = p.id
WHERE ogb."tenantId" = 1
  AND ogb."groupId" = 100;
```

### 5. Invoices for Client
```sql
EXPLAIN ANALYZE
SELECT i.*
FROM "Invoice" i
WHERE i."clientPartyId" = 123
  AND i."status" IN ('open', 'paid')
ORDER BY i."issuedAt" DESC;
```

### 6. Party Activity Summary
```sql
EXPLAIN ANALYZE
SELECT
  p.id,
  p.name,
  COUNT(DISTINCT w.id) as waitlist_count,
  COUNT(DISTINCT o.id) as offspring_purchased,
  COUNT(DISTINCT i.id) as invoice_count,
  SUM(i."amountCents") as total_invoiced
FROM "Party" p
LEFT JOIN "WaitlistEntry" w ON p.id = w."clientPartyId"
LEFT JOIN "Offspring" o ON p.id = o."buyerPartyId"
LEFT JOIN "Invoice" i ON p.id = i."clientPartyId"
WHERE p."tenantId" = 1
GROUP BY p.id, p.name;
```

## Success Criteria

After applying migrations:

1. ✅ All mandatory partyId columns have NOT NULL constraints
2. ✅ AnimalOwner.partyId uses ON DELETE RESTRICT
3. ✅ All validation queries return 0 NULL values and 0 orphaned references
4. ✅ All query patterns execute with index scans (no seq scans on large tables)
5. ✅ Schema reflects business invariants accurately
6. ✅ All existing validation scripts still pass

## Next Steps

1. Run validation queries against development database
2. Analyze query plans with EXPLAIN ANALYZE
3. Create migration files for Step 7A-7D
4. Test migrations against development database
5. Run full validation suite
6. Document findings and update constraints
7. Prepare for production deployment

