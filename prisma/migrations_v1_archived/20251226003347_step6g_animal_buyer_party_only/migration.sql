-- ============================================================================
-- Step 6G: Animal Buyer Party-Only Migration
-- ============================================================================
-- This migration removes legacy buyerContactId, buyerOrganizationId, and
-- buyerPartyType columns from Animal, persisting buyer identity only via
-- buyerPartyId.
--
-- IMPORTANT: This migration is idempotent and safe to run after db push.
-- It will only drop columns and constraints if they exist.
-- ============================================================================

-- ============================================================================
-- 1. Ensure buyerPartyId column exists with proper FK constraint
-- ============================================================================

-- Add buyerPartyId column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Animal' AND column_name = 'buyerPartyId'
    ) THEN
        ALTER TABLE "Animal" ADD COLUMN "buyerPartyId" INTEGER;
    END IF;
END $$;

-- Ensure FK constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Animal_buyerPartyId_fkey'
    ) THEN
        ALTER TABLE "Animal"
        ADD CONSTRAINT "Animal_buyerPartyId_fkey"
        FOREIGN KEY ("buyerPartyId") REFERENCES "Party"(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure indexes on buyerPartyId exist
CREATE INDEX IF NOT EXISTS "Animal_buyerPartyId_idx" ON "Animal"("buyerPartyId");
CREATE INDEX IF NOT EXISTS "Animal_tenantId_buyerPartyId_idx" ON "Animal"("tenantId", "buyerPartyId");

-- ============================================================================
-- 2. Drop legacy buyerContactId column and related constraints
-- ============================================================================

-- Drop FK constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Animal_buyerContactId_fkey'
    ) THEN
        ALTER TABLE "Animal" DROP CONSTRAINT "Animal_buyerContactId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "Animal_buyerContactId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Animal' AND column_name = 'buyerContactId'
    ) THEN
        ALTER TABLE "Animal" DROP COLUMN "buyerContactId";
    END IF;
END $$;

-- ============================================================================
-- 3. Drop legacy buyerOrganizationId column and related constraints
-- ============================================================================

-- Drop FK constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Animal_buyerOrganizationId_fkey'
    ) THEN
        ALTER TABLE "Animal" DROP CONSTRAINT "Animal_buyerOrganizationId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "Animal_buyerOrganizationId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Animal' AND column_name = 'buyerOrganizationId'
    ) THEN
        ALTER TABLE "Animal" DROP COLUMN "buyerOrganizationId";
    END IF;
END $$;

-- ============================================================================
-- 4. Drop legacy buyerPartyType column
-- ============================================================================

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Animal' AND column_name = 'buyerPartyType'
    ) THEN
        ALTER TABLE "Animal" DROP COLUMN "buyerPartyType";
    END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Animal now persists buyer identity only via buyerPartyId.
-- Legacy buyerContactId, buyerOrganizationId, and buyerPartyType columns
-- have been removed.
-- ============================================================================
