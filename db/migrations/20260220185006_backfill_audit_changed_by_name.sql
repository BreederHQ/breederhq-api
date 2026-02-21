-- migrate:up
-- Backfill changedByName from User table for all audit entries missing a display name.
UPDATE "public"."entity_audit_log" AS a
SET "changedByName" = TRIM(CONCAT(u."firstName", ' ', u."lastName"))
FROM "public"."User" AS u
WHERE a."changedBy" = u.id
  AND (a."changedByName" IS NULL OR a."changedByName" = '');

-- migrate:down
-- Backfill is not reversible — names were correct but missing.
