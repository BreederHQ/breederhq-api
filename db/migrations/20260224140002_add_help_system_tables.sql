-- migrate:up
-- Help system tables: RAG embeddings, user preferences, query analytics.
-- Requires pgvector extension (NeonDB supports this natively).

CREATE EXTENSION IF NOT EXISTS vector;

-- Chunked help article content with vector embeddings for semantic search.
-- Long articles are split into ~800-token chunks; each chunk gets its own row.
-- contentHash enables incremental re-indexing (skip unchanged articles).
CREATE TABLE "public"."HelpArticleEmbedding" (
  "id"           SERIAL PRIMARY KEY,
  "slug"         TEXT NOT NULL,
  "chunkIndex"   INTEGER NOT NULL DEFAULT 0,
  "title"        TEXT NOT NULL,
  "module"       TEXT NOT NULL,
  "tags"         TEXT[] NOT NULL DEFAULT '{}',
  "summary"      TEXT,
  "chunkText"    TEXT NOT NULL,
  "embedding"    vector(1024) NOT NULL,
  "contentHash"  TEXT NOT NULL,
  "metadata"     JSONB NOT NULL DEFAULT '{}',
  "indexedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "HelpArticleEmbedding_slug_chunkIndex_key" UNIQUE ("slug", "chunkIndex")
);

CREATE INDEX "idx_help_article_embedding_module" ON "public"."HelpArticleEmbedding" ("module");
CREATE INDEX "idx_help_article_embedding_tags" ON "public"."HelpArticleEmbedding" USING GIN ("tags");
-- IVFFlat index for approximate nearest-neighbor cosine search.
-- lists=20 is appropriate for <10K vectors; tune upward as content grows.
CREATE INDEX "idx_help_article_embedding_vector"
  ON "public"."HelpArticleEmbedding"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 20);

-- Per-user help preferences: which tours have been seen/dismissed.
-- Keyed by userId only (not tenant-scoped) — tour completion is personal.
CREATE TABLE "public"."UserHelpPreference" (
  "id"              SERIAL PRIMARY KEY,
  "userId"          TEXT NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "toursCompleted"  TEXT[] NOT NULL DEFAULT '{}',
  "toursDismissed"  TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "UserHelpPreference_userId_key" UNIQUE ("userId")
);

-- AI query audit log: analytics, rate limiting, and feedback collection.
-- Rate limit is enforced by counting rows WHERE userId = ? AND DATE(createdAt) = TODAY.
CREATE TABLE "public"."HelpQueryLog" (
  "id"             SERIAL PRIMARY KEY,
  "userId"         TEXT NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "tenantId"       INTEGER NOT NULL,
  "query"          TEXT NOT NULL,
  "response"       TEXT,
  "sourceSlugs"    TEXT[] NOT NULL DEFAULT '{}',
  "feedbackRating" SMALLINT,
  "feedbackText"   TEXT,
  "modelUsed"      TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  "tokenCount"     INTEGER,
  "latencyMs"      INTEGER,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_help_query_log_userId" ON "public"."HelpQueryLog" ("userId");
CREATE INDEX "idx_help_query_log_tenantId" ON "public"."HelpQueryLog" ("tenantId");
-- Composite index for efficient rate limit queries (WHERE userId = ? AND createdAt >= CURRENT_DATE)
-- DATE() is STABLE not IMMUTABLE, so we index the raw timestamp column instead.
CREATE INDEX "idx_help_query_log_user_day"
  ON "public"."HelpQueryLog" ("userId", "createdAt");

-- migrate:down
DROP TABLE IF EXISTS "public"."HelpQueryLog";
DROP TABLE IF EXISTS "public"."UserHelpPreference";
DROP TABLE IF EXISTS "public"."HelpArticleEmbedding";
-- Note: vector extension not dropped — may be used by other features.
