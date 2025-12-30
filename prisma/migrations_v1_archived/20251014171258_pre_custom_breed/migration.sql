-- Pre-Custom Breed Cleanup
-- add_custom_breed tries to drop/add columns without idempotency
-- Drop columns it will add, ensure constraints/indexes exist for dropping

-- Drop columns that next migration will add (from baseline completion)
ALTER TABLE "CustomBreed" DROP COLUMN IF EXISTS "createdByOrganizationId" CASCADE;
ALTER TABLE "CustomBreed" DROP COLUMN IF EXISTS "tenantId" CASCADE;

-- Add organizationId column to CustomBreed if not exists (for FK creation)
ALTER TABLE "CustomBreed" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER;

-- Create FK constraint if not exists (will be dropped by next migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomBreed_organizationId_fkey'
  ) THEN
    ALTER TABLE "CustomBreed" ADD CONSTRAINT "CustomBreed_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Drop indexes that next migration will create (from baseline completion)
DROP INDEX IF EXISTS "Animal_tenantId_customBreedId_idx";
DROP INDEX IF EXISTS "CustomBreed_tenantId_species_idx";
DROP INDEX IF EXISTS "CustomBreed_id_tenantId_key";
DROP INDEX IF EXISTS "CustomBreed_tenantId_species_name_key";

-- Create indexes that next migration will drop
CREATE INDEX IF NOT EXISTS "Animal_customBreedId_idx" ON "Animal"("customBreedId");
CREATE INDEX IF NOT EXISTS "CustomBreed_organizationId_species_idx" ON "CustomBreed"("organizationId", "species");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomBreed_organizationId_species_name_key" ON "CustomBreed"("organizationId", "species", "name");

-- Add FK for Animal.customBreedId if not exists (will be dropped by next migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Animal_customBreedId_fkey'
  ) THEN
    ALTER TABLE "Animal" ADD CONSTRAINT "Animal_customBreedId_fkey"
    FOREIGN KEY ("customBreedId") REFERENCES "CustomBreed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
