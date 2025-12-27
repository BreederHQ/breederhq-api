# Post-Migration Validation Runbook

## Purpose

This runbook provides step-by-step instructions for validating the Party migration after deployment to any environment (dev, staging, production).

Use this runbook:
- After deploying Party migration changes (Phases 1-5)
- After running backfill scripts
- As part of regular data integrity monitoring
- Before declaring a migration complete in production

## Prerequisites

- Database access (read-only sufficient for validation)
- Environment variables configured (.env.dev, .env.studio, or .env.prod.migrate)
- Node.js 20.x and dependencies installed
- Prisma Client generated (`npm run db:gen`)

## Validation Methods

### Method 1: Automated Test Suite (Recommended)

Run the complete automated test suite that validates both schema and data integrity.

```bash
# Run all tests (API contracts + regression)
npm test

# Or run specific test suites
npm run test:contracts    # API contract tests
npm run test:regression   # Database regression tests
```

**Expected Output:**
- All tests should pass
- No FAIL messages in output
- Exit code 0

**If tests fail:**
- Review the failure details
- Check for orphaned Party references
- Verify mandatory partyId fields are populated
- Run appropriate backfill scripts (see BACKFILL_RUNBOOK.md)

### Method 2: SQL Validation Scripts

Run the SQL validation scripts directly against the database.

```bash
# Run all SQL validation scripts
npm run validate:sql
```

This executes all `validate_step6*.sql` files in `prisma/sql/` directory.

**Key validation files:**
- `validate_step6_party_only_runtime.sql` - Core Party-only validation
- `validate_step6_waitlist_post.sql` - Waitlist Party integrity
- `validate_step6h_animalowner_post.sql` - AnimalOwner Party integrity
- `validate_step6i_breedingattempt_post.sql` - BreedingAttempt Party integrity
- `validate_step6m_user_post.sql` - User Party integrity

### Method 3: Manual SQL Validation

If automated tools are unavailable, run SQL queries manually via psql or database client.

#### 1. Check for Legacy Columns (Should Return Zero Rows)

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'WaitlistEntry' AND column_name IN ('contactId', 'organizationId'))
    OR (table_name = 'AnimalOwner' AND column_name IN ('contactId', 'organizationId', 'partyType'))
    OR (table_name = 'BreedingAttempt' AND column_name = 'studOwnerContactId')
    OR (table_name = 'Offspring' AND column_name IN ('buyerContactId', 'buyerOrganizationId'))
    OR (table_name = 'Animal' AND column_name IN ('buyerContactId', 'buyerOrganizationId', 'buyerPartyType'))
    OR (table_name = 'User' AND column_name = 'contactId')
    OR (table_name = 'Invoice' AND column_name IN ('contactId', 'organizationId'))
    OR (table_name = 'ContractParty' AND column_name IN ('contactId', 'organizationId'))
    OR (table_name = 'OffspringContract' AND column_name IN ('buyerContactId', 'buyerOrganizationId'))
    OR (table_name = 'Party' AND column_name = 'type')
  );
```

**Expected:** 0 rows

#### 2. Check for Mandatory Null partyId Fields (Should Return Zero Rows)

```sql
-- WaitlistEntry
SELECT COUNT(*) as null_count FROM "WaitlistEntry" WHERE "clientPartyId" IS NULL;

-- AnimalOwner
SELECT COUNT(*) as null_count FROM "AnimalOwner" WHERE "partyId" IS NULL;

-- User
SELECT COUNT(*) as null_count FROM "User" WHERE "partyId" IS NULL;
```

**Expected:** null_count = 0 for each query

#### 3. Check for Orphaned Party References (Should Return Zero Rows)

```sql
-- WaitlistEntry orphans
SELECT COUNT(*) as orphan_count
FROM "WaitlistEntry" we
WHERE we."clientPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = we."clientPartyId");

-- AnimalOwner orphans
SELECT COUNT(*) as orphan_count
FROM "AnimalOwner" ao
WHERE ao."partyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = ao."partyId");

-- BreedingAttempt orphans
SELECT COUNT(*) as orphan_count
FROM "BreedingAttempt" ba
WHERE ba."studOwnerPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = ba."studOwnerPartyId");

-- User orphans
SELECT COUNT(*) as orphan_count
FROM "User" u
WHERE u."partyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = u."partyId");
```

**Expected:** orphan_count = 0 for each query

#### 4. Check Foreign Key Constraints Exist

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (
    (tc.table_name = 'WaitlistEntry' AND kcu.column_name = 'clientPartyId')
    OR (tc.table_name = 'AnimalOwner' AND kcu.column_name = 'partyId')
    OR (tc.table_name = 'BreedingAttempt' AND kcu.column_name = 'studOwnerPartyId')
    OR (tc.table_name = 'User' AND kcu.column_name = 'partyId')
    OR (tc.table_name = 'Invoice' AND kcu.column_name = 'clientPartyId')
    OR (tc.table_name = 'ContractParty' AND kcu.column_name = 'partyId')
    OR (tc.table_name = 'OffspringContract' AND kcu.column_name = 'buyerPartyId')
    OR (tc.table_name = 'Animal' AND kcu.column_name = 'buyerPartyId')
  )
ORDER BY tc.table_name, kcu.column_name;
```

**Expected:** At least one FK constraint per table/column pair

## Interpreting Results

### Success Criteria

All validations pass when:
- No legacy columns exist in Party-touched tables
- All mandatory partyId fields are non-null
- No orphaned Party references exist
- Foreign key constraints are in place
- API contract tests pass
- Party.kind column exists (not Party.type)

### Failure Classes

#### Legacy Column Exists
**Symptom:** Validation finds contactId, organizationId, or partyType columns
**Cause:** Migration step was skipped or rolled back
**Action:** Re-run the appropriate migration step

#### Null Mandatory partyId
**Symptom:** Records with null clientPartyId, partyId, etc.
**Cause:** Backfill script was not run or incomplete
**Action:** Run appropriate backfill script (see BACKFILL_RUNBOOK.md)

#### Orphaned Party Reference
**Symptom:** partyId references non-existent Party record
**Cause:** Data integrity issue, Party was deleted without cascade
**Action:** Investigate orphaned records, restore Party or nullify reference

#### Missing Foreign Key
**Symptom:** No FK constraint on partyId field
**Cause:** Constraint creation step was skipped
**Action:** Run Step 7 constraint migration

## Runtime API Validation

After schema validation passes, test Party-native API behavior:

### Headers Required
```
x-tenant-id: <valid-tenant-id>
Authorization: Bearer <valid-token>
```

### Test Waitlist Creation (Party-native)

```bash
curl -X POST http://localhost:8080/api/v1/waitlist \
  -H "x-tenant-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "clientPartyId": 123,
    "status": "INQUIRY"
  }'
```

**Expected:** 201 Created with clientPartyId in response

### Test Waitlist Read (Party-native response)

```bash
curl http://localhost:8080/api/v1/waitlist \
  -H "x-tenant-id: 1"
```

**Expected:** Response contains clientPartyId, no contactId or organizationId

### Test Animal Owner Assignment

```bash
curl -X POST http://localhost:8080/api/v1/animals/{animalId}/owners \
  -H "x-tenant-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "partyId": 456,
    "currentOwner": true
  }'
```

**Expected:** 201 Created with partyId in response

## Monitoring and Alerts

Set up monitoring for:
- 500 errors on Party-touched endpoints (animals, waitlist, offspring, breeding)
- Slow queries involving Party joins
- Foreign key violation errors
- Null constraint violations on partyId fields

## Frequency

Run validations:
- **After each deployment:** Full test suite + SQL validation
- **Daily in production:** SQL orphan checks and null checks
- **Weekly:** Full API contract test suite in staging
- **Before major releases:** Complete validation runbook

## Troubleshooting

### Test Suite Connection Errors
- Verify .env.dev has correct DATABASE_URL
- Ensure database is running and accessible
- Check network connectivity and firewall rules

### SQL Validation Fails with Permission Errors
- Ensure database user has SELECT permission on all tables
- Ensure user has access to information_schema

### API Tests Fail with Authentication Errors
- Verify test tenant exists
- Check authentication token validity
- Review x-tenant-id header configuration

## Related Documentation

- [Backfill Runbook](./BACKFILL_RUNBOOK.md)
- [Rollback Posture](./ROLLBACK_POSTURE.md)
- [Performance Monitoring Checklist](./PERFORMANCE_MONITORING.md)
- [Party Migration Baseline](../migrations/party/notes/PARTY_MIGRATION_BASELINE.md)

