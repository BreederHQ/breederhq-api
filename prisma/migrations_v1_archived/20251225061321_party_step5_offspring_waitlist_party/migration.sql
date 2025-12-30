-- Party migration step 5: Offspring and Waitlist party references
-- This migration adds Party FK columns to WaitlistEntry, OffspringGroupBuyer, and Offspring
-- All changes are idempotent and safe to run after db push has already applied them

-- ============================================================================
-- WaitlistEntry: clientPartyId
-- ============================================================================

-- Add column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'WaitlistEntry'
      AND column_name = 'clientPartyId'
  ) THEN
    ALTER TABLE "WaitlistEntry" ADD COLUMN "clientPartyId" INTEGER;
  END IF;
END $$;

-- Add index if not exists
CREATE INDEX IF NOT EXISTS "WaitlistEntry_clientPartyId_idx" ON "WaitlistEntry"("clientPartyId");
CREATE INDEX IF NOT EXISTS "WaitlistEntry_tenantId_clientPartyId_idx" ON "WaitlistEntry"("tenantId", "clientPartyId");

-- Add foreign key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WaitlistEntry_clientPartyId_fkey'
  ) THEN
    ALTER TABLE "WaitlistEntry"
      ADD CONSTRAINT "WaitlistEntry_clientPartyId_fkey"
      FOREIGN KEY ("clientPartyId") REFERENCES "Party"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- OffspringGroupBuyer: buyerPartyId
-- ============================================================================

-- Add column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'OffspringGroupBuyer'
      AND column_name = 'buyerPartyId'
  ) THEN
    ALTER TABLE "OffspringGroupBuyer" ADD COLUMN "buyerPartyId" INTEGER;
  END IF;
END $$;

-- Add indexes if not exist
CREATE INDEX IF NOT EXISTS "OffspringGroupBuyer_buyerPartyId_idx" ON "OffspringGroupBuyer"("buyerPartyId");
CREATE INDEX IF NOT EXISTS "OffspringGroupBuyer_tenantId_buyerPartyId_idx" ON "OffspringGroupBuyer"("tenantId", "buyerPartyId");

-- Add foreign key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OffspringGroupBuyer_buyerPartyId_fkey'
  ) THEN
    ALTER TABLE "OffspringGroupBuyer"
      ADD CONSTRAINT "OffspringGroupBuyer_buyerPartyId_fkey"
      FOREIGN KEY ("buyerPartyId") REFERENCES "Party"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- Offspring: buyerPartyId
-- ============================================================================

-- Add column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Offspring'
      AND column_name = 'buyerPartyId'
  ) THEN
    ALTER TABLE "Offspring" ADD COLUMN "buyerPartyId" INTEGER;
  END IF;
END $$;

-- Add indexes if not exist
CREATE INDEX IF NOT EXISTS "Offspring_buyerPartyId_idx" ON "Offspring"("buyerPartyId");
CREATE INDEX IF NOT EXISTS "Offspring_tenantId_buyerPartyId_idx" ON "Offspring"("tenantId", "buyerPartyId");

-- Add foreign key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offspring_buyerPartyId_fkey'
  ) THEN
    ALTER TABLE "Offspring"
      ADD CONSTRAINT "Offspring_buyerPartyId_fkey"
      FOREIGN KEY ("buyerPartyId") REFERENCES "Party"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
