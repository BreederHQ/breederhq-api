-- Apply Dbmate Baseline
--
-- Run this ONCE against each existing database (dev and prod) to register
-- the baseline migration as "already applied" without executing it.
--
-- The baseline migration contains the full schema DDL, but since your
-- databases already have this schema (from 174 Prisma migrations), we
-- just need to tell dbmate "this one is done."
--
-- Usage:
--   Dev:  psql $DATABASE_URL -f scripts/migrations/apply-dbmate-baseline.sql
--   Prod: psql $DATABASE_URL -f scripts/migrations/apply-dbmate-baseline.sql
--
-- Or via any SQL client connected to your Neon database.

-- Create the schema_migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version VARCHAR(255) PRIMARY KEY
);

-- Mark the baseline migration as applied
INSERT INTO public.schema_migrations (version)
VALUES ('20260216185145')
ON CONFLICT (version) DO NOTHING;

-- Verify
SELECT version FROM public.schema_migrations ORDER BY version;
