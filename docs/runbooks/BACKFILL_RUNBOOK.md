# Backfill Runbook

## Purpose

Backfill scripts are operational recovery tools that populate partyId fields from legacy contactId/organizationId values or repair data integrity issues discovered during validation.

**Important:** Backfills are designed for operational recovery, not routine migration. In a properly executed migration, backfills should only be needed if:
- A migration step was skipped or failed
- Data was imported or created without proper partyId population
- Manual data corrections are required after discovering integrity issues

## Backfill Philosophy

- **Idempotent:** Safe to run multiple times
- **Non-destructive:** Never delete data
- **Conservative:** Only update records that need updating
- **Logged:** Output row counts for verification
- **Read-before-write:** Always query to understand scope before executing

## Prerequisites

- Database write access
- Environment configured (.env.dev, .env.studio, or .env.prod.migrate)
- Recent backup (especially for production)
- Validation baseline run first (see POST_MIGRATION_VALIDATION.md)

## Available Backfill Scripts

All backfill scripts are located in `prisma/sql/backfills/` directory.

### Core Party Backfills

#### 1. Waitlist Backfill
**File:** `backfill_waitlist_clientpartyid.sql`

**Purpose:** Populate WaitlistEntry.clientPartyId from legacy contactId/organizationId

**When to use:**
- WaitlistEntry records have null clientPartyId
- After importing legacy waitlist data
- After validation shows orphaned client references

**How to run:**
```bash
npx dotenv -e .env.dev -- psql $DATABASE_URL -f prisma/sql/backfills/backfill_waitlist_clientpartyid.sql
```

**Validation after:**
```sql
SELECT COUNT(*) FROM "WaitlistEntry" WHERE "clientPartyId" IS NULL;
-- Expected: 0
```

#### 2. Animal Owner Backfill
**File:** `backfill_animalowner_partyid.sql`

**Purpose:** Populate AnimalOwner.partyId from legacy contactId/organizationId

**When to use:**
- AnimalOwner records have null partyId
- After creating animal ownership records without partyId
- After validation shows orphaned owner references

**How to run:**
```bash
npx dotenv -e .env.dev -- psql $DATABASE_URL -f prisma/sql/backfills/backfill_animalowner_partyid.sql
```

**Validation after:**
```sql
SELECT COUNT(*) FROM "AnimalOwner" WHERE "partyId" IS NULL;
-- Expected: 0
```

#### 3. Breeding Attempt Backfill
**File:** `backfill_breedingattempt_studownerpartyid.sql`

**Purpose:** Populate BreedingAttempt.studOwnerPartyId from legacy studOwnerContactId

**When to use:**
- BreedingAttempt records have null studOwnerPartyId
- After importing breeding history
- After validation shows orphaned stud owner references

**How to run:**
```bash
npx dotenv -e .env.dev -- psql $DATABASE_URL -f prisma/sql/backfills/backfill_breedingattempt_studownerpartyid.sql
```

**Validation after:**
```sql
SELECT COUNT(*) FROM "BreedingAttempt"
WHERE "studOwnerPartyId" IS NULL AND "studId" IS NOT NULL;
-- Expected: 0 (null allowed only when no stud)
```

#### 4. Offspring Buyer Backfill
**File:** `backfill_offspring_buyerpartyid.sql`

**Purpose:** Populate Offspring.buyerPartyId from legacy buyerContactId/buyerOrganizationId

**When to use:**
- Offspring records have null buyerPartyId but should have buyers
- After buyer assignment without partyId
- After validation shows orphaned buyer references

**How to run:**
```bash
npx dotenv -e .env.dev -- psql $DATABASE_URL -f prisma/sql/backfills/backfill_offspring_buyerpartyid.sql
```

**Validation after:**
```sql
SELECT COUNT(*) FROM "Offspring"
WHERE "buyerPartyId" IS NULL AND "placementState" = 'WITH_BUYER';
-- Expected: 0 (buyers should have partyId)
```

#### 5. User Backfill
**File:** `backfill_user_partyid.sql`

**Purpose:** Populate User.partyId from legacy contactId

**When to use:**
- User records have null partyId
- After user creation without partyId
- After validation shows orphaned user-party links

**How to run:**
```bash
npx dotenv -e .env.dev -- psql $DATABASE_URL -f prisma/sql/backfills/backfill_user_partyid.sql
```

**Validation after:**
```sql
SELECT COUNT(*) FROM "User" WHERE "partyId" IS NULL;
-- Expected: 0
```

#### 6. Invoice Backfill
**File:** `backfill_invoice_clientpartyid.sql`

**Purpose:** Populate Invoice.clientPartyId from legacy contactId/organizationId

**When to use:**
- Invoice records have null clientPartyId
- After importing invoice history
- After validation shows orphaned invoice clients

**How to run:**
```bash
npx dotenv -e .env.dev -- psql $DATABASE_URL -f prisma/sql/backfills/backfill_invoice_clientpartyid.sql
```

**Validation after:**
```sql
SELECT COUNT(*) FROM "Invoice" WHERE "clientPartyId" IS NULL;
-- Expected: 0 or few (depending on business rules)
```

## Backfill Execution Workflow

### 1. Pre-Backfill Check

Before running any backfill:

```bash
# Run validation to identify scope
npm run validate:sql

# Or query manually to understand impact
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"WaitlistEntry\" WHERE \"clientPartyId\" IS NULL;"
```

### 2. Backup (Production Only)

For production environments, always take a snapshot before backfills:

```bash
# Example: Neon database snapshot
# Use your database provider's snapshot/backup mechanism
```

### 3. Execute Backfill

Run the specific backfill script:

```bash
npx dotenv -e .env.dev -- psql $DATABASE_URL -f prisma/sql/backfills/backfill_<entity>_<field>.sql
```

### 4. Validate Results

Run validation again to confirm success:

```bash
npm run validate:sql
```

Check specific entity validation:

```sql
-- Example: Verify WaitlistEntry
SELECT
  COUNT(*) as total,
  COUNT("clientPartyId") as with_party,
  COUNT(*) - COUNT("clientPartyId") as missing_party
FROM "WaitlistEntry";
```

### 5. Application Testing

After backfill, test affected API endpoints:

```bash
# Test waitlist endpoints
curl http://localhost:8080/api/v1/waitlist -H "x-tenant-id: 1"

# Test animal owners
curl http://localhost:8080/api/v1/animals/{id}/owners -H "x-tenant-id: 1"
```

## Idempotency Guarantee

All backfill scripts use patterns like:

```sql
UPDATE "WaitlistEntry"
SET "clientPartyId" = c."partyId"
FROM "Contact" c
WHERE "WaitlistEntry"."contactId" = c.id
  AND "WaitlistEntry"."clientPartyId" IS NULL  -- Only update if not set
  AND c."partyId" IS NOT NULL;                 -- Only if source exists
```

This ensures:
- No overwrites of existing correct data
- Safe to re-run if script is interrupted
- Only updates records that need updating

## Orphaned Data Resolution

If validation reveals orphaned records (partyId points to non-existent Party):

### Option 1: Create Missing Party
```sql
-- Example: Create orphaned Party record
INSERT INTO "Party" (id, "tenantId", kind, "displayName")
SELECT DISTINCT
  we."clientPartyId",
  we."tenantId",
  'CONTACT',  -- or 'ORGANIZATION'
  'Recovered Party'
FROM "WaitlistEntry" we
WHERE we."clientPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = we."clientPartyId");
```

### Option 2: Nullify Orphaned Reference
```sql
-- Example: Clear orphaned clientPartyId
UPDATE "WaitlistEntry"
SET "clientPartyId" = NULL
WHERE "clientPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = "clientPartyId");
```

**Decision criteria:**
- Option 1: Use when orphaned references are critical data
- Option 2: Use when orphaned references are artifacts of bad data

## Common Backfill Scenarios

### Scenario 1: Fresh Import Without Party IDs

**Symptom:** Bulk data imported, all partyId fields are null

**Solution:**
1. Run all relevant backfills in dependency order:
   - User backfill first (creates Party for users)
   - Waitlist backfill
   - Animal owner backfill
   - Breeding attempt backfill
   - Offspring backfill

2. Validate after each backfill

### Scenario 2: Partial Migration Failure

**Symptom:** Some tables migrated, others still have null partyId

**Solution:**
1. Identify affected tables via validation
2. Run specific backfill for each affected table
3. Validate constraints are satisfied

### Scenario 3: Production Data Drift

**Symptom:** Production has missing partyId after manual data entry

**Solution:**
1. Take production snapshot
2. Run backfill during maintenance window
3. Validate via POST_MIGRATION_VALIDATION.md
4. Monitor for errors post-backfill

## Production Backfill Checklist

Before running backfills in production:

- [ ] Validation shows specific missing data
- [ ] Backup/snapshot taken
- [ ] Maintenance window scheduled (if downtime needed)
- [ ] Dry-run executed in staging with production-like data
- [ ] Rollback plan documented
- [ ] Team notified of backfill window
- [ ] Monitoring alerts configured for errors
- [ ] Post-backfill validation plan ready

## Troubleshooting

### Backfill Updates Zero Rows

**Cause:** Data already backfilled or no legacy columns exist

**Action:** Verify legacy columns were populated before migration

### Backfill Fails with FK Violation

**Cause:** Attempting to set partyId that doesn't exist in Party table

**Action:** Run Party creation backfill first or investigate missing Party records

### Backfill Runs Slowly

**Cause:** Large dataset without indexes

**Action:** Run in batches or during off-peak hours

## Related Documentation

- [Post-Migration Validation Runbook](./POST_MIGRATION_VALIDATION.md)
- [Rollback Posture](./ROLLBACK_POSTURE.md)
- [Party Migration Baseline](../../PARTY_MIGRATION_BASELINE.md)
