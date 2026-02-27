-- migrate:up
-- Platform-level analytics table for nightly AI Copilot quality reports.
-- Not tenant-scoped — this is super admin / platform analytics only.
-- Stores AI-generated analysis of low-rated and unrated Copilot queries.

CREATE TABLE "public"."CopilotQualityReport" (
  "id" SERIAL PRIMARY KEY,
  "reportDate" date NOT NULL,
  "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "periodStart" timestamp(3) without time zone NOT NULL,
  "periodEnd" timestamp(3) without time zone NOT NULL,
  "totalQueries" integer NOT NULL DEFAULT 0,
  "ratedCount" integer NOT NULL DEFAULT 0,
  "thumbsUpCount" integer NOT NULL DEFAULT 0,
  "thumbsDownCount" integer NOT NULL DEFAULT 0,
  "satisfactionRate" double precision,
  "topQueryTopics" jsonb DEFAULT '[]',
  "failurePatterns" jsonb DEFAULT '[]',
  "aiAnalysis" text,
  "queriesSampled" jsonb DEFAULT '[]',
  "modelUsed" text,
  "tokenCount" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) without time zone NOT NULL
);

-- Unique constraint: one report per day
CREATE UNIQUE INDEX "CopilotQualityReport_reportDate_key"
  ON "public"."CopilotQualityReport" USING btree ("reportDate");

CREATE INDEX "CopilotQualityReport_generatedAt_idx"
  ON "public"."CopilotQualityReport" USING btree ("generatedAt");

-- migrate:down
DROP TABLE IF EXISTS "public"."CopilotQualityReport";
