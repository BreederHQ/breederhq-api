-- AlterTable: Add Organization.partyId column (forward patch for PROD schema drift)
-- This migration adds the missing partyId column to Organization table.
-- The column was added to schema.prisma but never migrated to PROD.

-- Add the partyId column if it doesn't exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Organization'
      AND column_name = 'partyId'
  ) THEN
    ALTER TABLE "Organization"
    ADD COLUMN "partyId" INTEGER;
  END IF;
END $$;

-- Create unique index on partyId if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'Organization'
      AND indexname = 'Organization_partyId_key'
  ) THEN
    CREATE UNIQUE INDEX "Organization_partyId_key" ON "Organization"("partyId");
  END IF;
END $$;

-- Add foreign key constraint to Party table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Organization_partyId_fkey'
  ) THEN
    -- Only add FK if Party table exists and partyId column is populated
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Party') THEN
      ALTER TABLE "Organization"
      ADD CONSTRAINT "Organization_partyId_fkey"
      FOREIGN KEY ("partyId") REFERENCES "Party"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- NOTE: The partyId column is left NULL-able for now.
-- After backfilling Organizations with Party records, a follow-up migration
-- will set it to NOT NULL.
