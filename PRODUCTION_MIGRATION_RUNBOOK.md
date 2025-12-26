# Production Migration Deployment Runbook

**Generated**: 2025-12-26
**Repository**: breederhq-api
**Branch**: dev
**Target Environment**: Production (bhq_prod)

---

## Executive Summary

**Current State**:
- Dev database: ✅ 64 migrations applied successfully
- Prod database: ⚠️ 51 migrations applied, 1 FAILED (blocking), 12 pending
- Failed migration: `20251225_step6_waitlist_party_only` (error 25001: CONCURRENTLY in transaction)

**Root Cause**:
Migration `20251225_step6_waitlist_party_only` used `CREATE INDEX CONCURRENTLY` which cannot run inside Prisma's transaction block.

**Solution Applied**:
- Removed `CONCURRENTLY` keyword from 4 index operations in the failing migration
- Migration now uses `CREATE INDEX IF NOT EXISTS` and `DROP INDEX IF EXISTS` (transaction-safe, idempotent)

**Expected Outcome**:
All 64 migrations will be applied to production using `prisma migrate deploy` without manual SQL intervention.

---

## Prerequisites

✅ All checks must pass before executing runbook:

1. **Repository State**:
   - On `dev` branch
   - Migration fix committed and pushed
   - Working tree clean

2. **Environment Files**:
   - `.env.prod.migrate` exists with valid production credentials
   - Can connect to prod database (test with `psql` or `prisma migrate status`)

3. **Backup**:
   - ⚠️ **CRITICAL**: Take production database snapshot before proceeding
   - Neon provides point-in-time restore (verify last backup timestamp)

4. **Communication**:
   - Stakeholders notified of deployment window
   - Monitoring/alerting ready for post-deployment validation

---

## Production Deployment Steps

### STEP 1: Pre-Deployment Validation

**Connect to prod and verify current state**:

```bash
cd /path/to/breederhq-api
npx dotenv -e .env.prod.migrate --override -- npx prisma migrate status --schema=prisma/schema.prisma
```

**Expected output**:
```
64 migrations found in prisma/migrations
Following migrations have not yet been applied:
20251225061321_party_step5_offspring_waitlist_party
20251225063854_step6_attachments_party_only
20251225064400_step6_tags_party_only
20251225172548_step6f_planparty_party_only
20251225185510_step6h_animalowner_party_only
20251225190453_step6i_breedingattempt_studowner_party_only
20251226_step7_party_constraints_and_indexes
20251226003347_step6g_animal_buyer_party_only
20251226011248_step6j_invoice_client_party_only
20251226013914_step6m_user_party_only
20251226014000_step6k_contractparty_party_only
20251226020000_step6l_offspringcontract_buyer_party_only
```

**Verify failed migration**:

```bash
psql "$DATABASE_URL" -c "SELECT migration_name, finished_at FROM _prisma_migrations WHERE finished_at IS NULL ORDER BY started_at;"
```

**Expected output**:
```
           migration_name            | finished_at
-------------------------------------+-------------
 20251225_step6_waitlist_party_only  |
```

---

### STEP 2: Clear the Failed Migration

The failed migration `20251225_step6_waitlist_party_only` must be marked as rolled back before Prisma will apply it again.

**Command**:
```bash
npx dotenv -e .env.prod.migrate --override -- \
  npx prisma migrate resolve --rolled-back 20251225_step6_waitlist_party_only \
  --schema=prisma/schema.prisma
```

**Expected output**:
```
Migration 20251225_step6_waitlist_party_only marked as rolled back.
```

**Verify clearance**:
```bash
psql "$DATABASE_URL" -c "SELECT migration_name, finished_at FROM _prisma_migrations WHERE finished_at IS NULL;"
```

**Expected output**: Empty result set (no failed migrations)

---

### STEP 3: Deploy All Pending Migrations

**Command**:
```bash
npx dotenv -e .env.prod.migrate --override -- \
  npx prisma migrate deploy \
  --schema=prisma/schema.prisma
```

**Expected behavior**:
- Prisma will detect 12 unapplied migrations
- Will apply them in order, including the fixed `20251225_step6_waitlist_party_only`
- All migrations are idempotent - safe to re-run if partially applied

**Monitor output for**:
- ✅ Each migration showing "Applied" status
- ✅ Final message: "All migrations have been successfully applied."
- ❌ Any error messages (stop immediately if errors occur)

**Estimated duration**: 30-60 seconds (depends on table sizes and index creation)

---

### STEP 4: Verify Deployment Success

**Check migration status**:
```bash
npx dotenv -e .env.prod.migrate --override -- \
  npx prisma migrate status \
  --schema=prisma/schema.prisma
```

**Expected output**:
```
Database schema is up to date!
```

**Verify migration count**:
```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) as total_applied FROM _prisma_migrations WHERE finished_at IS NOT NULL;"
```

**Expected output**:
```
 total_applied
---------------
            64
```

**Check for any failed migrations**:
```bash
psql "$DATABASE_URL" -c "SELECT migration_name, logs FROM _prisma_migrations WHERE finished_at IS NULL;"
```

**Expected output**: Empty result set (no failed migrations)

---

### STEP 5: Schema Integrity Validation

**Verify Party migration objects exist**:

```sql
-- Verify WaitlistEntry schema (Step 6E target)
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'WaitlistEntry'
  AND column_name IN ('clientPartyId', 'contactId', 'organizationId')
ORDER BY column_name;
```

**Expected result**:
- `clientPartyId` exists (nullable or NOT NULL depending on step7)
- `contactId` does NOT exist (dropped in step6)
- `organizationId` does NOT exist (dropped in step6)

**Verify critical indexes exist**:

```sql
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('WaitlistEntry', 'Offspring', 'OffspringGroupBuyer', 'AnimalOwner')
  AND indexname LIKE '%PartyId%'
ORDER BY tablename, indexname;
```

**Expected**: Indexes for all Party FK columns present (e.g., `WaitlistEntry_clientPartyId_idx`)

**Verify Step 7 constraints (if applied)**:

```sql
-- Check NOT NULL constraints applied by Step 7
SELECT
  table_name,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('WaitlistEntry', 'OffspringGroupBuyer', 'AnimalOwner', 'PlanParty', 'OffspringContract')
  AND column_name LIKE '%PartyId'
ORDER BY table_name, column_name;
```

**Expected**: Key Party columns have `is_nullable = 'NO'` (applied by step7)

---

### STEP 6: Functional Smoke Test

**Test API endpoints** (use staging/prod API):

1. **WaitlistEntry queries**:
   - GET `/api/waitlist` - should return entries with `clientPartyId`
   - Verify no errors related to missing columns

2. **Offspring queries**:
   - GET `/api/offspring` - should return offspring with `buyerPartyId`
   - Verify backward compatibility (API may still return derived legacy fields)

3. **Animal ownership queries**:
   - GET `/api/animals` - should return animals with owner party references
   - Verify AnimalOwner relations work correctly

**Expected**: All queries succeed without database errors

---

## Rollback Plan

### If Migration Fails During Deployment

**DO NOT attempt Prisma rollback** - Step 6 migrations are IRREVERSIBLE (drop columns).

**Recovery steps**:

1. **Identify failing migration**:
   ```bash
   psql "$DATABASE_URL" -c "SELECT migration_name, logs FROM _prisma_migrations WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1;"
   ```

2. **Assess impact**:
   - If failure is in Step 5 (additive): Low risk, no data loss
   - If failure is in Step 6 (cleanup): Medium risk, legacy columns may be partially dropped
   - If failure is in Step 7 (constraints): Low risk, constraints partially applied

3. **Resolution options**:

   **Option A - Mark migration as applied** (if DB changes actually succeeded):
   ```bash
   npx dotenv -e .env.prod.migrate --override -- \
     npx prisma migrate resolve --applied <migration_name> \
     --schema=prisma/schema.prisma
   ```
   Only use if the migration's SQL succeeded but Prisma lost connection or timed out.

   **Option B - Create repair migration** (if partial failure left DB in inconsistent state):
   - Create new migration in dev: `npx prisma migrate dev --name step6_repair`
   - Add idempotent SQL to complete the failed migration's intent
   - Deploy repair migration to prod

   **Option C - Restore from backup** (catastrophic failure):
   - Use Neon point-in-time restore to pre-deployment state
   - Investigate root cause before reattempting deployment

### If Application Breaks Post-Deployment

**Symptoms**:
- 500 errors from API endpoints
- "column does not exist" errors in logs
- Null reference errors for Party fields

**Immediate mitigation**:
1. Check API logs for specific SQL errors
2. Verify backend code is compatible (should have Party mapper functions)
3. Check frontend is sending correct payloads (partyId, not contactId)

**Repair**:
- If data coverage issue (NULL Party values): Run backfill scripts in `prisma/sql/backfills/`
- If schema issue: Create repair migration as described in Option B above

---

## Post-Deployment Verification

### Production Health Checks

**1. Database metrics**:
- Monitor query performance (index usage on new Party indexes)
- Check for slow queries related to Party FK joins
- Verify no missing index warnings in slow query log

**2. Application metrics**:
- Monitor API error rates (should not increase)
- Monitor API latency (may improve due to step7 indexes)
- Check for Party-related null reference exceptions

**3. Data integrity**:
- Run validation queries from `VALIDATION_QUERIES_STEP6_*.md` docs
- Verify 100% Party coverage for critical tables (WaitlistEntry, AnimalOwner, etc.)
- Check for orphaned Party references

### Success Criteria

✅ All 64 migrations applied (`prisma migrate status` shows "up to date")
✅ No failed migrations in `_prisma_migrations` table
✅ All Party FK columns exist with proper indexes
✅ Legacy columns dropped (contactId, organizationId) per Step 6 scope
✅ Step 7 NOT NULL constraints applied
✅ API endpoints functional (no 500 errors)
✅ Query performance stable or improved

---

## Migration Details Reference

### Migrations Applied in This Deployment

| Order | Migration Name | Type | Key Changes | Reversible |
|-------|----------------|------|-------------|-----------|
| 51 | `20251225061321_party_step5_offspring_waitlist_party` | Step 5 | Add Party FK to WaitlistEntry, OffspringGroupBuyer, Offspring | Yes (additive) |
| 52 | `20251225_step6_waitlist_party_only` | Step 6 | **FIXED**: Drop WaitlistEntry legacy columns, remove CONCURRENTLY | **NO** (drops columns) |
| 53 | `20251225063854_step6_attachments_party_only` | Step 6 | Drop Attachment.contactId | **NO** |
| 54 | `20251225064400_step6_tags_party_only` | Step 6 | Drop TagAssignment legacy columns | **NO** |
| 55 | `20251225172548_step6f_planparty_party_only` | Step 6 | Drop PlanParty legacy columns | **NO** |
| 56 | `20251225185510_step6h_animalowner_party_only` | Step 6 | Drop AnimalOwner legacy columns | **NO** |
| 57 | `20251225190453_step6i_breedingattempt_studowner_party_only` | Step 6 | Drop BreedingAttempt.studOwnerContactId | **NO** |
| 58 | `20251226_step7_party_constraints_and_indexes` | Step 7 | Add NOT NULL constraints, performance indexes | Partially (constraints hard to reverse) |
| 59 | `20251226003347_step6g_animal_buyer_party_only` | Step 6 | Drop Animal buyer legacy columns | **NO** |
| 60 | `20251226011248_step6j_invoice_client_party_only` | Step 6 | Drop Invoice legacy columns | **NO** |
| 61 | `20251226013914_step6m_user_party_only` | Step 6 | Drop User.contactId | **NO** |
| 62 | `20251226014000_step6k_contractparty_party_only` | Step 6 | Drop ContractParty legacy columns | **NO** |
| 63 | `20251226020000_step6l_offspringcontract_buyer_party_only` | Step 6 | Drop OffspringContract legacy columns | **NO** |

### Code Fix Applied

**File**: `prisma/migrations/20251225_step6_waitlist_party_only/migration.sql`

**Changes**:
```diff
- CREATE INDEX CONCURRENTLY IF NOT EXISTS "WaitlistEntry_clientPartyId_idx"
+ CREATE INDEX IF NOT EXISTS "WaitlistEntry_clientPartyId_idx"

- CREATE INDEX CONCURRENTLY IF NOT EXISTS "WaitlistEntry_tenantId_clientPartyId_idx"
+ CREATE INDEX IF NOT EXISTS "WaitlistEntry_tenantId_clientPartyId_idx"

- DROP INDEX CONCURRENTLY IF EXISTS "WaitlistEntry_contactId_idx";
+ DROP INDEX IF EXISTS "WaitlistEntry_contactId_idx";

- DROP INDEX CONCURRENTLY IF EXISTS "WaitlistEntry_organizationId_idx";
+ DROP INDEX IF EXISTS "WaitlistEntry_organizationId_idx";
```

**Rationale**:
- `CONCURRENTLY` requires running outside a transaction
- Prisma `migrate deploy` runs all DDL in transactions for atomicity
- `IF NOT EXISTS` / `IF EXISTS` provides idempotency without CONCURRENTLY
- Migration is safe to re-run after failure

---

## Appendix: Command Reference

### Check migration status
```bash
npx dotenv -e .env.prod.migrate --override -- npx prisma migrate status --schema=prisma/schema.prisma
```

### Deploy migrations
```bash
npx dotenv -e .env.prod.migrate --override -- npx prisma migrate deploy --schema=prisma/schema.prisma
```

### Mark migration as rolled back
```bash
npx dotenv -e .env.prod.migrate --override -- npx prisma migrate resolve --rolled-back <migration_name> --schema=prisma/schema.prisma
```

### Mark migration as applied (use carefully!)
```bash
npx dotenv -e .env.prod.migrate --override -- npx prisma migrate resolve --applied <migration_name> --schema=prisma/schema.prisma
```

### Direct database queries
```bash
# Using psql
psql "$(grep DATABASE_URL .env.prod.migrate | cut -d '=' -f2-)"

# Using Prisma db execute
npx dotenv -e .env.prod.migrate --override -- npx prisma db execute --file query.sql --schema=prisma/schema.prisma
```

---

**End of Runbook**
