-- migrate:up
-- Add mode column to HelpQueryLog to distinguish copilot vs ai-assistant queries.
-- Existing rows default to 'assistant' since the copilot was added after the assistant.

ALTER TABLE "public"."HelpQueryLog"
  ADD COLUMN "mode" text NOT NULL DEFAULT 'assistant';

CREATE INDEX "HelpQueryLog_mode_idx"
  ON "public"."HelpQueryLog" USING btree ("mode");

-- migrate:down
ALTER TABLE "public"."HelpQueryLog"
  DROP COLUMN IF EXISTS "mode";
