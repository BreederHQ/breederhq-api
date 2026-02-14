-- Re-grant marketplace schema permissions to bhq_app
-- Previous grants may have been lost after schema changes or database restore

GRANT USAGE ON SCHEMA marketplace TO bhq_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA marketplace TO bhq_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA marketplace TO bhq_app;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA marketplace TO bhq_app;

-- Ensure future objects created by bhq_migrator are also accessible
ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA marketplace GRANT ALL ON TABLES TO bhq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA marketplace GRANT ALL ON SEQUENCES TO bhq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bhq_migrator IN SCHEMA marketplace GRANT ALL ON FUNCTIONS TO bhq_app;
