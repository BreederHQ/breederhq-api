# Production Schema Alignment - DB Push Only Mode

## Overview

This runbook provides the safe, controlled process for aligning the `bhq_prod` database schema to match the current `prisma/schema.prisma` file while operating in **DB Push Only** mode.

In this mode:
- **NO migrations exist** - we do not use `prisma migrate dev` or `prisma migrate deploy`
- Schema changes are made directly to `schema.prisma`
- Dev uses `db push` to apply changes
- Prod requires **explicit SQL diff generation, review, and controlled execution**

## CRITICAL PRECONDITIONS

### 1. Snapshot Required

**DO NOT PROCEED WITHOUT A FRESH NEON SNAPSHOT OF `bhq_prod`**

Before running any alignment commands:

1. Log into Neon console
2. Navigate to `bhq_prod` database
3. Create a snapshot with a descriptive name (e.g., `pre-alignment-2025-12-28`)
4. Verify the snapshot completed successfully

**If anything goes wrong, you can restore from this snapshot.**

### 2. Verify Current Branch

Ensure you are on the `dev` branch:

```bash
git branch --show-current
# Should show: dev
```

### 3. Ensure Clean Working Tree

```bash
git status
# Should show: nothing to commit, working tree clean
```

## Alignment Workflow

### Step 1: Sync Dev Database

Ensure your local dev database (`bhq_dev`) matches `schema.prisma`:

```bash
npm run db:dev:sync
```

This runs:
- `db:dev:push` - applies schema to dev database
- `db:gen` - regenerates Prisma client

**Expected output:**
```
✓ Prisma guard: Safety checks passed
  Database: bhq_dev
  Command: db push

...schema changes applied...
✓ Generated Prisma Client
```

### Step 2: Generate Production Diff SQL

Generate the SQL needed to align prod with the current schema:

```bash
npm run db:prod:align:diff
```

This runs:
- Loads `.env.prod.migrate` (contains `bhq_prod` connection)
- Executes `prisma migrate diff` from prod database to `schema.prisma`
- Writes SQL to `prisma_prod_align.sql` in repo root

**Expected output:**
```
✓ Prisma guard: Safety checks passed
  Database: bhq_prod
  Command: migrate diff

✓ SQL diff written to prisma_prod_align.sql
⚠️  REVIEW THE FILE BEFORE APPLYING
```

### Step 3: Review the Generated SQL

**CRITICAL: Manually review `prisma_prod_align.sql` before applying**

```bash
cat prisma_prod_align.sql
# or open in your editor
```

**Check for destructive operations:**
- `DROP TABLE` - will delete data
- `DROP COLUMN` - will delete data
- `ALTER COLUMN TYPE` - may fail or truncate data
- Missing `WHERE` clauses in `DELETE` statements

**If the SQL looks safe**, proceed to Step 4.

**If you see unexpected changes:**
- Do NOT apply
- Investigate why schema and prod are out of sync
- Verify you ran `db:dev:sync` first
- Check recent git commits for schema changes

### Step 4: Apply SQL to Production

**Only proceed if you:**
1. Have a Neon snapshot
2. Have reviewed the SQL and it looks safe

```bash
npm run db:prod:align:apply
```

This runs:
- Loads `.env.prod.migrate`
- Executes `prisma db execute --file prisma_prod_align.sql`
- Guard enforces ONLY `prisma_prod_align.sql` can be applied to prod

**Expected output:**
```
✓ Prisma guard: Safety checks passed
  Database: bhq_prod
  Command: db execute

...SQL execution output...
```

**If errors occur:**
- Do NOT re-run
- Check error message carefully
- Restore from Neon snapshot if needed
- Investigate root cause before retrying

### Step 5: Verify Alignment

Confirm prod is now in sync with `schema.prisma`:

```bash
npm run db:prod:align:verify
```

This runs:
- `prisma migrate diff` with `--exit-code`
- Exit code 0 = no differences (success)
- Exit code non-zero = still out of sync (failure)

**Expected output (success):**
```
✓ Prisma guard: Safety checks passed
  Database: bhq_prod
  Command: migrate diff

(No output - schemas match)
```

**If schemas still differ:**
- Review the error output
- Check what differences remain
- Run `db:prod:align:diff` again to see current state
- Investigate before re-applying

### Step 6: Clean Up

After successful alignment:

```bash
# Remove the generated SQL file
rm prisma_prod_align.sql

# Verify clean state
git status
```

## Safety Notes

### What is BLOCKED by prisma-guard.js

1. **`prisma db push` to prod** - ALWAYS blocked
   - Prod changes must go through diff → review → apply workflow

2. **`prisma migrate dev/deploy/resolve`** - Blocked in this mode
   - We are not using migrations, only db push

3. **`prisma db pull`** - ALWAYS blocked
   - Would overwrite `schema.prisma` (our source of truth)

4. **All other prisma commands to prod** - Blocked by default
   - Only `migrate diff` and `db execute` (controlled) are allowed

### What is ALLOWED

1. **`prisma migrate diff`** - Read-only, generates SQL
   - Safe to run against prod
   - Does NOT modify database

2. **`prisma db execute --file prisma_prod_align.sql`** - Controlled apply
   - ONLY when invoked via `npm run db:prod:align:apply`
   - ONLY for the exact file `prisma_prod_align.sql`
   - Guard enforces these restrictions

## Recovery Procedures

### If SQL Application Fails

1. **Review the error message**
   - SQL syntax error? Fix SQL and regenerate diff
   - Constraint violation? Data issue may need manual fix
   - Connection error? Check network/credentials

2. **Restore from Neon snapshot** (if needed)
   - Log into Neon console
   - Select the snapshot created in preconditions
   - Restore to `bhq_prod`
   - Wait for restore to complete

3. **Investigate root cause**
   - Why did the SQL fail?
   - Is the schema change valid?
   - Does prod data violate new constraints?

### If Verification Fails

If `db:prod:align:verify` shows differences after applying:

1. **Generate a new diff**
   ```bash
   npm run db:prod:align:diff
   ```

2. **Review what's still different**
   ```bash
   cat prisma_prod_align.sql
   ```

3. **Determine cause**
   - Did only part of the SQL apply?
   - Is there a race condition (unlikely)?
   - Was the wrong SQL applied?

4. **Fix and re-apply** if safe
   - Only if you understand the root cause
   - Only if you still have a valid snapshot

## Common Issues

### "BLOCKED: Operation attempted against PRODUCTION database"

**Cause:** Trying to run a command not in the allowlist

**Solution:** Use the npm scripts:
- `npm run db:prod:align:diff` for diff
- `npm run db:prod:align:apply` for apply
- `npm run db:prod:align:verify` for verify

### "DATABASE_URL is not set"

**Cause:** dotenv not loading environment file

**Solution:** Always use the npm scripts (they handle dotenv loading)

### "Prod still out of sync" after verify

**Cause:** SQL did not fully apply or schema.prisma changed after diff

**Solution:**
1. Re-run `npm run db:prod:align:diff` to see current state
2. Review the new diff
3. Apply if safe

## Related Documentation

- [DEV_DB_WORKFLOW_DB_PUSH_ONLY.md](./DEV_DB_WORKFLOW_DB_PUSH_ONLY.md) - Dev workflow in db push mode
- [MIGRATION_RECONCILIATION_CHECKLIST.md](../MIGRATION_RECONCILIATION_CHECKLIST.md) - Original migration context

## Alignment Report

After completing alignment, an alignment report should be created:

```bash
# This will be generated automatically or manually
docs/runbooks/PROD_SCHEMA_ALIGNMENT_REPORT.md
```

The report confirms:
- Date and time of alignment
- Git commit hash
- That dev was synced first
- That prod diff was generated, reviewed, and applied
- Final verification result
