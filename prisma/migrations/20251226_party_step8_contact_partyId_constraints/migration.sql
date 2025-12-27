-- Add missing unique index and foreign key constraint for Contact.partyId
-- This migration ensures Contact.partyId has the same constraints as Organization.partyId
-- The column already exists in PROD but is missing the index and FK constraint

-- Add unique index on Contact.partyId if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'Contact'
      AND indexname = 'Contact_partyId_key'
  ) THEN
    CREATE UNIQUE INDEX "Contact_partyId_key" ON "Contact"("partyId");
  END IF;
END $$;

-- Add foreign key constraint to Party table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Contact_partyId_fkey'
  ) THEN
    -- Only add FK if Party table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Party') THEN
      ALTER TABLE "Contact"
      ADD CONSTRAINT "Contact_partyId_fkey"
      FOREIGN KEY ("partyId") REFERENCES "Party"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
