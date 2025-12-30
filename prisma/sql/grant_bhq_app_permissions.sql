-- grant_bhq_app_permissions.sql
-- Grants runtime permissions to bhq_app role for v2 database
--
-- Run this ONCE after v2 schema is applied by bhq_migrator.
-- The migrator owns all tables; this grants bhq_app access for runtime queries.
--
-- Usage:
--   psql $DATABASE_DIRECT_URL -f prisma/sql/grant_bhq_app_permissions.sql
--
-- This script is idempotent and safe to run multiple times.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Schema usage
-- ═══════════════════════════════════════════════════════════════════════════
GRANT USAGE ON SCHEMA public TO bhq_app;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Table permissions (SELECT, INSERT, UPDATE, DELETE)
-- ═══════════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bhq_app;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Sequence permissions (for auto-increment columns)
--    UPDATE is required for nextval() calls during INSERT
-- ═══════════════════════════════════════════════════════════════════════════
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO bhq_app;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Default privileges for FUTURE tables and sequences
--    (ensures new migrations automatically grant to bhq_app)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bhq_app;

ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO bhq_app;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Verification query (optional - shows granted privileges)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  table_count INTEGER;
  seq_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.role_table_grants
  WHERE grantee = 'bhq_app' AND table_schema = 'public';

  SELECT COUNT(*) INTO seq_count
  FROM information_schema.role_usage_grants
  WHERE grantee = 'bhq_app' AND object_schema = 'public';

  RAISE NOTICE '✓ bhq_app granted access to % tables and % sequences', table_count, seq_count;
END $$;
