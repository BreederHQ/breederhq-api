# Marketplace Schema Refactor Migration

## Overview

This migration renames marketplace listing tables to follow the `mkt_listing_*` naming convention.

## Phases

### Phase 1: Status Enum Migration
- Migrates `MarketplaceListing.status` from `ListingStatus` to `MarketplaceListingStatus`
- Maps `ACTIVE` → `LIVE`

### Phase 2: Table Renames
| Current | New |
|---------|-----|
| `AnimalPublicListing` | `mkt_listing_individual_animal` |
| `AnimalProgram` | `mkt_listing_animal_program` |
| `BreedingProgram` | `mkt_listing_breeding_program` |
| `MarketplaceListing` | `mkt_listing_breeder_service` |

### Phase 3: Cleanup
- Delete `marketplace.service_listings` (unused duplicate)
- Remove `isListed`, `visibility` from `mkt_listing_individual_animal`
- Remove `status` from `OffspringGroup`
- Delete deprecated enums

## Execution Order

```bash
# Run in order
psql $DATABASE_URL -f phase1_status_enum.sql
psql $DATABASE_URL -f phase2_table_renames.sql
psql $DATABASE_URL -f phase3_cleanup.sql
```

## Post-Migration

After running SQL migrations:

1. Update Prisma schema model names
2. Run `npx prisma generate`
3. Update all backend code references
4. Update frontend API client types

## Rollback

**Phase 2 Rollback** (table renames):
```sql
ALTER TABLE "mkt_listing_individual_animal" RENAME TO "AnimalPublicListing";
ALTER TABLE "mkt_listing_animal_program" RENAME TO "AnimalProgram";
ALTER TABLE "mkt_listing_breeding_program" RENAME TO "BreedingProgram";
ALTER TABLE "mkt_listing_breeder_service" RENAME TO "MarketplaceListing";
```

**Phase 1 Rollback** requires recreating the old ListingStatus column.
