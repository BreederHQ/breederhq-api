# PROTOTYPE MODE ACTIVE

**Database:** bhq_proto (disposable)
**Branch:** dev only
**Source of Truth:** prisma/schema.prisma
**Environment File:** .env.dev (with local DATABASE_URL override)

## Non-Negotiable Rules

1. **Setup:**
   - Prototype scripts use `.env.dev`
   - To enable prototype mode locally: set `DATABASE_URL` in `.env.dev` to your bhq_proto connection string
   - **Never commit** this DATABASE_URL change - keep it local only
   - `.env.dev` remains gitignored / local-only

2. **Use only these commands:**
   - `npm run db:proto:push` - apply schema changes
   - `npm run db:proto:reset` - reset database

3. **Never run:**
   - `prisma migrate` (any subcommand)
   - `prisma db push` (directly or via other scripts)
   - `prisma db pull`

4. **Never modify:**
   - Files under `prisma/migrations/` - migrations are FROZEN
   - Production or dev databases

5. **Guardrails enforce:**
   - Production (bhq_prod) is completely blocked
   - Dev (bhq_dev) is blocked for prototype scripts
   - Only bhq_proto database is allowed with db:proto:* scripts

**See:** [docs/runbooks/PROTOTYPE_DB_WORKFLOW.md](docs/runbooks/PROTOTYPE_DB_WORKFLOW.md)
