-- Convert AnimalTraitValue from old traitKey schema to new traitDefinitionId schema

-- Step 1: Rename old columns (preserve data temporarily)
ALTER TABLE "AnimalTraitValue" RENAME COLUMN "traitKey" TO "traitKey_old";
ALTER TABLE "AnimalTraitValue" RENAME COLUMN "boolValue" TO "valueBoolean_temp";
ALTER TABLE "AnimalTraitValue" RENAME COLUMN "textValue" TO "valueText_temp";
ALTER TABLE "AnimalTraitValue" RENAME COLUMN "dateValue" TO "valueDate_temp";
ALTER TABLE "AnimalTraitValue" RENAME COLUMN "fileReference" TO "fileReference_temp";

-- Step 2: Add new columns with correct types
ALTER TABLE "AnimalTraitValue" ADD COLUMN "traitDefinitionId" INTEGER;
ALTER TABLE "AnimalTraitValue" ADD COLUMN "valueBoolean" BOOLEAN;
ALTER TABLE "AnimalTraitValue" ADD COLUMN "valueNumber" DOUBLE PRECISION;
ALTER TABLE "AnimalTraitValue" ADD COLUMN "valueText" TEXT;
ALTER TABLE "AnimalTraitValue" ADD COLUMN "valueDate" TIMESTAMP(3);
ALTER TABLE "AnimalTraitValue" ADD COLUMN "valueJson" JSONB;
ALTER TABLE "AnimalTraitValue" ADD COLUMN "status" "TraitStatus";
ALTER TABLE "AnimalTraitValue" ADD COLUMN "performedAt" TIMESTAMP(3);
ALTER TABLE "AnimalTraitValue" ADD COLUMN "source" "TraitSource";
ALTER TABLE "AnimalTraitValue" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "AnimalTraitValue" ADD COLUMN "notes" TEXT;

-- Step 3: Create TraitDefinition records for any existing traitKeys in production
-- This creates global trait definitions for any trait keys that exist in the data
INSERT INTO "TraitDefinition" (
  "tenantId",
  "species",
  "key",
  "displayName",
  "category",
  "valueType",
  "requiresDocument",
  "marketplaceVisibleDefault",
  "createdAt",
  "updatedAt"
)
SELECT DISTINCT
  atv."tenantId",
  a."species",
  atv."traitKey_old" as "key",
  atv."traitKey_old" as "displayName",  -- Use key as display name initially
  'MIGRATED' as "category",             -- Mark these as migrated
  CASE
    WHEN atv."valueBoolean_temp" IS NOT NULL THEN 'BOOLEAN'::"TraitValueType"
    WHEN atv."valueDate_temp" IS NOT NULL THEN 'DATE'::"TraitValueType"
    ELSE 'TEXT'::"TraitValueType"
  END as "valueType",
  false as "requiresDocument",
  atv."marketplaceVisible" as "marketplaceVisibleDefault",
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "AnimalTraitValue" atv
JOIN "Animal" a ON a."id" = atv."animalId"
WHERE NOT EXISTS (
  SELECT 1 FROM "TraitDefinition" td
  WHERE td."species" = a."species"
    AND td."key" = atv."traitKey_old"
    AND td."tenantId" = atv."tenantId"
);

-- Step 4: Backfill traitDefinitionId by looking up the matching TraitDefinition
UPDATE "AnimalTraitValue" atv
SET "traitDefinitionId" = td."id"
FROM "Animal" a, "TraitDefinition" td
WHERE a."id" = atv."animalId"
  AND td."species" = a."species"
  AND td."key" = atv."traitKey_old"
  AND td."tenantId" = atv."tenantId";

-- Step 5: Copy data from old columns to new columns
UPDATE "AnimalTraitValue"
SET
  "valueBoolean" = "valueBoolean_temp",
  "valueText" = "valueText_temp",
  "valueDate" = "valueDate_temp";

-- Step 6: Set NOT NULL constraint on traitDefinitionId
ALTER TABLE "AnimalTraitValue" ALTER COLUMN "traitDefinitionId" SET NOT NULL;

-- Step 7: Drop old columns
ALTER TABLE "AnimalTraitValue" DROP COLUMN "traitKey_old";
ALTER TABLE "AnimalTraitValue" DROP COLUMN "valueBoolean_temp";
ALTER TABLE "AnimalTraitValue" DROP COLUMN "valueText_temp";
ALTER TABLE "AnimalTraitValue" DROP COLUMN "valueDate_temp";
ALTER TABLE "AnimalTraitValue" DROP COLUMN "fileReference_temp";

-- Step 8: Update indexes - drop old unique constraint and create new one
DROP INDEX IF EXISTS "AnimalTraitValue_animalId_traitKey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "AnimalTraitValue_tenantId_animalId_traitDefinitionId_key"
  ON "AnimalTraitValue"("tenantId", "animalId", "traitDefinitionId");

-- Step 9: Add new indexes for performance
CREATE INDEX IF NOT EXISTS "AnimalTraitValue_tenantId_animalId_idx"
  ON "AnimalTraitValue"("tenantId", "animalId");
CREATE INDEX IF NOT EXISTS "AnimalTraitValue_tenantId_traitDefinitionId_idx"
  ON "AnimalTraitValue"("tenantId", "traitDefinitionId");

-- Step 10: Add foreign key to TraitDefinition
ALTER TABLE "AnimalTraitValue"
ADD CONSTRAINT "AnimalTraitValue_traitDefinitionId_fkey"
FOREIGN KEY ("traitDefinitionId") REFERENCES "TraitDefinition"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
