-- migrate:up
-- Fix vector dimension mismatch: voyage-3-lite returns 512 dims, not 1024.
-- The HelpArticleEmbedding table is empty so this ALTER is instant.

-- Drop the old IVFFlat index (dimension-specific)
DROP INDEX IF EXISTS "idx_help_article_embedding_vector";

-- Change column from vector(1024) to vector(512)
ALTER TABLE "public"."HelpArticleEmbedding"
  ALTER COLUMN "embedding" TYPE vector(512);

-- Recreate the IVFFlat index for 512-dim vectors
CREATE INDEX "idx_help_article_embedding_vector"
  ON "public"."HelpArticleEmbedding"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 20);

-- migrate:down
DROP INDEX IF EXISTS "idx_help_article_embedding_vector";
ALTER TABLE "public"."HelpArticleEmbedding"
  ALTER COLUMN "embedding" TYPE vector(1024);
CREATE INDEX "idx_help_article_embedding_vector"
  ON "public"."HelpArticleEmbedding"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 20);
