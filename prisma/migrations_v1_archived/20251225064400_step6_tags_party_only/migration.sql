-- Step 6B: TagAssignment Party-only migration
-- Makes TagAssignment use Party exclusively for Contact/Organization tags
-- Removes legacy contactId and organizationId columns
-- Safe to run after db push
-- Idempotent

-- Ensure taggedPartyId column exists (should already exist from prior migrations)
ALTER TABLE "TagAssignment" ADD COLUMN IF NOT EXISTS "taggedPartyId" INTEGER;

-- Ensure FK constraint exists for taggedPartyId -> Party
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TagAssignment_taggedPartyId_fkey'
  ) THEN
    ALTER TABLE "TagAssignment"
      ADD CONSTRAINT "TagAssignment_taggedPartyId_fkey"
      FOREIGN KEY ("taggedPartyId")
      REFERENCES "Party"(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Ensure index exists on taggedPartyId
CREATE INDEX IF NOT EXISTS "TagAssignment_taggedPartyId_idx"
  ON "TagAssignment"("taggedPartyId");

-- Ensure compound index exists on (tagId, taggedPartyId)
CREATE INDEX IF NOT EXISTS "TagAssignment_tagId_taggedPartyId_idx"
  ON "TagAssignment"("tagId", "taggedPartyId");

-- Drop legacy unique constraints if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TagAssignment_tagId_contactId_key'
  ) THEN
    ALTER TABLE "TagAssignment" DROP CONSTRAINT "TagAssignment_tagId_contactId_key";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TagAssignment_tagId_organizationId_key'
  ) THEN
    ALTER TABLE "TagAssignment" DROP CONSTRAINT "TagAssignment_tagId_organizationId_key";
  END IF;
END $$;

-- Drop legacy indexes if they exist
DROP INDEX IF EXISTS "TagAssignment_contactId_idx";
DROP INDEX IF EXISTS "TagAssignment_organizationId_idx";

-- Drop legacy FK constraints if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TagAssignment_contactId_fkey'
  ) THEN
    ALTER TABLE "TagAssignment" DROP CONSTRAINT "TagAssignment_contactId_fkey";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TagAssignment_organizationId_fkey'
  ) THEN
    ALTER TABLE "TagAssignment" DROP CONSTRAINT "TagAssignment_organizationId_fkey";
  END IF;
END $$;

-- Drop legacy columns
ALTER TABLE "TagAssignment" DROP COLUMN IF EXISTS "contactId";
ALTER TABLE "TagAssignment" DROP COLUMN IF EXISTS "organizationId";

-- Ensure unique constraint exists on (tagId, taggedPartyId)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TagAssignment_tagId_taggedPartyId_key'
  ) THEN
    ALTER TABLE "TagAssignment"
      ADD CONSTRAINT "TagAssignment_tagId_taggedPartyId_key"
      UNIQUE ("tagId", "taggedPartyId");
  END IF;
END $$;
