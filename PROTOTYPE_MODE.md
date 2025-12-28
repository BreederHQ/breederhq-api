# PROTOTYPE MODE ACTIVE

**Database:** bhq_proto (disposable)
**Branch:** dev only
**Source of Truth:** prisma/schema.prisma

## Non-Negotiable Rules

1. **Use only these commands:**
   - `npm run db:proto:push` - apply schema changes
   - `npm run db:proto:reset` - reset database

2. **Never run:**
   - `prisma migrate` (any subcommand)
   - `prisma db push` (directly or via other scripts)
   - `prisma db pull`

3. **Never modify:**
   - Files under `prisma/migrations/` - migrations are FROZEN
   - Production or dev databases

4. **Guardrails enforce:**
   - Production (bhq_prod) is completely blocked
   - Dev (bhq_dev) is not used during prototype mode
   - Only bhq_proto database is allowed with db:proto:* scripts

**See:** [docs/runbooks/PROTOTYPE_DB_WORKFLOW.md](docs/runbooks/PROTOTYPE_DB_WORKFLOW.md)
