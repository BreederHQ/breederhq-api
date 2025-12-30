# Database Workflow Lockout: v1 Read-Only, v2 Authoritative

This document explains the database access restrictions enforced after the v1 → v2 migration.

## Overview

**v1 databases are now READ-ONLY and accessible only via snapshot-based dump scripts.**

**v2 is the ONLY writable, migration-controlled database path.**

All schema changes, migrations, and data writes must go through v2 workflows.

---

## What Changed

### Before (v1 Workflow)
- `prisma db push` used for schema changes
- Direct SQL alignment for production
- Multiple database targets (bhq_dev, bhq_prod)

### After (v2 Workflow)
- `prisma migrate` used exclusively
- Controlled migrations via `migrate dev` and `migrate deploy`
- Single migration history across environments
- v1 databases locked to read-only

---

## Allowed Scripts

### v2 Migration Workflow (ALLOWED)

| Script | Purpose |
|--------|---------|
| `npm run db:v2:dev:status` | Check migration status on v2 dev |
| `npm run db:v2:dev:migrate` | Create and apply migrations on v2 dev |
| `npm run db:v2:dev:baseline` | Mark init migration as applied (after data import) |
| `npm run db:v2:dev:move` | One-command v1→v2 data migration for dev |
| `npm run db:v2:prod:status` | Check migration status on v2 prod |
| `npm run db:v2:prod:deploy` | Deploy migrations to v2 prod |
| `npm run db:v2:prod:baseline` | Mark init migration as applied (after data import) |
| `npm run db:v2:prod:move` | One-command v1→v2 data migration for prod |

### v1 Snapshot Dumps (ALLOWED - Read-Only)

| Script | Purpose |
|--------|---------|
| `npm run db:v2:dump:v1:dev:snapshot` | Dump data from v1 dev snapshot |
| `npm run db:v2:dump:v1:prod:snapshot` | Dump data from v1 prod snapshot |

### v2 Data Import (ALLOWED)

| Script | Purpose |
|--------|---------|
| `npm run db:v2:import:dev:data` | Import v1 data dump to v2 dev |
| `npm run db:v2:import:prod:data` | Import v1 data dump to v2 prod |
| `npm run db:v2:postimport:dev` | Run post-import fixes on v2 dev |
| `npm run db:v2:postimport:prod` | Run post-import fixes on v2 prod |
| `npm run db:v2:validate:dev` | Validate v2 dev data integrity |
| `npm run db:v2:validate:prod` | Validate v2 prod data integrity |
| `npm run db:v2:preflight:dev:move` | Preflight checks for dev migration |
| `npm run db:v2:preflight:prod:move` | Preflight checks for prod migration |

### Utility Scripts (ALLOWED)

| Script | Purpose |
|--------|---------|
| `npm run db:studio` | Open Prisma Studio (now targets v2 dev) |
| `npm run db:gen` | Generate Prisma client locally |
| `npm run prisma:validate` | Validate schema.prisma |

### Convenience Aliases (ALLOWED)

| Alias | Maps To |
|-------|---------|
| `npm run db:dev:status` | `npm run db:v2:dev:status` |
| `npm run db:prod:status` | `npm run db:v2:prod:status` |
| `npm run db:prod:deploy` | `npm run db:v2:prod:deploy` |

---

## Blocked Scripts

### Legacy v1 Scripts (BLOCKED)

These scripts will **fail immediately** with guidance:

| Script | Reason |
|--------|--------|
| `npm run db:dev:push` | v1 db push workflow disabled |
| `npm run db:dev:reset` | v1 db push workflow disabled |
| `npm run db:dev:sync` | v1 db push workflow disabled |
| `npm run db:dev:print-target` | v1 workflow disabled |
| `npm run db:prod:align:diff` | v1 SQL alignment disabled |
| `npm run db:prod:align:apply` | v1 SQL alignment disabled |
| `npm run db:prod:align:verify` | v1 SQL alignment disabled |

### Prisma Commands (BLOCKED Outside v2 Context)

| Command | Reason |
|---------|--------|
| `prisma db push` | Deprecated; use `prisma migrate` via v2 scripts |
| `prisma db pull` | schema.prisma is authoritative |
| `prisma migrate dev` | Must run via `npm run db:v2:dev:migrate` |
| `prisma migrate deploy` | Must run via `npm run db:v2:prod:deploy` |

---

## Example: Blocked Command Output

Running a blocked legacy command:

```bash
$ npm run db:dev:push

═══════════════════════════════════════════════════════════════════════
❌ BLOCKED: v1 Database Workflow Disabled
═══════════════════════════════════════════════════════════════════════

Script: db:dev:push

v1 databases are now READ-ONLY and accessible only via snapshot dumps.
All schema changes and migrations must use the v2 workflow.

GUIDANCE:
  Use instead:
    npm run db:v2:dev:migrate   # Create and apply migrations
    npm run db:v2:dev:status    # Check migration status

DOCUMENTATION:
  See: docs/runbooks/DB_WORKFLOW_LOCKOUT.md
  See: docs/runbooks/DB_V1_TO_V2_DATA_MOVE_OPTION_B.md

TO DUMP v1 DATA (read-only):
  npm run db:v2:dump:v1:dev:snapshot   # Dump v1 dev
  npm run db:v2:dump:v1:prod:snapshot  # Dump v1 prod

═══════════════════════════════════════════════════════════════════════
```

---

## Example: Allowed Command Output

Running an allowed v2 command:

```bash
$ npm run db:v2:dev:status

🔧 run-with-env: Loading environment from .env.v2.dev
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DATABASE_URL: [SET - REDACTED]
  DATABASE_DIRECT_URL: [SET - REDACTED]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Running: prisma migrate status --schema=prisma/schema.prisma

... (Prisma migrate status output)
```

---

## Validation

### Command That Must Fail

```bash
npm run db:dev:push
# Expected: Non-zero exit code, BLOCKED message
```

### Command That Must Succeed

```bash
npm run db:v2:dev:status
# Expected: Zero exit code, migration status displayed
```

---

## How to Safely Dump v1 Data

If you need data from v1 databases:

1. **Create a snapshot branch** in Neon from the v1 database
2. **Configure the snapshot URL** in `.env.v1.dev.snapshot` or `.env.v1.prod.snapshot`
3. **Run the dump script**:
   ```bash
   npm run db:v2:dump:v1:dev:snapshot   # For v1 dev
   npm run db:v2:dump:v1:prod:snapshot  # For v1 prod
   ```
4. **Output file**: `./tmp/v1_data.sql`

See [DB_V1_TO_V2_DATA_MOVE_OPTION_B.md](./DB_V1_TO_V2_DATA_MOVE_OPTION_B.md) for full data migration instructions.

---

## Guard Scripts

### prisma-guard-v2.js

Located at `scripts/prisma-guard-v2.js`, this guard:

- Blocks all writes to v1 databases
- Blocks `prisma db push` entirely
- Blocks `prisma migrate` outside v2 script context
- Ensures v2 scripts target v2 databases
- Prevents `migrate dev` against production

### v1-blocked.js

Located at `scripts/v1-blocked.js`, this script:

- Called by deprecated v1 npm scripts
- Prints clear error message with guidance
- Exits with non-zero status

---

## Migration Path

For engineers needing to make schema changes:

1. **Edit** `prisma/schema.prisma`
2. **Run** `npm run db:v2:dev:migrate` to create migration
3. **Test** locally with v2 dev database
4. **Commit** the migration file
5. **Deploy** to production with `npm run db:v2:prod:deploy`

---

## FAQ

### Q: I need to reset my dev database
**A:** Use Neon console to reset the v2 dev branch, or create a new branch from main.

### Q: I accidentally ran a v1 command
**A:** No harm done - it will fail immediately without touching any database.

### Q: I need to inspect v1 prod data
**A:** Create a snapshot branch in Neon, then use `npm run db:v2:dump:v1:prod:snapshot`.

### Q: How do I roll back a migration?
**A:** Create a new migration that reverses the changes. Never delete migration files.
