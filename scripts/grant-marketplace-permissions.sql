-- Manual permission grant for marketplace schema
-- Run this directly on the database with a superuser account

-- Grant usage on schema
GRANT USAGE ON SCHEMA marketplace TO bhq_app;

-- Grant all privileges on existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA marketplace TO bhq_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA marketplace TO bhq_app;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA marketplace TO bhq_app;

-- Set default privileges for future objects created by bhq_migrator
ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA marketplace
    GRANT ALL PRIVILEGES ON TABLES TO bhq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA marketplace
    GRANT ALL PRIVILEGES ON SEQUENCES TO bhq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA marketplace
    GRANT ALL PRIVILEGES ON FUNCTIONS TO bhq_app;

-- Verify grants
SELECT
    grantee,
    table_schema,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'marketplace'
    AND grantee = 'bhq_app'
ORDER BY table_name, privilege_type;
