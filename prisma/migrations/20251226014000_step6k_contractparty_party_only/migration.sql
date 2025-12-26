-- ============================================================================
-- Step 6K: ContractParty Party-Only Migration
-- ============================================================================
-- This migration removes legacy contactId and organizationId columns from
-- ContractParty, persisting party identity only via partyId.
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
        WHERE table_name = 'ContractParty' AND column_name = 'partyId'
    ) THEN
        ALTER TABLE "ContractParty" ADD COLUMN "partyId" INTEGER;
    END IF;
END $$;

-- Ensure FK constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ContractParty_partyId_fkey'
    ) THEN
        ALTER TABLE "ContractParty"
        ADD CONSTRAINT "ContractParty_partyId_fkey"
        FOREIGN KEY ("partyId") REFERENCES "Party"(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure indexes on partyId exist
CREATE INDEX IF NOT EXISTS "ContractParty_partyId_idx" ON "ContractParty"("partyId");
CREATE INDEX IF NOT EXISTS "ContractParty_tenantId_partyId_idx" ON "ContractParty"("tenantId", "partyId");

-- ============================================================================
-- 2. Drop legacy contactId column and related constraints
-- ============================================================================

-- Drop FK constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ContractParty_contactId_fkey'
    ) THEN
        ALTER TABLE "ContractParty" DROP CONSTRAINT "ContractParty_contactId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "ContractParty_contactId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ContractParty' AND column_name = 'contactId'
    ) THEN
        ALTER TABLE "ContractParty" DROP COLUMN "contactId";
    END IF;
END $$;

-- ============================================================================
-- 3. Drop legacy organizationId column and related constraints
-- ============================================================================

-- Drop FK constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ContractParty_organizationId_fkey'
    ) THEN
        ALTER TABLE "ContractParty" DROP CONSTRAINT "ContractParty_organizationId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "ContractParty_organizationId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ContractParty' AND column_name = 'organizationId'
    ) THEN
        ALTER TABLE "ContractParty" DROP COLUMN "organizationId";
    END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- ContractParty now persists party identity only via partyId.
-- Legacy contactId and organizationId columns have been removed.
-- userId is preserved as it is separate from the Party system.
-- ============================================================================
