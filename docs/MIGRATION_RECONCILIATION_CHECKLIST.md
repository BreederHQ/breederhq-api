# Migration Reconciliation Checklist

## Purpose

This document provides operational guidance for reconciling Prisma migrations in the BreederHQ repository, specifically addressing the workflow when using `db push` in development vs `migrate deploy` in production.

## Background

In this repository:
- **Development**: We use `npx prisma db push` to apply schema changes quickly without creating migration files
- **Production**: We use `npx prisma migrate deploy` to apply migration files that have been tested and committed

This creates a potential mismatch: the dev database may have schema changes applied via `db push` that haven't yet been recorded as migrations.

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

## When It's Safe to Mark Migration as Resolved

Use `prisma migrate resolve --applied` **ONLY** when ALL of the following are true:

### Safety Checklist

- [ ] ✅ The schema objects (columns, FKs, indexes) already exist in the database
- [ ] ✅ You've verified object definitions match the migration.sql exactly
- [ ] ✅ The migration was applied via `db push` and you're just recording it in history
- [ ] ✅ The database is in sync with schema.prisma (confirmed via `db push` dry-run)
- [ ] ✅ You have a backup of the database (or it's dev/non-critical)
- [ ] ✅ The migration.sql file is idempotent (won't cause errors if re-run)

### Command
```powershell
npx dotenv -e .env.dev.migrate --override -- prisma migrate resolve --applied "20251225_party_step5_finance_party" --schema=prisma/schema.prisma
```

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

When writing `migration.sql` files that may be applied after `db push`, use idempotent SQL:

### Add Column
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'YourTable' AND column_name = 'yourColumn'
    ) THEN
        ALTER TABLE "YourTable" ADD COLUMN "yourColumn" INTEGER;
    END IF;
END $$;
```

### Add Foreign Key
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'YourTable_yourColumn_fkey'
    ) THEN
        ALTER TABLE "YourTable"
        ADD CONSTRAINT "YourTable_yourColumn_fkey"
        FOREIGN KEY ("yourColumn")
        REFERENCES "OtherTable"(id)
        ON DELETE SET NULL;
    END IF;
END $$;
```

### Add Index
```sql
CREATE INDEX IF NOT EXISTS "YourTable_yourColumn_idx" ON "YourTable"("yourColumn");
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

## Resources

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma db push vs migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate/db-push)
- Party Migration Files: `breederhq-api/prisma/migrations/20251225_party_step5_*`
