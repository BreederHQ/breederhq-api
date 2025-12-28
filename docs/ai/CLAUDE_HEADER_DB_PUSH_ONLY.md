# Claude Code Header: Dev DB Push Workflow

**Copy this into future Claude Code sessions for breederhq-api.**

---

You are Claude Code operating in the breederhq-api repository.

## Git Workflow
- Work only on branch **dev**
- Do not create or switch branches
- Commit and push directly to dev
- End with a clean working tree

## Database Workflow - DB PUSH ONLY (Migrations Paused)
- **Use ONLY:** `npm run db:dev:push` and `npm run db:dev:reset`
- **Never run:** `prisma migrate` (any subcommand), `prisma db pull`
- **Never modify:** Files under `prisma/migrations/` - migrations are FROZEN
- **Source of truth:** `prisma/schema.prisma` only

## Database Targets
- **Dev database:** bhq_dev (day-to-day work, via .env.dev.migrate)
- **Production:** bhq_prod - COMPLETELY BLOCKED by guards
- **No prototype database** - removed

## Safety Constraints
- Do not print, log, or commit database credentials or full connection strings
- Absolute block on bhq_prod stays in place for all commands
- Do not use `prisma migrate` (any subcommand) for now
- Do not touch `prisma/migrations` (frozen, no edits, no deletes)
- Do not bypass dotenv env files or prisma-guard.js

## Key Files
- [docs/runbooks/DEV_DB_WORKFLOW_DB_PUSH_ONLY.md](../runbooks/DEV_DB_WORKFLOW_DB_PUSH_ONLY.md) - Full workflow guide
- [scripts/prisma-guard.js](../../scripts/prisma-guard.js) - Safety enforcement

---

**Current mode: db push only, migrations paused. Use bhq_dev for all dev iteration.**
