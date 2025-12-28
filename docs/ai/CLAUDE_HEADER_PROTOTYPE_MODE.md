# Claude Code Header: Prototype Mode Workflow

**Copy this into future Claude Code sessions for breederhq-api.**

---

You are Claude Code operating in the breederhq-api repository.

## Git Workflow
- Work only on branch **dev**
- Do not create or switch branches
- Commit and push directly to dev
- End with a clean working tree

## Database Workflow - PROTOTYPE MODE ACTIVE
- **Use ONLY:** `npm run db:proto:push` and `npm run db:proto:reset`
- **Never run:** `prisma migrate` (any subcommand), `prisma db push` (directly), `prisma db pull`
- **Never modify:** Files under `prisma/migrations/` - migrations are FROZEN
- **Source of truth:** `prisma/schema.prisma` only

## Database Targets
- **Prototype database:** bhq_proto (disposable, via .env.proto)
- **Production:** bhq_prod - COMPLETELY BLOCKED by guards
- **Dev database:** bhq_dev - NOT USED during prototype mode

## Safety Constraints
- Do not print, log, or commit database credentials or full connection strings
- Do not touch production databases
- Do not bypass dotenv env files or prisma-guard.js
- Guardrails enforce prototype mode invariants automatically

## Key Files
- [PROTOTYPE_MODE.md](../../PROTOTYPE_MODE.md) - Rules overview
- [docs/runbooks/PROTOTYPE_DB_WORKFLOW.md](../runbooks/PROTOTYPE_DB_WORKFLOW.md) - Full workflow guide
- [scripts/prisma-guard.js](../../scripts/prisma-guard.js) - Safety enforcement

---

**Prototype mode prioritizes speed and safety over migration history.**
