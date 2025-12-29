# Prisma Migrations

## ⚠️ MIGRATIONS FROZEN DURING PROTOTYPE MODE

**Current Status: PROTOTYPE MODE ACTIVE**

During prototype mode:
- **Migrations are FROZEN** - do not add, edit, or delete migration files
- **schema.prisma is the ONLY source of truth**
- Schema changes are applied using `prisma db push` (NOT `prisma migrate`)
- The prototype database (bhq_proto) is considered DISPOSABLE
- Migration history is intentionally ignored for rapid iteration

### Prototype Mode Workflow

1. Make schema changes directly in [schema.prisma](../schema.prisma)
2. Apply changes instantly: `npm run db:proto:push`
3. Reset database when needed: `npm run db:proto:reset`

### Why Migrations Are Frozen

The migration history accumulated technical debt from:
- Incomplete baseline migrations
- Non-idempotent schema changes
- Shadow DB replay failures
- Schema evolution conflicts

Rather than continue fixing broken migrations while prototyping new features, we've frozen the migration history and switched to `prisma db push` for rapid development.

### When Migrations Will Resume

When prototype phase completes and we're ready for production deployment:
1. Generate a clean baseline migration from the final schema.prisma
2. Apply baseline to production using `prisma migrate deploy`
3. Resume normal migration workflow for future changes

### Migration Files

The existing migration files in this directory represent the production database state and should NOT be modified during prototype mode. They serve as historical record only.

---

**Last Updated:** 2025-12-28
**Mode:** Prototype
**Database:** bhq_proto (disposable)
