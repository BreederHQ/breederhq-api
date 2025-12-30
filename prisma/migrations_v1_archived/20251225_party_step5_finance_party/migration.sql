-- Party migration Step 5: Finance domain
-- Add partyId columns to Invoice, OffspringContract, and ContractParty models
-- This migration is idempotent and safe to run after db push

-- ============================================================================
-- Invoice: Add clientPartyId column
-- ============================================================================

-- Add clientPartyId column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Invoice' AND column_name = 'clientPartyId'
    ) THEN
        ALTER TABLE "Invoice" ADD COLUMN "clientPartyId" INTEGER;
    END IF;
END $$;

-- Add foreign key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Invoice_clientPartyId_fkey'
    ) THEN
        ALTER TABLE "Invoice"
        ADD CONSTRAINT "Invoice_clientPartyId_fkey"
        FOREIGN KEY ("clientPartyId")
        REFERENCES "Party"(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Create index on clientPartyId if not exists
CREATE INDEX IF NOT EXISTS "Invoice_clientPartyId_idx" ON "Invoice"("clientPartyId");

-- Create composite index on tenantId + clientPartyId if not exists
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_clientPartyId_idx" ON "Invoice"("tenantId", "clientPartyId");

-- ============================================================================
-- OffspringContract: Add buyerPartyId column
-- ============================================================================

-- Add buyerPartyId column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'OffspringContract' AND column_name = 'buyerPartyId'
    ) THEN
        ALTER TABLE "OffspringContract" ADD COLUMN "buyerPartyId" INTEGER;
    END IF;
END $$;

-- Add foreign key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'OffspringContract_buyerPartyId_fkey'
    ) THEN
        ALTER TABLE "OffspringContract"
        ADD CONSTRAINT "OffspringContract_buyerPartyId_fkey"
        FOREIGN KEY ("buyerPartyId")
        REFERENCES "Party"(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Create index on buyerPartyId if not exists
CREATE INDEX IF NOT EXISTS "OffspringContract_buyerPartyId_idx" ON "OffspringContract"("buyerPartyId");

-- Create composite index on tenantId + buyerPartyId if not exists
CREATE INDEX IF NOT EXISTS "OffspringContract_tenantId_buyerPartyId_idx" ON "OffspringContract"("tenantId", "buyerPartyId");

-- ============================================================================
-- ContractParty: Add partyId column
-- ============================================================================

-- Add partyId column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ContractParty' AND column_name = 'partyId'
    ) THEN
        ALTER TABLE "ContractParty" ADD COLUMN "partyId" INTEGER;
    END IF;
END $$;

-- Add foreign key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ContractParty_partyId_fkey'
    ) THEN
        ALTER TABLE "ContractParty"
        ADD CONSTRAINT "ContractParty_partyId_fkey"
        FOREIGN KEY ("partyId")
        REFERENCES "Party"(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Create index on partyId if not exists
CREATE INDEX IF NOT EXISTS "ContractParty_partyId_idx" ON "ContractParty"("partyId");

-- Create composite index on tenantId + partyId if not exists
CREATE INDEX IF NOT EXISTS "ContractParty_tenantId_partyId_idx" ON "ContractParty"("tenantId", "partyId");
