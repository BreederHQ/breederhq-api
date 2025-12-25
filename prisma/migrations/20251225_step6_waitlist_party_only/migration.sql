-- Step 6E: WaitlistEntry Party-Only Migration
-- Removes legacy contactId, organizationId, partyType columns
-- Ensures clientPartyId column and indexes exist (idempotent)
-- Safe to run after db push

-- ============================================================
-- 1. Ensure clientPartyId column exists with FK to Party
-- ============================================================

DO $$
BEGIN
  -- Add clientPartyId column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WaitlistEntry'
    AND column_name = 'clientPartyId'
  ) THEN
    ALTER TABLE "WaitlistEntry"
    ADD COLUMN "clientPartyId" INTEGER;
  END IF;

  -- Ensure FK to Party exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WaitlistEntry_clientPartyId_fkey'
  ) THEN
    ALTER TABLE "WaitlistEntry"
    ADD CONSTRAINT "WaitlistEntry_clientPartyId_fkey"
    FOREIGN KEY ("clientPartyId") REFERENCES "Party"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. Ensure indexes exist for clientPartyId
-- ============================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS "WaitlistEntry_clientPartyId_idx"
ON "WaitlistEntry"("clientPartyId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "WaitlistEntry_tenantId_clientPartyId_idx"
ON "WaitlistEntry"("tenantId", "clientPartyId");

-- ============================================================
-- 3. Drop legacy columns and indexes
-- ============================================================

-- Drop legacy indexes first (safe: IF EXISTS)
DROP INDEX CONCURRENTLY IF EXISTS "WaitlistEntry_contactId_idx";
DROP INDEX CONCURRENTLY IF EXISTS "WaitlistEntry_organizationId_idx";

-- Drop legacy columns (safe: IF EXISTS via DO block)
DO $$
BEGIN
  -- Drop contactId FK constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WaitlistEntry_contactId_fkey'
  ) THEN
    ALTER TABLE "WaitlistEntry" DROP CONSTRAINT "WaitlistEntry_contactId_fkey";
  END IF;

  -- Drop organizationId FK constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WaitlistEntry_organizationId_fkey'
  ) THEN
    ALTER TABLE "WaitlistEntry" DROP CONSTRAINT "WaitlistEntry_organizationId_fkey";
  END IF;

  -- Drop contactId column if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WaitlistEntry'
    AND column_name = 'contactId'
  ) THEN
    ALTER TABLE "WaitlistEntry" DROP COLUMN "contactId";
  END IF;

  -- Drop organizationId column if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WaitlistEntry'
    AND column_name = 'organizationId'
  ) THEN
    ALTER TABLE "WaitlistEntry" DROP COLUMN "organizationId";
  END IF;

  -- Drop partyType column if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WaitlistEntry'
    AND column_name = 'partyType'
  ) THEN
    ALTER TABLE "WaitlistEntry" DROP COLUMN "partyType";
  END IF;
END $$;
