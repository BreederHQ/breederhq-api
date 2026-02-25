-- migrate:up
-- Add contentType column to HelpArticleEmbedding for distinguishing content sources
-- (articles, feature docs, changelogs, etc.)

ALTER TABLE "public"."HelpArticleEmbedding"
  ADD COLUMN "contentType" text NOT NULL DEFAULT 'article';

-- migrate:down
ALTER TABLE "public"."HelpArticleEmbedding"
  DROP COLUMN IF EXISTS "contentType";
