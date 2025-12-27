-- Backfill Document.scope = 'animal' for animal documents
--
-- CONTEXT:
-- DocumentScope.ANIMAL enum value was added in a corrective pass.
-- Previously, animal documents were incorrectly created with scope='offspring'.
-- This script corrects all existing animal documents to use the proper scope.
--
-- SAFETY CONDITIONS:
-- - Only update rows where animalId IS NOT NULL (it's an animal document)
-- - Only update rows where scope = 'offspring' (needs correction)
-- - Only update rows where offspringId IS NULL (safety: not a genuine offspring document)
--
-- RUN INSTRUCTIONS:
-- psql -h localhost -U your_user -d breederhq_dev -f prisma/sql/backfills/20251227_backfill_document_scope_animal.sql
--
-- VERIFICATION (before and after):
-- SELECT count(*) FROM "Document"
-- WHERE "animalId" IS NOT NULL
--   AND "scope" = 'offspring'
--   AND "offspringId" IS NULL;
-- Expected after backfill: 0

BEGIN;

-- Update animal documents to use scope='animal' and report actual rows modified
WITH updated AS (
  UPDATE "Document"
  SET "scope" = 'animal'
  WHERE "animalId" IS NOT NULL
    AND "scope" = 'offspring'
    AND "offspringId" IS NULL
  RETURNING 1
)
SELECT
  'Backfill complete. Updated ' || count(*) || ' documents to scope=''animal''' AS result
FROM updated;

COMMIT;
