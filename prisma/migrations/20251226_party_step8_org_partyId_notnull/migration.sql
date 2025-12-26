-- Make Organization.partyId NOT NULL after backfill
-- This migration runs after backfill has populated all partyId values

-- Verify all Organizations have partyId before setting NOT NULL
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM "Organization"
  WHERE "partyId" IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Cannot set partyId to NOT NULL: % organizations still have NULL partyId', missing_count;
  END IF;
END $$;

-- Set partyId to NOT NULL (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Organization'
      AND column_name = 'partyId'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "Organization"
    ALTER COLUMN "partyId" SET NOT NULL;
  END IF;
END $$;
