# Party Step 5: Offspring and Waitlist Validation Queries

This document provides instructions for Aaron to manually validate the Party migration for Offspring and Waitlist buyer references.

## Overview

**What was migrated:**
- `WaitlistEntry.clientPartyId` - unified party reference for waitlist clients
- `OffspringGroupBuyer.buyerPartyId` - unified party reference for group buyers
- `Offspring.buyerPartyId` - unified party reference for offspring buyers

**Legacy columns preserved:**
- `WaitlistEntry`: `contactId`, `organizationId`
- `OffspringGroupBuyer`: `contactId`, `organizationId`
- `Offspring`: `buyerContactId`, `buyerOrganizationId`

## SQL Files Location

All SQL files are located in `breederhq-api/prisma/sql/`:

1. **Backfill**: `backfill_party_step5_offspring_waitlist.sql`
2. **Validation**: `validate_party_step5_offspring_waitlist.sql`

## Execution Order

### Step 1: Run Backfill SQL

The backfill script populates the new `partyId` columns from existing legacy Contact/Organization references.

**Using pgAdmin:**
1. Open pgAdmin and connect to your dev database
2. Open the SQL query tool
3. Load `breederhq-api/prisma/sql/backfill_party_step5_offspring_waitlist.sql`
4. Execute the script
5. Review the summary output at the end

**Using PowerShell:**
```powershell
$env:PGPASSWORD = "your-password"
psql -h localhost -U your-username -d breederhq_dev -f breederhq-api/prisma/sql/backfill_party_step5_offspring_waitlist.sql
```

**What it does:**
- Updates `WaitlistEntry.clientPartyId` from `Contact.partyId` (via `contactId`)
- Updates `WaitlistEntry.clientPartyId` from `Organization.partyId` (via `organizationId`)
- Updates `OffspringGroupBuyer.buyerPartyId` from `Contact.partyId` (via `contactId`)
- Updates `OffspringGroupBuyer.buyerPartyId` from `Organization.partyId` (via `organizationId`)
- Updates `Offspring.buyerPartyId` from `Contact.partyId` (via `buyerContactId`)
- Updates `Offspring.buyerPartyId` from `Organization.partyId` (via `buyerOrganizationId`)

**Safety:**
- Idempotent: only updates rows where `partyId IS NULL`
- Read-only for legacy columns: `contactId`/`organizationId` remain unchanged
- Reports conflicts where both `contactId` and `organizationId` are set

### Step 2: Run Validation SQL

The validation script checks schema correctness and data completeness.

**Using pgAdmin:**
1. Open the SQL query tool
2. Load `breederhq-api/prisma/sql/validate_party_step5_offspring_waitlist.sql`
3. Execute the script
4. Review all validation output sections

**Using PowerShell:**
```powershell
$env:PGPASSWORD = "your-password"
psql -h localhost -U your-username -d breederhq_dev -f breederhq-api/prisma/sql/validate_party_step5_offspring_waitlist.sql
```

**What it validates:**

1. **Schema Validation**
   - Columns exist: `clientPartyId`, `buyerPartyId`
   - Indexes exist on party columns
   - Foreign keys exist to `Party` table

2. **WaitlistEntry Completeness**
   - Total entries vs entries with `clientPartyId`
   - Percentage populated
   - Entries with `contactId` but no `clientPartyId` (should be 0 after backfill)
   - Entries with `organizationId` but no `clientPartyId` (should be 0 after backfill)
   - Conflict count (both `contactId` and `organizationId` set)
   - Orphan `clientPartyId` references (no matching Party)
   - Type consistency (partyId matches Contact or Organization type)

3. **OffspringGroupBuyer Completeness**
   - Same checks as WaitlistEntry but for buyer fields

4. **Offspring Completeness**
   - Same checks as above but for `buyerContactId`/`buyerOrganizationId`

## Expected Results

### After Backfill

**WaitlistEntry:**
- All entries with `contactId` should have `clientPartyId` populated (if Contact has partyId)
- All entries with `organizationId` should have `clientPartyId` populated (if Organization has partyId)
- Conflicts (both set) are reported but NOT modified

**OffspringGroupBuyer:**
- All buyers with `contactId` should have `buyerPartyId` populated
- All buyers with `organizationId` should have `buyerPartyId` populated

**Offspring:**
- All offspring with `buyerContactId` should have `buyerPartyId` populated
- All offspring with `buyerOrganizationId` should have `buyerPartyId` populated

### Acceptable Gaps

Some records may legitimately not have `partyId`:

1. **Legacy data**: Contacts or Organizations created before Party migration may not have `partyId` yet
2. **No buyer assigned**: Offspring or waitlist entries with no buyer will have NULL `partyId`
3. **Conflicts**: Rows with BOTH `contactId` and `organizationId` are not auto-resolved

## Troubleshooting

### Issue: Low completion percentage

**Possible causes:**
- Contacts/Organizations missing their own `partyId` (run Contact/Organization backfill first)
- Many records with no buyer assigned (expected)

**Resolution:**
- Check Contact/Organization Party migration status
- Review individual records with missing partyId

### Issue: Type mismatches

**Possible causes:**
- Data corruption
- Manual data edits bypassing application logic

**Resolution:**
- Review specific mismatched records
- Determine if `contactId`/`organizationId` or `partyId` is incorrect
- Manually correct the data

### Issue: Orphan partyId references

**Possible causes:**
- Party records deleted after partyId was set
- Data imported incorrectly

**Resolution:**
- Investigate why Party was deleted
- Either restore Party or clear orphan partyId

## Next Steps

After validation passes:

1. Review conflict counts - decide how to resolve rows with both contactId and organizationId
2. Test dual-write in dev environment (see TEST_PLAN_OFFSPRING_WAITLIST.md)
3. Plan production deployment with same backfill process

## Notes

- **Do not run backfill in production without testing in dev first**
- **Always backup database before running backfill scripts**
- Backfill is idempotent and safe to re-run if needed
