# Marketplace Listing Status Standardization

## Summary
Standardize all marketplace listing status fields to use a single enum: `MarketplaceListingStatus`

## Changes Required

### 1. Add New Enum (add after line 702 in schema.prisma)

```prisma
enum MarketplaceListingStatus {
  DRAFT    // Not yet published
  LIVE     // Published and visible to public
  PAUSED   // Temporarily hidden

  @@schema("public")
}
```

### 2. Update Models

#### AnimalPublicListing (line ~2568)
**Before:**
```prisma
status  AnimalListingStatus  @default(DRAFT)
```

**After:**
```prisma
status  MarketplaceListingStatus  @default(DRAFT)
```

#### OffspringGroup (line ~3858, 4112)
**Before:**
```prisma
published     Boolean @default(false)
```

**After:**
```prisma
status  MarketplaceListingStatus  @default(DRAFT)
```

**Note:** Remove the `published` field entirely - replace with status

#### BreedingProgram (line ~3151)
**Before:**
```prisma
listed             Boolean @default(false)
```

**After:**
```prisma
status  MarketplaceListingStatus  @default(DRAFT)
```

**Note:** Remove the `listed` field entirely - replace with status

#### MarketplaceServiceListing (line ~7498)
**Before:**
```prisma
status      String    @default("draft")
```

**After:**
```prisma
status      MarketplaceListingStatus    @default(DRAFT)
```

### 3. Deprecate Old Enum

```prisma
// DEPRECATED: Use MarketplaceListingStatus instead
enum AnimalListingStatus {
  DRAFT
  LIVE
  PAUSED

  @@schema("public")
}
```

## Migration SQL (you'll handle this)

The DB migration will need to:

1. Add new enum `MarketplaceListingStatus` with values: DRAFT, LIVE, PAUSED
2. Add `status` column to `OffspringGroup` (default DRAFT, derived from published: false->DRAFT, true->LIVE)
3. Add `status` column to `BreedingProgram` (default DRAFT, derived from listed: false->DRAFT, true->LIVE)
4. Change `MarketplaceServiceListing.status` from text to enum (convert: "draft"->DRAFT, "active"->LIVE, "paused"->PAUSED)
5. Change `AnimalPublicListing.status` from `AnimalListingStatus` to `MarketplaceListingStatus` (values map 1:1)
6. After data migration, drop old boolean fields: `OffspringGroup.published`, `BreedingProgram.listed`

## API Query Changes

All dashboard/listing queries change from:
- `status: "LIVE"` ✅ (already correct for AnimalPublicListing)
- `published: true` ❌ → `status: "LIVE"`
- `listed: true` ❌ → `status: "LIVE"`
- `status: "ACTIVE"` ❌ → `status: "LIVE"` or keep as text during migration

Final state: **All four models use `status: MarketplaceListingStatus` with values DRAFT/LIVE/PAUSED**
