# Prototype Database Workflow

## Overview

**Prototype mode** is a fast, safe development workflow that prioritizes rapid iteration over migration history. It uses `prisma db push` exclusively and treats the database as disposable.

## Why Prototype Mode?

### Problems with Traditional Migrations

The project accumulated migration debt:
- Incomplete baseline migration (only enums, missing tables)
- Non-idempotent schema changes
- Shadow database replay failures
- 60+ migrations with conflicts requiring extensive repair work
- Developer time spent fixing migrations instead of building features

### Prototype Mode Solution

- **No migrations generated** - schema.prisma is the single source of truth
- **Instant schema changes** - `db push` applies changes in seconds
- **No shadow database** - no validation overhead
- **Disposable database** - reset anytime without consequences
- **Protected production** - absolute guardrails prevent accidents

## How It Works

### Database Setup

Prototype mode uses a dedicated Neon database: `bhq_proto`

Configuration: `.env.dev` (local override)

To enable prototype mode:
1. Set `DATABASE_URL` in `.env.dev` to your bhq_proto connection string
2. Keep this change local - **never commit** the bhq_proto URL to `.env.dev`
3. `.env.dev` remains gitignored

Example (local only):
```env
DATABASE_URL="postgresql://bhq_proto_user:PASSWORD@ep-proto.region.aws.neon.tech/bhq_proto?sslmode=require"
```

### Core Workflow

#### 1. Make Schema Changes

Edit `prisma/schema.prisma` directly:

```prisma
model NewFeature {
  id        Int      @id @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
}
```

#### 2. Apply Changes

```bash
npm run db:proto:push
```

This:
- Analyzes schema.prisma
- Calculates required SQL changes
- Applies changes to bhq_proto
- Regenerates Prisma Client
- Takes ~3-5 seconds

#### 3. Iterate Freely

Make more changes, push again. Repeat as needed.

#### 4. Reset When Needed

```bash
npm run db:proto:reset
```

This:
- Drops all tables
- Recreates schema from scratch
- Useful when schema becomes messy or data needs clearing

## Safety Guardrails

### Non-Negotiable Rules Enforced by Guard

The `prisma-guard.js` script enforces **strict invariants** that cannot be bypassed:

#### 1. Production Database - Absolute Block
- **BLOCKED:** ANY operation against bhq_prod (including status checks)
- Production must only be accessed through controlled deployment pipelines
- No exceptions

#### 2. Prototype Mode - Strict Constraints
When using `db:proto:*` scripts:
- **BLOCKED:** All `prisma migrate` commands (dev, deploy, reset, etc.)
- **BLOCKED:** `prisma db pull` (would overwrite schema.prisma source of truth)
- **REQUIRED:** DATABASE_URL in `.env.dev` must point to bhq_proto
- **REQUIRED:** Use only `npm run db:proto:push` and `npm run db:proto:reset`

#### 3. Database-Script Matching
- **BLOCKED:** Running `db:proto:*` scripts against bhq_dev or bhq_prod
- **BLOCKED:** Running prototype scripts without DATABASE_URL set to bhq_proto
- Guard detects npm script name and validates DATABASE_URL matches

#### 4. Dotenv Enforcement
- **REQUIRED:** All commands must use `npx dotenv -e <env-file>`
- **BLOCKED:** Commands without DATABASE_URL set
- Prevents accidental runs against wrong database

### How Protection Works

```javascript
// Detects prototype scripts from npm script name
const isProtoScript = process.env.npm_lifecycle_event?.includes('proto');
const isPrototypeMode = envFileArg && envFileArg.includes('proto');

// ABSOLUTE BLOCK: Production
if (isProdDatabase) {
  exitWithError('NO operations allowed against bhq_prod');
}

// STRICT PROTOTYPE MODE CHECKS
if (isPrototypeMode) {
  // Block ALL migrate commands
  if (prismaCommand === 'migrate') {
    exitWithError('Prisma Migrate not allowed in prototype mode');
  }

  // Block db pull (corrupts source of truth)
  if (fullCommand === 'db pull') {
    exitWithError('db pull not allowed in prototype mode');
  }

  // Enforce bhq_proto ONLY
  if (!isProtoDatabase) {
    exitWithError('DATABASE_URL must contain "bhq_proto"');
  }
}

// INVERSE CHECK: Block db:proto:* against wrong databases
if (isProtoScript && !isProtoDatabase) {
  exitWithError('db:proto:* scripts require bhq_proto database');
}
```

### What Happens When Guard Blocks a Command

**Example 1: Attempting migrate in prototype mode**
```bash
$ npm run db:proto:push
# (but someone manually changed the command to "prisma migrate dev")

❌ PRISMA GUARD: OPERATION BLOCKED

BLOCKED: Prisma Migrate not allowed in prototype mode.

Prototype mode uses "prisma db push" exclusively.
Migrations are frozen. Schema changes go directly to schema.prisma.

Use:
  npm run db:proto:push   (apply schema changes)
  npm run db:proto:reset  (reset database)

See: PROTOTYPE_MODE.md
```

**Example 2: Wrong database configured**
```bash
$ npm run db:proto:push
# (but .env.dev has DATABASE_URL pointing to bhq_dev)

❌ PRISMA GUARD: OPERATION BLOCKED

BLOCKED: db:proto:* scripts require bhq_proto database.

Script: db:proto:push
Current database: bhq_dev

db:proto:push and db:proto:reset can ONLY be used with bhq_proto.
To use prototype mode:
  1. Set DATABASE_URL in .env.dev to your bhq_proto connection string
  2. Keep this change local (do not commit)
  3. Run npm run db:proto:push or db:proto:reset

See: PROTOTYPE_MODE.md
```

**What to Do:**
1. Read the error message carefully
2. Check you're using the correct npm script (`db:proto:push` or `db:proto:reset`)
3. Verify DATABASE_URL in `.env.dev` points to bhq_proto (locally, not committed)
4. Do NOT try to bypass the guard
5. See `PROTOTYPE_MODE.md` at repo root for rules

## Available Commands

### Prototype Mode Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run db:proto:push` | Apply schema changes | After editing schema.prisma |
| `npm run db:proto:reset` | Reset database | When starting fresh or data is messy |

### NOT Available in Prototype Mode

| Blocked Command | Why | Alternative |
|----------------|-----|-------------|
| `prisma migrate dev` | Generates migrations | Use `db:proto:push` |
| `prisma migrate deploy` | Applies migrations | Use `db:proto:push` |
| `db:dev:migrate` | Uses migration system | Use `db:proto:push` |

## Migration History Status

### Current State

- **Migrations:** FROZEN - do not add, edit, or delete
- **Source of Truth:** prisma/schema.prisma
- **Production Database:** bhq_prod - migration history intact but not used
- **Prototype Database:** bhq_proto - no migration tracking

### What Happens to Existing Migrations?

Existing migration files in `prisma/migrations/` are:
- **Preserved** - not deleted
- **Ignored** - not applied in prototype mode
- **Historical** - represent prod state at time of freeze

### Future Migration Plan

When prototype phase completes:

1. **Generate Clean Baseline**
   ```bash
   # After finalizing schema.prisma
   prisma migrate dev --name baseline_final --create-only
   ```

2. **Review and Deploy**
   ```bash
   # Review generated SQL
   cat prisma/migrations/TIMESTAMP_baseline_final/migration.sql

   # Apply to production (when ready)
   npm run db:prod:deploy
   ```

3. **Resume Normal Workflow**
   - New features use `prisma migrate dev`
   - Production uses `prisma migrate deploy`
   - Prototype mode can be deactivated

## Comparison: Prototype vs. Traditional

| Aspect | Prototype Mode | Traditional Migrations |
|--------|----------------|----------------------|
| **Speed** | 3-5 seconds | 30-60 seconds (with shadow DB) |
| **Schema Source** | schema.prisma only | schema.prisma + migrations |
| **History** | None (intentional) | Full history tracked |
| **Shadow DB** | Not used | Required for validation |
| **Rollback** | Reset database | Revert migrations |
| **Production** | Blocked completely | Careful deployment |
| **Best For** | Rapid prototyping | Stable production systems |

## Common Scenarios

### Adding a New Field

```prisma
model Animal {
  id        Int     @id @default(autoincrement())
  name      String
  species   String
  age       Int?    // ← New field
}
```

```bash
npm run db:proto:push
```

Prisma prompts:
```
⚠️  There will be data loss:
  • Added required column 'age' to Animal without default

? Do you want to continue? (y/N)
```

Type `y` if acceptable (prototype data is disposable).

### Renaming a Column

Prisma can't detect renames, treats as drop + add:

```prisma
model Animal {
  id           Int    @id @default(autoincrement())
  animalName   String  // renamed from 'name'
}
```

```bash
npm run db:proto:push
```

Result: Data in `name` column is lost. This is OK in prototype mode.

### Complex Refactoring

When making breaking changes, reset for clean slate:

```bash
npm run db:proto:reset
```

### Experimenting with Relations

Try different FK strategies without migration baggage:

```prisma
model Animal {
  id        Int       @id @default(autoincrement())
  owner     User?     @relation(fields: [ownerId], references: [id])
  ownerId   Int?

  // Try composite FK
  @@unique([id, ownerId])
}
```

```bash
npm run db:proto:push
```

Not happy? Change it again and push.

## Troubleshooting

### "Migration history is out of sync"

**Solution:** Ignore this message in prototype mode. We're not using migrations.

### "Shadow database is required"

**Solution:** This shouldn't happen with `db push`. If it does, ensure you're using `npm run db:proto:push`, not migrate commands.

### "Database is ahead of schema"

**Solution:**
```bash
npm run db:proto:reset
```
This resets database to match schema.prisma exactly.

### "Type 'X' already exists"

**Solution:**
```bash
npm run db:proto:reset
```
Clears any conflicting database objects.

## Transitioning Out of Prototype Mode

When ready for production deployment:

### Step 1: Finalize Schema

Review schema.prisma for:
- Unnecessary fields
- Missing indexes
- Suboptimal relations
- Naming consistency

### Step 2: Generate Clean Baseline

```bash
# Temporarily switch to dev environment
npx dotenv -e .env.dev.migrate -- \
  prisma migrate dev --create-only --name production_baseline
```

### Step 3: Review Generated SQL

```bash
cat prisma/migrations/*/migration.sql
```

Verify:
- All tables created correctly
- Indexes are appropriate
- Foreign keys are correct

### Step 4: Test on Dev Database

```bash
npx dotenv -e .env.dev.migrate -- \
  prisma migrate deploy
```

### Step 5: Deploy to Production

When confident:
```bash
npm run db:prod:deploy
```

### Step 6: Resume Normal Workflow

- Restore DATABASE_URL in `.env.dev` to bhq_dev connection
- Update README to indicate migrations are active
- Future changes use `prisma migrate dev`

## Best Practices

### DO

✅ Make frequent small schema changes
✅ Push changes immediately to test
✅ Reset database when it gets messy
✅ Use prototype mode for new features
✅ Experiment with schema designs freely

### DON'T

❌ Try to create migrations in prototype mode
❌ Commit bhq_proto DATABASE_URL to `.env.dev`
❌ Expect to preserve prototype database data
❌ Mix prototype mode with migration commands
❌ Edit existing migration files

## FAQ

**Q: Will we lose all migration history?**

A: No. Existing migrations are preserved in `prisma/migrations/`. We're just not using them during prototype mode.

**Q: Can I switch back to migrations anytime?**

A: Yes. Generate a clean baseline migration from schema.prisma and resume normal workflow.

**Q: What if I need to preserve data?**

A: Prototype mode is for rapid iteration. For data preservation, use dev environment with migrations, not prototype mode.

**Q: Is this recommended by Prisma?**

A: `prisma db push` is officially supported for prototyping and schema iteration. Prisma docs recommend it for early development phases.

**Q: What about team collaboration?**

A: Team members work in their own bhq_proto databases. Schema changes are shared via schema.prisma in git. No migration files to conflict.

---

**Created:** 2025-12-28
**Status:** Active
**Review Date:** When prototype phase completes
