# Party Step 5: Animals Migration

## Overview

This migration adds Party references to the Animals domain:
- `Animal.buyerPartyId` - unified buyer party reference
- `AnimalOwner.partyId` - unified co-owner party reference
- `AnimalOwnershipChange.fromOwnerParties` - party-based ownership snapshot (from)
- `AnimalOwnershipChange.toOwnerParties` - party-based ownership snapshot (to)

## Development Workflow

**IMPORTANT**: In development, we use `prisma db push` to apply schema changes, NOT `prisma migrate dev`.

### Why This Migration Must Be Idempotent

Since dev uses `db push` to apply schema changes from `schema.prisma`, the database may already contain the columns, indexes, and constraints defined in this migration **before** the migration is run via `prisma migrate deploy`.

This migration has been written to be **idempotent** - it can be safely run multiple times and will not fail if the objects already exist.

## If This Migration Failed

If you encountered an error like:

```
constraint "Animal_buyerPartyId_fkey" already exists
```

This means `db push` already created the constraint, and the migration tried to create it again.

### Resolution Steps

1. **Verify the database already has the expected schema objects:**

```sql
-- Check columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('Animal', 'AnimalOwner', 'AnimalOwnershipChange')
  AND column_name IN ('buyerPartyId', 'partyId', 'fromOwnerParties', 'toOwnerParties')
ORDER BY table_name, column_name;

-- Check foreign keys exist
SELECT conname, conrelid::regclass AS table_name
FROM pg_constraint
WHERE conname IN ('Animal_buyerPartyId_fkey', 'AnimalOwner_partyId_fkey')
ORDER BY conname;

-- Check indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname IN (
  'Animal_buyerPartyId_idx',
  'Animal_tenantId_buyerPartyId_idx',
  'AnimalOwner_partyId_idx',
  'AnimalOwner_animalId_partyId_idx'
)
ORDER BY indexname;
```

2. **Confirm the migration SQL is now idempotent** (it should be after the fix):
   - All `ADD COLUMN` uses `IF NOT EXISTS`
   - All `CREATE INDEX` uses `IF NOT EXISTS`
   - All foreign keys are wrapped in `DO $$ ... END $$` blocks that check `pg_constraint`

3. **Mark the migration as applied** (since the DB already has the schema):

```bash
npx prisma migrate resolve --applied "20251225_party_step5_animals_party"
```

4. **Verify migration status:**

```bash
npx prisma migrate status
```

You should see this migration marked as applied.

## Future Migrations

All future migrations should follow this pattern:
- Use `IF NOT EXISTS` for all `ADD COLUMN` and `CREATE INDEX` statements
- Wrap all `ADD CONSTRAINT` for foreign keys in idempotent DO blocks
- Never assume objects don't exist - always check first
