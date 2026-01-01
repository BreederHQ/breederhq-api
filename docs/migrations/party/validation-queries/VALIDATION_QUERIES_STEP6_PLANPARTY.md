# Step 6F: PlanParty Party-Only Validation Queries

This document contains SQL validation queries for Step 6F, which removes legacy `contactId` and `organizationId` columns from PlanParty and persists role-based party identity only via `partyId`.

## Pre-Migration Validation

Run these queries **BEFORE** dropping legacy columns to ensure safe migration.

**File**: `prisma/sql/validate_step6f_planparty_pre.sql`

### Execution

```bash
psql $DATABASE_URL -f prisma/sql/validate_step6f_planparty_pre.sql
```

### Expected Results

1. **partyId Coverage**: `missing_party_id = 0`
   - All PlanParty entries must have `partyId` populated before dropping legacy columns
   - If > 0: Run backfill to populate `partyId` from legacy fields

2. **Dual Assignment Conflicts**: `conflicting_entries = 0`
   - No entries should have both `contactId` and `organizationId` set
   - If > 0: Review and resolve precedence (current behavior: organizationId wins)

3. **Orphaned Party References**: `orphaned_party_refs = 0`
   - All `partyId` values must reference existing Party rows
   - If > 0: Fix data integrity before proceeding

4. **Party Backing Entities**: `parties_without_backing_entity = 0`
   - Every Party must have either Contact or Organization
   - If > 0: Review and fix Party data integrity

## Post-Migration Validation

Run these queries **AFTER** dropping legacy columns to confirm successful migration.

**File**: `prisma/sql/validate_step6f_planparty_post.sql`

### Execution

```bash
psql $DATABASE_URL -f prisma/sql/validate_step6f_planparty_post.sql
```

### Expected Results

1. **Legacy Columns Removed**:
   - `has_contact_id = 0`
   - `has_organization_id = 0`

2. **partyId Column Exists**: `has_party_id = 1`

3. **Indexes Exist**: At least 2 indexes on `partyId`
   - `PlanParty_partyId_idx`
   - `PlanParty_tenantId_partyId_role_idx`

4. **FK Constraint Exists**: `PlanParty_partyId_fkey` with type `f`

5. **Data Coverage**: `coverage_pct` should be high (ideally 100%)

6. **No Orphaned References**: `orphaned_party_refs = 0`

7. **Party Type Distribution**: Informational breakdown of CONTACT vs ORGANIZATION

8. **Backing Entity Integrity**: `parties_without_backing_entity = 0`

## Backfill Script (If Needed)

If pre-migration validation shows `missing_party_id > 0`, run the backfill script.

**File**: `prisma/sql/backfill_step6f_planparty_party_only.sql`

### Execution

```bash
psql $DATABASE_URL -f prisma/sql/backfill_step6f_planparty_party_only.sql
```

This script:
- Populates `PlanParty.partyId` from `Contact.partyId` when `contactId` is set
- Populates `PlanParty.partyId` from `Organization.partyId` when `organizationId` is set
- Is idempotent and safe to run multiple times

## Manual Validation Queries

### Check PlanParty with Party Details

```sql
SELECT
  pp.id,
  pp."tenantId",
  pp."planId",
  pp.role,
  pp."partyId",
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
  END AS party_name
FROM "PlanParty" pp
LEFT JOIN "Party" p ON p.id = pp."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE pp."tenantId" = :your_tenant_id
LIMIT 20;
```

### Verify Backward Compatibility

Check that legacy fields can be derived from Party:

```sql
SELECT
  pp.id,
  pp."partyId",
  p.type,
  -- Derived legacy contactId
  CASE WHEN p.type = 'CONTACT' THEN c.id ELSE NULL END AS contactId,
  -- Derived legacy organizationId
  CASE WHEN p.type = 'ORGANIZATION' THEN o.id ELSE NULL END AS organizationId
FROM "PlanParty" pp
JOIN "Party" p ON p.id = pp."partyId"
LEFT JOIN "Contact" c ON c."partyId" = p.id
LEFT JOIN "Organization" o ON o."partyId" = p.id
WHERE pp."tenantId" = :your_tenant_id
LIMIT 10;
```

## Troubleshooting

### Issue: Missing partyId

**Symptom**: Pre-validation shows `missing_party_id > 0`

**Resolution**:
1. Identify affected rows:
   ```sql
   SELECT id, "tenantId", "planId", role, "contactId", "organizationId"
   FROM "PlanParty"
   WHERE "partyId" IS NULL;
   ```

2. Run backfill script (see above) to resolve from legacy fields

3. For rows where both legacy fields are NULL:
   - These may be intentionally unassigned party roles
   - Review if `partyId` should remain NULL or be assigned

### Issue: Orphaned Party References

**Symptom**: `orphaned_party_refs > 0` (partyId points to non-existent Party)

**Resolution**:
1. Identify orphans:
   ```sql
   SELECT id, "partyId"
   FROM "PlanParty" pp
   WHERE pp."partyId" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = pp."partyId");
   ```

2. Either:
   - Create missing Party rows
   - Set `partyId` to NULL for affected entries
   - Delete invalid entries

### Issue: Party Without Backing Entity

**Symptom**: `parties_without_backing_entity > 0`

**Resolution**:
1. Identify affected Parties:
   ```sql
   SELECT p.id, p.type, p.name
   FROM "Party" p
   WHERE p.id IN (SELECT "partyId" FROM "PlanParty" WHERE "partyId" IS NOT NULL)
   AND NOT EXISTS (SELECT 1 FROM "Contact" c WHERE c."partyId" = p.id)
   AND NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o."partyId" = p.id);
   ```

2. Create backing Contact or Organization for orphaned Parties

## Success Criteria

Migration is successful when:

✅ All pre-migration validation checks pass
✅ Schema changes applied via `db push`
✅ All post-migration validation checks pass
✅ Legacy columns (`contactId`, `organizationId`) removed
✅ `partyId` column exists with proper FK and indexes
✅ 100% coverage: all PlanParty entries have `partyId` (or NULL is intentional)
✅ No orphaned Party references
✅ TypeScript compilation passes
✅ Tests pass (if applicable)

## Notes

- **No API Endpoints**: PlanParty has no public API endpoints, so no backward compatibility mapping is required
- **Schema Cleanup Only**: This migration is purely schema cleanup
- **Migration Safety**: The migration is idempotent and safe to run after `db push`
- **Role Flexibility**: PlanParty supports arbitrary role strings (e.g., "STUD_OWNER", "CO_BREEDER", "VET", etc.)
