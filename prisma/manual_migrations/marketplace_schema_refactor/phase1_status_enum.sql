-- Phase 1: Status Enum Migration
-- Migrate MarketplaceListing from ListingStatus to MarketplaceListingStatus
--
-- Current: ListingStatus (DRAFT, PENDING_REVIEW, ACTIVE, PAUSED, EXPIRED, REMOVED)
-- Target: MarketplaceListingStatus (DRAFT, LIVE, PAUSED)

-- Step 1: Add new status column with MarketplaceListingStatus type
ALTER TABLE "MarketplaceListing"
ADD COLUMN "new_status" "MarketplaceListingStatus" DEFAULT 'DRAFT';

-- Step 2: Migrate data from old status to new status
UPDATE "MarketplaceListing" SET "new_status" = 'DRAFT' WHERE status = 'DRAFT';
UPDATE "MarketplaceListing" SET "new_status" = 'LIVE' WHERE status = 'ACTIVE';
UPDATE "MarketplaceListing" SET "new_status" = 'PAUSED' WHERE status = 'PAUSED';
-- Map any remaining statuses to DRAFT (PENDING_REVIEW, EXPIRED, REMOVED)
UPDATE "MarketplaceListing" SET "new_status" = 'DRAFT' WHERE "new_status" IS NULL;

-- Step 3: Drop old status column
ALTER TABLE "MarketplaceListing" DROP COLUMN "status";

-- Step 4: Rename new_status to status
ALTER TABLE "MarketplaceListing" RENAME COLUMN "new_status" TO "status";

-- Step 5: Set NOT NULL constraint
ALTER TABLE "MarketplaceListing" ALTER COLUMN "status" SET NOT NULL;

-- Step 6: Set default
ALTER TABLE "MarketplaceListing" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
