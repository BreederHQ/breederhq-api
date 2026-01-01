# Step 6D: Offspring Buyer Validation Queries

Validation queries for Offspring Party-only storage migration.

## Pre-Migration Validation

Run **before** dropping legacy buyer columns to ensure data consistency.

```bash
psql $DATABASE_URL -f ../breederhq-api/prisma/sql/validate_step6_offspring_buyer_pre.sql
```

### Expected Results

All "should be zero" checks must return 0:
- No Offspring with NULL buyerPartyId but non-NULL legacy buyer fields
- No Offspring with both buyerContactId and buyerOrganizationId set
- No orphan buyerPartyId references

Coverage metrics should show:
- Total Offspring with legacy buyer fields matches those with buyerPartyId
- Consistency checks confirm legacy buyer ids match Party backing entities

## Post-Migration Validation

Run **after** dropping legacy buyer columns to confirm schema changes.

```bash
psql $DATABASE_URL -f ../breederhq-api/prisma/sql/validate_step6_offspring_buyer_post.sql
```

### Expected Results

Column existence checks:
- `buyerContactId` column exists: **false**
- `buyerOrganizationId` column exists: **false**
- `buyerPartyType` column exists: **false**
- `buyerPartyId` column exists: **true**

Index existence checks:
- `Offspring_buyerContactId_idx` exists: **false**
- `Offspring_buyerOrganizationId_idx` exists: **false**
- `Offspring_buyerPartyId_idx` exists: **true**
- `Offspring_tenantId_buyerPartyId_idx` exists: **true**

FK existence checks:
- `Offspring_buyerContactId_fkey` exists: **false**
- `Offspring_buyerOrganizationId_fkey` exists: **false**
- `Offspring_buyerPartyId_fkey` exists: **true**

Data validation:
- Orphan buyerPartyId count: **0**
- Party type distribution shows CONTACT and ORGANIZATION buyers

## Manual Spot Checks

### 1. Verify Offspring with Contact Buyer

```sql
SELECT
  o.id,
  o."tenantId",
  o.name,
  o."buyerPartyId",
  p.type AS party_type,
  c.id AS contact_id,
  c.display_name AS buyer_name
FROM "Offspring" o
INNER JOIN "Party" p ON o."buyerPartyId" = p.id
INNER JOIN "Contact" c ON p.id = c."partyId"
WHERE p.type = 'CONTACT'
LIMIT 5;
```

### 2. Verify Offspring with Organization Buyer

```sql
SELECT
  o.id,
  o."tenantId",
  o.name,
  o."buyerPartyId",
  p.type AS party_type,
  org.id AS org_id,
  org.name AS buyer_name
FROM "Offspring" o
INNER JOIN "Party" p ON o."buyerPartyId" = p.id
INNER JOIN "Organization" org ON p.id = org."partyId"
WHERE p.type = 'ORGANIZATION'
LIMIT 5;
```

### 3. Verify Available Offspring (No Buyer)

```sql
SELECT
  o.id,
  o."tenantId",
  o.name,
  o."placementState",
  o."keeperIntent",
  o."buyerPartyId"
FROM "Offspring" o
WHERE o."buyerPartyId" IS NULL
  AND o."placementState" = 'UNASSIGNED'
LIMIT 5;
```

## Rollback (If Needed)

If issues are found, the migration can be rolled back by:

1. Stopping the API
2. Reverting the Prisma schema changes
3. Running `npx prisma db push` to restore legacy columns
4. Restoring legacy buyer data from backups
5. Reverting code changes

**Note:** Data loss occurred during column drop. Rollback requires backup restoration.
