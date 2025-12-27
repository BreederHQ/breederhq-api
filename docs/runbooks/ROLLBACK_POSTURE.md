# Rollback Posture Documentation

## Overview

This document outlines the reality of rollback capabilities for the Party migration. It focuses on honest assessments and practical recovery strategies rather than false promises of instant rollback.

**Key Principle:** Party migration Phases 4-5 involve irreversible schema changes (column drops). True rollback is not possible without database restore. This document focuses on mitigation, recovery, and what can actually be done if problems occur.

## Irreversible Changes

The following changes from Phases 4-5 CANNOT be rolled back without database restore:

### Phase 4: Schema Drops
- Dropped columns:
  - `WaitlistEntry.contactId`, `WaitlistEntry.organizationId`
  - `AnimalOwner.contactId`, `AnimalOwner.organizationId`, `AnimalOwner.partyType`
  - `BreedingAttempt.studOwnerContactId`
  - `Offspring.buyerContactId`, `Offspring.buyerOrganizationId`
  - `Animal.buyerContactId`, `Animal.buyerOrganizationId`, `Animal.buyerPartyType`
  - `User.contactId`
  - `Invoice.contactId`, `Invoice.organizationId`
  - `ContractParty.contactId`, `ContractParty.organizationId`
  - `OffspringContract.buyerContactId`, `OffspringContract.buyerOrganizationId`
  - `Party.type` (renamed to `Party.kind`)

**Impact:** Once these columns are dropped, the data they contained is lost. Rolling back the application code alone will fail because the columns don't exist.

### Phase 5: Code Removal
- Removed all legacy identity compatibility code
- Removed mapping services (`waitlist-mapping.ts`, etc.)
- Changed API contracts to Party-native only

**Impact:** Legacy API contracts no longer supported. Frontend must use Party-native fields.

## Rollback Scenarios and Strategies

### Scenario 1: Critical Production Bug Discovered After Deployment

**Symptom:** Production errors, 500s on Party-touched endpoints, data integrity issues

**Reality:** Cannot rollback schema. Must fix forward.

**Mitigation Steps:**

1. **Immediate triage:**
   - Identify specific failing endpoints
   - Check error logs for FK violations, null constraint errors
   - Determine if issue is schema, data, or code

2. **Hotfix options:**

   **Option A: Data Issue (Preferred)**
   - If errors are due to null partyId fields:
     ```bash
     # Run backfill scripts immediately
     npm run validate:sql  # Identify gaps
     # Run specific backfill (see BACKFILL_RUNBOOK.md)
     ```
   - Validate and redeploy

   **Option B: Code Issue**
   - If errors are in new Party-native API code:
     - Deploy hotfix to affected route handlers
     - Add defensive null checks
     - Log errors for post-mortem
     - Keep schema as-is, fix code only

   **Option C: Feature Flag (If Implemented)**
   - Disable Party-first features
   - Fall back to read-only Party display
   - Maintain writes via partyId but reduce exposure

3. **Do NOT attempt schema rollback:**
   - Avoid ALTER TABLE ADD COLUMN to restore legacy fields
   - Avoid dual-write code reintroduction (causes drift)

### Scenario 2: Data Corruption or Integrity Loss

**Symptom:** Orphaned Party references, missing critical data, FK violations

**Reality:** Restore from backup may be necessary.

**Mitigation Steps:**

1. **Assess damage:**
   ```sql
   -- Count orphaned records
   SELECT COUNT(*) FROM "WaitlistEntry" we
   WHERE we."clientPartyId" IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = we."clientPartyId");
   ```

2. **If small number of orphans:**
   - Create missing Party records (see BACKFILL_RUNBOOK.md)
   - Validate and continue

3. **If widespread corruption:**
   - **Production:** Restore from most recent backup before migration
   - **Dev/Staging:** Rebuild from schema and re-migrate
   - **Important:** Restoration loses all data created after backup point

4. **Prevention for future:**
   - Implement backup schedule before migrations
   - Test migrations in staging with production-like data
   - Validate before proceeding to production

### Scenario 3: Need to Undo Migration Entirely

**Symptom:** Decision to abandon Party migration

**Reality:** Requires database restore to pre-Phase 4 state.

**Steps:**

1. **If pre-Phase 4 backup exists:**
   - Restore database from backup taken before Phase 4
   - Redeploy application code from commit before Phase 4
   - Accept data loss for any activity since backup
   - Resume operations on legacy identity model

2. **If no backup exists:**
   - Migration cannot be undone
   - Must fix forward or rebuild
   - Options:
     - Recreate legacy columns (but data is lost)
     - Continue with Party-only model and fix bugs
     - Rebuild database from external data sources

## Application-Level Rollback (Partial)

If schema changes are intact but new code has bugs, you CAN rollback application code.

### Conditions for App-Level Rollback
- Schema migrations (Phases 1-4) were successful
- Only Phase 5 code changes have issues
- Database state is valid (no orphans, no nulls)

### Steps for App-Level Rollback

1. **Identify rollback commit:**
   ```bash
   git log --oneline | grep "Phase 5"
   # Find commit immediately before Phase 5
   ```

2. **Deploy previous application code:**
   ```bash
   # Example: Revert to commit before Phase 5
   git checkout <commit-before-phase5>
   npm run build
   # Deploy to affected environment
   ```

3. **Important limitations:**
   - Cannot rollback to code that references dropped columns
   - Must rollback to commit after Phase 4 but before Phase 5
   - Frontend must also rollback if API contracts changed

4. **Validate after rollback:**
   ```bash
   npm run build  # Ensure code compiles
   npm run validate:sql  # Ensure schema still valid
   ```

## Production Deployment Safety Checklist

To minimize need for rollback:

### Pre-Deployment
- [ ] Full validation suite passes in staging
- [ ] API contract tests pass
- [ ] Database regression tests pass
- [ ] Frontend smoke tests pass (both repos)
- [ ] Backup taken and verified
- [ ] Rollback window identified (time to restore if needed)
- [ ] Team on standby for monitoring

### During Deployment
- [ ] Deploy during low-traffic window
- [ ] Monitor error rates in real-time
- [ ] Run post-deployment validation immediately
- [ ] Check key API endpoints manually

### Post-Deployment
- [ ] Run `npm run validate:sql` in production
- [ ] Monitor logs for FK violations and null errors
- [ ] Test critical user flows (waitlist, animal owners, breeding)
- [ ] Keep backup available for 7+ days

## Recovery Options Summary

| Issue | Can Rollback? | Recovery Strategy |
|-------|---------------|-------------------|
| Code bug in Phase 5 | Yes (app-level) | Revert to post-Phase 4 commit |
| Missing partyId data | No | Run backfill scripts |
| Orphaned Party refs | No | Create missing Party or nullify refs |
| Schema column dropped | No | Restore from backup or fix forward |
| API contract change | Partial | Rollback app + frontend together |
| Data corruption | No | Restore from backup (data loss) |
| Performance regression | Yes | Optimize queries, add indexes |

## When to Restore from Backup

Restore from backup only when:
- Data corruption is widespread and unfixable
- Critical business data is lost
- Orphaned references exceed safe repair threshold
- Team decides to abandon migration entirely

**Cost of restore:**
- All data created after backup is lost
- Downtime during restore process
- Must re-run migrations if resuming later

## Monitoring for Early Detection

Set up alerts to catch issues before rollback is needed:

### Critical Alerts
- FK violation errors on Party-touched tables
- Null constraint violations on partyId fields
- 500 error rate spike on waitlist, animals, breeding endpoints
- Slow query alerts for Party joins

### Warning Alerts
- Orphaned Party reference count > 0
- Missing partyId count > 0
- Party creation failures

## Post-Incident Process

If rollback or major recovery was needed:

1. **Post-mortem:**
   - Document what went wrong
   - Identify gaps in testing or validation
   - Update runbooks with lessons learned

2. **Improve safety:**
   - Add missing test coverage
   - Enhance validation scripts
   - Improve staging environment parity
   - Increase backup frequency

3. **Re-migration plan:**
   - If rolled back fully, plan re-migration with fixes
   - Test more thoroughly in staging
   - Consider phased production rollout

## Reality Check

**What rollback CAN do:**
- Revert application code changes (if schema intact)
- Restore database from backup (with data loss)
- Disable features via feature flags

**What rollback CANNOT do:**
- Undo dropped columns without restore
- Recover data lost in column drops
- Instantly revert production without downtime
- Avoid data loss if backup is old

**Best strategy:**
- Prevent need for rollback via thorough testing
- Have backups ready but plan to fix forward
- Use validation and monitoring to catch issues early

## Related Documentation

- [Post-Migration Validation Runbook](./POST_MIGRATION_VALIDATION.md)
- [Backfill Runbook](./BACKFILL_RUNBOOK.md)
- [Performance Monitoring Checklist](./PERFORMANCE_MONITORING.md)
- [Party Migration Baseline](../migrations/party/notes/PARTY_MIGRATION_BASELINE.md)

