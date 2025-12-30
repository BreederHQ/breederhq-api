# Neon v2 + Prisma Migrate Safe Cutover Runbook

This runbook describes the safe, staged migration from Neon v1 (db push workflow) to Neon v2 (Prisma Migrate workflow).

## Overview

**Goal**: Enable Prisma Migrate on Neon v2 without breaking v1 dev/prod environments.

**Strategy**:
1. Stage 1: Repo wiring only (inert until env files exist)
2. Stage 2: Create baseline migration on v2 dev (local only)
3. Stage 3: Apply migrations to v2 prod (manual, deliberate)
4. Stage 4: (Future) Point services at v2 after validation

---

## Prerequisites

### Neon v2 Project Setup

Before running any commands, ensure the Neon v2 project exists with:

- **Branches**: `production`, `development`
- **Roles**: `bhq_app` (runtime), `bhq_migrator` (migrations)

### Required SQL Extensions

Run these SQL commands in the Neon console on **BOTH** the v2 production and development branches:

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

**Important**: These must be created by a superuser role before migrations can run.

---

## Stage 2: Create Baseline Migration on v2 Dev

Run these commands locally after Stage 1 repo wiring is complete.

### Step 1: Create Environment File

```bash
# Copy the example file
cp .env.v2.dev.example .env.v2.dev
```

Edit `.env.v2.dev` and fill in the values from the Neon console:
- `DATABASE_URL`: Pooled connection with `bhq_app` role (for runtime)
- `DATABASE_DIRECT_URL`: Direct connection with `bhq_migrator` role (for migrations)

**Never commit `.env.v2.dev` to git.**

### Step 2: Validate Schema

```bash
npm run prisma:validate
```

This verifies the Prisma schema is syntactically correct.

### Step 3: Check Migration Status

```bash
npm run db:v2:dev:status
```

Expected output for a fresh database: "Database schema is not in sync with your migration history."

### Step 4: Create Baseline Migration

```bash
npm run db:v2:dev:migrate -- --name init
```

This creates the initial migration in `prisma/migrations/` and applies it to v2 dev.

### Step 5: Generate Prisma Client

```bash
npm run prisma:gen
```

### Step 6: Commit Migration Files

```bash
git add prisma/migrations
git commit -m "prisma: add baseline migration for v2"
git push origin dev
```

---

## Stage 3: Apply Migrations to v2 Production

**Only run after Stage 2 is complete and tested.**

### Step 1: Create Environment File

```bash
# Copy the example file
cp .env.v2.prod.example .env.v2.prod
```

Edit `.env.v2.prod` and fill in the values from the Neon console:
- `DATABASE_URL`: Pooled connection with `bhq_app` role
- `DATABASE_DIRECT_URL`: Direct connection with `bhq_migrator` role

**Never commit `.env.v2.prod` to git.**

### Step 2: Deploy Migrations

```bash
npm run db:v2:prod:deploy
```

This applies all migrations from `prisma/migrations/` to v2 production.

---

## Safety Guarantees

### What Cannot Break v1

1. **No environment variables changed**: v1 uses `DATABASE_URL` from `.env.dev.migrate` and `.env.prod.migrate`
2. **No scripts modified**: All existing `db:dev:*` and `db:prod:*` scripts unchanged
3. **New scripts are inert**: `db:v2:*` scripts only work with `.env.v2.dev` and `.env.v2.prod` files
4. **directUrl is optional**: Prisma ignores `directUrl` if the env var is empty/unset

### Guardrails

The updated `prisma-guard.js` enforces:

| Operation | v2 Dev | v2 Prod | v1 Dev | v1 Prod |
|-----------|--------|---------|--------|---------|
| `migrate dev` | ✅ | ❌ | ❌ | ❌ |
| `migrate status` | ✅ | ❌ | ❌ | ❌ |
| `migrate deploy` | ❌ | ✅ | ❌ | ❌ |
| `db push` | ❌ | ❌ | ✅ | ❌ |
| `db execute` (SQL file) | ❌ | ❌ | ❌ | ✅ (controlled) |

Additional protections:
- `NODE_ENV=production` blocks `migrate dev` and `db push`
- Production databases never accept destructive commands
- Environment files must match expected database types

---

## Environment Variables Reference

### v2 Development (.env.v2.dev)

| Variable | Role | Connection Type | Purpose |
|----------|------|-----------------|---------|
| `DATABASE_URL` | `bhq_app` | Pooled (PgBouncer) | Runtime connections |
| `DATABASE_DIRECT_URL` | `bhq_migrator` | Direct | Migration execution |

### v2 Production (.env.v2.prod)

| Variable | Role | Connection Type | Purpose |
|----------|------|-----------------|---------|
| `DATABASE_URL` | `bhq_app` | Pooled (PgBouncer) | Runtime connections |
| `DATABASE_DIRECT_URL` | `bhq_migrator` | Direct | Migration execution |

---

## Troubleshooting

### "Environment file not found"

Ensure you've copied the example file:
```bash
cp .env.v2.dev.example .env.v2.dev
# or
cp .env.v2.prod.example .env.v2.prod
```

### "Extension does not exist"

Run the extension SQL commands in the Neon console as a superuser before migrations.

### "Permission denied"

Ensure the `bhq_migrator` role has DDL permissions on the database.

### "Database is not in sync"

This is expected on first run. The baseline migration will sync the schema.

---

## Warning

**Do NOT point any running service at v2 until:**

1. v2 dev migrations succeed (`npm run db:v2:dev:migrate`)
2. v2 prod migrations succeed (`npm run db:v2:prod:deploy`)
3. Schema is verified to match v1 production
4. Application code is tested against v2

v1 remains the production database until explicit cutover.
