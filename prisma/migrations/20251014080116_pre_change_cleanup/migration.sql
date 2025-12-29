-- Pre-Change Cleanup
-- The change migration tries to CREATE tables and indexes that already exist
-- Drop them so change migration can recreate with new schema

DROP TABLE IF EXISTS "BreedRegistryLink" CASCADE;
DROP TABLE IF EXISTS "Breed" CASCADE;
DROP INDEX IF EXISTS "Animal_canonicalBreedId_idx";
DROP INDEX IF EXISTS "Animal_customBreedId_idx";
