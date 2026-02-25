-- migrate:up
-- Rename MareReproductiveHistory to AnimalReproductiveHistory
-- Generalize horse-specific column names to support all species
-- Add species column for species-adaptive calculations

-- 1. Drop existing foreign key constraints (must drop before rename)
ALTER TABLE ONLY "public"."MareReproductiveHistory"
  DROP CONSTRAINT IF EXISTS "MareReproductiveHistory_mareId_fkey";
ALTER TABLE ONLY "public"."MareReproductiveHistory"
  DROP CONSTRAINT IF EXISTS "MareReproductiveHistory_tenantId_fkey";

-- 2. Drop existing indexes
DROP INDEX IF EXISTS "public"."MareReproductiveHistory_mareId_key";
DROP INDEX IF EXISTS "public"."MareReproductiveHistory_mareId_idx";
DROP INDEX IF EXISTS "public"."MareReproductiveHistory_riskScore_idx";
DROP INDEX IF EXISTS "public"."MareReproductiveHistory_tenantId_idx";

-- 3. Rename table
ALTER TABLE "public"."MareReproductiveHistory" RENAME TO "AnimalReproductiveHistory";

-- 4. Rename sequence to match new table name
ALTER SEQUENCE "public"."MareReproductiveHistory_id_seq"
  RENAME TO "AnimalReproductiveHistory_id_seq";

-- 5. Rename primary key constraint
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME CONSTRAINT "MareReproductiveHistory_pkey" TO "AnimalReproductiveHistory_pkey";

-- 6. Rename column: mareId -> animalId
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "mareId" TO "animalId";

-- 7. Add species column, backfill from Animal table, make NOT NULL
ALTER TABLE "public"."AnimalReproductiveHistory"
  ADD COLUMN "species" text;

UPDATE "public"."AnimalReproductiveHistory" h
  SET "species" = a."species"
  FROM "public"."Animal" a
  WHERE h."animalId" = a."id";

-- Default any remaining nulls to HORSE (all existing data is horse)
UPDATE "public"."AnimalReproductiveHistory"
  SET "species" = 'HORSE'
  WHERE "species" IS NULL;

ALTER TABLE "public"."AnimalReproductiveHistory"
  ALTER COLUMN "species" SET NOT NULL;

-- 8. Rename horse-specific columns to generic names
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "totalFoalings" TO "totalBirths";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "totalLiveFoals" TO "totalLiveOffspring";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "totalComplicatedFoalings" TO "totalComplicatedBirths";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "lastFoalingDate" TO "lastBirthDate";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "lastFoalingComplications" TO "lastBirthComplications";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "lastMareCondition" TO "lastDamCondition";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "avgPostFoalingHeatDays" TO "avgPostBirthHeatDays";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "minPostFoalingHeatDays" TO "minPostBirthHeatDays";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "maxPostFoalingHeatDays" TO "maxPostBirthHeatDays";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "lastPostFoalingHeatDate" TO "lastPostBirthHeatDate";

-- 9. Recreate indexes with new names
CREATE UNIQUE INDEX "AnimalReproductiveHistory_animalId_key"
  ON "public"."AnimalReproductiveHistory" USING btree ("animalId");
CREATE INDEX "AnimalReproductiveHistory_animalId_idx"
  ON "public"."AnimalReproductiveHistory" USING btree ("animalId");
CREATE INDEX "AnimalReproductiveHistory_tenantId_idx"
  ON "public"."AnimalReproductiveHistory" USING btree ("tenantId");
CREATE INDEX "AnimalReproductiveHistory_riskScore_idx"
  ON "public"."AnimalReproductiveHistory" USING btree ("riskScore");
CREATE INDEX "AnimalReproductiveHistory_species_idx"
  ON "public"."AnimalReproductiveHistory" USING btree ("species");

-- 10. Recreate foreign key constraints with new names
ALTER TABLE ONLY "public"."AnimalReproductiveHistory"
  ADD CONSTRAINT "AnimalReproductiveHistory_animalId_fkey"
  FOREIGN KEY ("animalId") REFERENCES "public"."Animal"(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."AnimalReproductiveHistory"
  ADD CONSTRAINT "AnimalReproductiveHistory_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 11. Rename FoalingOutcome.mareCondition -> damCondition
ALTER TABLE "public"."FoalingOutcome"
  RENAME COLUMN "mareCondition" TO "damCondition";

-- 12. Rename FoalingOutcome horse-specific columns to generic names
ALTER TABLE "public"."FoalingOutcome"
  RENAME COLUMN "postFoalingHeatDate" TO "postBirthHeatDate";
ALTER TABLE "public"."FoalingOutcome"
  RENAME COLUMN "postFoalingHeatNotes" TO "postBirthHeatNotes";

-- 13. Create the new DamPostBirthCondition enum (same values as old)
CREATE TYPE "public"."DamPostBirthCondition" AS ENUM (
  'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'VETERINARY_CARE_REQUIRED'
);

-- 14. Convert column from old enum to new enum via text cast
ALTER TABLE "public"."FoalingOutcome"
  ALTER COLUMN "damCondition" TYPE text USING ("damCondition"::text);
ALTER TABLE "public"."FoalingOutcome"
  ALTER COLUMN "damCondition" TYPE "public"."DamPostBirthCondition"
  USING ("damCondition"::"public"."DamPostBirthCondition");

-- 15. Drop old enum
DROP TYPE IF EXISTS "public"."MarePostFoalingCondition";


-- migrate:down
-- Reverse all renames to restore original MareReproductiveHistory structure

-- 1. Recreate old enum
CREATE TYPE "public"."MarePostFoalingCondition" AS ENUM (
  'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'VETERINARY_CARE_REQUIRED'
);

-- 2. Convert FoalingOutcome column back to old enum
ALTER TABLE "public"."FoalingOutcome"
  ALTER COLUMN "damCondition" TYPE text USING ("damCondition"::text);
ALTER TABLE "public"."FoalingOutcome"
  ALTER COLUMN "damCondition" TYPE "public"."MarePostFoalingCondition"
  USING ("damCondition"::"public"."MarePostFoalingCondition");

-- 3. Drop new enum
DROP TYPE IF EXISTS "public"."DamPostBirthCondition";

-- 4. Rename FoalingOutcome columns back
ALTER TABLE "public"."FoalingOutcome"
  RENAME COLUMN "damCondition" TO "mareCondition";
ALTER TABLE "public"."FoalingOutcome"
  RENAME COLUMN "postBirthHeatDate" TO "postFoalingHeatDate";
ALTER TABLE "public"."FoalingOutcome"
  RENAME COLUMN "postBirthHeatNotes" TO "postFoalingHeatNotes";

-- 5. Drop new foreign key constraints
ALTER TABLE ONLY "public"."AnimalReproductiveHistory"
  DROP CONSTRAINT IF EXISTS "AnimalReproductiveHistory_animalId_fkey";
ALTER TABLE ONLY "public"."AnimalReproductiveHistory"
  DROP CONSTRAINT IF EXISTS "AnimalReproductiveHistory_tenantId_fkey";

-- 6. Drop new indexes
DROP INDEX IF EXISTS "public"."AnimalReproductiveHistory_animalId_key";
DROP INDEX IF EXISTS "public"."AnimalReproductiveHistory_animalId_idx";
DROP INDEX IF EXISTS "public"."AnimalReproductiveHistory_tenantId_idx";
DROP INDEX IF EXISTS "public"."AnimalReproductiveHistory_riskScore_idx";
DROP INDEX IF EXISTS "public"."AnimalReproductiveHistory_species_idx";

-- 7. Rename columns back to horse-specific names
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "totalBirths" TO "totalFoalings";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "totalLiveOffspring" TO "totalLiveFoals";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "totalComplicatedBirths" TO "totalComplicatedFoalings";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "lastBirthDate" TO "lastFoalingDate";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "lastBirthComplications" TO "lastFoalingComplications";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "lastDamCondition" TO "lastMareCondition";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "avgPostBirthHeatDays" TO "avgPostFoalingHeatDays";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "minPostBirthHeatDays" TO "minPostFoalingHeatDays";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "maxPostBirthHeatDays" TO "maxPostFoalingHeatDays";
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "lastPostBirthHeatDate" TO "lastPostFoalingHeatDate";

-- 8. Drop species column
ALTER TABLE "public"."AnimalReproductiveHistory"
  DROP COLUMN IF EXISTS "species";

-- 9. Rename column back: animalId -> mareId
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME COLUMN "animalId" TO "mareId";

-- 10. Rename primary key constraint back
ALTER TABLE "public"."AnimalReproductiveHistory"
  RENAME CONSTRAINT "AnimalReproductiveHistory_pkey" TO "MareReproductiveHistory_pkey";

-- 11. Rename table back
ALTER TABLE "public"."AnimalReproductiveHistory" RENAME TO "MareReproductiveHistory";

-- 12. Rename sequence back
ALTER SEQUENCE "public"."AnimalReproductiveHistory_id_seq"
  RENAME TO "MareReproductiveHistory_id_seq";

-- 13. Recreate original indexes
CREATE UNIQUE INDEX "MareReproductiveHistory_mareId_key"
  ON "public"."MareReproductiveHistory" USING btree ("mareId");
CREATE INDEX "MareReproductiveHistory_mareId_idx"
  ON "public"."MareReproductiveHistory" USING btree ("mareId");
CREATE INDEX "MareReproductiveHistory_tenantId_idx"
  ON "public"."MareReproductiveHistory" USING btree ("tenantId");
CREATE INDEX "MareReproductiveHistory_riskScore_idx"
  ON "public"."MareReproductiveHistory" USING btree ("riskScore");

-- 14. Recreate original foreign key constraints
ALTER TABLE ONLY "public"."MareReproductiveHistory"
  ADD CONSTRAINT "MareReproductiveHistory_mareId_fkey"
  FOREIGN KEY ("mareId") REFERENCES "public"."Animal"(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."MareReproductiveHistory"
  ADD CONSTRAINT "MareReproductiveHistory_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"(id)
  ON UPDATE CASCADE ON DELETE CASCADE;
