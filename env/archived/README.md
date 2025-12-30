# Archived Environment Files

These environment files are **DEPRECATED** and must not be used.

## Why Archived?

These files were used by the v1 database workflow which has been replaced by v2:

- `.env.dev.migrate` → Points to v1 bhq_dev, use `.env.v2.dev` instead
- `.env.prod.migrate` → Points to v1 bhq_prod, use `.env.v2.prod` instead
- `.env.studio` → Use `.env.v2.dev` with `npm run db:studio` instead

## Current Workflow

For v2 database operations, use:

| Purpose | Env File | Command |
|---------|----------|---------|
| Dev migrations | `.env.v2.dev` | `npm run db:v2:dev:migrate` |
| Dev status | `.env.v2.dev` | `npm run db:v2:dev:status` |
| Prod deploy | `.env.v2.prod` | `npm run db:v2:prod:deploy` |
| Prod status | `.env.v2.prod` | `npm run db:v2:prod:status` |
| Prisma Studio | `.env.v2.dev` | `npm run db:studio` |

## v1→v2 Data Migration

For migrating data from v1 snapshots, use:

| Purpose | Env File |
|---------|----------|
| v1 dev snapshot source | `.env.v1.dev.snapshot` |
| v1 prod snapshot source | `.env.v1.prod.snapshot` |
| v2 dev target | `.env.v2.dev` |
| v2 prod target | `.env.v2.prod` |

See `docs/runbooks/DB_V1_TO_V2_DATA_MOVE_OPTION_B.md` for full instructions.
