-- Step 6D: Offspring Party-only storage for buyer identity
--
-- Remove legacy buyerContactId and buyerOrganizationId columns
-- while maintaining buyerPartyId for buyer identity.
--
-- SAFE: Idempotent. Can run after db push or on fresh deploy.

-- 1. Ensure buyerPartyId column exists (idempotent)
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

-- 2. Ensure indexes exist (idempotent)
CREATE INDEX IF NOT EXISTS "Offspring_buyerPartyId_idx" ON "Offspring"("buyerPartyId");
CREATE INDEX IF NOT EXISTS "Offspring_tenantId_buyerPartyId_idx" ON "Offspring"("tenantId", "buyerPartyId");

-- 3. Ensure FK exists for buyerPartyId (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offspring_buyerPartyId_fkey'
      AND conrelid = 'public."Offspring"'::regclass
  ) THEN
    ALTER TABLE "Offspring"
      ADD CONSTRAINT "Offspring_buyerPartyId_fkey"
      FOREIGN KEY ("buyerPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Drop legacy buyer column indexes if they exist
DROP INDEX IF EXISTS "Offspring_buyerContactId_idx";
DROP INDEX IF EXISTS "Offspring_buyerOrganizationId_idx";

-- 5. Drop legacy buyer column FKs if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offspring_buyerContactId_fkey'
      AND conrelid = 'public."Offspring"'::regclass
  ) THEN
    ALTER TABLE "Offspring" DROP CONSTRAINT "Offspring_buyerContactId_fkey";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offspring_buyerOrganizationId_fkey'
      AND conrelid = 'public."Offspring"'::regclass
  ) THEN
    ALTER TABLE "Offspring" DROP CONSTRAINT "Offspring_buyerOrganizationId_fkey";
  END IF;
END $$;

-- 6. Drop legacy buyer columns if they exist
ALTER TABLE "Offspring" DROP COLUMN IF EXISTS "buyerContactId";
ALTER TABLE "Offspring" DROP COLUMN IF EXISTS "buyerOrganizationId";
ALTER TABLE "Offspring" DROP COLUMN IF EXISTS "buyerPartyType";

-- RESULT: Offspring persists buyer identity only via buyerPartyId.
-- API endpoints remain backward compatible via Party mapping.
