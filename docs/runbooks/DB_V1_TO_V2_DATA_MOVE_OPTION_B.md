# DB v1 → v2 Data Move: Option B (Data-Only Logical Copy)

This runbook covers the data-only logical copy approach for migrating data from v1 database snapshots to v2 databases.

## Overview

**Option B** uses `pg_dump --data-only` to export data from a v1 snapshot and `psql` to import it into v2. The v2 schema is authoritative and must already be applied before import.

**Key constraints:**
- Schema divergence, constraint violations, enum mismatches, or FK violations will cause import to fail
- If import fails, stop and report the exact error - do not implement fallback logic
- Never copy directly from live v1 prod - always use snapshot branches

**Neon compatibility:**
- We do NOT use `--disable-triggers` in pg_dump because Neon (managed Postgres) blocks `DISABLE TRIGGER ALL` for non-superusers
- Instead, the import process temporarily drops FK constraints, imports data, then restores FK constraints
- FK constraint definitions are backed up to `_bhq_fk_backup` table during import

## Prerequisites

### 1. Required Tools
- PostgreSQL client tools (`pg_dump`, `psql`) installed and in PATH
- Node.js 20.x
- npm dependencies installed (`npm install`)

### 2. Required Environment Files

Create these files by copying from `.example` templates:

| Environment | Source (v1 snapshot) | Target (v2) |
|-------------|---------------------|-------------|
| Dev | `.env.v1.dev.snapshot` | `.env.v2.dev` |
| Prod | `.env.v1.prod.snapshot` | `.env.v2.prod` |

### 3. Required Environment Variables

For **v1 snapshot** files:
```
V1_DEV_SNAPSHOT_DIRECT_URL=postgresql://...   # .env.v1.dev.snapshot
V1_PROD_SNAPSHOT_DIRECT_URL=postgresql://...  # .env.v1.prod.snapshot
```

For **v2 target** files:
```
DATABASE_URL=postgresql://...        # Pooled connection
DATABASE_DIRECT_URL=postgresql://... # Direct connection (required for import)
```

### 4. v2 Schema Applied

Before importing data, the v2 schema must be applied to the target database:

```bash
# For dev
npm run db:v2:dev:status
npm run db:v2:dev:migrate  # if migrations pending

# For prod
npm run db:v2:prod:status
npm run db:v2:prod:deploy  # if migrations pending
```

---

## Section A: v1 Dev Snapshot → v2 Dev

### Fast Path (One Command)

Use this if you want to run the full migration with a single command.

**Step 0: Setup environment file**

```bash
# Create the v1 snapshot env file from template
cp .env.v1.dev.snapshot.example .env.v1.dev.snapshot
```

Then edit `.env.v1.dev.snapshot` and set `V1_DEV_SNAPSHOT_DIRECT_URL`:

1. Go to [Neon Console](https://console.neon.tech)
2. Select your v1 dev project
3. Go to **Branches** → Create a snapshot branch (or use existing)
4. Copy the **DIRECT** connection string (port 5432, NOT the pooled one with port 6543)
5. Paste into `V1_DEV_SNAPSHOT_DIRECT_URL=postgresql://...`

**Step 1: Run the migration**

```bash
npm run db:v2:dev:move
```

This single command:
- Runs all preflight checks
- Dumps data from v1 dev snapshot
- Imports data to v2 dev
- Runs post-import fixes (sequences, cleanup)
- Validates data integrity

If any step fails, the command stops and shows what to fix.

---

### Verbose Path (Step-by-Step)

Use this for debugging or if you need to run individual steps.

#### Quick Setup

```bash
# 1. Create the v1 snapshot env file from template
cp .env.v1.dev.snapshot.example .env.v1.dev.snapshot

# 2. Edit and set V1_DEV_SNAPSHOT_DIRECT_URL to your v1 dev snapshot branch URL
#    (Create a snapshot branch in Neon first if you haven't already)

# 3. Run preflight to verify configuration
npm run db:v2:preflight:dev:move
```

#### Preconditions Checklist

- [ ] v1 dev snapshot branch exists in Neon
- [ ] `.env.v1.dev.snapshot` created with `V1_DEV_SNAPSHOT_DIRECT_URL`
- [ ] `.env.v2.dev` exists with `DATABASE_URL` and `DATABASE_DIRECT_URL`
- [ ] v2 dev schema is up to date (`npm run db:v2:dev:status` shows no pending migrations)
- [ ] Preflight passes: `npm run db:v2:preflight:dev:move`

#### Step 0: Run Preflight Check

```bash
npm run db:v2:preflight:dev:move
```

This verifies:
- On git branch `dev`
- Working tree is clean
- `.env.v1.dev.snapshot` exists with `V1_DEV_SNAPSHOT_DIRECT_URL` set
- `.env.v2.dev` exists with `DATABASE_DIRECT_URL` set
- `pg_dump` and `psql` are available

**Expected output (all checks pass):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Preflight: v1 Dev Snapshot → v2 Dev Data Migration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Git checks:
  ✓ On branch 'dev'
  ✓ Working tree clean

v1 Snapshot configuration:
  ✓ File exists: .env.v1.dev.snapshot
  ✓ V1_DEV_SNAPSHOT_DIRECT_URL is set

v2 Dev configuration:
  ✓ File exists: .env.v2.dev
  ✓ DATABASE_DIRECT_URL (v2 dev) is set

Tools:
  ✓ pg_dump available
  ✓ psql available

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ All preflight checks PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Step 1: Dump Data from v1 Dev Snapshot

```bash
npm run db:v2:dump:v1:dev:snapshot
```

This creates `./tmp/v1_data.sql` containing data-only dump.

> **Note:** The dump automatically excludes `_prisma_migrations` and `_prisma_migrations_lock` tables. v2 has its own migration history that should not be overwritten.

**Expected output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
run-dump.js: Dumping v1 dev snapshot data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment file: .env.v1.dev.snapshot
  V1_DEV_SNAPSHOT_DIRECT_URL: [SET - REDACTED]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Starting pg_dump (data-only)...
Output file: ./tmp/v1_data.sql

✓ pg_dump completed successfully
```

#### Step 2: Import Data to v2 Dev

```bash
npm run db:v2:import:dev:data
```

**Expected output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
run-import.js: Importing data to v2 dev
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment file: .env.v2.dev
  DATABASE_DIRECT_URL: [SET - REDACTED]
  Input file: ./tmp/v1_data.sql
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 0/4: Safety truncate _prisma_migrations (if exists)
✓ Truncate _prisma_migrations completed

Step 1/4: Drop FK constraints
✓ Drop FK constraints completed

Step 2/4: Import v1 data
✓ Import v1 data completed

Step 3/4: Restore FK constraints
✓ Restore FK constraints completed

✓ Import completed successfully
```

#### Step 3: Run Post-Import Fixes

```bash
npm run db:v2:postimport:dev
```

This drops the `_prisma_migrations` table (v1 artifact) and resets all sequences.

#### Step 4: Check Prisma Migration Status

```bash
npm run db:v2:dev:status
```

Should show:
- Database schema is up to date
- All migrations applied

If baseline migration needs to be marked:
```bash
npm run db:v2:dev:migrate
```

#### Step 5: Run Validation

```bash
npm run db:v2:validate:dev
```

**Expected output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
v1 → v2 Post-Import Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE ROW COUNTS:
─────────────────────────────────────────
  Animal                            XXX
  Party                             XXX
  ...

ORPHAN CHECKS (Party FK Integrity):
─────────────────────────────────────────
  ✓ WaitlistEntry.clientPartyId          0
  ✓ OffspringGroupBuyer.buyerPartyId     0
  ✓ AnimalOwner.partyId                  0
  ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT: PASS - All integrity checks passed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Section B: v1 Prod Snapshot → v2 Prod

### Preconditions Checklist

- [ ] v1 prod snapshot branch exists in Neon (created from prod at known point)
- [ ] `.env.v1.prod.snapshot` created with `V1_PROD_SNAPSHOT_DIRECT_URL`
- [ ] `.env.v2.prod` exists with `DATABASE_URL` and `DATABASE_DIRECT_URL`
- [ ] v2 prod schema is up to date (`npm run db:v2:prod:status`)
- [ ] Dev migration has been tested successfully first

### Step 1: Dump Data from v1 Prod Snapshot

```bash
npm run db:v2:dump:v1:prod:snapshot
```

This creates `./tmp/v1_data.sql` containing data-only dump.

### Step 2: Import Data to v2 Prod

```bash
npm run db:v2:import:prod:data
```

### Step 3: Run Post-Import Fixes

```bash
npm run db:v2:postimport:prod
```

### Step 4: Check Prisma Migration Status

```bash
npm run db:v2:prod:status
```

If deploy needed:
```bash
npm run db:v2:prod:deploy
```

### Step 5: Run Validation

```bash
npm run db:v2:validate:prod
```

All orphan counts must be 0 before proceeding.

---

## Failure Handling

### Import Fails with Constraint Violation

If `psql` import fails, you will see an error like:

```
ERROR:  insert or update on table "TableName" violates foreign key constraint "fk_name"
DETAIL:  Key (column_id)=(123) is not present in table "ReferencedTable".
```

**Action required:**
1. Note the exact table, constraint, and failing key
2. **STOP** - do not attempt workarounds
3. Report:
   - Exact failing constraint name
   - Table and column involved
   - Sample of failing data (first 5-10 rows)
4. A targeted backfill may be needed before retry

### Import Fails with Enum Mismatch

```
ERROR:  invalid input value for enum "EnumName": "value"
```

**Action required:**
1. Note the enum name and invalid value
2. Check if v1 has enum values not present in v2 schema
3. **STOP** - schema alignment needed

### Import Fails with Missing Table

```
ERROR:  relation "TableName" does not exist
```

**Action required:**
1. Verify v2 schema is applied: `npm run db:v2:dev:status`
2. If schema is correct, table may have been removed in v2
3. May need to exclude table from dump

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run db:v2:dev:move` | **One-command migration** (runs all steps below) |
| `npm run db:v2:preflight:dev:move` | Preflight checks for dev data migration |
| `npm run db:v2:dump:v1:dev:snapshot` | Dump data from v1 dev snapshot |
| `npm run db:v2:dump:v1:prod:snapshot` | Dump data from v1 prod snapshot |
| `npm run db:v2:import:dev:data` | Import data to v2 dev |
| `npm run db:v2:import:prod:data` | Import data to v2 prod |
| `npm run db:v2:postimport:dev` | Run post-import fixes on v2 dev |
| `npm run db:v2:postimport:prod` | Run post-import fixes on v2 prod |
| `npm run db:v2:validate:dev` | Validate v2 dev data integrity |
| `npm run db:v2:validate:prod` | Validate v2 prod data integrity |
| `npm run db:v2:dev:status` | Check v2 dev migration status |
| `npm run db:v2:prod:status` | Check v2 prod migration status |

---

## Files Reference

| File | Purpose |
|------|---------|
| `scripts/db/v2/dev-move-runbook.js` | One-command migration wrapper |
| `scripts/db/v2/preflight-dev-move.js` | Preflight checks for dev migration |
| `scripts/db/v2/dump-v1-data.sh` | Shell script for pg_dump |
| `scripts/db/v2/import-v1-data.sh` | Shell script for psql import |
| `scripts/db/v2/run-dump.js` | Node wrapper for dump (cross-platform) |
| `scripts/db/v2/run-import.js` | Node wrapper for import (cross-platform) |
| `scripts/db/v2/run-postimport.js` | Node wrapper for post-import fixes |
| `scripts/db/v2/validate-post-import.ts` | TypeScript validation harness |
| `prisma/sql/backfills/v2_pre_import_drop_fks.sql` | Drop FK constraints before import (Neon compat) |
| `prisma/sql/backfills/v2_post_import_restore_fks.sql` | Restore FK constraints after import |
| `prisma/sql/backfills/v2_post_import_fix.sql` | Post-import fixes (sequences, cleanup) |
| `prisma/sql/validation/v2_post_import_checks.sql` | Validation queries |
| `.env.v1.dev.snapshot.example` | Template for v1 dev snapshot connection |
| `.env.v1.prod.snapshot.example` | Template for v1 prod snapshot connection |
