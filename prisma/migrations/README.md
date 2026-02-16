# Prisma Migrations (Archived)

**Status: ARCHIVED as of 2026-02-16**

These migrations were managed by Prisma Migrate and represent the schema history from
`20251230112400_init` through `20260216133849_add_marketplace_mobile_refresh_tokens`
(174 migrations total).

## Why archived?

The project has migrated to **dbmate** for SQL schema migrations. Prisma is now used
exclusively as an ORM (query builder / client generation), not for migrations.

## New migration workflow

All new migrations live in `db/migrations/` as plain SQL files managed by dbmate.

```bash
# Create a new migration
npm run db:new <name>

# Apply pending migrations (dev)
npm run db:dev:up

# Apply pending migrations (prod)
npm run db:prod:deploy

# Full sync: apply + pull schema + regenerate client
npm run db:dev:sync

# Rollback last migration
npm run db:dev:down

# Check migration status
npm run db:dev:status
```

## Can I delete this directory?

The `_prisma_migrations` table still exists in the database but is no longer used.
This directory is kept for historical reference. You can safely delete it — the
git history preserves everything.

## DO NOT run Prisma Migrate commands

The following commands are no longer valid:
- `prisma migrate dev` — use `npm run db:new` + `npm run db:dev:up`
- `prisma migrate deploy` — use `npm run db:prod:deploy`
- `prisma migrate reset` — use `npm run db:dev:reset`
