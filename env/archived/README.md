# Archived Environment Files

These environment files are **DEPRECATED** and must not be used.

## Contents

| File | Original Purpose | Status |
|------|------------------|--------|
| `.env.dev.migrate.example` | v1 dev migrate template | Deprecated |
| `.env.prod.migrate.example` | v1 prod migrate template | Deprecated |
| `.env.studio.example` | Prisma Studio template | Use `npm run db:studio` instead |

## Why Archived?

The v1→v2 database migration is complete. These files were used during the migration process and are no longer needed.

## Current Workflow

For database operations, use the npm scripts directly:

| Purpose | Command |
|---------|---------|
| Dev migrations | `npm run db:v2:dev:migrate` |
| Dev status | `npm run db:v2:dev:status` |
| Prod deploy | `npm run db:v2:prod:deploy` |
| Prod status | `npm run db:v2:prod:status` |
| Prisma Studio | `npm run db:studio` |

See `docs/runbooks/DB_WORKFLOW_LOCKOUT.md` for the authoritative workflow documentation.
