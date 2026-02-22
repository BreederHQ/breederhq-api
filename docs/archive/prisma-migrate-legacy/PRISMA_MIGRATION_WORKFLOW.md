# Prisma Migration Workflow Runbook

## Overview

This runbook describes the safe migration workflow for the breederhq-api project using Prisma v6 with Neon PostgreSQL databases.

## ⚠️ Known Issue: Incomplete Baseline Migration

**IMPORTANT**: The baseline migration `20251014074658_baseline` is incomplete and causes shadow DB validation to fail. See [MIGRATION_BASELINE_ISSUE.md](./MIGRATION_BASELINE_ISSUE.md) for details and workarounds.

**Current Status** (as of 2025-12-28):
- ✅ Dev database: Schema up to date
- ✅ Prod database: Schema up to date
- ❌ Shadow DB: Will fail on fresh replay

**Recommended workflow** until baseline is fixed:
1. Use `db push` for dev iterations
2. Create migrations with `--create-only` and manual SQL review
3. Apply using `migrate deploy` or mark as `--applied` after manual verification

## Database Environment Setup

### Development Environment
- **Primary DB**: `bhq_dev` (accessed via `bhq_migrator` role for migrations, `bhq_app` role for runtime)
- **Shadow DB**: `bhq_shadow_dev` (used by Prisma for migration validation)
- **Config File**: `.env.dev.migrate` (for migrations) and `.env.dev` (for runtime)

### Production Environment
- **Primary DB**: `bhq_prod` (accessed via `bhq_migrator` role)
- **Config File**: `.env.prod.migrate`
- **No Shadow DB**: Production uses `migrate deploy` which doesn't require shadow database

## Safety Guardrails

### Prisma Guard Script
All migration commands run through `scripts/prisma-guard.js` which:
- Prevents `migrate dev` from running against `bhq_prod`
- Prevents `db push` from running against `bhq_prod`
- Requires `DATABASE_URL` to be set via dotenv
- Validates environment before executing Prisma commands

### Environment File Discipline
- **Never** run Prisma commands without explicit env file specification
- Dev migrations: Always use `.env.dev.migrate`
- Prod migrations: Always use `.env.prod.migrate`
- Runtime app: Use `.env.dev` (uses `bhq_app` role, not migrator)

## Development Workflow

### 1. Create a New Migration (Create-Only)

Use this to design a migration without applying it:

```bash
npm run db:dev:migrate:createonly -- --name descriptive_migration_name
```

This will:
- Load `.env.dev.migrate` (pointing to `bhq_dev` with migrator role)
- Run prisma-guard safety checks
- Use `bhq_shadow_dev` to validate the migration
- Create migration files in `prisma/migrations/` without applying to dev

**Review the generated SQL before applying.**

### 2. Apply Migration to Dev Database

After reviewing the migration SQL:

```bash
npm run db:dev:migrate
```

This will:
- Load `.env.dev.migrate`
- Run prisma-guard safety checks
- Apply pending migrations to `bhq_dev`
- Update Prisma Client types

### 3. Check Migration Status

```bash
npm run db:dev:status
```

Shows which migrations have been applied to `bhq_dev`.

## Production Deployment Workflow

### 1. Check Production Migration Status

Before deploying:

```bash
npm run db:prod:status
```

This shows:
- Which migrations are applied in `bhq_prod`
- Which migrations are pending
- Any conflicts between local and remote state

### 2. Deploy Migrations to Production

```bash
npm run db:prod:deploy
```

This will:
- Load `.env.prod.migrate` (pointing to `bhq_prod` with migrator role)
- Run prisma-guard safety checks
- Apply pending migrations to `bhq_prod` in transaction order
- **Does NOT use shadow database** (deploy is non-interactive)

**CRITICAL**: Only run this from a clean git state with tested migrations.

### 3. Resolve Migration Conflicts (If Needed)

If migrations are out of sync:

```bash
npm run db:prod:resolve -- --applied <migration_name>
# or
npm run db:prod:resolve -- --rolled-back <migration_name>
```

Use this carefully and only when you're certain about the database state.

## Shadow Database

Prisma automatically creates and drops a shadow database during `migrate dev`. No manual configuration is needed.

### How It Works
1. Prisma uses `DATABASE_DIRECT_URL` (bypasses connection pooling)
2. Creates a temporary shadow database in the same Neon project
3. Replays all migrations to validate them
4. Drops the shadow database when done

### Requirements
- The `bhq_migrator` role must have `CREATE DATABASE` privileges (Neon provides this by default)
- Use `.env.v2.dev` which has `DATABASE_DIRECT_URL` configured

## Common Scenarios

### Scenario 1: Creating a New Feature with Schema Changes

```bash
# 1. Make changes to prisma/schema.prisma
# 2. Create and apply migration to dev
npm run db:v2:dev:migrate -- --name add_new_feature

# 3. Review the generated SQL in prisma/migrations/YYYYMMDDHHMMSS_add_new_feature/

# 4. Test your changes locally

# 5. Commit migration files to git
git add prisma/migrations/YYYYMMDDHHMMSS_add_new_feature/
git add prisma/schema.prisma
git commit -m "feat: add new feature schema"

# 6. After PR merge and deploy, apply to prod
npm run db:v2:prod:deploy
```

### Scenario 2: Migration Status is Out of Sync

If you see "migrations from database not found locally":

1. Check if someone else deployed migrations you don't have locally
2. Pull latest code: `git pull origin dev`
3. Check status again: `npm run db:v2:dev:status`
4. If still out of sync, use `db:v2:prod:baseline` carefully

### Scenario 3: Testing Migration Deployment Process

To test the deployment process safely:

```bash
# Check what would be deployed
npm run db:v2:prod:status

# If you want to test deploy behavior without running against prod,
# create a new Neon branch from prod and update .env.v2.prod temporarily
# (DO NOT commit this change)
```

## Troubleshooting

### Error: "DATABASE_URL is not set"
- Ensure you're using `npm run` commands, not calling `prisma` directly
- Check that the env file exists (`.env.v2.dev` or `.env.v2.prod`)

### Error: "OPERATION BLOCKED - attempted to run against PRODUCTION"
- **Good!** The guard is working.
- You tried to run `migrate dev` against production
- Use `npm run db:v2:dev:migrate` for development
- Use `npm run db:v2:prod:deploy` for production

### Error: "Migration failed to apply to shadow database"
- Usually means an existing migration has an issue
- Check the specific migration file mentioned in the error
- Prisma auto-creates shadow databases; ensure `bhq_migrator` has CREATE DATABASE privilege

### Error: "Relation already exists" in migration SQL
- Check if the migration is trying to create something that already exists
- Review the migration SQL for idempotency
- Consider using `IF NOT EXISTS` clauses for safe re-application

## Environment Variables Reference

### .env.v2.dev (development)
```bash
DATABASE_URL=postgresql://bhq_app:<password>@<host>-pooler/<database>?sslmode=require
DATABASE_DIRECT_URL=postgresql://bhq_migrator:<password>@<host>/<database>?sslmode=require
```

### .env.v2.prod (production)
```bash
DATABASE_URL=postgresql://bhq_app:<password>@<host>-pooler/<database>?sslmode=require
DATABASE_DIRECT_URL=postgresql://bhq_migrator:<password>@<host>/<database>?sslmode=require
```

## Security Notes

1. **Never commit actual `.env.*` files** - Only commit `.env.*.example` templates
2. **Rotate passwords immediately** if they are accidentally committed
3. **Use separate roles** - `bhq_migrator` for schema changes, `bhq_app` for runtime queries
4. **Audit migration files** before applying to production

## Quick Reference

| Task | Command |
|------|---------|
| Create migration (review first) | `npm run db:dev:migrate:createonly -- --name <name>` |
| Apply migration to dev | `npm run db:dev:migrate` |
| Check dev migration status | `npm run db:dev:status` |
| Deploy to production | `npm run db:prod:deploy` |
| Check prod migration status | `npm run db:prod:status` |
| Resolve migration conflict | `npm run db:prod:resolve -- <args>` |
| Open Prisma Studio | `npm run db:studio` |
| Regenerate Prisma Client | `npm run db:gen` |

---

**Last Updated**: 2025-12-28
**Prisma Version**: 6.17.1
**Author**: Migration workflow hardening initiative
