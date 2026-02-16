-- Grant permissions to bhq_app user for marketplace schema
-- Wrapped in conditional block: shadow database (used by prisma migrate dev) lacks custom roles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bhq_app') THEN
    GRANT USAGE ON SCHEMA marketplace TO bhq_app;
    GRANT ALL ON ALL TABLES IN SCHEMA marketplace TO bhq_app;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA marketplace TO bhq_app;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA marketplace TO bhq_app;

    ALTER DEFAULT PRIVILEGES IN SCHEMA marketplace GRANT ALL ON TABLES TO bhq_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA marketplace GRANT ALL ON SEQUENCES TO bhq_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA marketplace GRANT ALL ON FUNCTIONS TO bhq_app;
  END IF;
END
$$;
