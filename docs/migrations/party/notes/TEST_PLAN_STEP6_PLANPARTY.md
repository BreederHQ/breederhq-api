# Step 6F: PlanParty Party-Only Test Plan

This document outlines the testing strategy for Step 6F, which removes legacy `contactId` and `organizationId` columns from PlanParty and persists role-based party identity only via `partyId`.

## Overview

**Objective**: Ensure PlanParty persists identity only via `partyId` while maintaining data integrity.

**Scope**: Schema cleanup only - no API endpoints exist for PlanParty.

**Risk Level**: Low
- No public API endpoints
- No backward compatibility concerns
- Schema-only change

## Pre-Migration Testing

### 1. Data Validation

**Execute Pre-Migration Validation SQL**

```bash
psql $DATABASE_URL -f prisma/sql/validate_step6f_planparty_pre.sql
```

**Expected Results**:
- ✅ `missing_party_id = 0` (100% coverage)
- ✅ `conflicting_entries = 0` (no dual assignments)
- ✅ `orphaned_party_refs = 0` (all parties exist)
- ✅ `parties_without_backing_entity = 0` (all parties have Contact or Organization)

**If Validation Fails**:
1. Run backfill script:
   ```bash
   psql $DATABASE_URL -f prisma/sql/backfill_step6f_planparty_party_only.sql
   ```
2. Re-run pre-migration validation
3. Resolve any remaining issues before proceeding

### 2. Backup Verification

**Manual Check**:
- Verify database backup exists and is recent
- Document current PlanParty row count for comparison

```sql
SELECT COUNT(*) AS total_plan_parties FROM "PlanParty";
```

## Migration Execution

### 1. Schema Application

**Execute db push**:
```bash
cd breederhq-api
npx dotenv -e .env.dev.migrate --override -- prisma db push --schema=prisma/schema.prisma --accept-data-loss
```

**Expected Output**:
- ✅ "Your database is now in sync with your Prisma schema"
- ✅ Prisma Client regenerated successfully

### 2. Migration SQL (For Production)

**File**: `prisma/migrations/20251225172548_step6f_planparty_party_only/migration.sql`

**Idempotency**: Safe to run multiple times

**Execute** (production environment):
```bash
psql $DATABASE_URL -f prisma/migrations/20251225172548_step6f_planparty_party_only/migration.sql
```

## Post-Migration Testing

### 1. Schema Validation

**Execute Post-Migration Validation SQL**

```bash
psql $DATABASE_URL -f prisma/sql/validate_step6f_planparty_post.sql
```

**Expected Results**:
- ✅ `has_contact_id = 0` (contactId removed)
- ✅ `has_organization_id = 0` (organizationId removed)
- ✅ `has_party_id = 1` (partyId exists)
- ✅ Indexes exist: `PlanParty_partyId_idx`, `PlanParty_tenantId_partyId_role_idx`
- ✅ FK constraint exists: `PlanParty_partyId_fkey`
- ✅ `coverage_pct` high (ideally 100%)
- ✅ `orphaned_party_refs = 0`
- ✅ `parties_without_backing_entity = 0`

### 2. Data Integrity

**Row Count Verification**:
```sql
SELECT COUNT(*) AS total_plan_parties FROM "PlanParty";
```
- Compare to pre-migration count
- ✅ Row count should be identical

**Sample Data Check**:
```sql
SELECT
  pp.id,
  pp."tenantId",
  pp."planId",
  pp.role,
  pp."partyId",
  p.type AS party_type,
  CASE
    WHEN p.type = 'CONTACT' THEN c.display_name
    WHEN p.type = 'ORGANIZATION' THEN o.name
    ELSE NULL
  END AS party_name
FROM "PlanParty" pp
LEFT JOIN "Party" p ON p.id = pp."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
LIMIT 10;
```
- ✅ All rows resolve to valid Party
- ✅ Party names display correctly

### 3. TypeScript Compilation

**Execute TypeScript Check**:
```bash
cd breederhq-api
npm run typecheck
```

**Expected Result**:
- ✅ No TypeScript errors
- ✅ Prisma Client types reflect new schema

**Common Issues**:
- If any code references `PlanParty.contactId` or `PlanParty.organizationId`, update to use `partyId`
- Since no API endpoints exist, compilation should succeed without code changes

### 4. Application Tests

**Execute Test Suite** (if tests exist):
```bash
cd breederhq-api
npm test
```

**Expected Result**:
- ✅ All tests pass
- ✅ No tests reference legacy PlanParty fields

**Note**: Since PlanParty has no API endpoints, application-level tests are minimal.

## Regression Testing

Since PlanParty has no API endpoints, regression testing focuses on data integrity.

### 1. BreedingPlan with Parties

**Test Query**:
```sql
-- Verify BreedingPlan can still resolve PlanParty roles
SELECT
  bp.id AS plan_id,
  bp.name AS plan_name,
  pp.role,
  p.type AS party_type,
  CASE
    WHEN p.type = 'CONTACT' THEN c.display_name
    WHEN p.type = 'ORGANIZATION' THEN o.name
    ELSE NULL
  END AS party_name
FROM "BreedingPlan" bp
LEFT JOIN "PlanParty" pp ON pp."planId" = bp.id
LEFT JOIN "Party" p ON p.id = pp."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE bp."tenantId" = :your_tenant_id
  AND pp.id IS NOT NULL
ORDER BY bp.id DESC, pp.role
LIMIT 20;
```

**Expected Result**:
- ✅ All PlanParty roles resolve correctly
- ✅ Party names display for all roles

### 2. Orphan Check

**Test Query**:
```sql
-- Ensure no orphaned PlanParty entries
SELECT COUNT(*) AS orphaned_plan_parties
FROM "PlanParty" pp
WHERE pp."partyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = pp."partyId");
```

**Expected Result**:
- ✅ `orphaned_plan_parties = 0`

## Rollback Plan

If critical issues are discovered post-migration:

### Option 1: Re-add Legacy Columns (Manual)

```sql
-- Add legacy columns back (if needed)
ALTER TABLE "PlanParty" ADD COLUMN "contactId" INTEGER;
ALTER TABLE "PlanParty" ADD COLUMN "organizationId" INTEGER;

-- Add FK constraints
ALTER TABLE "PlanParty"
  ADD CONSTRAINT "PlanParty_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"(id) ON DELETE SET NULL;

ALTER TABLE "PlanParty"
  ADD CONSTRAINT "PlanParty_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE SET NULL;

-- Backfill from Party
UPDATE "PlanParty" pp
SET "contactId" = c.id
FROM "Party" p
JOIN "Contact" c ON c."partyId" = p.id
WHERE pp."partyId" = p.id
  AND p.type = 'CONTACT';

UPDATE "PlanParty" pp
SET "organizationId" = o.id
FROM "Party" p
JOIN "Organization" o ON o."partyId" = p.id
WHERE pp."partyId" = p.id
  AND p.type = 'ORGANIZATION';
```

### Option 2: Database Restore

- Restore from pre-migration backup
- Document reason for rollback
- Plan remediation before retry

## Success Criteria

Step 6F is successful when:

✅ Pre-migration validation passes
✅ Schema changes applied via `db push`
✅ Post-migration validation passes
✅ Legacy columns removed: `contactId`, `organizationId`
✅ `partyId` column exists with proper FK and indexes
✅ Row count unchanged
✅ No orphaned Party references
✅ TypeScript compiles without errors
✅ All tests pass (if applicable)
✅ Sample queries demonstrate correct Party resolution

## Documentation Updates

After successful migration:

1. ✅ Update schema documentation (if any)
2. ✅ Document PlanParty as Party-only
3. ✅ Note: No API endpoints exist for PlanParty
4. ✅ Archive legacy field documentation

## Notes

- **No API Surface**: PlanParty has no public API endpoints, simplifying migration
- **Schema Cleanup Only**: This is purely schema cleanup with no application logic changes
- **Idempotent Migration**: Safe to run migration multiple times
- **Role Flexibility**: PlanParty.role is a free-form string field supporting various role types
- **Internal Use**: PlanParty is used internally to track parties involved in breeding plans (e.g., co-breeders, stud owners, vets)

## Sign-Off

- [ ] Pre-migration validation passed
- [ ] Schema changes applied successfully
- [ ] Post-migration validation passed
- [ ] TypeScript compilation successful
- [ ] Tests passed (if applicable)
- [ ] Documentation updated
- [ ] Migration complete and verified

**Completed By**: ________________
**Date**: ________________
**Environment**: ________________ (dev/staging/production)
