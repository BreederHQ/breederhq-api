-- Fix marketplace schema permissions
-- The previous migration didn't work because ALTER DEFAULT PRIVILEGES only applies to future objects
-- We need to grant on existing tables that were created by bhq_migrator
-- Wrapped in conditional block: shadow database (used by prisma migrate dev) lacks custom roles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bhq_app') THEN
    GRANT USAGE ON SCHEMA marketplace TO bhq_app;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA marketplace TO bhq_app;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA marketplace TO bhq_app;
    GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA marketplace TO bhq_app;
  END IF;

  -- Set default privileges for bhq_migrator (who creates the tables)
  -- This ensures future tables created by migrations are accessible to bhq_app
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bhq_migrator')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bhq_app') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA marketplace GRANT ALL ON TABLES TO bhq_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA marketplace GRANT ALL ON SEQUENCES TO bhq_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA marketplace GRANT ALL ON FUNCTIONS TO bhq_app;
  END IF;
END
$$;
