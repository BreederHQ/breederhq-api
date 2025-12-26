-- Party migration step 5: Animals domain party references
-- Additive schema changes only, nullable columns
-- IDEMPOTENT: Safe to run after db push has already created these objects

-- ────────────────────────────────────────────────────────────────────────────
-- A) Animal buyer party reference
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Animal"
  ADD COLUMN IF NOT EXISTS "buyerPartyId" INTEGER;

-- Create FK only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Animal_buyerPartyId_fkey'
      AND conrelid = '"Animal"'::regclass
  ) THEN
    ALTER TABLE "Animal"
      ADD CONSTRAINT "Animal_buyerPartyId_fkey"
      FOREIGN KEY ("buyerPartyId")
      REFERENCES "Party"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Animal_buyerPartyId_idx"
  ON "Animal"("buyerPartyId");

CREATE INDEX IF NOT EXISTS "Animal_tenantId_buyerPartyId_idx"
  ON "Animal"("tenantId", "buyerPartyId");

-- ────────────────────────────────────────────────────────────────────────────
-- B) AnimalOwner party reference
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "AnimalOwner"
  ADD COLUMN IF NOT EXISTS "partyId" INTEGER;

-- Create FK only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AnimalOwner_partyId_fkey'
      AND conrelid = '"AnimalOwner"'::regclass
  ) THEN
    ALTER TABLE "AnimalOwner"
      ADD CONSTRAINT "AnimalOwner_partyId_fkey"
      FOREIGN KEY ("partyId")
      REFERENCES "Party"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AnimalOwner_partyId_idx"
  ON "AnimalOwner"("partyId");

CREATE INDEX IF NOT EXISTS "AnimalOwner_animalId_partyId_idx"
  ON "AnimalOwner"("animalId", "partyId");

-- ────────────────────────────────────────────────────────────────────────────
-- C) AnimalOwnershipChange party-based JSON snapshots
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "AnimalOwnershipChange"
  ADD COLUMN IF NOT EXISTS "fromOwnerParties" JSONB;

ALTER TABLE "AnimalOwnershipChange"
  ADD COLUMN IF NOT EXISTS "toOwnerParties" JSONB;

-- ────────────────────────────────────────────────────────────────────────────
-- Migration metadata
-- ────────────────────────────────────────────────────────────────────────────
COMMENT ON COLUMN "Animal"."buyerPartyId" IS 'Party migration step 5: unified buyer reference';
COMMENT ON COLUMN "AnimalOwner"."partyId" IS 'Party migration step 5: unified co-owner reference';
COMMENT ON COLUMN "AnimalOwnershipChange"."fromOwnerParties" IS 'Party migration step 5: party-based ownership snapshot (from)';
COMMENT ON COLUMN "AnimalOwnershipChange"."toOwnerParties" IS 'Party migration step 5: party-based ownership snapshot (to)';
