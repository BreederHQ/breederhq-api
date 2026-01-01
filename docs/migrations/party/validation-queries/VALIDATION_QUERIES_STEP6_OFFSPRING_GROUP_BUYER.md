# Step 6C: OffspringGroupBuyer Party-Only Migration Validation

This document provides validation procedures for Step 6C: removing legacy buyer columns (`contactId`, `organizationId`) from OffspringGroupBuyer while maintaining API backward compatibility through Party mapping.

## Overview

**What Changed:**
- **Removed columns**: `contactId`, `organizationId` from `OffspringGroupBuyer`
- **Retained column**: `buyerPartyId` (sole source of buyer identity)
- **API compatibility**: Endpoints still accept `contactId`/`organizationId` in requests and derive them in responses from Party

**Backend mapping**:
- **Writes**: Accept legacy `contactId` or `organizationId`, resolve to `buyerPartyId`, persist only `buyerPartyId`
- **Reads**: Fetch `buyerParty`, derive legacy fields from `Party.type` and backing Contact/Organization

## SQL Files Location

All validation SQL files are in `breederhq-api/prisma/sql/`:

1. **Pre-migration**: `validate_step6_offspring_group_buyer_pre.sql`
2. **Post-migration**: `validate_step6_offspring_group_buyer_post.sql`

## Pre-Migration Validation

Run **before** applying the migration to production to ensure data is ready.

**Using PowerShell:**
```powershell
cd breederhq-api
$env:PGPASSWORD = "your-password"
psql -h your-host -U your-username -d your-database -f prisma/sql/validate_step6_offspring_group_buyer_pre.sql
```

**What it checks:**
1. Total OffspringGroupBuyer count
2. Rows with `buyerPartyId` NULL (should be 0 after Step 5 backfill)
3. Rows with both `contactId` AND `organizationId` (conflicts)
4. Duplicate `(groupId, buyerPartyId)` combinations (would violate new unique constraint)
5. Legacy `contactId` coverage vs `buyerPartyId` migration
6. Legacy `organizationId` coverage vs `buyerPartyId` migration
7. Sample rows showing what will be dropped

**Expected results:**
- `buyerPartyId` NULL count: **0** (all backfilled in Step 5)
- Duplicate `(groupId, buyerPartyId)`: **0**
- Conflicts acceptable if documented

## Migration Application

After pre-validation passes, apply the schema change.

**Development:**
```powershell
cd breederhq-api
npx dotenv -e .env.dev.migrate --override -- prisma db push --schema=prisma/schema.prisma --accept-data-loss
```

**Production:**
Run the idempotent migration script:
```powershell
cd breederhq-api
$env:PGPASSWORD = "your-password"
psql -h your-host -U your-username -d your-database -f prisma/migrations/20251225_step6_offspring_group_buyer_party_only/migration.sql
```

**Migration script features:**
- Idempotent: safe to re-run
- Drops legacy `contactId` and `organizationId` columns
- Drops legacy indexes and constraints
- Adds unique constraint on `(groupId, buyerPartyId)` (guards against duplicates)
- Ensures `buyerPartyId` index and FK exist

## Post-Migration Validation

Run **after** migration to confirm schema correctness and data integrity.

**Using PowerShell:**
```powershell
cd breederhq-api
$env:PGPASSWORD = "your-password"
psql -h your-host -U your-username -d your-database -f prisma/sql/validate_step6_offspring_group_buyer_post.sql
```

**What it validates:**
1. **Schema**: `contactId` and `organizationId` columns are ABSENT
2. **buyerPartyId** column exists with correct type and nullability
3. **Indexes**: `buyerPartyId` indexes exist
4. **FK constraints**: `buyerPartyId` FK to Party exists
5. **Unique constraints**: `(groupId, buyerPartyId)` unique constraint exists
6. **Data coverage**: Count of buyers with `buyerPartyId` populated
7. **Orphans**: No `buyerPartyId` pointing to non-existent Party (should be 0)
8. **Type consistency**: Party types (CONTACT/ORGANIZATION) distribution
9. **Samples**: Buyers with Party backing Contact
10. **Samples**: Buyers with Party backing Organization
11. **Uniqueness**: No duplicate `(groupId, buyerPartyId)` (should be 0)

**Expected results:**
- Legacy columns: **ABSENT**
- `buyerPartyId` column: **EXISTS**
- `buyerPartyId` indexes: **EXISTS**
- `buyerPartyId` FK: **EXISTS**
- Unique constraint `(groupId, buyerPartyId)`: **EXISTS**
- Orphan buyers: **0**
- Duplicate `(groupId, buyerPartyId)`: **0**

## API Backward Compatibility Verification

After migration, verify API endpoints still work with legacy fields.

**Test creating a buyer with legacy contactId:**
```powershell
$tenantId = 1
$groupId = 123
$contactId = 456

curl -X POST "http://localhost:6001/offspring/groups/$groupId/buyers" `
  -H "Content-Type: application/json" `
  -H "x-tenant-id: $tenantId" `
  -d "{\"contactId\": $contactId}"
```

**Expected response:**
```json
{
  "ok": true,
  "duplicate": false,
  "group": {
    ...
    "groupBuyerLinks": [
      {
        "id": 789,
        "contactId": 456,
        "organizationId": null,
        "contact": {
          "id": 456,
          "displayName": "John Doe",
          ...
        },
        ...
      }
    ]
  }
}
```

**Verify legacy fields are derived:**
- `contactId` should be populated from `Party.contact.id` when `Party.type = 'CONTACT'`
- `organizationId` should be populated from `Party.organization.id` when `Party.type = 'ORGANIZATION'`
- Database should only store `buyerPartyId`, not `contactId`/`organizationId`

## Troubleshooting

### Issue: Pre-validation shows buyerPartyId NULL

**Cause**: Step 5 backfill not completed

**Resolution**:
1. Run Step 5 backfill: `breederhq-api/prisma/sql/backfill_party_step5_offspring_waitlist.sql`
2. Re-run pre-validation
3. Proceed only when NULL count is 0

### Issue: Duplicate (groupId, buyerPartyId) found

**Cause**: Data corruption or incorrect backfill

**Resolution**:
1. Investigate duplicates:
   ```sql
   SELECT "groupId", "buyerPartyId", COUNT(*)
   FROM "OffspringGroupBuyer"
   WHERE "buyerPartyId" IS NOT NULL
   GROUP BY "groupId", "buyerPartyId"
   HAVING COUNT(*) > 1;
   ```
2. Manually resolve duplicates (delete or update)
3. Re-run pre-validation

### Issue: Post-validation shows orphan buyerPartyId

**Cause**: Party records deleted after migration

**Resolution**:
1. Investigate orphan records
2. Either restore Party or set `buyerPartyId` to NULL
3. Consider waitlist-only buyers (may have NULL `buyerPartyId`)

### Issue: API returns null for contactId/organizationId

**Cause**: Party mapping not working

**Resolution**:
1. Check Party has backing Contact/Organization:
   ```sql
   SELECT p.*, c.id as contact_id, o.id as org_id
   FROM "Party" p
   LEFT JOIN "Contact" c ON c."partyId" = p.id
   LEFT JOIN "Organization" o ON o."partyId" = p.id
   WHERE p.id = ?;
   ```
2. Verify Party type matches backing entity
3. Check backend mapping code in `offspring.ts`

## Next Steps

After validation passes:

1. **Monitor**: Watch API logs for errors related to buyer endpoints
2. **Test**: Run integration tests (see `TEST_PLAN_STEP6_OFFSPRING_GROUP_BUYER.md`)
3. **Document**: Update any internal docs referencing `contactId`/`organizationId`
4. **Deploy**: Roll out to production with migration script

## Notes

- **Idempotent**: Migration is safe to re-run
- **Backward compatible**: API accepts and returns legacy fields via mapping
- **Data loss**: `contactId` and `organizationId` columns dropped (data preserved in Party)
- **Performance**: Party-based queries may require JOIN to Contact/Organization for derived fields
