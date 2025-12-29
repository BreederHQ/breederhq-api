# Baseline Migration Known Issue

## Problem Statement

The baseline migration `20251014074658_baseline/migration.sql` is **incomplete**. It only contains enum definitions and ends with a placeholder comment:

```sql
-- Everything below here stays exactly as it was in baseline,
-- starting at: CREATE TABLE "public"."Animal" ...
-- Paste the remainder of your existing baseline SQL starting at the first CREATE TABLE line.
```

This causes the shadow database validation to fail when running `prisma migrate dev` because:
1. The baseline creates only enums
2. Subsequent migration `20251014080117_change` tries to create tables (like `Breed`) that reference those enums
3. The shadow DB correctly applies migrations in sequence and works
4. **However**, since the baseline was applied to production successfully (before it was fixed), we cannot edit it

## Current State

- ✅ **Production**: Database schema is up to date, baseline was applied successfully
- ✅ **Development**: Database schema is up to date, all migrations marked as applied
- ❌ **Shadow DB**: Will fail on fresh replay due to incomplete baseline

## Impact

### What Works
- ✅ `prisma migrate deploy` (production deployments)
- ✅ `prisma migrate status` (both dev and prod)
- ✅ `prisma db push` (for dev iterations without migrations)
- ✅ Running the application

### What Fails
- ❌ `prisma migrate dev --create-only` (shadow DB validation fails)
- ❌ `prisma migrate dev` (shadow DB validation fails)
- ❌ Fresh database setup from migrations alone

## Root Cause

The baseline migration was created during a migration consolidation but was never completed. The SQL file contains only the enum definitions from the DO $$ blocks that were fixed for syntax, but the table creation DDL was never added.

## Workaround for New Migrations

When creating new migrations, use this workflow:

### Option 1: Use db push for iteration, then create migration
```bash
# 1. Make schema changes
# 2. Apply to dev without migration
npm run db:dev:push

# 3. Test your changes
# 4. Create the migration file manually
npm run db:dev:migrate:createonly

# 5. If shadow DB fails, manually mark as applied after verification
npx dotenv -e .env.dev.migrate -- prisma migrate resolve --applied <migration_name>
```

### Option 2: Skip shadow DB validation (not recommended)
```bash
# This bypasses safety checks - only use if absolutely necessary
npx dotenv -e .env.dev.migrate -- prisma migrate dev --skip-shadow-database
```

### Option 3: Use deploy workflow in dev (recommended for now)
```bash
# 1. Create migration manually
npx dotenv -e .env.dev.migrate -- prisma migrate dev --create-only --name <name>

# 2. Review the generated SQL
# 3. Apply using deploy (no shadow DB)
npx dotenv -e .env.dev.migrate -- prisma migrate deploy
```

## Permanent Fix (Future Work)

To properly fix this issue, we need to:

1. **Create a new squashed baseline** that captures the complete schema as of the baseline migration
2. **Mark all pre-baseline migrations as applied** in a fresh database
3. **Test the new baseline** works in shadow DB
4. **Deploy the fix** to all environments

### Steps for Permanent Fix

```bash
# 1. Export current prod schema as baseline
npx dotenv -e .env.prod.migrate -- prisma db pull

# 2. Generate a complete migration from that schema
# (This requires careful manual work to extract just the baseline portion)

# 3. Replace the incomplete baseline migration
# WARNING: This is complex and risky - requires coordination

# 4. Test in a clean shadow database
# 5. Validate all environments can migrate forward
```

## Temporary Mitigation

For now, the migration workflow is:

1. **Dev iterations**: Use `prisma db push` or manually create migrations
2. **Review**: Always review generated SQL before applying
3. **Dev apply**: Use `prisma migrate resolve --applied` if shadow DB fails
4. **Prod deploy**: Always use `prisma migrate deploy` (never uses shadow DB)

## Monitoring

Check migration status regularly:

```bash
# Dev
npm run db:dev:status

# Prod
npm run db:prod:status
```

Both should show "Database schema is up to date!" ✅

## Related Files

- Incomplete baseline: `prisma/migrations/20251014074658_baseline/migration.sql`
- Fixed syntax: DO $$ blocks (lines 5-73)
- Missing content: All CREATE TABLE statements

## Date

- Issue documented: 2025-12-28
- Last status check: Both dev and prod clean ✅
- Next review: Before next production deployment
