-- ============================================================================
-- Step 6H: AnimalOwner Party-Only Migration
-- ============================================================================
-- This migration removes legacy contactId, organizationId, and partyType
-- columns from AnimalOwner, persisting owner identity only via partyId.
--
-- IMPORTANT: This migration is idempotent and safe to run after db push.
-- It will only drop columns and constraints if they exist.
-- ============================================================================

-- ============================================================================
-- 1. Ensure partyId column exists with proper FK constraint and NOT NULL
-- ============================================================================

-- Add partyId column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AnimalOwner' AND column_name = 'partyId'
    ) THEN
        ALTER TABLE "AnimalOwner" ADD COLUMN "partyId" INTEGER;
    END IF;
END $$;

-- Ensure FK constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AnimalOwner_partyId_fkey'
    ) THEN
        ALTER TABLE "AnimalOwner"
        ADD CONSTRAINT "AnimalOwner_partyId_fkey"
        FOREIGN KEY ("partyId") REFERENCES "Party"(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Make partyId NOT NULL (after ensuring it's populated)
DO $$
BEGIN
    -- Check if any rows have NULL partyId
    IF NOT EXISTS (
        SELECT 1 FROM "AnimalOwner" WHERE "partyId" IS NULL
    ) THEN
        -- Only add NOT NULL constraint if all rows have partyId
        ALTER TABLE "AnimalOwner" ALTER COLUMN "partyId" SET NOT NULL;
    ELSE
        RAISE NOTICE 'Warning: Some AnimalOwner rows have NULL partyId. NOT NULL constraint not applied.';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'partyId column may already be NOT NULL';
END $$;

-- Ensure index on partyId exists
CREATE INDEX IF NOT EXISTS "AnimalOwner_partyId_idx" ON "AnimalOwner"("partyId");

-- ============================================================================
-- 2. Drop unique constraint on animalId + organizationId
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AnimalOwner_animalId_organizationId_key'
    ) THEN
        ALTER TABLE "AnimalOwner" DROP CONSTRAINT "AnimalOwner_animalId_organizationId_key";
    END IF;
END $$;

-- ============================================================================
-- 3. Drop unique constraint on animalId + contactId
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AnimalOwner_animalId_contactId_key'
    ) THEN
        ALTER TABLE "AnimalOwner" DROP CONSTRAINT "AnimalOwner_animalId_contactId_key";
    END IF;
END $$;

-- ============================================================================
-- 4. Drop legacy contactId column and related constraints
-- ============================================================================

-- Drop FK constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AnimalOwner_contactId_fkey'
    ) THEN
        ALTER TABLE "AnimalOwner" DROP CONSTRAINT "AnimalOwner_contactId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "AnimalOwner_contactId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AnimalOwner' AND column_name = 'contactId'
    ) THEN
        ALTER TABLE "AnimalOwner" DROP COLUMN "contactId";
    END IF;
END $$;

-- ============================================================================
-- 5. Drop legacy organizationId column and related constraints
-- ============================================================================

-- Drop FK constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AnimalOwner_organizationId_fkey'
    ) THEN
        ALTER TABLE "AnimalOwner" DROP CONSTRAINT "AnimalOwner_organizationId_fkey";
    END IF;
END $$;

-- Drop index if exists
DROP INDEX IF EXISTS "AnimalOwner_organizationId_idx";

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AnimalOwner' AND column_name = 'organizationId'
    ) THEN
        ALTER TABLE "AnimalOwner" DROP COLUMN "organizationId";
    END IF;
END $$;

-- ============================================================================
-- 6. Drop legacy partyType column
-- ============================================================================

-- Drop column if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AnimalOwner' AND column_name = 'partyType'
    ) THEN
        ALTER TABLE "AnimalOwner" DROP COLUMN "partyType";
    END IF;
END $$;

-- ============================================================================
-- 7. Ensure unique constraint on animalId + partyId exists
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AnimalOwner_animalId_partyId_key'
    ) THEN
        ALTER TABLE "AnimalOwner" ADD CONSTRAINT "AnimalOwner_animalId_partyId_key" UNIQUE ("animalId", "partyId");
    END IF;
END $$;

-- Ensure index on animalId + partyId exists
CREATE INDEX IF NOT EXISTS "AnimalOwner_animalId_partyId_idx" ON "AnimalOwner"("animalId", "partyId");

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- AnimalOwner now persists owner identity only via partyId.
-- Legacy contactId, organizationId, and partyType columns have been removed.
-- ============================================================================
