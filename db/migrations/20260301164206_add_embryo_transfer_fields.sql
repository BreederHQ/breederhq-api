-- migrate:up
-- Add embryo transfer (ET) fields to BreedingPlan and Offspring tables.
-- For ET plans: geneticDamId = donor mare (genetic mother), recipientDamId = surrogate carrier.
-- For non-ET plans: both fields remain NULL, damId continues to work as before.

-- BreedingPlan: ET fields
ALTER TABLE "public"."BreedingPlan"
  ADD COLUMN "geneticDamId" integer,
  ADD COLUMN "recipientDamId" integer,
  ADD COLUMN "flushDate" timestamp(3) without time zone,
  ADD COLUMN "embryoTransferDate" timestamp(3) without time zone,
  ADD COLUMN "embryoType" text;

-- BreedingPlan: foreign keys (SET NULL on delete — don't cascade-delete plans if an animal is removed)
ALTER TABLE "public"."BreedingPlan"
  ADD CONSTRAINT "BreedingPlan_geneticDamId_fkey"
    FOREIGN KEY ("geneticDamId") REFERENCES "public"."Animal"(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  ADD CONSTRAINT "BreedingPlan_recipientDamId_fkey"
    FOREIGN KEY ("recipientDamId") REFERENCES "public"."Animal"(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- BreedingPlan: CHECK — donor and recipient must be different animals (when both set)
ALTER TABLE "public"."BreedingPlan"
  ADD CONSTRAINT "BreedingPlan_donor_ne_recipient_chk"
    CHECK ("geneticDamId" IS NULL OR "recipientDamId" IS NULL OR "geneticDamId" != "recipientDamId");

-- BreedingPlan: indexes on new FK columns
CREATE INDEX "BreedingPlan_geneticDamId_idx"
  ON "public"."BreedingPlan" USING btree ("geneticDamId");
CREATE INDEX "BreedingPlan_recipientDamId_idx"
  ON "public"."BreedingPlan" USING btree ("recipientDamId");

-- Offspring: ET fields
ALTER TABLE "public"."Offspring"
  ADD COLUMN "geneticDamId" integer,
  ADD COLUMN "recipientDamId" integer;

-- Offspring: foreign keys
ALTER TABLE "public"."Offspring"
  ADD CONSTRAINT "Offspring_geneticDamId_fkey"
    FOREIGN KEY ("geneticDamId") REFERENCES "public"."Animal"(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  ADD CONSTRAINT "Offspring_recipientDamId_fkey"
    FOREIGN KEY ("recipientDamId") REFERENCES "public"."Animal"(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- Offspring: indexes on new FK columns
CREATE INDEX "Offspring_geneticDamId_idx"
  ON "public"."Offspring" USING btree ("geneticDamId");
CREATE INDEX "Offspring_recipientDamId_idx"
  ON "public"."Offspring" USING btree ("recipientDamId");


-- migrate:down
-- Drop all ET fields, indexes, constraints, and foreign keys

-- Offspring: drop FKs, indexes, columns
ALTER TABLE "public"."Offspring"
  DROP CONSTRAINT IF EXISTS "Offspring_geneticDamId_fkey",
  DROP CONSTRAINT IF EXISTS "Offspring_recipientDamId_fkey";
DROP INDEX IF EXISTS "public"."Offspring_geneticDamId_idx";
DROP INDEX IF EXISTS "public"."Offspring_recipientDamId_idx";
ALTER TABLE "public"."Offspring"
  DROP COLUMN IF EXISTS "geneticDamId",
  DROP COLUMN IF EXISTS "recipientDamId";

-- BreedingPlan: drop FKs, CHECK, indexes, columns
ALTER TABLE "public"."BreedingPlan"
  DROP CONSTRAINT IF EXISTS "BreedingPlan_geneticDamId_fkey",
  DROP CONSTRAINT IF EXISTS "BreedingPlan_recipientDamId_fkey",
  DROP CONSTRAINT IF EXISTS "BreedingPlan_donor_ne_recipient_chk";
DROP INDEX IF EXISTS "public"."BreedingPlan_geneticDamId_idx";
DROP INDEX IF EXISTS "public"."BreedingPlan_recipientDamId_idx";
ALTER TABLE "public"."BreedingPlan"
  DROP COLUMN IF EXISTS "geneticDamId",
  DROP COLUMN IF EXISTS "recipientDamId",
  DROP COLUMN IF EXISTS "flushDate",
  DROP COLUMN IF EXISTS "embryoTransferDate",
  DROP COLUMN IF EXISTS "embryoType";
