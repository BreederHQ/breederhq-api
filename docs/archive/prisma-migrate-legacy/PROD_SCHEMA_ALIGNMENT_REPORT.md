# Production Schema Alignment Report

## Alignment Details

**Date:** [To be filled after alignment]
**Operator:** [To be filled after alignment]
**Git Commit:** [To be filled after alignment]

## Workflow Executed

### 1. Preconditions
- [ ] Fresh Neon snapshot of `bhq_prod` created
- [ ] Working on `dev` branch
- [ ] Clean working tree confirmed

### 2. Dev Sync
**Command:** `npm run db:dev:sync`

**Result:** [To be filled]
- [ ] Dev database successfully synced to schema.prisma
- [ ] Prisma client regenerated

### 3. Prod Diff Generation
**Command:** `npm run db:prod:align:diff`

**Result:** [To be filled]
- [ ] SQL diff successfully generated
- [ ] Wrote to: `prisma_prod_align.sql`

**Changes Identified:**
[List key changes from SQL file, e.g.:]
- Added column `users.email_verified`
- Created index on `sessions.user_id`
- Altered column type `invoices.amount`

### 4. SQL Review
**Reviewer:** [To be filled]

**Destructive Changes Identified:**
- [ ] None (safe to apply)
- [ ] DROP TABLE: [list tables]
- [ ] DROP COLUMN: [list columns]
- [ ] ALTER TYPE: [list columns]

**Review Decision:** [APPROVED / REJECTED / DEFERRED]

### 5. Prod Apply
**Command:** `npm run db:prod:align:apply`

**Result:** [To be filled]
- [ ] SQL successfully executed against `bhq_prod`
- [ ] No errors encountered

**Errors (if any):**
```
[Paste error output if errors occurred]
```

### 6. Verification
**Command:** `npm run db:prod:align:verify`

**Result:** [To be filled]
- [ ] Verification PASSED - prod and schema.prisma in sync
- [ ] Verification FAILED - differences remain

**Final Status:** [IN SYNC / OUT OF SYNC]

## Recovery Actions (if needed)

**Actions Taken:**
- [ ] No recovery needed
- [ ] Restored from Neon snapshot
- [ ] Re-ran alignment workflow
- [ ] Manual intervention required

**Details:**
[Describe any recovery actions taken]

## Post-Alignment Validation

**Production Health Checks:**
- [ ] Application started successfully
- [ ] Database connections healthy
- [ ] No constraint violations in logs
- [ ] User-facing features operational

## Notes

[Any additional notes, observations, or lessons learned]

## Snapshot Information

**Pre-Alignment Snapshot:**
- Snapshot Name: [e.g., pre-alignment-2025-12-28]
- Created: [timestamp]
- Status: [available / restored / deleted]

## Related Changes

**Schema Changes Applied:**
[List major schema changes that were aligned]

**Git Commits:**
[List relevant git commits that introduced these schema changes]

---

**Report Status:** DRAFT - To be completed after running alignment workflow
