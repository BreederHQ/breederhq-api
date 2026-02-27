-- migrate:up
-- Rekey WeanCheck from breedingPlanId (unique) to animalId (unique).
-- Supports twins: each foal gets its own wean check record.
-- breedingPlanId index already exists from the create migration; not recreated here.

-- 1. Drop the unique constraint on breedingPlanId (index remains for lookups)
ALTER TABLE "public"."WeanCheck"
  DROP CONSTRAINT IF EXISTS "WeanCheck_breedingPlanId_key";

-- 2. Add animalId column (nullable — existing rows have no foal reference)
ALTER TABLE "public"."WeanCheck"
  ADD COLUMN "animalId" integer;

-- 3. Add unique constraint and FK on animalId
ALTER TABLE "public"."WeanCheck"
  ADD CONSTRAINT "WeanCheck_animalId_key" UNIQUE ("animalId"),
  ADD CONSTRAINT "WeanCheck_animalId_fkey"
    FOREIGN KEY ("animalId") REFERENCES "public"."Animal"(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- 4. Add index on animalId
CREATE INDEX "WeanCheck_animalId_idx"
  ON "public"."WeanCheck" USING btree ("animalId");

-- migrate:down
DROP INDEX IF EXISTS "WeanCheck_animalId_idx";

ALTER TABLE "public"."WeanCheck"
  DROP CONSTRAINT IF EXISTS "WeanCheck_animalId_fkey",
  DROP CONSTRAINT IF EXISTS "WeanCheck_animalId_key",
  DROP COLUMN IF EXISTS "animalId";

ALTER TABLE "public"."WeanCheck"
  ADD CONSTRAINT "WeanCheck_breedingPlanId_key" UNIQUE ("breedingPlanId");
