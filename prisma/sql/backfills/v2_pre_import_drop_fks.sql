-- v2_pre_import_drop_fks.sql
-- Temporarily drops all FK constraints before data import.
-- Constraints are backed up to _bhq_fk_backup for restoration.
--
-- This is required because Neon (managed Postgres) does not allow
-- DISABLE TRIGGER ALL for non-superusers. Instead, we drop FKs,
-- import data, then restore FKs.

-- Create backup table if not exists
CREATE TABLE IF NOT EXISTS _bhq_fk_backup (
  conname TEXT NOT NULL,
  relname TEXT NOT NULL,
  condef TEXT NOT NULL
);

-- Clear any previous backup
TRUNCATE TABLE _bhq_fk_backup;

-- Backup all FK constraints
INSERT INTO _bhq_fk_backup (conname, relname, condef)
SELECT
  c.conname,
  c.conrelid::regclass::text AS relname,
  pg_get_constraintdef(c.oid, true) AS condef
FROM pg_constraint c
WHERE c.contype = 'f'
  AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Report what we're about to drop
DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count FROM _bhq_fk_backup;
  RAISE NOTICE 'Backing up and dropping % FK constraints...', fk_count;
END $$;

-- Dynamically drop all FK constraints
-- Note: relname is already quoted by regclass::text, so use %s not %I
DO $$
DECLARE
  r RECORD;
  drop_sql TEXT;
BEGIN
  FOR r IN SELECT conname, relname FROM _bhq_fk_backup ORDER BY relname, conname
  LOOP
    -- Safety: skip null relnames (should not happen)
    IF r.relname IS NULL THEN
      RAISE NOTICE 'Skipping constraint % with NULL relname', r.conname;
      CONTINUE;
    END IF;

    -- relname from regclass::text is already properly quoted/schema-qualified
    -- conname needs %I quoting
    drop_sql := format('ALTER TABLE %s DROP CONSTRAINT %I', r.relname, r.conname);
    RAISE NOTICE 'Dropping: %.%', r.relname, r.conname;
    EXECUTE drop_sql;
  END LOOP;
END $$;

-- Confirm completion
DO $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  IF remaining > 0 THEN
    RAISE EXCEPTION 'Failed to drop all FKs, % remaining', remaining;
  END IF;

  RAISE NOTICE 'All FK constraints dropped successfully.';
END $$;
