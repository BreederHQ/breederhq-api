-- ============================================================================
-- Step 6F: PlanParty Party-Only Migration
-- ============================================================================
-- This migration removes legacy contactId and organizationId columns from
-- PlanParty, persisting identity only via partyId.
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
        WHERE table_name = 'PlanParty' AND column_name = 'partyId'
    ) THEN
        ALTER TABLE "PlanParty" ADD COLUMN "partyId" INTEGER;
    END IF;
END $$;

-- Ensure FK constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'PlanParty_partyId_fkey'
    ) THEN
        ALTER TABLE "PlanParty"
        ADD CONSTRAINT "PlanParty_partyId_fkey"
        FOREIGN KEY ("partyId") REFERENCES "Party"(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure index on partyId exists
CREATE INDEX IF NOT EXISTS "PlanParty_partyId_idx" ON "PlanParty"("partyId");

-- Ensure composite index exists
CREATE INDEX IF NOT EXISTS "PlanParty_tenantId_partyId_role_idx"
ON "PlanParty"("tenantId", "partyId", "role");

-- ============================================================================
-- 2. Drop legacy contactId column and related constraints
-- ============================================================================

-- Drop FK constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'PlanParty_contactId_fkey'
    ) THEN
        ALTER TABLE "PlanParty" DROP CONSTRAINT "PlanParty_contactId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "PlanParty_contactId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'PlanParty' AND column_name = 'contactId'
    ) THEN
        ALTER TABLE "PlanParty" DROP COLUMN "contactId";
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
        WHERE conname = 'PlanParty_organizationId_fkey'
    ) THEN
        ALTER TABLE "PlanParty" DROP CONSTRAINT "PlanParty_organizationId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "PlanParty_organizationId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'PlanParty' AND column_name = 'organizationId'
    ) THEN
        ALTER TABLE "PlanParty" DROP COLUMN "organizationId";
    END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- PlanParty now persists identity only via partyId.
-- Legacy contactId and organizationId columns have been removed.
-- ============================================================================
