-- AlterTable
-- Step 1: Backfill NULL values with placeholder for existing users
UPDATE "User"
SET "firstName" = 'Unknown', "lastName" = 'Unknown'
WHERE "firstName" IS NULL OR "lastName" IS NULL;

-- Step 2: Make firstName and lastName required (NOT NULL)
ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;

-- CreateIndex
-- Add unique constraint on PortalAccess.partyId (one-to-one relation fix)
CREATE UNIQUE INDEX "PortalAccess_partyId_key" ON "PortalAccess"("partyId");
