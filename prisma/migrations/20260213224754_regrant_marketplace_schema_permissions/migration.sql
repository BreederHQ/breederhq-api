-- Re-grant marketplace schema permissions to bhq_app
-- Previous grants may have been lost after schema changes or database restore
-- Wrapped in conditional block: shadow database (used by prisma migrate dev) lacks custom roles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bhq_app') THEN
    GRANT USAGE ON SCHEMA marketplace TO bhq_app;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA marketplace TO bhq_app;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA marketplace TO bhq_app;
    GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA marketplace TO bhq_app;
  END IF;

  -- Ensure future objects created by bhq_migrator are also accessible
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bhq_migrator')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bhq_app') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA marketplace GRANT ALL ON TABLES TO bhq_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA marketplace GRANT ALL ON SEQUENCES TO bhq_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA marketplace GRANT ALL ON FUNCTIONS TO bhq_app;
  END IF;
END
$$;
