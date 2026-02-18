# Dev Database Workflow - DB Push Only

**Status:** Active
**Mode:** DB push only, migrations paused
**Database Target:** bhq_dev
**Environment File:** .env.dev.migrate (local-only, gitignored)

---

## Current Workflow

Schema changes are applied using **prisma db push** exclusively. Migrations are frozen and not used during this phase.

### Core Principles

1. **Single source of truth:** `prisma/schema.prisma`
2. **Single database target:** `bhq_dev` (via .env.dev.migrate)
3. **Two commands only:**
   - `npm run db:dev:push` - apply schema changes
   - `npm run db:dev:reset` - force-reset database
4. **No migrations:** Do not run `prisma migrate` (any subcommand)
5. **No db pull:** Do not run `prisma db pull`

---

## Available Commands

### Primary Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run db:dev:push` | Apply schema changes to bhq_dev | After editing schema.prisma |
| `npm run db:dev:reset` | Force-reset bhq_dev and reapply schema | When database state is corrupted or needs clean slate |
| `npm run db:dev:print-target` | Validate DB target and print name | Verify configuration before operations |

### Supporting Commands

| Command | Purpose |
|---------|---------|
| `npm run db:gen` | Regenerate Prisma Client |
| `npm run db:studio` | Open Prisma Studio (uses .env.studio) |

---

## Workflow Steps

### 1. Edit Schema

Make changes directly to `prisma/schema.prisma`:

```prisma
model Animal {
  id        Int      @id @default(autoincrement())
  name      String
  species   String
  age       Int?     // ← New field
}
```

### 2. Apply Changes

```bash
npm run db:dev:push
```

This command:
- Analyzes schema.prisma
- Calculates required SQL changes
- Applies changes to bhq_dev
- Regenerates Prisma Client

### 3. Iterate

Make more changes, push again. Repeat as needed.

### 4. Reset if Needed

If database state becomes inconsistent:

```bash
npm run db:dev:reset
```

This drops all tables and recreates schema from scratch.

---

## Safety Guardrails

### Enforced by prisma-guard.js

1. **Production Database - Absolute Block**
   - ANY operation against bhq_prod is blocked
   - No exceptions

2. **Migrate Commands - Blocked**
   - ALL `prisma migrate` commands are blocked during this phase
   - Use `npm run db:dev:push` instead

3. **DB Pull - Blocked**
   - `prisma db pull` is blocked
   - Schema.prisma is the source of truth, not the database

4. **Database Target Enforcement**
   - `db:dev:*` scripts MUST target bhq_dev
   - If DATABASE_URL points elsewhere, operation is blocked

5. **Explicit Env Loading Required**
   - All commands use `dotenv -e .env.dev.migrate --override`
   - If DATABASE_URL is not set, operation is blocked

### Example Block Messages

**Attempting migrate:**
```
❌ PRISMA GUARD: OPERATION BLOCKED

BLOCKED: Prisma Migrate not allowed during db push workflow phase.

Migrations are paused. Use "prisma db push" exclusively.
Schema changes go directly to schema.prisma.

Use:
  npm run db:dev:push   (apply schema changes)
  npm run db:dev:reset  (reset database)
```

**Wrong database target:**
```
❌ PRISMA GUARD: OPERATION BLOCKED

BLOCKED: db:dev:* scripts require bhq_dev database.

Script: db:dev:push
Current database: bhq_prod

db:dev:push and db:dev:reset can ONLY be used with bhq_dev.
Update DATABASE_URL in .env.dev.migrate to point to bhq_dev.
```

---

## Non-Negotiables

### DO NOT:

❌ Run `prisma migrate` (any subcommand)
❌ Run `prisma db pull`
❌ Modify files under `prisma/migrations/` - migrations are FROZEN
❌ Point any commands at bhq_prod
❌ Commit DATABASE_URL credentials to .env.dev.migrate

### DO:

✅ Use `npm run db:dev:push` for schema changes
✅ Use `npm run db:dev:reset` when database needs clean slate
✅ Edit `prisma/schema.prisma` directly
✅ Keep .env.dev.migrate local-only (gitignored)
✅ Target bhq_dev only

---

## Migrations Status

- **Migrations directory:** `prisma/migrations/` - FROZEN, do not modify
- **Migration history:** Preserved but not used during this phase
- **Production database:** bhq_prod - migration history intact, fully protected

---

## Exit Plan (Future)

When schema stabilizes and migrations need to be re-enabled:

1. **Generate clean baseline migration** from finalized schema.prisma
2. **Review generated SQL** for correctness
3. **Test on bhq_dev** to validate
4. **Deploy to production** via controlled pipeline
5. **Resume normal migrate workflow** for future changes

This is a high-level outline - detailed migration re-enablement steps will be documented when needed.

---

## Environment File

`.env.dev.migrate` contains:

```env
DATABASE_URL="postgresql://user:password@host/bhq_dev?sslmode=require"
```

- **Gitignored:** Yes
- **Local-only:** Never commit credentials
- **Target database:** Must point to bhq_dev

---

## Troubleshooting

### "DATABASE_URL is not set"

**Cause:** Environment file not loaded
**Solution:** Ensure using `npm run` scripts, not direct prisma commands

### "Database is ahead of schema"

**Cause:** Manual database changes or schema rollback
**Solution:** `npm run db:dev:reset`

### "Migration history out of sync"

**Cause:** Expected during db push workflow
**Solution:** Ignore - migrations are not used in this phase

### "Type 'X' already exists"

**Cause:** Database has orphaned objects
**Solution:** `npm run db:dev:reset`

---

**Created:** 2025-12-28
**Phase:** Dev iteration using db push only
**Next Review:** When schema stabilizes for migration re-enablement
