# Migration Reconciliation Checklist

## Purpose

This document provides operational guidance for reconciling Prisma migrations in the BreederHQ repository, specifically addressing the workflow when using `db push` in development vs `migrate deploy` in production.

## Background

**This is the project standard - not optional:**

In this repository:
- **Development**: We use `npx prisma db push` ONLY to apply schema changes
- **Migration folders**: Kept for history and for production deploy, but migration.sql MUST be idempotent
- **NEVER use `prisma migrate dev`**: We do not use shadow databases in this project
- **Production**: We use `npx prisma migrate deploy` to apply migration files

This creates a workflow where the dev database will have schema changes applied via `db push` **before** migrations are run. Therefore, all migration.sql files must be written to handle pre-existing objects gracefully.

## When to Use Each Command

### Use `db push` for:
- ✅ Local development iterations
- ✅ Testing schema changes quickly
- ✅ Prototyping new features
- ✅ When you want immediate schema updates without migration history

**Command**:
```powershell
npx dotenv -e .env.dev.migrate --override -- prisma db push --schema=prisma/schema.prisma
```

### Use `migrate deploy` for:
- ✅ Production deployments
- ✅ Staging environments
- ✅ CI/CD pipelines
- ✅ When you need migration history and rollback capability

**Command**:
```powershell
npx dotenv -e .env.prod --override -- prisma migrate deploy --schema=prisma/schema.prisma
```

### NEVER Use `migrate dev` in this Repo:
- ❌ **Do NOT use** `prisma migrate dev` (creates shadow database, which we don't use)
- ❌ Our workflow explicitly avoids shadow databases for dev

## Detecting "DB Push Already Applied but Migration Not Recorded"

### Scenario
You've run `db push` to apply schema changes to your dev database, but the corresponding migration file doesn't exist yet or hasn't been marked as applied.

### Detection Steps

#### Step 1: Check if schema and DB are in sync
```powershell
cd breederhq-api
npx dotenv -e .env.dev.migrate --override -- prisma db push --schema=prisma/schema.prisma
```

**Output Analysis**:
- ✅ "The database is already in sync with the Prisma schema" → Schema matches DB
- ⚠️ Shows pending changes → Schema doesn't match DB (run `db push` to apply)

#### Step 2: Check migration status
```powershell
npx dotenv -e .env.dev.migrate --override -- prisma migrate status --schema=prisma/schema.prisma
```

**Output Analysis**:
- ✅ "Database schema is up to date!" → All migrations applied
- ⚠️ Lists pending migrations → Migrations exist but not applied
- ⚠️ "Your local migration history is different from the remote" → Mismatch detected

#### Step 3: Query the migration table directly
```sql
-- Check which migrations have been applied
SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY finished_at DESC
LIMIT 10;
```

**What to Look For**:
- Missing migration folders that exist in `prisma/migrations/` → Need to be applied or resolved
- Applied migrations that don't have folders → Historical or deleted migrations

## Verifying Schema Objects Exist

When you suspect a migration was applied via `db push` but not recorded, verify the schema objects manually.

### For Finance Domain Party Migration (Example)

#### Check Columns
```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('Invoice', 'OffspringContract', 'ContractParty')
  AND column_name IN ('clientPartyId', 'buyerPartyId', 'partyId')
ORDER BY table_name, column_name;
```

**Expected**: 3 rows (one for each model's partyId column)

#### Check Foreign Keys
```sql
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('Invoice', 'OffspringContract', 'ContractParty')
  AND kcu.column_name IN ('clientPartyId', 'buyerPartyId', 'partyId');
```

**Expected**: 3 constraints pointing to `Party` table

#### Check Indexes
```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('Invoice', 'OffspringContract', 'ContractParty')
  AND (indexname LIKE '%PartyId%' OR indexname LIKE '%partyId%')
ORDER BY tablename, indexname;
```

**Expected**: At least 6 indexes (single + composite for each model)

## When to Use `prisma migrate resolve --applied`

Use `prisma migrate resolve --applied` when a migration failed because `db push` already created the objects, and you've now made the migration.sql idempotent.

### Reconciliation Workflow After Migration Failure

If `prisma migrate deploy` failed with an error like "constraint already exists":

1. **Validate the database already has the expected objects** - Run the verification queries from the migration's README.md to confirm columns, FKs, and indexes exist
2. **Make the migration.sql idempotent** - Wrap all FK creations in DO blocks checking pg_constraint, use IF NOT EXISTS for columns and indexes
3. **Mark the migration as applied**:
   ```powershell
   npx dotenv -e .env.dev.migrate --override -- prisma migrate resolve --applied "20251225_party_step5_animals_party" --schema=prisma/schema.prisma
   ```

### Safety Checklist Before Using Resolve

Use `prisma migrate resolve --applied` **ONLY** when ALL of the following are true:

- [ ] ✅ The schema objects (columns, FKs, indexes) already exist in the database
- [ ] ✅ You've verified object definitions match what the migration.sql would create
- [ ] ✅ The migration was applied via `db push` and you're just recording it in history
- [ ] ✅ The database is in sync with schema.prisma (confirmed via `db push` showing "already in sync")
- [ ] ✅ You have a backup of the database (or it's dev/non-critical)
- [ ] ✅ The migration.sql file is NOW idempotent (won't cause errors if re-run in production)

**Effect**: Marks the migration as applied in `_prisma_migrations` table without executing it.

## When to STOP and NOT Resolve

### Red Flags - DO NOT use migrate resolve if:

- ❌ Schema objects are partially applied (e.g., columns exist but indexes missing)
- ❌ Object definitions don't match migration.sql
- ❌ Database schema differs from schema.prisma
- ❌ You're not sure if the migration was fully applied
- ❌ You're working in production without a backup
- ❌ Migration.sql is NOT idempotent

### What to Do Instead:
1. Create a new migration with the missing changes
2. Run `db push` to sync schema fully
3. Manually apply the migration.sql if it's idempotent
4. Reset the database and re-apply all migrations from scratch (dev only)

## Standard Workflow for Windows PowerShell

### Scenario: You want to apply schema changes in dev and record the migration

```powershell
# 1. Navigate to API directory
cd C:\Users\Aaron\Documents\Projects\breederhq-api

# 2. Apply schema changes via db push
npx dotenv -e .env.dev.migrate --override -- prisma db push --schema=prisma/schema.prisma --skip-generate

# 3. Create migration folder with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$migrationName = "${timestamp}_your_migration_name"
mkdir "prisma/migrations/$migrationName"

# 4. Write migration.sql (manually, based on schema changes)
# Use idempotent SQL (IF NOT EXISTS, DO blocks, CREATE INDEX IF NOT EXISTS)

# 5. Mark migration as applied (since db push already applied it)
npx dotenv -e .env.dev.migrate --override -- prisma migrate resolve --applied "$migrationName" --schema=prisma/schema.prisma

# 6. Verify migration status
npx dotenv -e .env.dev.migrate --override -- prisma migrate status --schema=prisma/schema.prisma
```

### Scenario: You want to deploy migrations to production

```powershell
# 1. Navigate to API directory
cd C:\Users\Aaron\Documents\Projects\breederhq-api

# 2. Review pending migrations
npx dotenv -e .env.prod --override -- prisma migrate status --schema=prisma/schema.prisma

# 3. Deploy migrations (will execute migration.sql files)
npx dotenv -e .env.prod --override -- prisma migrate deploy --schema=prisma/schema.prisma

# 4. Verify deployment
npx dotenv -e .env.prod --override -- prisma migrate status --schema=prisma/schema.prisma
```

## Idempotent Migration Patterns

**CRITICAL**: All migration.sql files MUST be idempotent because dev uses `db push` which may create objects before the migration runs.

When writing `migration.sql` files that may be applied after `db push`, use these patterns:

### Add Column
```sql
-- Simple form (Prisma 5.x supports this)
ALTER TABLE "YourTable"
  ADD COLUMN IF NOT EXISTS "yourColumn" INTEGER;
```

### Add Foreign Key (REQUIRED PATTERN)
```sql
-- IMPORTANT: Always wrap FK creation in a DO block checking pg_constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'YourTable_yourColumn_fkey'
      AND conrelid = '"YourTable"'::regclass
  ) THEN
    ALTER TABLE "YourTable"
      ADD CONSTRAINT "YourTable_yourColumn_fkey"
      FOREIGN KEY ("yourColumn")
      REFERENCES "OtherTable"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
```

**Why check both `conname` AND `conrelid`?**
- `conname`: Ensures we're checking the right constraint name
- `conrelid`: Ensures the constraint belongs to the correct table (not a different table with same FK name)

### Add Index
```sql
-- Built-in IF NOT EXISTS support
CREATE INDEX IF NOT EXISTS "YourTable_yourColumn_idx"
  ON "YourTable"("yourColumn");
```

### Add JSONB Column
```sql
-- JSONB columns are just like any other column
ALTER TABLE "YourTable"
  ADD COLUMN IF NOT EXISTS "yourJsonColumn" JSONB;
```

## FAQ

### Q: Can I run migrate deploy after db push?
**A**: Yes, if you've created an idempotent migration.sql that won't fail when objects already exist.

### Q: What if migrate deploy fails because objects already exist?
**A**: Either:
1. Use `migrate resolve --applied` to skip the migration (if you're sure it's already applied), OR
2. Make the migration.sql idempotent so it can run safely

### Q: Should I commit migration files created after db push?
**A**: Yes! Always commit migration files so they can be deployed to production and other environments.

### Q: How do I reset my dev database?
**A**: (Destructive - dev only)
```powershell
# Drop and recreate schema (CAREFUL!)
npx dotenv -e .env.dev.migrate --override -- prisma migrate reset --schema=prisma/schema.prisma --force

# OR manually drop all tables and run migrate deploy
```

### Q: What's the difference between resolve --applied and resolve --rolled-back?
**A**:
- `--applied`: Marks migration as applied without executing (use when db push already applied it)
- `--rolled-back`: Marks migration as not applied, allowing it to be applied again

## Best Practices

1. ✅ Always use `db push` for quick dev iterations
2. ✅ Create idempotent migration.sql files immediately after `db push`
3. ✅ Mark migrations as applied using `migrate resolve --applied`
4. ✅ Commit migration files to git
5. ✅ Use `migrate deploy` in production
6. ✅ Test migrations on staging before production
7. ✅ Keep migration.sql files idempotent
8. ✅ Document manual backfill steps in separate .sql files (not in migration.sql)

## Step 6 Party-Only Migration Reconciliation

Step 6 of the Party migration removes legacy columns from models that were dual-writing in Step 5. After running `db push` for Step 6 schema cleanup, migrations are marked as applied using `migrate resolve --applied` because the schema changes were already applied to dev.

### Step 6 Target Models (Party-only)

The following models had legacy columns removed and now store only Party references:

- **AnimalOwner**: `partyId` only (removed: contactId, organizationId, partyType)
- **BreedingAttempt**: `studOwnerPartyId` only (removed: studOwnerContactId)
- **Invoice**: `clientPartyId` only (removed: contactId, organizationId)
- **ContractParty**: `partyId` + `userId` (removed: contactId, organizationId)
- **OffspringContract**: `buyerPartyId` only (removed: buyerContactId, buyerOrganizationId)
- **User**: `partyId` only (removed: contactId)
- **Animal**: `buyerPartyId` only (removed: buyerContactId, buyerOrganizationId, buyerPartyType)

Plus earlier Step 6 work: **Attachment**, **Tag**, **OffspringGroupBuyer**, **Offspring**, **WaitlistEntry**, **PlanParty**

### Key Constraint After Step 6

**CRITICAL**: After Step 6 schema cleanup migrations are marked as applied using `migrate resolve --applied`, **NEVER** run `migrate deploy` in dev to apply Step 6 schema cleanup migrations, because:

1. Dev database already has Step 6 schema changes applied via `db push`
2. Migrations are marked as applied in `_prisma_migrations` table
3. Running `migrate deploy` would try to execute already-applied DROP COLUMN statements
4. This would fail or cause inconsistencies

### Safe Deployment Path

**Development**:
```powershell
# 1. Run db push to apply Step 6 schema cleanup
npx dotenv -e .env.dev.migrate --override -- prisma db push --schema=prisma/schema.prisma

# 2. Mark Step 6 migrations as applied (do NOT run migrate deploy)
npx dotenv -e .env.dev.migrate --override -- prisma migrate resolve --applied "20251225_step6_cleanup_*" --schema=prisma/schema.prisma
```

**Production** (when ready):
```powershell
# Production uses migrate deploy as normal - migrations are idempotent
npx dotenv -e .env.prod --override -- prisma migrate deploy --schema=prisma/schema.prisma
```

### Runtime Validation Query

After Step 6 operational updates, run this query to validate Party-only persistence:

```powershell
# Location: breederhq-api/prisma/sql/validate_step6_party_only_runtime.sql
psql $YOUR_DEV_CONNECTION_STRING -f prisma/sql/validate_step6_party_only_runtime.sql
```

This validates:
1. Legacy columns no longer exist
2. Party-only columns exist with proper foreign keys
3. No orphaned Party references

## Resources

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma db push vs migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate/db-push)
- Party Migration Files: `breederhq-api/prisma/migrations/20251225_party_step5_*`
- Step 6 Validation: `breederhq-api/prisma/sql/validate_step6_party_only_runtime.sql`
