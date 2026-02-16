# Table Naming Standardization Migration Plan

**Date**: 2026-02-10
**Status**: Planning
**Priority**: Medium (technical debt cleanup)

---

## Overview

This migration standardizes table names in the marketplace schema to follow the `mkt_listing_*` snake_case convention consistently.

## Current State vs Target State

| Prisma Model | Current Table Name | Target Table Name | Schema |
|--------------|-------------------|-------------------|--------|
| `MktListingIndividualAnimal` | `direct_animal_listing` | `mkt_listing_individual_animal` | public |
| `MktListingBreederService` | `MktListingService` (PascalCase!) | `mkt_listing_breeder_service` | marketplace |

## Additional Cleanup (Dead Code)

| Model | Table | Status | Action |
|-------|-------|--------|--------|
| `ServiceProviderProfile` | `ServiceProviderProfile` (no @@map) | Legacy/unused | Remove model |
| `MktBreedingServiceAnimal` | `mkt_breeding_service_animal` | Dead code | Remove model |

---

## Pre-Migration Verification

### 1. Confirm No Direct Table References

Verified: No application code references these table names directly.

```bash
# Check for raw SQL referencing old names
grep -r "direct_animal_listing\|MktListingService" src/
# Result: No matches
```

### 2. Confirm No Active Foreign Keys from Other Tables

Need to verify foreign key relationships before renaming:

- `MktListingIndividualAnimal`: Check for FK references
- `MktListingBreederService`: Used by `MarketplaceTransaction`, `MarketplaceMessageThread`, `MarketplaceServiceTagAssignment`

---

## Migration Steps

### Step 1: Schema Changes

Update `prisma/schema.prisma`:

```prisma
// BEFORE
model MktListingIndividualAnimal {
  // ...
  @@map("direct_animal_listing")
  @@schema("public")
}

// AFTER
model MktListingIndividualAnimal {
  // ...
  @@map("mkt_listing_individual_animal")
  @@schema("public")
}
```

```prisma
// BEFORE
model MktListingBreederService {
  // ...
  @@map("MktListingService")
  @@schema("marketplace")
}

// AFTER
model MktListingBreederService {
  // ...
  @@map("mkt_listing_breeder_service")
  @@schema("marketplace")
}
```

### Step 2: Generate Migration

**IMPORTANT**: Run this from the breederhq-api directory with proper environment setup.

```bash
cd breederhq-api
npx prisma migrate dev --name standardize_mkt_listing_table_names --create-only
```

**Note**: If Prisma generates a DROP/CREATE migration instead of RENAME, you must manually edit the migration file to use ALTER TABLE RENAME to preserve data.

### Step 3: Review Generated Migration

The migration should contain:

```sql
-- Rename direct_animal_listing to mkt_listing_individual_animal
ALTER TABLE "public"."direct_animal_listing" RENAME TO "mkt_listing_individual_animal";

-- Rename MktListingService to mkt_listing_breeder_service
ALTER TABLE "marketplace"."MktListingService" RENAME TO "mkt_listing_breeder_service";
```

**Note**: Prisma may generate DROP/CREATE instead of RENAME. If so, manually edit to use RENAME for data preservation.

### Step 4: Apply Migration

```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy
```

---

## Dead Code Removal (Separate Migration)

### ServiceProviderProfile Removal

1. **Verify no usage**: Search API code for `serviceProviderProfile`
2. **Check for data**: `SELECT COUNT(*) FROM "ServiceProviderProfile"`
3. **If data exists**: Migrate to `MarketplaceProvider` or confirm data is obsolete
4. **Remove model**: Delete from schema and generate migration

### MktBreedingServiceAnimal Removal

1. **Verify no usage**: Already confirmed - no API references
2. **Check for data**: `SELECT COUNT(*) FROM mkt_breeding_service_animal`
3. **If empty**: Safe to drop
4. **If has data**: Determine if needed for future feature or obsolete

---

## Rollback Plan

If issues arise after deployment:

```sql
-- Rollback table renames
ALTER TABLE "public"."mkt_listing_individual_animal" RENAME TO "direct_animal_listing";
ALTER TABLE "marketplace"."mkt_listing_breeder_service" RENAME TO "MktListingService";
```

---

## Testing Checklist

- [ ] Run migration in dev environment
- [ ] Verify all 5 commerce pages still work:
  - [ ] `/commerce/manage/individual-animals`
  - [ ] `/commerce/manage/animal-programs`
  - [ ] `/commerce/manage/breeding-programs`
  - [ ] `/commerce/manage/breeding-services`
  - [ ] `/commerce/manage/services`
- [ ] Verify provider portal still works:
  - [ ] `marketplace.breederhq.test/provider`
- [ ] Verify public marketplace browsing works
- [ ] Run API tests
- [ ] Check for any console errors

---

## Deployment Notes

1. This is a **backwards-compatible** change at the database level (just a rename)
2. No application code changes required (Prisma handles mapping)
3. Can be deployed during normal maintenance window
4. Recommended: Deploy API first, then run migration

---

## Related Documentation

- [ADR 0005 - Vertical Feature Slicing](../codebase/architecture-decisions/0005-VERTICAL-FEATURE-SLICING.md)
- [Prisma Schema](../prisma/schema.prisma)
