-- ============================================================================
-- Step 6L: OffspringContract Buyer Party-Only Migration
-- ============================================================================
-- This migration removes legacy buyerContactId and buyerOrganizationId
-- columns from OffspringContract, persisting buyer identity only via
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
        WHERE table_name = 'OffspringContract' AND column_name = 'buyerPartyId'
    ) THEN
        ALTER TABLE "OffspringContract" ADD COLUMN "buyerPartyId" INTEGER;
    END IF;
END $$;

-- Ensure FK constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'OffspringContract_buyerPartyId_fkey'
    ) THEN
        ALTER TABLE "OffspringContract"
        ADD CONSTRAINT "OffspringContract_buyerPartyId_fkey"
        FOREIGN KEY ("buyerPartyId") REFERENCES "Party"(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure indexes on buyerPartyId exist
CREATE INDEX IF NOT EXISTS "OffspringContract_buyerPartyId_idx" ON "OffspringContract"("buyerPartyId");
CREATE INDEX IF NOT EXISTS "OffspringContract_tenantId_buyerPartyId_idx" ON "OffspringContract"("tenantId", "buyerPartyId");

-- ============================================================================
-- 2. Drop legacy buyerContactId column and related constraints
-- ============================================================================

-- Drop FK constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'OffspringContract_buyerContactId_fkey'
    ) THEN
        ALTER TABLE "OffspringContract" DROP CONSTRAINT "OffspringContract_buyerContactId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "OffspringContract_buyerContactId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'OffspringContract' AND column_name = 'buyerContactId'
    ) THEN
        ALTER TABLE "OffspringContract" DROP COLUMN "buyerContactId";
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
        WHERE conname = 'OffspringContract_buyerOrganizationId_fkey'
    ) THEN
        ALTER TABLE "OffspringContract" DROP CONSTRAINT "OffspringContract_buyerOrganizationId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "OffspringContract_buyerOrganizationId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'OffspringContract' AND column_name = 'buyerOrganizationId'
    ) THEN
        ALTER TABLE "OffspringContract" DROP COLUMN "buyerOrganizationId";
    END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- OffspringContract now persists buyer identity only via buyerPartyId.
-- Legacy buyerContactId and buyerOrganizationId columns have been removed.
-- ============================================================================
