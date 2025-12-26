-- Step 6C: OffspringGroupBuyer Party-only migration
-- Remove legacy buyer contact/org columns, persist only buyerPartyId
-- Safe to run after db push; idempotent for production deployment

-- Ensure buyerPartyId column exists (should already exist from Step 5)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'OffspringGroupBuyer'
        AND column_name = 'buyerPartyId'
    ) THEN
        ALTER TABLE "OffspringGroupBuyer"
        ADD COLUMN "buyerPartyId" INTEGER;
    END IF;
END $$;

-- Ensure buyerPartyId index exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'OffspringGroupBuyer'
        AND indexname = 'OffspringGroupBuyer_buyerPartyId_idx'
    ) THEN
        CREATE INDEX "OffspringGroupBuyer_buyerPartyId_idx"
        ON "OffspringGroupBuyer"("buyerPartyId");
    END IF;
END $$;

-- Ensure composite (tenantId, buyerPartyId) index exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'OffspringGroupBuyer'
        AND indexname = 'OffspringGroupBuyer_tenantId_buyerPartyId_idx'
    ) THEN
        CREATE INDEX "OffspringGroupBuyer_tenantId_buyerPartyId_idx"
        ON "OffspringGroupBuyer"("tenantId", "buyerPartyId");
    END IF;
END $$;

-- Ensure FK constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
        AND table_name = 'OffspringGroupBuyer'
        AND constraint_name = 'OffspringGroupBuyer_buyerPartyId_fkey'
    ) THEN
        ALTER TABLE "OffspringGroupBuyer"
        ADD CONSTRAINT "OffspringGroupBuyer_buyerPartyId_fkey"
        FOREIGN KEY ("buyerPartyId")
        REFERENCES "Party"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Drop legacy unique constraint on (groupId, contactId) if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'OffspringGroupBuyer_groupId_contactId_key'
    ) THEN
        ALTER TABLE "OffspringGroupBuyer"
        DROP CONSTRAINT "OffspringGroupBuyer_groupId_contactId_key";
    END IF;
END $$;

-- Drop legacy unique constraint on (groupId, organizationId) if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'OffspringGroupBuyer_groupId_organizationId_key'
    ) THEN
        ALTER TABLE "OffspringGroupBuyer"
        DROP CONSTRAINT "OffspringGroupBuyer_groupId_organizationId_key";
    END IF;
END $$;

-- Add new unique constraint on (groupId, buyerPartyId) if not exists
-- IMPORTANT: Only add if no duplicates exist (validation should catch this)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'OffspringGroupBuyer_groupId_buyerPartyId_key'
    ) THEN
        -- Check for duplicates before adding constraint
        IF NOT EXISTS (
            SELECT "groupId", "buyerPartyId"
            FROM "OffspringGroupBuyer"
            WHERE "buyerPartyId" IS NOT NULL
            GROUP BY "groupId", "buyerPartyId"
            HAVING COUNT(*) > 1
        ) THEN
            ALTER TABLE "OffspringGroupBuyer"
            ADD CONSTRAINT "OffspringGroupBuyer_groupId_buyerPartyId_key"
            UNIQUE ("groupId", "buyerPartyId");
        ELSE
            RAISE WARNING 'Duplicate (groupId, buyerPartyId) found; skipping unique constraint';
        END IF;
    END IF;
END $$;

-- Drop legacy contactId index if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'OffspringGroupBuyer'
        AND indexname = 'OffspringGroupBuyer_contactId_idx'
    ) THEN
        DROP INDEX "OffspringGroupBuyer_contactId_idx";
    END IF;
END $$;

-- Drop legacy organizationId index if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'OffspringGroupBuyer'
        AND indexname = 'OffspringGroupBuyer_organizationId_idx'
    ) THEN
        DROP INDEX "OffspringGroupBuyer_organizationId_idx";
    END IF;
END $$;

-- Drop legacy FK constraints
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'OffspringGroupBuyer_contactId_fkey'
    ) THEN
        ALTER TABLE "OffspringGroupBuyer"
        DROP CONSTRAINT "OffspringGroupBuyer_contactId_fkey";
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'OffspringGroupBuyer_organizationId_fkey'
    ) THEN
        ALTER TABLE "OffspringGroupBuyer"
        DROP CONSTRAINT "OffspringGroupBuyer_organizationId_fkey";
    END IF;
END $$;

-- Drop legacy contactId column if exists
ALTER TABLE "OffspringGroupBuyer"
DROP COLUMN IF EXISTS "contactId";

-- Drop legacy organizationId column if exists
ALTER TABLE "OffspringGroupBuyer"
DROP COLUMN IF EXISTS "organizationId";
