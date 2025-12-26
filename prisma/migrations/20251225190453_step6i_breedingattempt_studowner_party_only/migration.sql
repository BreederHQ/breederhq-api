-- ============================================================================
-- Step 6I: BreedingAttempt Stud Owner Party-Only Migration
-- ============================================================================
-- This migration removes legacy studOwnerContactId column from BreedingAttempt,
-- persisting stud owner identity only via studOwnerPartyId.
--
-- IMPORTANT: This migration is idempotent and safe to run after db push.
-- It will only drop columns and constraints if they exist.
-- ============================================================================

-- ============================================================================
-- 1. Ensure studOwnerPartyId column exists with proper FK constraint
-- ============================================================================

-- Add studOwnerPartyId column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'BreedingAttempt' AND column_name = 'studOwnerPartyId'
    ) THEN
        ALTER TABLE "BreedingAttempt" ADD COLUMN "studOwnerPartyId" INTEGER;
    END IF;
END $$;

-- Ensure FK constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'BreedingAttempt_studOwnerPartyId_fkey'
    ) THEN
        ALTER TABLE "BreedingAttempt"
        ADD CONSTRAINT "BreedingAttempt_studOwnerPartyId_fkey"
        FOREIGN KEY ("studOwnerPartyId") REFERENCES "Party"(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure index on studOwnerPartyId exists
CREATE INDEX IF NOT EXISTS "BreedingAttempt_studOwnerPartyId_idx" ON "BreedingAttempt"("studOwnerPartyId");

-- ============================================================================
-- 2. Drop legacy studOwnerContactId column and related constraints
-- ============================================================================

-- Drop FK constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'BreedingAttempt_studOwnerContactId_fkey'
    ) THEN
        ALTER TABLE "BreedingAttempt" DROP CONSTRAINT "BreedingAttempt_studOwnerContactId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "BreedingAttempt_studOwnerContactId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'BreedingAttempt' AND column_name = 'studOwnerContactId'
    ) THEN
        ALTER TABLE "BreedingAttempt" DROP COLUMN "studOwnerContactId";
    END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- BreedingAttempt now persists stud owner identity only via studOwnerPartyId.
-- Legacy studOwnerContactId column has been removed.
-- ============================================================================
