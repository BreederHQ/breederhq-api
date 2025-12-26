-- ============================================================================
-- Step 6J: Invoice Client Party-Only Migration
-- ============================================================================
-- This migration removes legacy contactId and organizationId columns from
-- Invoice, persisting client identity only via clientPartyId.
--
-- IMPORTANT: This migration is idempotent and safe to run after db push.
-- It will only drop columns and constraints if they exist.
-- ============================================================================

-- ============================================================================
-- 1. Ensure clientPartyId column exists with proper FK constraint
-- ============================================================================

-- Add clientPartyId column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Invoice' AND column_name = 'clientPartyId'
    ) THEN
        ALTER TABLE "Invoice" ADD COLUMN "clientPartyId" INTEGER;
    END IF;
END $$;

-- Ensure FK constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Invoice_clientPartyId_fkey'
    ) THEN
        ALTER TABLE "Invoice"
        ADD CONSTRAINT "Invoice_clientPartyId_fkey"
        FOREIGN KEY ("clientPartyId") REFERENCES "Party"(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure indexes on clientPartyId exist
CREATE INDEX IF NOT EXISTS "Invoice_clientPartyId_idx" ON "Invoice"("clientPartyId");
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_clientPartyId_idx" ON "Invoice"("tenantId", "clientPartyId");

-- ============================================================================
-- 2. Drop legacy contactId column and related constraints
-- ============================================================================

-- Drop FK constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Invoice_contactId_fkey'
    ) THEN
        ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_contactId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "Invoice_contactId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Invoice' AND column_name = 'contactId'
    ) THEN
        ALTER TABLE "Invoice" DROP COLUMN "contactId";
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
        WHERE conname = 'Invoice_organizationId_fkey'
    ) THEN
        ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_organizationId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "Invoice_organizationId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Invoice' AND column_name = 'organizationId'
    ) THEN
        ALTER TABLE "Invoice" DROP COLUMN "organizationId";
    END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Invoice now persists client identity only via clientPartyId.
-- Legacy contactId and organizationId columns have been removed.
-- ============================================================================
