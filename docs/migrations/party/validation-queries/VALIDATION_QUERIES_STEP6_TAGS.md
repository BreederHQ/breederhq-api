# Step 6B: Tags Party-Only - Validation Queries

This document contains validation queries for Step 6B of the Party migration, which removes legacy `contactId` and `organizationId` columns from `TagAssignment` and makes it Party-only.

## Overview

**Domain**: Tags (TagAssignment)
**Migration**: Step 6B - Party-only storage
**Schema Changes**: Removed `contactId` and `organizationId`, kept only `taggedPartyId`
**API Changes**: None - API endpoints remain backward compatible

## Pre-Migration Validation

Run these queries **BEFORE** applying the migration to identify potential issues.

```bash
cd ../breederhq-api
psql $DATABASE_URL -f prisma/sql/validate_step6_tags_party_only_pre.sql
```

### Expected Results (Pre-Migration)

1. **NULL taggedPartyId count**: Should be **0**
   - All Contacts and Organizations should have been migrated to Party in Step 5
   - All existing tag assignments should have taggedPartyId populated

2. **Both contactId and organizationId set**: Should be **0**
   - No tag assignment should have both fields set

3. **Duplicate (tagId, taggedPartyId)**: Should be **0**
   - No duplicates that would violate the new unique constraint
   - If duplicates exist, they need to be deduplicated before migration

4. **Contacts/Organizations without partyId**: Should be **0**
   - All entities should have been migrated to Party in Step 5

5. **Orphan taggedPartyId references**: Should be **0**
   - All taggedPartyId values should reference existing Party rows

### Remediation Steps

If pre-migration validation fails:

#### Issue: NULL taggedPartyId

```sql
-- Find assignments with NULL taggedPartyId
SELECT id, "tagId", "contactId", "organizationId"
FROM "TagAssignment"
WHERE "taggedPartyId" IS NULL
  AND ("contactId" IS NOT NULL OR "organizationId" IS NOT NULL);

-- This should not happen if Step 5 completed successfully
-- Contact Aaron if this occurs
```

#### Issue: Duplicate (tagId, taggedPartyId)

```sql
-- Find duplicates
SELECT "tagId", "taggedPartyId", COUNT(*) as dup_count
FROM "TagAssignment"
WHERE "taggedPartyId" IS NOT NULL
GROUP BY "tagId", "taggedPartyId"
HAVING COUNT(*) > 1;

-- Deduplicate (keep oldest)
DELETE FROM "TagAssignment" ta
WHERE ta.id NOT IN (
  SELECT MIN(id)
  FROM "TagAssignment"
  GROUP BY "tagId", "taggedPartyId"
);
```

## Post-Migration Validation

Run these queries **AFTER** applying the migration to verify success.

```bash
cd ../breederhq-api
psql $DATABASE_URL -f prisma/sql/validate_step6_tags_party_only_post.sql
```

### Expected Results (Post-Migration)

1. **Legacy columns dropped**: Query should return **0 rows**
   - `contactId` and `organizationId` columns should not exist

2. **taggedPartyId column exists**: Should show one row
   - Column: `taggedPartyId`, Type: `integer`, Nullable: `YES`

3. **Unique constraint exists**: Should show one row
   - Constraint: `TagAssignment_tagId_taggedPartyId_key`, Type: `u` (unique)

4. **FK constraint exists**: Should show one row
   - Constraint: `TagAssignment_taggedPartyId_fkey`, Type: `f` (foreign key)

5. **Indexes exist**: Should show 2 rows
   - `TagAssignment_taggedPartyId_idx`
   - `TagAssignment_tagId_taggedPartyId_idx`

6. **Legacy indexes dropped**: Should return **0 rows**
   - `TagAssignment_contactId_idx` and `TagAssignment_organizationId_idx` should not exist

7. **Data coverage**:
   - `has_tagged_party` should equal count of Contact/Organization tags
   - Other counts (animal, waitlist, etc.) should remain unchanged

8. **No orphan references**: Should be **0**

9. **Party-based assignments by type**:
   - Should show breakdown by CONTACT and ORGANIZATION

10. **NULL taggedPartyId for Contact/Org tags**: Should be **0**

## Migration Application

The migration has already been applied via `db push`. For production deployment:

```bash
cd ../breederhq-api

# Apply idempotent migration (safe to run multiple times)
psql $DATABASE_URL -f prisma/migrations/20251225064400_step6_tags_party_only/migration.sql
```

## Rollback Plan

**CRITICAL**: This migration drops columns containing data. Rollback requires:

1. Restore from backup taken before migration
2. Or manually recreate columns and repopulate from Party data

```sql
-- Emergency rollback (only if backup restoration is not possible)
ALTER TABLE "TagAssignment" ADD COLUMN "contactId" INTEGER;
ALTER TABLE "TagAssignment" ADD COLUMN "organizationId" INTEGER;

-- Repopulate from Party
UPDATE "TagAssignment" ta
SET "contactId" = c.id
FROM "Contact" c
WHERE ta."taggedPartyId" = c."partyId"
  AND ta."taggedPartyId" IS NOT NULL;

UPDATE "TagAssignment" ta
SET "organizationId" = o.id
FROM "Organization" o
WHERE ta."taggedPartyId" = o."partyId"
  AND ta."taggedPartyId" IS NOT NULL;

-- Recreate constraints and indexes
ALTER TABLE "TagAssignment"
  ADD CONSTRAINT "TagAssignment_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"(id) ON DELETE SET NULL;

ALTER TABLE "TagAssignment"
  ADD CONSTRAINT "TagAssignment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE SET NULL;

CREATE INDEX "TagAssignment_contactId_idx" ON "TagAssignment"("contactId");
CREATE INDEX "TagAssignment_organizationId_idx" ON "TagAssignment"("organizationId");
```

## Notes

- API endpoints remain backward compatible - they still accept `contactId` and `organizationId` as inputs
- Backend automatically resolves these to `taggedPartyId` before persisting
- Reads use Party lookups exclusively
- This completes the Party migration for the Tags domain
