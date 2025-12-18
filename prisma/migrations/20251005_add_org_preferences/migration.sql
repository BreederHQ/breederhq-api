ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "preferences" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "Organization_preferences_gin"
ON "Organization"
USING GIN ("preferences" jsonb_path_ops);