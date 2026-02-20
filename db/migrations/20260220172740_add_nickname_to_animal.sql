-- migrate:up
-- Add nullable nickname (call name) column to Animal table
ALTER TABLE "public"."Animal"
  ADD COLUMN "nickname" text;

-- migrate:down
ALTER TABLE "public"."Animal"
  DROP COLUMN IF EXISTS "nickname";
