# Archived: Prisma Migrate Workflow Documentation

**Archived**: 2026-02-18
**Reason**: Project migrated from Prisma Migrate to dbmate on 2026-02-16
**Superseded By**: [ADR 0010: Adopt dbmate](../../docs/codebase/architecture-decisions/0010-DBMATE-MIGRATION-SYSTEM.md) (in breederhq repo)

---

These documents describe the old Prisma Migrate workflow and related operational procedures. They are preserved for historical reference only. **Do not follow these instructions for current development.**

## Current Migration Workflow

See the backend [CLAUDE.md](../../.claude/CLAUDE.md) for the current dbmate-based workflow:

```bash
npm run db:new <name>       # Create migration file
# Edit the SQL
npm run db:dev:sync         # Apply + sync Prisma schema + regenerate client
npm run db:prod:deploy      # Deploy to production
```

## Archived Files

| File | Original Purpose |
|------|-----------------|
| `PRISMA_MIGRATION_WORKFLOW.md` | Step-by-step Prisma Migrate commands |
| `MIGRATION_BASELINE_ISSUE.md` | Shadow database checksum failures |
| `NEON_V2_MIGRATE_SAFE_CUTOVER.md` | NeonDB v1 → v2 cutover procedure |
| `DB_WORKFLOW_LOCKOUT.md` | Why Prisma Migrate was locked down |
| `DEV_DB_WORKFLOW_DB_PUSH_ONLY.md` | Interim db push workflow |
| `PROD_SCHEMA_ALIGNMENT_DB_PUSH_ONLY.md` | Production alignment via db push |
| `PROD_SCHEMA_ALIGNMENT_REPORT.md` | Schema alignment report template |
| `DB_V1_TO_V2_DATA_MOVE_OPTION_B.md` | NeonDB v1 → v2 data migration |
| `ROLLBACK_POSTURE.md` | Prisma-era rollback procedures |
