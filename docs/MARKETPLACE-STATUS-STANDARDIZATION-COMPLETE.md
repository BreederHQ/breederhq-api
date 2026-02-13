# Marketplace Listing Status Standardization - Complete

## Summary
Successfully standardized all marketplace listing status fields to use a unified enum: `MarketplaceListingStatus` with values: `DRAFT`, `LIVE`, `PAUSED`

## Changes Completed

### 1. Prisma Schema Updates ✅

#### Added New Enum
```prisma
enum MarketplaceListingStatus {
  DRAFT  // Not yet published
  LIVE   // Published and visible to public
  PAUSED // Temporarily hidden

  @@schema("public")
}
```

#### Updated Models (6 total)

1. **AnimalPublicListing** - Changed from `AnimalListingStatus` to `MarketplaceListingStatus`
   - Before: `status  AnimalListingStatus  @default(DRAFT)`
   - After: `status  MarketplaceListingStatus  @default(DRAFT)`

2. **AnimalProgram** - Replaced boolean `published` with `status` enum
   - Before: `published   Boolean   @default(false)`
   - After: `status      MarketplaceListingStatus  @default(DRAFT)`

3. **OffspringGroup** - Replaced boolean `published` with `status` enum
   - Before: `published     Boolean @default(false)`
   - After: `status        MarketplaceListingStatus @default(DRAFT)`

4. **Offspring** (individual offspring) - Replaced boolean `published` with `marketplaceStatus` enum
   - Before: `published     Boolean @default(false)`
   - After: `marketplaceStatus     MarketplaceListingStatus @default(DRAFT)`

5. **BreedingProgram** - Replaced boolean `listed` with `status` enum
   - Before: `listed             Boolean @default(false)`
   - After: `status             MarketplaceListingStatus @default(DRAFT)`

6. **MarketplaceServiceListing** - Changed from text to enum
   - Before: `status      String    @default("draft")`
   - After: `status      MarketplaceListingStatus @default(DRAFT)`

#### Deprecated Old Enum
```prisma
// DEPRECATED: Use MarketplaceListingStatus instead
enum AnimalListingStatus {
  DRAFT
  LIVE
  PAUSED

  @@schema("public")
}
```

### 2. API Endpoint Updates ✅

**File:** `src/routes/breeder-marketplace.ts`

**Dashboard Stats Endpoint** (line 796-839)
- Updated all four queries to use consistent `status: "LIVE"` condition
- Added comment explaining standardization

Before:
```typescript
// Inconsistent queries:
status: "LIVE"              // AnimalPublicListing
published: true             // OffspringGroup
listed: true                // BreedingProgram
status: "ACTIVE"            // MarketplaceServiceListing
```

After:
```typescript
// All queries now use:
status: "LIVE"              // AnimalPublicListing
status: "LIVE"              // OffspringGroup
status: "LIVE"              // BreedingProgram
status: "LIVE"              // MarketplaceServiceListing
```

## Database Migration Required ⚠️

You mentioned you'll handle the DB migration. Here's what needs to happen:

### Migration Steps

1. **Add Enum Type**
   ```sql
   CREATE TYPE "MarketplaceListingStatus" AS ENUM ('DRAFT', 'LIVE', 'PAUSED');
   ```

2. **Add `status` column to OffspringGroup**
   ```sql
   ALTER TABLE "OffspringGroup"
   ADD COLUMN "status" "MarketplaceListingStatus" DEFAULT 'DRAFT';

   -- Migrate data: published=true -> LIVE, published=false -> DRAFT
   UPDATE "OffspringGroup"
   SET "status" = 'LIVE'
   WHERE "published" = true;

   -- Make NOT NULL after data migration
   ALTER TABLE "OffspringGroup"
   ALTER COLUMN "status" SET NOT NULL;

   -- Drop old column
   ALTER TABLE "OffspringGroup"
   DROP COLUMN "published";
   ```

3. **Add `status` column to Animal Program**
   ```sql
   ALTER TABLE "AnimalProgram"
   ADD COLUMN "status" "MarketplaceListingStatus" DEFAULT 'DRAFT';

   UPDATE "AnimalProgram"
   SET "status" = 'LIVE'
   WHERE "published" = true;

   ALTER TABLE "AnimalProgram"
   ALTER COLUMN "status" SET NOT NULL;

   ALTER TABLE "AnimalProgram"
   DROP COLUMN "published";
   ```

4. **Add `marketplaceStatus` column to Offspring**
   ```sql
   ALTER TABLE "Offspring"
   ADD COLUMN "marketplaceStatus" "MarketplaceListingStatus" DEFAULT 'DRAFT';

   UPDATE "Offspring"
   SET "marketplaceStatus" = 'LIVE'
   WHERE "published" = true;

   ALTER TABLE "Offspring"
   ALTER COLUMN "marketplaceStatus" SET NOT NULL;

   ALTER TABLE "Offspring"
   DROP COLUMN "published";
   ```

5. **Add `status` column to BreedingProgram**
   ```sql
   ALTER TABLE "BreedingProgram"
   ADD COLUMN "status" "MarketplaceListingStatus" DEFAULT 'DRAFT';

   UPDATE "BreedingProgram"
   SET "status" = 'LIVE'
   WHERE "listed" = true;

   ALTER TABLE "BreedingProgram"
   ALTER COLUMN "status" SET NOT NULL;

   ALTER TABLE "BreedingProgram"
   DROP COLUMN "listed";
   ```

6. **Convert MarketplaceServiceListing.status to enum**
   ```sql
   -- Create temp column
   ALTER TABLE "marketplace"."MarketplaceServiceListing"
   ADD COLUMN "status_new" "MarketplaceListingStatus";

   -- Migrate data: "draft"->DRAFT, "active"->LIVE, "paused"->PAUSED
   UPDATE "marketplace"."MarketplaceServiceListing"
   SET "status_new" = CASE
     WHEN "status" = 'draft' THEN 'DRAFT'::"MarketplaceListingStatus"
     WHEN "status" = 'active' THEN 'LIVE'::"MarketplaceListingStatus"
     WHEN "status" = 'paused' THEN 'PAUSED'::"MarketplaceListingStatus"
     ELSE 'DRAFT'::"MarketplaceListingStatus"
   END;

   -- Drop old, rename new
   ALTER TABLE "marketplace"."MarketplaceServiceListing"
   DROP COLUMN "status";

   ALTER TABLE "marketplace"."MarketplaceServiceListing"
   RENAME COLUMN "status_new" TO "status";

   ALTER TABLE "marketplace"."MarketplaceServiceListing"
   ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"MarketplaceListingStatus";

   ALTER TABLE "marketplace"."MarketplaceServiceListing"
   ALTER COLUMN "status" SET NOT NULL;
   ```

7. **Convert AnimalPublicListing.status to new enum**
   ```sql
   -- Same process as MarketplaceServiceListing but simpler since values map 1:1
   ALTER TABLE "AnimalPublicListing"
   ADD COLUMN "status_new" "MarketplaceListingStatus";

   UPDATE "AnimalPublicListing"
   SET "status_new" = "status"::text::"MarketplaceListingStatus";

   ALTER TABLE "AnimalPublicListing"
   DROP COLUMN "status";

   ALTER TABLE "AnimalPublicListing"
   RENAME COLUMN "status_new" TO "status";

   ALTER TABLE "AnimalPublicListing"
   ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"MarketplaceListingStatus";

   ALTER TABLE "AnimalPublicListing"
   ALTER COLUMN "status" SET NOT NULL;
   ```

8. **Optionally drop old enum** (after confirming nothing else uses it)
   ```sql
   DROP TYPE "AnimalListingStatus";
   ```

## Testing Checklist

After migration:

- [ ] Run `npx prisma generate` to regenerate Prisma Client with new types
- [ ] Restart API server
- [ ] Test dashboard stats endpoint returns correct counts
- [ ] Verify all four dashboard cards show accurate numbers
- [ ] Test publishing/unpublishing listings in each category
- [ ] Verify marketplace public pages show only LIVE listings

## Benefits

1. **Consistency**: All marketplace listings use the same status vocabulary
2. **Type Safety**: TypeScript will enforce correct status values
3. **Maintainability**: Single enum to update if we add new statuses
4. **Clear Semantics**: `status: "LIVE"` is more clear than `published: true` or `listed: true`

## Status Values

- **DRAFT**: Listing created but not yet published (default for all new listings)
- **LIVE**: Published and visible to public on marketplace
- **PAUSED**: Temporarily hidden from marketplace (can be re-published without data loss)

## Next Steps

1. You create and run the database migration
2. Run `npx prisma generate`
3. Restart API server
4. Test dashboard and marketplace functionality
5. Monitor logs for any queries still using old field names
