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

Configuration: `.env.proto`
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

### Production Protection

The `prisma-guard.js` script provides absolute protection:

1. **BLOCKED:** ANY operation against bhq_prod
2. **BLOCKED:** `prisma migrate` commands in prototype mode
3. **BLOCKED:** Using .env.proto with non-proto database

### How Protection Works

```javascript
// Detects prototype mode from .env.proto
const isPrototypeMode = envFileArg && envFileArg.includes('proto');

// Blocks ALL prod operations
if (isProdDatabase) {
  exitWithError('NO operations allowed against bhq_prod');
}

// Blocks migrations in prototype mode
if (isPrototypeMode && prismaCommand === 'migrate') {
  exitWithError('Prisma Migrate not allowed in prototype mode');
}
```

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

- Remove or archive .env.proto
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
❌ Use .env.proto with production database
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
