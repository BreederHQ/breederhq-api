-- migrate:up
-- Remove the Volhard PAT benchmark protocol and its stages/activities.
-- Temperament assessments are now a first-class offspring feature (AssessmentResult table),
-- no longer modeled as rearing protocols.
-- AssessmentResult.assignmentId is SET NULL on delete (from prior migration),
-- so existing assessment results survive with assignmentId = NULL.

-- 1. Delete tenant-level assignments referencing this benchmark protocol.
--    AssessmentResult.assignmentId → SET NULL (preserves assessment data).
DELETE FROM public."RearingProtocolAssignment"
WHERE "protocolId" IN (
  SELECT id FROM public."RearingProtocol"
  WHERE name = 'Volhard Puppy Aptitude Test (PAT)'
    AND "isBenchmark" = true
    AND "tenantId" IS NULL
);

-- 2. Delete activities (children of stages)
DELETE FROM public."RearingProtocolActivity"
WHERE "stageId" IN (
  SELECT s.id FROM public."RearingProtocolStage" s
  JOIN public."RearingProtocol" p ON s."protocolId" = p.id
  WHERE p.name = 'Volhard Puppy Aptitude Test (PAT)'
    AND p."isBenchmark" = true
    AND p."tenantId" IS NULL
);

-- 3. Delete stages
DELETE FROM public."RearingProtocolStage"
WHERE "protocolId" IN (
  SELECT id FROM public."RearingProtocol"
  WHERE name = 'Volhard Puppy Aptitude Test (PAT)'
    AND "isBenchmark" = true
    AND "tenantId" IS NULL
);

-- 4. Delete the protocol itself
DELETE FROM public."RearingProtocol"
WHERE name = 'Volhard Puppy Aptitude Test (PAT)'
  AND "isBenchmark" = true
  AND "tenantId" IS NULL;

-- migrate:down
-- Re-seeding would be handled by the seed script; no automatic rollback.
-- Run: npx tsx prisma/seed/seed-rearing-benchmarks.ts
