-- ============================================================================
-- Step 6M: User Party-Only Migration
-- ============================================================================
-- This migration removes legacy contactId column from User, persisting
-- user profile identity only via partyId.
--
-- IMPORTANT: This migration is idempotent and safe to run after db push.
-- It will only drop columns and constraints if they exist.
-- ============================================================================

-- ============================================================================
-- 1. Ensure partyId column exists with proper FK constraint
-- ============================================================================

-- Add partyId column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'partyId'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "partyId" INTEGER;
    END IF;
END $$;

-- Ensure FK constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'User_partyId_fkey'
    ) THEN
        ALTER TABLE "User"
        ADD CONSTRAINT "User_partyId_fkey"
        FOREIGN KEY ("partyId") REFERENCES "Party"(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure index on partyId exists
CREATE INDEX IF NOT EXISTS "User_partyId_idx" ON "User"("partyId");

-- ============================================================================
-- 2. Drop legacy contactId column and related constraints
-- ============================================================================

-- Drop unique constraint if exists
DROP INDEX IF EXISTS "User_contactId_key";

-- Drop FK constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'User_contactId_fkey'
    ) THEN
        ALTER TABLE "User" DROP CONSTRAINT "User_contactId_fkey";
    END IF;
END $$;

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'contactId'
    ) THEN
        ALTER TABLE "User" DROP COLUMN "contactId";
    END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- User now persists profile identity only via partyId.
-- Legacy contactId column has been removed.
-- ============================================================================
