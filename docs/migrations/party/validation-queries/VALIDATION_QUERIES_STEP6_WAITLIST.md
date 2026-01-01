# Step 6E: WaitlistEntry Party-Only Validation Queries

This document contains SQL validation queries for Step 6E, which removes legacy `contactId`, `organizationId`, and `partyType` columns from WaitlistEntry and persists client identity only via `clientPartyId`.

## Pre-Migration Validation

Run these queries **BEFORE** dropping legacy columns to ensure safe migration.

**File**: `prisma/sql/validate_step6_waitlist_pre.sql`

### Execution

```bash
psql $DATABASE_URL -f prisma/sql/validate_step6_waitlist_pre.sql
```

### Expected Results

1. **clientPartyId Coverage**: `missing_client_party_id = 0`
   - All waitlist entries must have `clientPartyId` populated before dropping legacy columns
   - If > 0: Run backfill to populate `clientPartyId` from legacy fields

2. **Dual Assignment Conflicts**: `conflicting_entries = 0`
   - No entries should have both `contactId` and `organizationId` set
   - If > 0: Review and resolve precedence (current behavior: organizationId wins)

3. **Orphaned Party References**: `orphaned_party_refs = 0`
   - All `clientPartyId` values must reference existing Party rows
   - If > 0: Fix data integrity before proceeding

4. **Party Backing Entities**: `parties_without_backing_entity = 0`
   - Every Party must have either Contact or Organization
   - If > 0: Review and fix Party data integrity

## Post-Migration Validation

Run these queries **AFTER** dropping legacy columns to confirm successful migration.

**File**: `prisma/sql/validate_step6_waitlist_post.sql`

### Execution

```bash
psql $DATABASE_URL -f prisma/sql/validate_step6_waitlist_post.sql
```

### Expected Results

1. **Legacy Columns Removed**:
   - `has_contact_id = 0`
   - `has_organization_id = 0`
   - `has_party_type = 0`

2. **clientPartyId Column Exists**: `has_client_party_id = 1`

3. **Indexes Exist**: At least 2 indexes on `clientPartyId`
   - `WaitlistEntry_clientPartyId_idx`
   - `WaitlistEntry_tenantId_clientPartyId_idx`

4. **FK Constraint Exists**: `WaitlistEntry_clientPartyId_fkey` with type `f`

5. **Data Coverage**: `coverage_pct` should be high (ideally 100%)

6. **No Orphaned References**: `orphaned_party_refs = 0`

7. **Party Type Distribution**: Informational breakdown of CONTACT vs ORGANIZATION

8. **Backing Entity Integrity**: `parties_without_backing_entity = 0`

## Manual Validation Queries

### Check WaitlistEntry with Party Details

```sql
SELECT
  w.id,
  w."tenantId",
  w."clientPartyId",
  p.type AS party_type,
  CASE
    WHEN p.type = 'CONTACT' THEN c.id
    ELSE NULL
  END AS derived_contact_id,
  CASE
    WHEN p.type = 'ORGANIZATION' THEN o.id
    ELSE NULL
  END AS derived_organization_id,
  CASE
    WHEN p.type = 'CONTACT' THEN c.display_name
    WHEN p.type = 'ORGANIZATION' THEN o.name
    ELSE NULL
  END AS client_name
FROM "WaitlistEntry" w
LEFT JOIN "Party" p ON p.id = w."clientPartyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE w."tenantId" = :your_tenant_id
LIMIT 20;
```

### Verify Backward Compatibility

Check that legacy fields can be derived from Party:

```sql
SELECT
  w.id,
  w."clientPartyId",
  p.type,
  -- Derived legacy contactId
  CASE WHEN p.type = 'CONTACT' THEN c.id ELSE NULL END AS contactId,
  -- Derived legacy organizationId
  CASE WHEN p.type = 'ORGANIZATION' THEN o.id ELSE NULL END AS organizationId
FROM "WaitlistEntry" w
JOIN "Party" p ON p.id = w."clientPartyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE w."tenantId" = :your_tenant_id
LIMIT 10;
```

## Troubleshooting

### Issue: Missing clientPartyId

**Symptom**: Pre-validation shows `missing_client_party_id > 0`

**Resolution**:
1. Identify affected rows:
   ```sql
   SELECT id, "tenantId", "contactId", "organizationId"
   FROM "WaitlistEntry"
   WHERE "clientPartyId" IS NULL;
   ```

2. For each row, resolve `clientPartyId` from `contactId` or `organizationId`:
   ```sql
   -- For contact-based entries
   UPDATE "WaitlistEntry" w
   SET "clientPartyId" = c."partyId"
   FROM "Contact" c
   WHERE w."contactId" = c.id
   AND w."clientPartyId" IS NULL
   AND w."contactId" IS NOT NULL;

   -- For organization-based entries
   UPDATE "WaitlistEntry" w
   SET "clientPartyId" = o."partyId"
   FROM "Organization" o
   WHERE w."organizationId" = o.id
   AND w."clientPartyId" IS NULL
   AND w."organizationId" IS NOT NULL;
   ```

### Issue: Orphaned Party References

**Symptom**: `orphaned_party_refs > 0` (clientPartyId points to non-existent Party)

**Resolution**:
1. Identify orphans:
   ```sql
   SELECT id, "clientPartyId"
   FROM "WaitlistEntry" w
   WHERE w."clientPartyId" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = w."clientPartyId");
   ```

2. Either:
   - Create missing Party rows
   - Set `clientPartyId` to NULL for affected entries
   - Delete invalid entries

### Issue: Party Without Backing Entity

**Symptom**: `parties_without_backing_entity > 0`

**Resolution**:
1. Identify affected Parties:
   ```sql
   SELECT p.id, p.type, p.name
   FROM "Party" p
   WHERE p.id IN (SELECT "clientPartyId" FROM "WaitlistEntry" WHERE "clientPartyId" IS NOT NULL)
   AND NOT EXISTS (SELECT 1 FROM "Contact" c WHERE c."partyId" = p.id)
   AND NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o."partyId" = p.id);
   ```

2. Create backing Contact or Organization for orphaned Parties

## Success Criteria

Migration is successful when:

✅ All pre-migration validation checks pass
✅ Schema changes applied via `db push`
✅ All post-migration validation checks pass
✅ Legacy columns (`contactId`, `organizationId`, `partyType`) removed
✅ `clientPartyId` column exists with proper FK and indexes
✅ 100% coverage: all waitlist entries have `clientPartyId`
✅ No orphaned Party references
✅ API endpoints return legacy fields correctly via Party mapping
✅ TypeScript compilation passes
✅ Tests pass
