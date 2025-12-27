-- Add tenantId column to AnimalTraitValue (nullable initially for safe backfill)
ALTER TABLE "AnimalTraitValue" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;

-- Backfill tenantId from Animal.tenantId via animalId
UPDATE "AnimalTraitValue" atv
SET "tenantId" = a."tenantId"
FROM "Animal" a
WHERE a."id" = atv."animalId"
  AND atv."tenantId" IS NULL;

-- Verify backfill (manual check - run this query before proceeding)
-- SELECT count(*) FROM "AnimalTraitValue" WHERE "tenantId" IS NULL;
-- Expected result: 0

-- Set NOT NULL constraint after backfill
ALTER TABLE "AnimalTraitValue" ALTER COLUMN "tenantId" SET NOT NULL;

-- Add index on tenantId for performance
CREATE INDEX IF NOT EXISTS "AnimalTraitValue_tenantId_idx" ON "AnimalTraitValue" ("tenantId");

-- Add foreign key constraint to Tenant
ALTER TABLE "AnimalTraitValue"
ADD CONSTRAINT "AnimalTraitValue_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
