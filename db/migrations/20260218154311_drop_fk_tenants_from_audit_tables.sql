-- migrate:up
-- Step 1: Drop FK constraints on tenantId in audit/activity tables.
-- These are append-only compliance logs — referential integrity on tenantId
-- is not required and causes issues when the tenants table name differs
-- between environments. tenantId is kept as a plain INTEGER partition key.

ALTER TABLE "public"."entity_audit_log"
  DROP CONSTRAINT IF EXISTS "entity_audit_log_tenantId_fkey";

ALTER TABLE "public"."entity_activity"
  DROP CONSTRAINT IF EXISTS "entity_activity_tenantId_fkey";

-- Step 2: Backfill entity_activity from legacy domain-event tables.
-- Idempotent: uses a metadata->>'_source' tag so re-runs skip already-migrated rows.
-- Original tables are NOT touched — they still serve domain logic.

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. BreedingPlanEvent → entity_activity (BREEDING_PLAN)
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO "public"."entity_activity"
  ("tenantId", "entityType", "entityId", "kind", "category", "title", "description", "metadata", "actorId", "actorName", "createdAt")
SELECT
  e."tenantId",
  'BREEDING_PLAN',
  e."planId",
  COALESCE(e."type", 'event'),
  'event',
  COALESCE(e."label", e."type", 'Breeding plan event'),
  e."notes",
  jsonb_build_object('_source', 'BreedingPlanEvent', '_sourceId', e."id") ||
    COALESCE(e."data", '{}'::jsonb),
  e."recordedByUserId",
  NULL,
  e."createdAt"
FROM "public"."BreedingPlanEvent" e
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."entity_activity" ea
  WHERE ea."metadata"->>'_source' = 'BreedingPlanEvent'
    AND (ea."metadata"->>'_sourceId')::int = e."id"
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. OffspringEvent → entity_activity (OFFSPRING)
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO "public"."entity_activity"
  ("tenantId", "entityType", "entityId", "kind", "category", "title", "description", "metadata", "actorId", "actorName", "createdAt")
SELECT
  e."tenantId",
  'OFFSPRING',
  e."offspringId",
  COALESCE(e."type", 'event'),
  CASE
    WHEN e."type" ILIKE '%health%' THEN 'health'
    WHEN e."type" ILIKE '%status%' THEN 'status'
    ELSE 'event'
  END,
  COALESCE(e."type", 'Offspring event') ||
    CASE WHEN e."field" IS NOT NULL THEN ' (' || e."field" || ')' ELSE '' END,
  e."notes",
  jsonb_build_object('_source', 'OffspringEvent', '_sourceId', e."id",
    'field', e."field", 'before', e."before", 'after', e."after"),
  e."recordedByUserId",
  NULL,
  e."createdAt"
FROM "public"."OffspringEvent" e
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."entity_activity" ea
  WHERE ea."metadata"->>'_source' = 'OffspringEvent'
    AND (ea."metadata"->>'_sourceId')::int = e."id"
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. OffspringGroupEvent → entity_activity (LITTER)
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO "public"."entity_activity"
  ("tenantId", "entityType", "entityId", "kind", "category", "title", "description", "metadata", "actorId", "actorName", "createdAt")
SELECT
  e."tenantId",
  'LITTER',
  e."offspringGroupId",
  COALESCE(e."type", 'event'),
  CASE
    WHEN e."type" ILIKE '%status%' THEN 'status'
    ELSE 'event'
  END,
  COALESCE(e."type", 'Litter event') ||
    CASE WHEN e."field" IS NOT NULL THEN ' (' || e."field" || ')' ELSE '' END,
  e."notes",
  jsonb_build_object('_source', 'OffspringGroupEvent', '_sourceId', e."id",
    'field', e."field", 'before', e."before", 'after', e."after"),
  e."recordedByUserId",
  NULL,
  e."createdAt"
FROM "public"."OffspringGroupEvent" e
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."entity_activity" ea
  WHERE ea."metadata"->>'_source' = 'OffspringGroupEvent'
    AND (ea."metadata"->>'_sourceId')::int = e."id"
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. LitterEvent → entity_activity (LITTER)
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO "public"."entity_activity"
  ("tenantId", "entityType", "entityId", "kind", "category", "title", "description", "metadata", "actorId", "actorName", "createdAt")
SELECT
  e."tenantId",
  'LITTER',
  e."litterId",
  COALESCE(e."type", 'event'),
  CASE
    WHEN e."type" ILIKE '%status%' THEN 'status'
    ELSE 'event'
  END,
  COALESCE(e."type", 'Litter event') ||
    CASE WHEN e."field" IS NOT NULL THEN ' (' || e."field" || ')' ELSE '' END,
  e."notes",
  jsonb_build_object('_source', 'LitterEvent', '_sourceId', e."id",
    'field', e."field", 'before', e."before", 'after', e."after"),
  e."recordedByUserId",
  NULL,
  e."createdAt"
FROM "public"."LitterEvent" e
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."entity_activity" ea
  WHERE ea."metadata"->>'_source' = 'LitterEvent'
    AND (ea."metadata"->>'_sourceId')::int = e."id"
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. BreedingEvent → entity_activity (ANIMAL)
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO "public"."entity_activity"
  ("tenantId", "entityType", "entityId", "kind", "category", "title", "description", "metadata", "actorId", "actorName", "createdAt")
SELECT
  e."tenantId",
  'ANIMAL',
  e."animalId",
  COALESCE(e."eventType", 'breeding_event'),
  'event',
  COALESCE(e."title", e."eventType", 'Breeding event'),
  e."description",
  jsonb_build_object('_source', 'BreedingEvent', '_sourceId', e."id",
    'outcome', e."outcome",
    'serviceType', e."serviceType",
    'breedingPlanId', e."breedingPlanId",
    'partnerAnimalId', e."partnerAnimalId"),
  e."createdBy",
  NULL,
  e."createdAt"
FROM "public"."BreedingEvent" e
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."entity_activity" ea
  WHERE ea."metadata"->>'_source' = 'BreedingEvent'
    AND (ea."metadata"->>'_sourceId')::int = e."id"
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. HealthEvent → entity_activity (OFFSPRING, category=health)
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO "public"."entity_activity"
  ("tenantId", "entityType", "entityId", "kind", "category", "title", "description", "metadata", "actorId", "actorName", "createdAt")
SELECT
  e."tenantId",
  'OFFSPRING',
  e."offspringId",
  'health_' || LOWER(e."kind"::text),
  'health',
  CASE e."kind"::text
    WHEN 'VACCINATION' THEN 'Vaccination: ' || COALESCE(e."vaccineCode", 'unknown')
    WHEN 'WEIGHT' THEN 'Weight recorded: ' || COALESCE(e."weightGrams"::text || 'g', 'unknown')
    WHEN 'TEST' THEN 'Health test: ' || COALESCE(e."result", 'recorded')
    ELSE 'Health event: ' || e."kind"::text
  END,
  e."notes",
  jsonb_build_object('_source', 'HealthEvent', '_sourceId', e."id",
    'kind', e."kind"::text,
    'weightGrams', e."weightGrams",
    'vaccineCode', e."vaccineCode",
    'dose', e."dose",
    'vetClinic', e."vetClinic",
    'result', e."result"),
  e."recordedByUserId",
  NULL,
  e."createdAt"
FROM "public"."HealthEvent" e
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."entity_activity" ea
  WHERE ea."metadata"->>'_source' = 'HealthEvent'
    AND (ea."metadata"->>'_sourceId')::int = e."id"
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. SignatureEvent → entity_activity (CONTRACT)
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO "public"."entity_activity"
  ("tenantId", "entityType", "entityId", "kind", "category", "title", "description", "metadata", "actorId", "actorName", "createdAt")
SELECT
  e."tenantId",
  'CONTRACT',
  e."contractId",
  'signature_' || LOWER(e."status"::text),
  'document',
  CASE e."status"::text
    WHEN 'SIGNED' THEN 'Contract signed'
    WHEN 'DECLINED' THEN 'Contract declined'
    WHEN 'PENDING' THEN 'Contract sent for signature'
    WHEN 'VIEWED' THEN 'Contract viewed'
    WHEN 'EXPIRED' THEN 'Contract signature expired'
    WHEN 'VOIDED' THEN 'Contract voided'
    ELSE 'Signature event: ' || e."status"::text
  END,
  e."message",
  jsonb_build_object('_source', 'SignatureEvent', '_sourceId', e."id",
    'status', e."status"::text,
    'partyId', e."partyId"),
  NULL,
  NULL,
  e."at"
FROM "public"."SignatureEvent" e
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."entity_activity" ea
  WHERE ea."metadata"->>'_source' = 'SignatureEvent'
    AND (ea."metadata"->>'_sourceId')::int = e."id"
);

-- migrate:down
-- No rollback for data backfill — rows identifiable by metadata->>'_source'.
-- FK constraints intentionally not restored.
