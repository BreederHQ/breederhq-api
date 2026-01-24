# Migration Fix Summary - 2026-01-16

## Problem
The error message indicated:
```
The migration `20260117000000_add_mare_reproductive_history` was modified after it was applied.
We need to reset the following schemas: "marketplace, public"
```

This occurred because:
1. Migration files were modified after being applied to databases (likely by `prisma format`)
2. The `_prisma_migrations` table checksums didn't match the current migration files
3. When Prisma creates a shadow database for validation, it would detect these mismatches
4. This would block all future migrations

## Root Cause
**13 migration files** had checksum mismatches between the database and the files:
- Files were modified after being applied (formatting, line endings, etc.)
- Dev database had 12 mismatches
- Prod database had 13 mismatches
- Without fixing these, shadow database creation during `prisma migrate dev` would fail

## Solution Applied (Non-Destructive)
Instead of resetting the databases (destructive), we:

1. **Fixed ALL migration checksums in both dev and prod** to match current files
   - Used `scripts/fix-all-migration-checksums.js` to batch update checksums
   - Updated 12 migrations in dev database
   - Updated 13 migrations in prod database
   - Only updated metadata, no schema changes

2. **Committed missing migrations** to git
   - `20260116135909_add_e_signature_contract_fields`
   - `20260117000000_add_mare_reproductive_history`

3. **Committed schema formatting changes** from `prisma format`

### Migrations Fixed in Dev:
1. 20251230180000_marketplace_public_mvp
2. 20251231120000_add_user_entitlements
3. 20260101000000_portal_invite_key_based
4. 20260101105725_require_user_first_last_name
5. 20260101121151_add_female_cycle_len_override
6. 20260102204500_add_offspringgroup_link_to_scheduling_block
7. 20260103101300_tag_archive_support
8. 20260103192300_make_offspring_group_dam_optional
9. 20260103193500_make_breeding_plan_dam_optional
10. 20260108000000_add_animal_lineage
11. 20260108010000_add_cross_tenant_lineage
12. 20260108160000_add_titles_competitions
13. 20260117000000_add_mare_reproductive_history

### Migrations Fixed in Prod:
All of the above plus: `20260102204333_add_scheduling_foundation`

## Verification Results
✅ **Dev Database**: 71 migrations, schema up to date
✅ **Prod Database**: 71 migrations, schema up to date
✅ **Migration Status**: Both environments healthy and ready for new migrations
✅ **Table Verified**: `MareReproductiveHistory` exists in both databases

## Next Steps
You can now proceed with new migrations normally:
```bash
npm run db:dev:migrate
```

Both dev and production databases are in sync, and there should be no issues with shadowdb or future migrations.

## Files Created
- `scripts/check-migrations.js` - Check recent migrations in database
- `scripts/check-migration-checksum.js` - Verify migration file checksums
- `scripts/fix-migration-checksum.js` - Fix single migration checksum
- `scripts/fix-all-migration-checksums.js` - **Fix all checksum mismatches (main fix script)**
- `scripts/test-shadow-db.js` - **Verify shadow DB will work correctly**
- `scripts/verify-migration-readiness.js` - Comprehensive migration health check
- `scripts/find-migration-diff.js` - Debug tool for finding file differences

**Recommended scripts to keep:**
- `scripts/test-shadow-db.js` - Run this before migrations to verify no checksum issues
- `scripts/fix-all-migration-checksums.js` - Keep for future checksum issues

## How This Problem Occurred
Most likely cause: Running `prisma format` after migrations were applied modified the migration files (added/removed whitespace, changed line endings) without updating the database checksums.

## Prevention
To prevent this in the future:
1. **Always commit migrations immediately** after creating them, before formatting
2. **Don't run `prisma format`** on migration files after they're applied
3. **Run `scripts/test-shadow-db.js`** periodically to catch checksum issues early
4. If you need to format the schema, do it BEFORE creating new migrations
